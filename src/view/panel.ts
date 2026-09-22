import type { DeviceInstance, PanelId, QuestionDef, TerminalDef, Wire } from '../model/types';
import { defOf, ROLE_COLOR } from '../library';
import type { Simulator } from '../engine/simulator';
import { routeWire, type Pt } from './routing';
import { preSource, spareTerminals } from '../model/preWired';

const NS = 'http://www.w3.org/2000/svg';
const el = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, cls?: string): SVGElementTagNameMap[K] => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (cls) e.setAttribute('class', cls);
  return e;
};
/** 小端子台上排（考場引接）螺絲的 y (mm) */
const TB_TOP = 6;

const text = (x: number, y: number, s: string, size: number, cls: string, anchor?: string): SVGTextElement => {
  const t = el('text', { x, y, 'font-size': size }, cls);
  if (anchor) t.setAttribute('text-anchor', anchor);
  t.textContent = s;
  return t;
};

export interface PanelEvents {
  terminalClick(tid: string): void;
  terminalHover(tid: string | null, x: number, y: number): void;
  deviceHover(devId: string | null): void;
  deviceClick(devId: string): void;
  wireClick(wid: string): void;
  wireHover(wid: string | null): void;
  backgroundClick(): void;
  press(devId: string, down: boolean): void;
  nfbToggle(): void;
  canWire(): boolean;
  countAt(tid: string): number;
  viewChanged(): void;
}

interface View { x: number; y: number; k: number }

/** 單一面板（器具板 / 操作面板）的 SVG 視圖 */
export class PanelView {
  readonly root: HTMLElement;
  readonly svg: SVGSVGElement;
  private world: SVGGElement;
  private wireLayer!: SVGGElement;
  private hlLayer!: SVGGElement;
  private rubber!: SVGPolylineElement;
  private devices: DeviceInstance[];
  private ducts;
  private mirror: boolean;
  private termPos = new Map<string, Pt>();
  private termEls = new Map<string, SVGGElement>();
  private termLabels = new Map<string, SVGTextElement>();
  /** 考場引接線要落在哪一點（小端子台為上排螺絲，其餘為端子本身） */
  private preAnchor = new Map<string, Pt>();
  private spares: Set<string>;
  private deviceEls = new Map<string, SVGGElement>();
  private view: View = { x: 0, y: 0, k: 1 };
  private sim: Simulator | null = null;
  private pendingTid: string | null = null;
  private wires: Wire[] = [];
  private knownWireIds = new Set<string>();
  private pointers = new Map<number, Pt>();
  private drag: { start: Pt; view: View; moved: boolean; target: Element | null; dev: string | null } | null = null;
  private pinchDist = 0;
  private hoverTid: string | null = null;
  private hoverDev: string | null = null;
  private hoverWire: string | null = null;

  constructor(container: HTMLElement, readonly q: QuestionDef, readonly panelId: PanelId, private ev: PanelEvents) {
    const P = q.panels[panelId];
    this.spares = spareTerminals(q);
    this.mirror = !!P.mirror;
    const mx = (x: number, w: number) => this.mirror ? P.w - x - w : x;
    this.devices = q.devices.filter(d => d.panel === panelId).map(d => ({ ...d, x: mx(d.x, d.w ?? defOf(d.kind).w) }));
    this.ducts = q.ducts.filter(d => d.panel === panelId).map(d => ({ ...d, x: mx(d.x, d.w) }));

    this.root = container;
    container.innerHTML = `<div class="panel-head"><span class="name">${P.name}</span>${P.note ? `<span class="note">${P.note}</span>` : ''}</div>
      <div class="zoom"><button data-z="in" title="放大">＋</button><button data-z="out" title="縮小">－</button><button data-z="fit" title="置中 (F)">⤢</button></div>`;
    this.svg = el('svg', { xmlns: NS });
    this.world = el('g', {}, 'world');
    this.svg.appendChild(this.world);
    this.buildStatic();
    container.appendChild(this.svg);
    for (const g of this.svg.querySelectorAll<SVGGElement>('g.term')) this.termEls.set(g.getAttribute('data-tid')!, g);
    container.querySelectorAll<HTMLButtonElement>('[data-z]').forEach(b => b.onclick = () => {
      const z = b.dataset.z;
      if (z === 'fit') this.fit(); else this.zoomBy(z === 'in' ? 1.3 : 1 / 1.3);
    });
    this.bindPointer();
    requestAnimationFrame(() => this.fit());
    new ResizeObserver(() => this.fit()).observe(container);
  }

  /* ================= 靜態繪製 ================= */
  private buildStatic(): void {
    const p = this.q.panels[this.panelId];
    this.world.appendChild(el('rect', { x: 0, y: 0, width: p.w, height: p.h, rx: 4 }, 'board'));
    for (const d of this.ducts) this.world.appendChild(el('rect', { x: d.x, y: d.y, width: d.w, height: d.h, rx: 1 }, 'duct'));
    for (const d of this.devices) this.world.appendChild(this.drawDevice(d));
    this.drawPreWired();
    this.wireLayer = el('g', {}, 'wires');
    this.hlLayer = el('g', {}, 'hl-layer');
    this.rubber = el('polyline', {}, 'rubber');
    this.rubber.style.display = 'none';
    this.world.append(this.wireLayer, this.hlLayer, this.rubber);
  }

  /** 考場已引接線（器具本體端子 → 無編號小 TB）：灰色虛線，只畫本面板內、非過門線的 passThrough */
  private drawPreWired(): void {
    const g = el('g', {}, 'prewires');
    for (const p of this.q.passThrough) {
      if (p.a.startsWith('TB3.') || p.b.startsWith('TB3.')) continue;
      const a = this.preAnchor.get(p.a) ?? this.termPos.get(p.a);
      const b = this.preAnchor.get(p.b) ?? this.termPos.get(p.b);
      if (!a || !b) continue;
      const dy = Math.max(6, Math.abs(b.y - a.y) * 0.5);
      g.appendChild(el('path', { d: `M${a.x},${a.y} C${a.x},${a.y + dy} ${b.x},${b.y - dy} ${b.x},${b.y}` }, 'prewire'));
    }
    this.world.appendChild(g);
  }

  private geom(d: DeviceInstance) {
    const def = defOf(d.kind);
    return { def, w: d.w ?? def.w, h: d.h ?? def.h };
  }
  private tx(t: TerminalDef, w: number): number { return this.mirror ? w - t.x : t.x; }

  private drawDevice(d: DeviceInstance): SVGGElement {
    const { def, w, h } = this.geom(d);
    const g = el('g', { transform: `translate(${d.x},${d.y})`, 'data-dev': d.id }, 'device');
    const label = d.label ?? d.id;
    const bodyCls = 'body' + (d.display ? ' display' : '');

    switch (d.kind) {
      case 'MC': {
        g.appendChild(el('rect', { x: 0, y: 12, width: 16, height: 72, rx: 1.5 }, 'aux-block'));
        g.appendChild(el('rect', { x: w - 16, y: 12, width: 16, height: 72, rx: 1.5 }, 'aux-block'));
        g.appendChild(el('rect', { x: 16, y: 0, width: w - 32, height: h, rx: 2 }, bodyCls));
        g.appendChild(el('rect', { x: 29, y: 8, width: 62, height: 14, rx: 1 }, 'strip'));
        g.appendChild(el('rect', { x: 29, y: h - 22, width: 62, height: 14, rx: 1 }, 'strip'));
        g.appendChild(el('rect', { x: w - 16, y: 0, width: 16, height: 10, rx: 1.5 }, 'aux-block'));
        g.appendChild(el('rect', { x: 0, y: h - 10, width: 16, height: 10, rx: 1.5 }, 'aux-block'));
        g.appendChild(text(w / 2, h / 2 + 4, label, 11, 'device-label'));
        g.appendChild(el('rect', { x: w / 2 - 6, y: h / 2 + 9, width: 12, height: 4, rx: 1, 'data-led': d.id }, 'mc-led'));
        break;
      }
      case 'TR': {
        g.appendChild(el('rect', { x: 0, y: 0, width: w, height: h, rx: 2 }, 'socket'));
        g.appendChild(el('rect', { x: 2, y: 4, width: w - 4, height: 16, rx: 1 }, 'strip'));
        g.appendChild(el('rect', { x: 2, y: h - 20, width: w - 4, height: 16, rx: 1 }, 'strip'));
        g.appendChild(el('circle', { cx: w / 2, cy: h / 2, r: 13 }, 'relay-body'));
        g.appendChild(el('circle', { cx: w / 2, cy: h / 2 - 3, r: 5.5, fill: '#fff', stroke: '#888', 'stroke-width': .5 }));
        g.appendChild(text(w / 2, h / 2 + 11, label, 7, 'device-label'));
        g.appendChild(text(w / 2, h / 2 - 1, '', 4.5, 'tr-text')).setAttribute('data-trtext', d.id);
        break;
      }
      case 'THRY': {
        g.appendChild(el('rect', { x: 0, y: 0, width: w, height: h, rx: 2 }, bodyCls));
        g.appendChild(el('rect', { x: 12, y: 2, width: 52, height: 14, rx: 1 }, 'strip'));
        g.appendChild(el('rect', { x: 12, y: h - 16, width: 52, height: 14, rx: 1 }, 'strip'));
        g.appendChild(el('rect', { x: 72, y: 3, width: 18, height: h - 6, rx: 1 }, 'aux-block'));
        g.appendChild(text(38, h / 2 + 3, label, 8, 'device-label'));
        g.appendChild(el('rect', { x: 30, y: h / 2 + 5, width: 16, height: 4, rx: 1, fill: '#333', 'data-trip': d.id }));
        break;
      }
      case 'PB': case 'PL': case 'BZ': {
        const r = w / 2;
        g.appendChild(el('circle', { cx: r, cy: r, r }, bodyCls));
        g.appendChild(el('rect', { x: 6, y: 8, width: w - 12, height: h - 16, rx: 2, fill: '#3b3f46', stroke: '#222', 'stroke-width': .6 }));
        if (d.kind === 'PB') {
          g.appendChild(el('circle', { cx: r, cy: r, r: r * 0.5, fill: d.color ?? '#999', stroke: '#222', 'stroke-width': .6, 'data-cap': d.id }, 'pb-cap'));
        } else {
          const lamp = el('circle', { cx: r, cy: r, r: r * 0.5, fill: this.dim(d.color ?? '#999'), stroke: '#222', 'stroke-width': .6, 'data-lamp': d.id });
          lamp.style.color = d.color ?? '#fff';
          g.appendChild(lamp);
        }
        g.appendChild(text(r, r + 2.6, label, 6.5, 'device-label')).setAttribute('fill', '#fff');
        break;
      }
      case 'DF': {
        g.appendChild(el('circle', { cx: w / 2, cy: h / 2, r: Math.min(w, h) / 2 }, bodyCls));
        g.appendChild(el('circle', { cx: w / 2, cy: h / 2, r: 9, fill: '#c9b458', stroke: '#555', 'stroke-width': .6, 'data-fuse': d.id }));
        g.appendChild(text(w / 2, h / 2 + 2.5, 'D-F', 5.5, 'device-label'));
        break;
      }
      case 'NFB': {
        g.appendChild(el('rect', { x: 0, y: 0, width: w, height: h, rx: 2 }, bodyCls));
        g.appendChild(el('rect', { x: 10, y: 2, width: 72, height: 14, rx: 1 }, 'strip'));
        g.appendChild(el('rect', { x: 10, y: h - 16, width: 72, height: 14, rx: 1 }, 'strip'));
        g.appendChild(el('rect', { x: w / 2 - 8, y: 26, width: 16, height: 24, rx: 2, fill: '#444', 'data-nfb': d.id }, 'nfb-handle'));
        g.appendChild(text(w / 2, 23, 'OFF', 4.5, 'device-label')).setAttribute('data-nfbtext', d.id);
        g.appendChild(text(w / 2 + 24, 40, label, 7, 'device-label'));
        break;
      }
      case 'TB16': {
        // 雙排端子台：每個腳位左右各一顆螺絲，同一金屬片；考生接線側一顆（可點），過門線側一顆（已配妥，僅顯示）
        g.appendChild(el('rect', { x: 0, y: 0, width: w, height: h, rx: 2 }, bodyCls));
        g.appendChild(text(w / 2, -5, label, 7, 'device-label'));
        const doorX = this.mirror ? 10 : w - 10;   // 過門線側朝門（器具板在右、操作面板鏡射後在左）
        const stubX = this.mirror ? -6 : w + 6;
        for (const t of def.terminals) {
          const ux = this.tx(t, w);
          g.appendChild(el('line', { x1: ux, y1: t.y, x2: doorX, y2: t.y }, 'tb-bar'));
          g.appendChild(el('circle', { cx: doorX, cy: t.y, r: 3.2 }, 'tb-screw'));
          g.appendChild(el('path', { d: `M${doorX},${t.y} L${stubX},${t.y}` }, 'prewire'));
          g.appendChild(el('line', { x1: 2, y1: t.y + 12.5, x2: w - 2, y2: t.y + 12.5 }, 'tb-sep'));
        }
        break;
      }
      case 'TBM4': case 'TBM3': {
        // 雙排端子台：上排螺絲壓考場引接線（僅顯示），下排給考生；沒引接到器具的空位整格不畫
        g.appendChild(el('rect', { x: 0, y: 0, width: w, height: h, rx: 1.5 }, bodyCls));
        g.appendChild(text(w / 2, h + 5.5, label, 4.2, 'device-sub'));
        const live = def.terminals.filter(t => !this.spares.has(`${d.id}.${t.id}`));
        const xs = def.terminals.map(t => this.tx(t, w)).sort((p1, p2) => p1 - p2);
        for (let i = 1; i < xs.length; i++) {
          const mx = (xs[i - 1] + xs[i]) / 2;
          g.appendChild(el('line', { x1: mx, y1: 2, x2: mx, y2: h - 2 }, 'tb-sep'));
        }
        for (const t of live) {
          const ux = this.tx(t, w);
          g.appendChild(el('line', { x1: ux, y1: TB_TOP, x2: ux, y2: t.y }, 'tb-bar'));
          g.appendChild(el('circle', { cx: ux, cy: TB_TOP, r: 2.4 }, 'tb-screw'));
          this.preAnchor.set(`${d.id}.${t.id}`, { x: d.x + ux, y: d.y + TB_TOP });
          // 標出這一格引接到器具的哪個接點（a 上 / b 下 / X1 / c …），顏色同接點角色
          const src = preSource(this.q, `${d.id}.${t.id}`);
          if (src) {
            const mk = text(ux, -1.8, src.label, 4.4, 'tb-mark');
            mk.setAttribute('fill', ROLE_COLOR[src.role]);
            g.appendChild(mk);
          }
        }
        break;
      }
      default: {
        g.appendChild(el('rect', { x: 0, y: 0, width: w, height: h, rx: 2 }, bodyCls));
        const size = Math.min(11, (w / Math.max(3, label.length)) * 1.4);
        g.appendChild(text(w / 2, h / 2 + size / 3, label, size, 'device-label'));
      }
    }

    // 端子
    for (const t of def.terminals) {
      const tid = `${d.id}.${t.id}`;
      if (this.spares.has(tid)) continue;
      const tx = this.tx(t, w);
      this.termPos.set(tid, { x: d.x + tx, y: d.y + t.y });
      const wireable = t.wireable !== false && !d.display;
      const tg = el('g', { 'data-tid': tid, transform: `translate(${tx},${t.y})` }, 'term' + (wireable ? '' : ' main'));
      if (wireable) {
        tg.appendChild(el('circle', { cx: 0, cy: 0, r: 5.4 }, 'halo'));
        tg.appendChild(el('circle', { cx: 0, cy: 0, r: 5.4 }, 'ring'));
        tg.appendChild(el('circle', { cx: 0, cy: 0, r: 3.4, fill: ROLE_COLOR[t.role] }, 'dot'));
        tg.appendChild(el('g', {}, 'occ-layer'));
      } else {
        tg.appendChild(el('rect', { x: -2.2, y: -2.2, width: 4.4, height: 4.4, rx: .6, fill: ROLE_COLOR[t.role] }, 'dot'));
      }
      g.appendChild(tg);
      // 標籤
      if (t.label && d.kind !== 'TBM4' && d.kind !== 'TBM3') {
        const isTB = d.kind === 'TB16';
        const inner = d.kind === 'PB' || d.kind === 'PL' || d.kind === 'BZ';
        const size = wireable ? (isTB ? 5 : 4.2) : 3.6;
        let lx = tx, ly = t.y + 8, anchor = 'middle';
        if (isTB) { lx = w / 2; ly = t.y + 1.8; anchor = 'middle'; }
        else if (d.kind === 'MC' && (t.role === 'a' || t.role === 'b')) { ly = t.y - 5.2; }
        else if (d.kind === 'MC' && t.role === 'coil') { lx = tx + (tx < w / 2 ? 9 : -9); ly = t.y + 1.6; anchor = tx < w / 2 ? 'start' : 'end'; }
        else if (inner) { ly = t.y < h / 2 ? t.y - 5 : t.y + 8.5; }
        const lbl = text(lx, ly, t.short ?? t.label, size, wireable ? 'term-label' : 'term-sub', anchor);
        if (inner) lbl.setAttribute('fill', '#e9ecf0');
        g.appendChild(lbl);
        this.termLabels.set(tid, lbl);
      }
    }
    this.deviceEls.set(d.id, g);
    return g;
  }

  private dim(color: string): string {
    const c = color.replace('#', '');
    const n = parseInt(c.length === 3 ? c.split('').map(x => x + x).join('') : c, 16);
    return `rgb(${Math.round(((n >> 16) & 255) * .35)},${Math.round(((n >> 8) & 255) * .35)},${Math.round((n & 255) * .35)})`;
  }

  /* ================= 導線 ================= */
  setWires(wires: Wire[], selected: string | null): void {
    this.wires = wires;
    this.wireLayer.replaceChildren();
    const counts = new Map<string, number>();
    for (const w of wires) {
      counts.set(w.a, (counts.get(w.a) ?? 0) + 1);
      counts.set(w.b, (counts.get(w.b) ?? 0) + 1);
      if (w.panel !== this.panelId) continue;
      const a = this.termPos.get(w.a), b = this.termPos.get(w.b);
      if (!a || !b) continue;
      const pts = routeWire(a, b, this.ducts, w.id).map(p => `${p.x},${p.y}`).join(' ');
      const hit = el('polyline', { points: pts, 'data-wire': w.id }, 'wire-hit');
      const line = el('polyline', { points: pts, 'data-wire': w.id }, 'wire' + (w.id === selected ? ' sel' : '') + (w.id === this.hoverWire ? ' hover' : ''));
      const ph = this.sim?.terminalPhase(w.a);
      if (ph) line.classList.add('live-' + ph);
      this.wireLayer.append(hit, line);
      if (!this.knownWireIds.has(w.id) && this.knownWireIds.size > 0) {
        const len = line.getTotalLength();
        line.style.strokeDasharray = `${len}`;
        line.style.strokeDashoffset = `${len}`;
        line.classList.add('draw');
        requestAnimationFrame(() => { line.style.strokeDashoffset = '0'; });
        setTimeout(() => { line.style.strokeDasharray = ''; line.classList.remove('draw'); }, 400);
      }
    }
    this.knownWireIds = new Set(wires.map(w => w.id));
    if (this.knownWireIds.size === 0) this.knownWireIds.add('__init__');
    for (const [tid, g] of this.termEls) {
      const n = counts.get(tid) ?? 0;
      g.classList.toggle('full', n >= 2);
      const occ = g.querySelector('.occ-layer');
      if (occ) {
        occ.replaceChildren();
        for (let i = 0; i < n; i++) occ.appendChild(el('circle', { cx: -1.6 + i * 3.2, cy: 0, r: 1.1 }, 'occ'));
      }
    }
  }

  setPending(tid: string | null): void {
    if (this.pendingTid) this.termEls.get(this.pendingTid)?.classList.remove('pending');
    this.pendingTid = tid;
    if (tid && this.termEls.has(tid)) this.termEls.get(tid)!.classList.add('pending');
    else this.rubber.style.display = 'none';
  }

  setTargets(tids: Iterable<string>): void {
    for (const g of this.termEls.values()) g.classList.remove('target');
    for (const t of tids) this.termEls.get(t)?.classList.add('target');
  }

  setHighlight(soft: Iterable<string>, strong: Iterable<string>): void {
    this.hlLayer.replaceChildren();
    const add = (tid: string, cls: string, r: number) => {
      const p = this.termPos.get(tid); if (!p) return;
      this.hlLayer.appendChild(el('circle', { cx: p.x, cy: p.y, r }, cls));
    };
    for (const t of soft) add(t, 'hl soft', 6.5);
    for (const t of strong) add(t, 'hl', 8.5);
  }

  setHoverTerminal(tid: string | null): void {
    if (this.hoverTid) this.termEls.get(this.hoverTid)?.classList.remove('hover');
    this.hoverTid = tid;
    if (tid) this.termEls.get(tid)?.classList.add('hover');
    this.setMuted(tid);
  }

  /** 滑過某端子時，同一器具的其他端子（含標籤）隨時間霧化、黯淡，但不完全消失 */
  private setMuted(tid: string | null): void {
    const dev = tid ? tid.slice(0, tid.lastIndexOf('.')) : null;
    const off = (id: string) => !!dev && id !== tid && id.slice(0, id.lastIndexOf('.')) === dev;
    for (const [id, g] of this.termEls) g.classList.toggle('muted', off(id));
    for (const [id, l] of this.termLabels) l.classList.toggle('muted', off(id));
  }
  setHoverWire(wid: string | null): void {
    this.hoverWire = wid;
    for (const l of this.wireLayer.querySelectorAll<SVGElement>('polyline.wire')) l.classList.toggle('hover', l.getAttribute('data-wire') === wid);
  }
  setDeviceFocus(devId: string | null): void {
    for (const [id, g] of this.deviceEls) g.classList.toggle('focus', id === devId);
  }
  setDim(on: boolean): void { this.root.classList.toggle('dim', on); }
  /** 器具在畫面上的矩形（client 座標），供彈出面板定位 */
  deviceRect(devId: string): DOMRect | null { return this.deviceEls.get(devId)?.getBoundingClientRect() ?? null; }
  /** 讓橡皮筋線跟到指定畫面座標（指標在彈出面板上時由外部呼叫） */
  rubberTo(clientX: number, clientY: number): void {
    if (!this.pendingTid) return;
    const a = this.termPos.get(this.pendingTid); if (!a) return;
    const pt = this.clientToWorld(clientX, clientY);
    this.rubber.setAttribute('points', `${a.x},${a.y} ${pt.x},${pt.y}`); this.rubber.style.display = '';
  }
  hasTerminal(tid: string): boolean { return this.termPos.has(tid); }
  hasDevice(id: string): boolean { return this.deviceEls.has(id); }

  /* ================= 模擬狀態 ================= */
  setSim(sim: Simulator | null): void {
    this.sim = sim;
    for (const d of this.devices) {
      const g = this.deviceEls.get(d.id)!;
      const s = sim?.state.get(d.id);
      if (d.kind === 'PL' || d.kind === 'BZ') {
        const lamp = g.querySelector<SVGCircleElement>('[data-lamp]')!;
        const on = !!sim && sim.energized.has(`${d.id}.${d.kind === 'PL' ? 'lamp' : 'buzzer'}`);
        lamp.setAttribute('fill', on ? (d.color ?? '#fff') : this.dim(d.color ?? '#999'));
        lamp.classList.toggle('lamp-glow', on);
      }
      if (d.kind === 'MC') g.querySelector('[data-led]')!.classList.toggle('on', !!s?.actuated);
      if (d.kind === 'TR') {
        const t = g.querySelector<SVGTextElement>('[data-trtext]')!;
        t.textContent = s?.actuated ? `${Math.max(0, (sim!.timerMs - s.timerMs) / 1000).toFixed(1)}` : '';
      }
      if (d.kind === 'THRY') g.querySelector('[data-trip]')!.setAttribute('fill', s?.tripped ? '#ff3b3b' : '#333');
      if (d.kind === 'NFB') {
        const on = !!sim?.nfbOn;
        g.querySelector('[data-nfb]')!.setAttribute('fill', on ? '#2ecc71' : '#444');
        g.querySelector<SVGTextElement>('[data-nfbtext]')!.textContent = on ? 'ON' : 'OFF';
      }
      if (d.kind === 'DF') g.querySelector('[data-fuse]')!.setAttribute('fill', s?.blown ? '#333' : '#c9b458');
    }
    for (const line of this.wireLayer.querySelectorAll<SVGPolylineElement>('polyline.wire')) {
      const w = this.wires.find(x => x.id === line.getAttribute('data-wire'));
      line.classList.remove('live-A', 'live-B', 'live-C');
      const ph = w && sim ? sim.terminalPhase(w.a) : null;
      if (ph) line.classList.add('live-' + ph);
    }
  }

  /* ================= 導覽 ================= */
  private clientToWorld(x: number, y: number): Pt {
    const r = this.svg.getBoundingClientRect();
    return { x: (x - r.left - this.view.x) / this.view.k, y: (y - r.top - this.view.y) / this.view.k };
  }
  private applyView(): void { this.world.setAttribute('transform', `translate(${this.view.x},${this.view.y}) scale(${this.view.k})`); this.ev.viewChanged(); }

  fit(): void {
    const r = this.svg.getBoundingClientRect();
    if (r.width < 10 || r.height < 10) return;
    const p = this.q.panels[this.panelId];
    const k = Math.min(r.width / (p.w + 30), (r.height - 30) / (p.h + 20));
    this.view = { k, x: (r.width - p.w * k) / 2, y: (r.height - p.h * k) / 2 + 6 };
    this.applyView();
  }
  zoomBy(f: number, cx?: number, cy?: number): void {
    const r = this.svg.getBoundingClientRect();
    const px = cx ?? r.left + r.width / 2, py = cy ?? r.top + r.height / 2;
    const pt = this.clientToWorld(px, py);
    const k = Math.max(0.3, Math.min(14, this.view.k * f));
    this.view = { k, x: px - r.left - pt.x * k, y: py - r.top - pt.y * k };
    this.applyView();
  }
  focusTerminal(tid: string, k = 3.2): void {
    const p = this.termPos.get(tid); if (!p) return;
    const r = this.svg.getBoundingClientRect();
    this.view = { k, x: r.width / 2 - p.x * k, y: r.height / 2 - p.y * k };
    this.applyView();
  }

  private hitTarget(t: Element | null): Element | null {
    return t?.closest('.term:not(.main), .wire-hit, .wire, .pb-cap, .nfb-handle') ?? null;
  }

  private bindPointer(): void {
    const svg = this.svg;
    svg.addEventListener('wheel', ev => {
      ev.preventDefault();
      this.zoomBy(Math.exp(-ev.deltaY * 0.0015), ev.clientX, ev.clientY);
    }, { passive: false });

    svg.addEventListener('pointerdown', ev => {
      svg.setPointerCapture(ev.pointerId);
      this.pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
        this.drag = null;
        return;
      }
      const target = this.hitTarget(ev.target as Element);
      // 器具要在 pointerdown 就記下來：setPointerCapture 之後 pointerup 的 target 會被改成 svg 本身
      const devDown = (ev.target as Element).closest('.device')?.getAttribute('data-dev') ?? null;
      this.drag = { start: { x: ev.clientX, y: ev.clientY }, view: { ...this.view }, moved: false, target, dev: devDown };
      const cap = (ev.target as Element).closest('.pb-cap') as SVGElement | null;
      if (cap && !this.ev.canWire()) { cap.classList.add('pressed'); this.ev.press(cap.getAttribute('data-cap')!, true); }
      if (!target) svg.classList.add('grabbing');
    });

    svg.addEventListener('pointermove', ev => {
      const pt = this.clientToWorld(ev.clientX, ev.clientY);
      if (this.pointers.has(ev.pointerId)) this.pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinchDist > 0) this.zoomBy(d / this.pinchDist, (a.x + b.x) / 2, (a.y + b.y) / 2);
        this.pinchDist = d;
        return;
      }
      if (this.drag) {
        const dx = ev.clientX - this.drag.start.x, dy = ev.clientY - this.drag.start.y;
        if (Math.hypot(dx, dy) > 5) this.drag.moved = true;
        if (this.drag.moved && !this.drag.target) {
          this.view.x = this.drag.view.x + dx; this.view.y = this.drag.view.y + dy;
          this.applyView();
        }
      }
      if (this.pendingTid) {
        const a = this.termPos.get(this.pendingTid);
        if (a) { this.rubber.setAttribute('points', `${a.x},${a.y} ${pt.x},${pt.y}`); this.rubber.style.display = ''; }
      }
    });

    const end = (ev: PointerEvent) => {
      this.pointers.delete(ev.pointerId);
      svg.classList.remove('grabbing');
      const cap = svg.querySelector('.pb-cap.pressed') as SVGElement | null;
      if (cap) { cap.classList.remove('pressed'); this.ev.press(cap.getAttribute('data-cap')!, false); }
      const d = this.drag; this.drag = null;
      if (!d || d.moved || ev.type === 'pointercancel') return;
      const t = d.target;
      if (!t) {
        if (d.dev) this.ev.deviceClick(d.dev);
        else this.ev.backgroundClick();
        return;
      }
      if (t.classList.contains('term')) { if (this.ev.canWire()) this.ev.terminalClick(t.getAttribute('data-tid')!); return; }
      if (t.classList.contains('wire-hit') || t.classList.contains('wire')) { this.ev.wireClick(t.getAttribute('data-wire')!); return; }
      if (t.classList.contains('nfb-handle')) { if (!this.ev.canWire()) this.ev.nfbToggle(); return; }
    };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
    svg.addEventListener('contextmenu', ev => {
      ev.preventDefault();
      const w = (ev.target as Element).closest('[data-wire]');
      if (w) this.ev.wireClick(w.getAttribute('data-wire')!);
    });

    svg.addEventListener('pointerover', ev => {
      const t = ev.target as Element;
      const tid = t.closest('.term:not(.main)')?.getAttribute('data-tid') ?? null;
      if (tid !== this.hoverTid) { this.setHoverTerminal(tid); this.ev.terminalHover(tid, ev.clientX, ev.clientY); }
      const devId = t.closest('.device')?.getAttribute('data-dev') ?? null;
      if (devId !== this.hoverDev) { this.hoverDev = devId; this.ev.deviceHover(devId); }
      const wid = t.closest('[data-wire]')?.getAttribute('data-wire') ?? null;
      if (wid !== this.hoverWire) { this.setHoverWire(wid); this.ev.wireHover(wid); }
    });
    svg.addEventListener('pointerleave', () => {
      if (this.hoverTid) { this.setHoverTerminal(null); this.ev.terminalHover(null, 0, 0); }
      if (this.hoverDev) { this.hoverDev = null; this.ev.deviceHover(null); }
      if (this.hoverWire) { this.setHoverWire(null); this.ev.wireHover(null); }
    });
  }
}
