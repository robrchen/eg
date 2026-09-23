import type { DeviceInstance, DuctRect, PanelId, QuestionDef, TerminalDef, Wire } from '../model/types';
import { defOf, ROLE_COLOR, PHASE_COLOR } from '../library';
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
/** TB2 下排（引出到電動機）螺絲的 y */
const TB2_LOW = 30;

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
  /** 右鍵：按到端子／導線／器具，或空白處（id 為 null） */
  contextMenu(kind: 'terminal' | 'wire' | 'device' | 'blank', id: string | null, x: number, y: number): void;
  press(devId: string, down: boolean): void;
  nfbToggle(): void;
  /** TH-RY 本體上的 TEST（跳脫）／RESET（復歸）鈕 */
  thryTrip(on: boolean): void;
  canWire(): boolean;
  countAt(tid: string): number;
  viewChanged(): void;
}

interface View { x: number; y: number; k: number }

/** 畫布上的一塊板子：器具板或操作面板，各有原點與是否鏡射 */
interface Board { id: PanelId; x0: number; y0: number; w: number; h: number; mirror: boolean; name: string; note?: string;
  /** 板內器具的垂直位移：讓 TB4 對齊 TB3，但板子外框本身仍與器具板齊平 */
  dy: number }
/** 兩塊板子在畫布上的間距 (mm)：門邊的 TB3、TB4 要靠在一起，過門線才短 */
const BOARD_GAP = 12;

/** 單一面板（器具板 / 操作面板）的 SVG 視圖 */
export class PanelView {
  readonly root: HTMLElement;
  readonly svg: SVGSVGElement;
  private world: SVGGElement;
  private wireLayer!: SVGGElement;
  private hlLayer!: SVGGElement;
  private fxLayer!: SVGGElement;
  private magLayer!: SVGGElement;  // 放大中的器具搬到這層，浮在導線之上   // 一次性動畫（過門光點），不被 setHighlight 清掉
  private rubber!: SVGPolylineElement;
  private devices: DeviceInstance[];
  private ducts: DuctRect[];
  /** 兩塊板子排在同一張畫布上，拉線時直接平移過去 */
  private boards: Board[];
  private boardEls = new Map<PanelId, SVGGElement>();
  /** 目前正在繪製的器具所在板子是否鏡射（buildStatic 逐板設定） */
  private mirror = false;
  private termPos = new Map<string, Pt>();
  private termEls = new Map<string, SVGGElement>();
  private termLabels = new Map<string, SVGTextElement>();
  /** 考場引接線要落在哪一點（小端子台為上排螺絲，其餘為端子本身） */
  private preAnchor = new Map<string, Pt>();
  /** 導線離開端子的第一個轉折點：朝器具外側直出，不從其他端子頭上跨過去 */
  private termExit = new Map<string, Pt>();
  private spares: Set<string>;
  private deviceEls = new Map<string, SVGGElement>();
  private view: View = { x: 0, y: 0, k: 1 };
  private sim: Simulator | null = null;
  private pendingTid: string | null = null;
  private wires: Wire[] = [];
  private knownWireIds = new Set<string>();
  private pointers = new Map<number, Pt>();
  private drag: { start: Pt; view: View; moved: boolean; target: Element | null; dev: string | null; cap?: boolean } | null = null;
  private pinchDist = 0;
  private hoverTid: string | null = null;
  private hoverDev: string | null = null;
  /** 導線走線（不含端子端點），放大器具時只重算首尾點 */
  private wireRoutes = new Map<string, { a: string; b: string; mid: Pt[] }>();
  /** 滑過的器具原地放大 */
  private magDev: string | null = null;
  private magScale = 1;
  private magCenter: Pt = { x: 0, y: 0 };
  private magNext: Node | null = null;
  private magParent: Node | null = null;
  /** 點器具固定放大（取代原本的 HTML 接點面板） */
  private pinnedDev: string | null = null;
  private magTimer = 0;
  private hoverWire: string | null = null;

  constructor(container: HTMLElement, readonly q: QuestionDef, private ev: PanelEvents) {
    this.spares = spareTerminals(q);
    let x0 = 0;
    this.boards = (['device', 'operator'] as PanelId[]).filter(id => q.panels[id]).map(id => {
      const P = q.panels[id];
      const b: Board = { id, x0, y0: 0, w: P.w, h: P.h, mirror: !!P.mirror, name: P.name, note: P.note, dy: 0 };
      x0 += P.w + BOARD_GAP;
      return b;
    });
    const boardOf = (id: PanelId) => this.boards.find(b => b.id === id)!;
    // 操作面板的器具整體上下平移，讓 TB4 與 TB3 的腳位對齊（同號腳位為過門線）；板子外框仍與器具板齊平
    const tb3 = q.devices.find(d => d.kind === 'TB16' && d.panel === 'device');
    const tb4 = q.devices.find(d => d.kind === 'TB16' && d.panel === 'operator');
    if (tb3 && tb4) boardOf('operator').dy = tb3.y - tb4.y;
    const mx = (b: Board, x: number, w: number) => b.mirror ? b.x0 + b.w - x - w : b.x0 + x;
    this.devices = q.devices.map(d => { const b = boardOf(d.panel); return { ...d, x: mx(b, d.x, d.w ?? defOf(d.kind).w), y: b.y0 + b.dy + d.y }; });
    this.ducts = q.ducts.map(d => { const b = boardOf(d.panel); return { ...d, x: mx(b, d.x, d.w), y: b.y0 + b.dy + d.y }; });

    this.root = container;
    const note = this.boards.map(b => b.note).filter(Boolean).join('；');
    container.innerHTML = `<div class="panel-head"><span class="name">${this.boards.map(b => b.name).join('　|　')}</span>${note ? `<span class="note">${note}</span>` : ''}</div>
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
    requestAnimationFrame(() => this.fit(false));
    new ResizeObserver(() => this.fit(false)).observe(container);
  }

  /* ================= 靜態繪製 ================= */
  private buildStatic(): void {
    for (const b of this.boards) {
      const g = el('g', { 'data-board': b.id }, 'board-group');
      g.appendChild(el('rect', { x: b.x0, y: b.y0, width: b.w, height: b.h, rx: 4 }, 'board'));
      g.appendChild(text(b.x0 + b.w / 2, b.y0 - 10, b.name, 12, 'board-title'));
      for (const d of this.ducts) if (d.panel === b.id) g.appendChild(el('rect', { x: d.x, y: d.y, width: d.w, height: d.h, rx: 1 }, 'duct'));
      this.mirror = b.mirror;
      for (const d of this.devices) if (d.panel === b.id) g.appendChild(this.drawDevice(d));
      this.world.appendChild(g);
      this.boardEls.set(b.id, g);
    }
    this.drawPreWired();
    this.wireLayer = el('g', {}, 'wires');
    this.hlLayer = el('g', {}, 'hl-layer');
    this.fxLayer = el('g', {}, 'fx-layer');
    this.magLayer = el('g', {}, 'mag-layer');
    this.rubber = el('polyline', {}, 'rubber');
    this.rubber.style.display = 'none';
    this.world.append(this.wireLayer, this.hlLayer, this.magLayer, this.fxLayer, this.rubber);
  }

  /** 考場已引接線（器具本體端子 → 無編號小 TB）：灰色虛線，只畫本面板內、非過門線的 passThrough */
  private drawPreWired(): void {
    const g = el('g', {}, 'prewires');
    const devOf = (tid: string) => tid.slice(0, tid.lastIndexOf('.'));
    const SIMPLE = new Set(['PB', 'PL', 'BZ', 'THRY']);
    const cables = new Map<string, { dev: string; xs: number[]; y: number; sx: number[] }>();
    for (const p of this.q.passThrough) {
      if (p.a.startsWith('TB3.') || p.b.startsWith('TB3.')) continue;
      // 燈／按鈕／BZ：本體到小 TB 畫成一條短纜，不畫 2～4 條交叉虛線
      const src = this.devices.find(d => d.id === devOf(p.a));
      if (src && SIMPLE.has(src.kind)) {
        const b = this.preAnchor.get(p.b) ?? this.termPos.get(p.b);
        if (!b) continue;
        const c = cables.get(src.id) ?? { dev: src.id, xs: [], y: b.y, sx: [] as number[] };
        c.xs.push(b.x); c.y = Math.min(c.y, b.y); cables.set(src.id, c);
        const a = this.termPos.get(p.a); if (a) c.sx.push(a.x);
        continue;
      }
      const a = this.preAnchor.get(p.a) ?? this.termPos.get(p.a);
      const b = this.preAnchor.get(p.b) ?? this.termPos.get(p.b);
      if (!a || !b) continue;
      const dy = Math.max(6, Math.abs(b.y - a.y) * 0.5);
      g.appendChild(el('path', { d: `M${a.x},${a.y} C${a.x},${a.y + dy} ${b.x},${b.y - dy} ${b.x},${b.y}` }, 'prewire'));
    }
    for (const c of cables.values()) {
      const d = this.devices.find(x => x.id === c.dev)!;
      const { w, h } = this.geom(d);
      // 燈／按鈕從本體底緣中央出線；TH-RY 從接點座（95/96/98）下方出線
      const x0 = d.kind === 'THRY' && c.sx.length ? (Math.min(...c.sx) + Math.max(...c.sx)) / 2 : d.x + w / 2, y0 = d.y + h;
      const x1 = (Math.min(...c.xs) + Math.max(...c.xs)) / 2, y1 = c.y - 2;
      const my = (y0 + y1) / 2;
      g.appendChild(el('path', { d: `M${x0},${y0} L${x0},${my} L${x1},${my} L${x1},${y1}` }, 'prewire cable'));
    }
    // 主電源（考場已配妥）：電源 → TB1 → NFB 電源側，依電工法規 R 紅、S 白、T 黑
    const tb1 = this.devices.find(d => d.kind === 'TB1'), nfb = this.devices.find(d => d.kind === 'NFB');
    if (tb1) {
      const b = this.boards.find(x => x.id === tb1.panel)!;
      for (const [k, ph] of [['A', 'R'], ['B', 'S'], ['C', 'T']] as const) {
        const p = this.termPos.get(`${tb1.id}.${k}`); if (!p) continue;
        const segs: string[] = [`M${p.x},${b.y0 + 3} L${p.x},${p.y}`];
        const q = nfb && this.termPos.get(`${nfb.id}.電源${k}`);
        if (q) segs.push(`M${p.x},${p.y} L${p.x},${(p.y + q.y) / 2} L${q.x},${(p.y + q.y) / 2} L${q.x},${q.y}`);
        for (const dd of segs) {
          g.appendChild(el('path', { d: dd }, 'mainlead-case'));
          g.appendChild(el('path', { d: dd, stroke: PHASE_COLOR[ph] }, 'mainlead'));
        }
      }
    }
    this.drawMotor(g);
    this.world.appendChild(g);
  }

  /** TB2 下排引出六條線到電動機（Y-Δ：U V W X Y Z），G 以綠黃線接電動機外殼與接地端子板 */
  private drawMotor(g: SVGGElement): void {
    const tb2 = this.devices.find(d => d.kind === 'TB2'); if (!tb2) return;
    const b = this.boards.find(x => x.id === tb2.panel)!;
    const leads = ['U', 'V', 'W', 'X', 'Y', 'Z', '8'].map(id => ({ id, p: this.termPos.get(`${tb2.id}.${id}`) })).filter(l => l.p) as { id: string; p: Pt }[];
    if (!leads.length) return;
    const { w } = this.geom(tb2);
    const bottom = b.y0 + b.h;
    // 電動機放在 TB2 右側、板子底部
    const mx0 = tb2.x + w + 22, bx = mx0, by = bottom - 30, bw = 44, bh = 24;
    const cx = bx + bw / 2, cy = by - 19;   // 端子盒貼在電動機底部
    // 引線：最左邊那條走最低，彼此不交叉
    leads.forEach((l, j) => {
      const y = bottom - 6 - j * 2.6;
      const x0 = l.p.x, y0 = tb2.y + TB2_LOW;
      const isG = l.id === '8';
      const d = `M${x0},${y0} L${x0},${y} L${bx},${y}`;
      g.appendChild(el('path', { d }, isG ? 'motorlead ground' : 'motorlead'));
    });
    g.appendChild(el('circle', { cx, cy, r: 22 }, 'motor-body'));
    g.appendChild(el('rect', { x: bx, y: by, width: bw, height: bh, rx: 2 }, 'motor-box'));
    g.appendChild(text(bx + bw / 2, by + bh / 2 + 1.6, '端子盒', 4, 'motor-text'));
    g.appendChild(text(cx, cy - 1, 'IM', 9, 'motor-text'));
    g.appendChild(text(cx, cy + 8, '3φ Y-Δ', 4.2, 'motor-text'));
    // TB2 的 G（上排第 8 格）以綠黃線接到接地端子板
    const gbar = this.devices.find(d => d.kind === 'GBAR');
    const g8 = this.termPos.get(`${tb2.id}.8`), g1 = gbar && this.termPos.get(`${gbar.id}.G1`);
    if (g8 && g1) g.appendChild(el('path', { d: `M${g8.x},${g8.y} L${g8.x},${g1.y} L${g1.x},${g1.y}` }, 'motorlead ground'));
  }

  private geom(d: DeviceInstance) {
    const def = defOf(d.kind);
    return { def, w: d.w ?? def.w, h: d.h ?? def.h };
  }
  private tx(t: TerminalDef, w: number): number { return this.mirror ? w - t.x : t.x; }

  private drawDevice(d: DeviceInstance): SVGGElement {
    const { def, w, h } = this.geom(d);
    // 外層用 transform 屬性定位（CSS 不能對它下 transform）；內層 .mag 沒有屬性 transform，滑過時用 CSS scale 原地放大
    const og = el('g', { transform: `translate(${d.x},${d.y})`, 'data-dev': d.id }, 'device');
    const g = el('g', {}, 'mag');
    og.appendChild(g);
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
        // 端子區（左）與操作區（右）分開：上排 1 3 5、下排 2 4 6 + 95、其下 96 98
        g.appendChild(el('rect', { x: 0, y: 0, width: w, height: h, rx: 2 }, bodyCls));
        g.appendChild(el('rect', { x: 3, y: 2, width: 50, height: 14, rx: 1 }, 'strip'));
        g.appendChild(el('rect', { x: 3, y: 18, width: 68, height: 14, rx: 1 }, 'strip'));
        g.appendChild(el('rect', { x: 35, y: 35, width: 36, height: 14, rx: 1 }, 'aux-block'));
        g.appendChild(text(18, 45, label, 6.5, 'device-label'));
        // 輔助接點座（95 / 96 98）只標編號；實際接線在下方引接小 TB
        g.appendChild(text(62, 26.4, '95', 3.6, 'device-sub'));
        g.appendChild(text(44, 43.4, '96', 3.6, 'device-sub'));
        g.appendChild(text(62, 43.4, '98', 3.6, 'device-sub'));
        // 操作區
        g.appendChild(el('rect', { x: 74, y: 2, width: 20, height: h - 4, rx: 2 }, 'thry-panel'));
        g.appendChild(el('circle', { cx: 62, cy: 9, r: 5 }, 'thry-dial'));
        g.appendChild(el('line', { x1: 62, y1: 9, x2: 64.5, y2: 5.2 }, 'thry-dial-pointer'));
        g.appendChild(el('rect', { x: 77, y: 5, width: 14, height: 6, rx: 1, fill: '#333', 'data-trip': d.id }, 'thry-flag'));
        const test = g.appendChild(el('circle', { cx: 84, cy: 21, r: 5.5, 'data-thry': 'trip' }, 'thry-btn thry-test'));
        g.appendChild(text(84, 31.5, '過載', 3.6, 'thry-cap'));
        const reset = g.appendChild(el('rect', { x: 77, y: 35, width: 14, height: 9, rx: 1.5, 'data-thry': 'reset' }, 'thry-btn thry-reset'));
        g.appendChild(text(84, 50, '復歸', 3.6, 'thry-cap'));
        test.appendChild(el('title')).textContent = '過載：模擬跳脫（通電測試時）';
        reset.appendChild(el('title')).textContent = '復歸 RESET';
        break;
      }
      case 'PB': case 'PL': case 'BZ': {
        const r = w / 2;
        g.appendChild(el('circle', { cx: r, cy: r, r }, bodyCls));
        // 本體（面板、鏡頭／按鈕帽）放在內層群組，蜂鳴器震動動畫套在這層，不影響定位用的 transform
        const face = el('g', {}, 'face');
        g.appendChild(face);
        if (d.kind === 'PB') {
          face.appendChild(el('circle', { cx: r, cy: r, r: r * 0.56, fill: '#1d2025', stroke: '#111', 'stroke-width': .5 }, 'pb-well'));
          face.appendChild(el('circle', { cx: r, cy: r, r: r * 0.5, fill: d.color ?? '#999', stroke: '#222', 'stroke-width': .6, 'data-cap': d.id }, 'pb-cap'));
        } else {
          if (d.kind === 'BZ') for (const k of [0, 1]) face.appendChild(el('circle', { cx: r, cy: r, r: r * 0.5, 'data-bzring': String(k) }, 'bz-ring'));
          const lamp = el('circle', { cx: r, cy: r, r: r * 0.5, fill: this.dim(d.color ?? '#999'), stroke: '#222', 'stroke-width': .6, 'data-lamp': d.id }, 'lamp');
          lamp.style.color = d.color ?? '#fff';
          face.appendChild(lamp);
          face.appendChild(el('ellipse', { cx: r - r * 0.16, cy: r - r * 0.2, rx: r * 0.18, ry: r * 0.1, fill: '#fff', opacity: .35 }, 'lamp-gloss'));
        }
        face.appendChild(text(r, r + 2.6, label, 6.5, 'device-label')).setAttribute('fill', '#fff');
        break;
      }
      case 'DF': {
        g.appendChild(el('circle', { cx: w / 2, cy: h / 2, r: Math.min(w, h) / 2 }, bodyCls));
        g.appendChild(el('circle', { cx: w / 2, cy: h / 2, r: 9, fill: '#c9b458', stroke: '#555', 'stroke-width': .6, 'data-fuse': d.id }));
        g.appendChild(text(w / 2, h / 2 + 2.5, 'D-F', 5.5, 'device-label'));
        break;
      }
      case 'NFB': {
        // 講義外觀：三極並排（每極上下各一螺絲、額定標示），中間一支共用把手
        g.appendChild(el('rect', { x: 0, y: 0, width: w, height: h, rx: 2 }, bodyCls));
        for (let i = 0; i < 3; i++) {
          g.appendChild(el('rect', { x: 11 + i * 24, y: 2, width: 22, height: h - 4, rx: 1.5 }, 'nfb-pole'));
          g.appendChild(text(22 + i * 24, 22, '30A', 3.2, 'device-sub'));
        }
        const lever = el('g', { 'data-nfb-lever': d.id }, 'nfb-handle nfb-lever');
        lever.appendChild(el('rect', { x: 9, y: 28, width: 74, height: 10, rx: 2, fill: '#444', 'data-nfb': d.id }));
        lever.appendChild(text(w / 2, 35.2, 'OFF', 4.5, 'nfb-state')).setAttribute('data-nfbtext', d.id);
        g.appendChild(lever);
        g.appendChild(text(w / 2, 52, label, 6, 'device-label'));
        break;
      }
      case 'TB1': {
        // 3P 電源端子台：三格並排，上方引入電源、下方引到 NFB（都是考場已配妥）
        g.appendChild(el('rect', { x: 0, y: 0, width: w, height: h, rx: 2 }, bodyCls));
        for (let i = 0; i < 3; i++) g.appendChild(el('rect', { x: 11 + i * 24, y: 4, width: 22, height: h - 8, rx: 1.5 }, 'tb1-cell'));
        const lb = text(5.5, h / 2, label, 5, 'device-label');
        lb.setAttribute('transform', `rotate(-90 5.5 ${h / 2})`);
        lb.setAttribute('dominant-baseline', 'middle');
        g.appendChild(lb);
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
      case 'TB2': {
        // 8P 雙排：上排（盤內主電路）、下排（引出到電動機）；兩排同一金屬片
        g.appendChild(el('rect', { x: 0, y: 0, width: w, height: h, rx: 2 }, bodyCls));
        for (const t of def.terminals) {
          const ux = this.tx(t, w);
          g.appendChild(el('rect', { x: ux - 12, y: 3, width: 24, height: h - 6, rx: 1.2 }, 'tb1-cell'));
          g.appendChild(el('line', { x1: ux, y1: t.y, x2: ux, y2: TB2_LOW }, 'tb-bar'));
          g.appendChild(el('circle', { cx: ux, cy: t.y, r: 3 }, 'tb-screw'));
          g.appendChild(el('circle', { cx: ux, cy: TB2_LOW, r: 3 }, 'tb-screw'));
          g.appendChild(text(ux + 6, (t.y + TB2_LOW) / 2 + 1.6, t.label, 4, t.id === '8' ? 'tb2-g' : 'device-sub', 'start'));
        }
        g.appendChild(text(w + 3, h / 2 + 2, label, 5, 'device-label', 'start'));
        break;
      }
      case 'GBAR': {
        // 接地端子板：銅排 + 螺絲 + 接地符號
        g.appendChild(el('rect', { x: 0, y: 2, width: w, height: h - 4, rx: 1.5 }, 'gbar-copper'));
        for (const t of def.terminals) g.appendChild(el('circle', { cx: this.tx(t, w), cy: t.y, r: 3 }, 'tb-screw'));
        const gx = w + 7, gy = h / 2;
        g.appendChild(el('path', { d: `M${w},${gy} L${gx},${gy} M${gx - 5},${gy} L${gx + 5},${gy} M${gx - 3.2},${gy + 2.4} L${gx + 3.2},${gy + 2.4} M${gx - 1.4},${gy + 4.8} L${gx + 1.4},${gy + 4.8}` }, 'gnd-symbol'));
        g.appendChild(text(w / 2, h + 5.5, '接地端子板 G', 4.2, 'device-sub'));
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
      // 出線方向：端子最靠近器具的哪一邊，就從那一邊直出到器具外 8mm，再去找線槽
      {
        const EXIT = 8;
        const side = [['l', tx], ['r', w - tx], ['t', t.y], ['b', h - t.y]].sort((p, q) => (p[1] as number) - (q[1] as number))[0][0];
        const ex = side === 'l' ? -EXIT : side === 'r' ? w + EXIT : tx;
        const ey = side === 't' ? -EXIT : side === 'b' ? h + EXIT : t.y;
        this.termExit.set(tid, { x: d.x + ex, y: d.y + ey });
      }
      const wireable = t.wireable !== false && !d.display;
      // 燈／按鈕／BZ 本體上的接點由考場引接到小 TB，本體上不畫方塊與字樣（位置仍登記給引接線用）
      if (!wireable && (d.kind === 'PB' || d.kind === 'PL' || d.kind === 'BZ' || d.kind === 'TB2' || d.kind === 'GBAR')) continue;
      // TH-RY 的 95/96/98 由考場引接到下方小 TB：本體只畫接點座，不畫點與字
      if (!wireable && d.kind === 'THRY' && t.role !== 'main') continue;
      const tg = el('g', { 'data-tid': tid, transform: `translate(${tx},${t.y})` }, 'term' + (wireable ? '' : ' main'));
      if (wireable) {
        tg.appendChild(el('circle', { cx: 0, cy: 0, r: 7 }, 'hit'));   // 透明點擊區：把點與環之間的死區補起來
        tg.appendChild(el('circle', { cx: 0, cy: 0, r: 5.4 }, 'halo'));
        tg.appendChild(el('circle', { cx: 0, cy: 0, r: 5.4 }, 'ring'));
        // 引接小 TB 的端子點用它引接來源的角色色（a 藍、b 橘、c 紫、燈 綠）
        const pre = (d.kind === 'TBM3' || d.kind === 'TBM4') ? preSource(this.q, tid) : null;
        const fill = t.phase ? PHASE_COLOR[t.phase] : ROLE_COLOR[pre?.role ?? t.role];
        tg.appendChild(el('circle', { cx: 0, cy: 0, r: 3.4, fill }, 'dot'));
        tg.appendChild(el('g', {}, 'occ-layer'));
      } else {
        tg.appendChild(el('rect', { x: -2.2, y: -2.2, width: 4.4, height: 4.4, rx: .6, fill: t.phase ? PHASE_COLOR[t.phase] : ROLE_COLOR[t.role] }, 'dot'));
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
        else if (t.phase) { lx = tx - 6.5; ly = t.y + 1.6; anchor = 'end'; }   // R/S/T 標在螺絲左側，不被引線壓到
        const lbl = text(lx, ly, t.short ?? t.label, size, wireable ? 'term-label' : 'term-sub', anchor);
        if (inner) lbl.setAttribute('fill', '#e9ecf0');
        g.appendChild(lbl);
        this.termLabels.set(tid, lbl);
      }
    }
    this.deviceEls.set(d.id, og);
    return og;
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
    this.wireRoutes.clear();
    const counts = new Map<string, number>();
    for (const w of wires) {
      counts.set(w.a, (counts.get(w.a) ?? 0) + 1);
      counts.set(w.b, (counts.get(w.b) ?? 0) + 1);
      const a = this.termPos.get(w.a), b = this.termPos.get(w.b);
      if (!a || !b) continue;
      // 先從端子直出到器具外側，再由外側點走線槽；最後一段同樣從外側直進端子
      const ea = this.termExit.get(w.a) ?? a, eb = this.termExit.get(w.b) ?? b;
      const mid = routeWire(ea, eb, this.ducts.filter(d => d.panel === w.panel), w.id);
      this.wireRoutes.set(w.id, { a: w.a, b: w.b, mid });
      const pts = this.wirePoints(w.id)!;
      // 點擊區只到出線點為止，端子本身不被導線蓋住（第二條線才點得到端子）
      const hit = el('polyline', { points: mid.map(p => `${p.x},${p.y}`).join(' '), 'data-wire': w.id }, 'wire-hit');
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
  /** 拉線中：只有起點所在的板子保持清楚，另一塊變暗（跨板要經 TB3 / TB4） */
  dimExcept(panel: PanelId | null): void {
    for (const [id, g] of this.boardEls) g.classList.toggle('dim', panel !== null && id !== panel);
  }
  /** 器具在畫面上的矩形（client 座標），供彈出面板定位 */
  deviceRect(devId: string): DOMRect | null { return this.deviceEls.get(devId)?.getBoundingClientRect() ?? null; }
  /** 其他器具的畫面矩形（彈出面板擺放時要避開） */
  deviceRects(except: string): DOMRect[] {
    const out: DOMRect[] = [];
    for (const [id, g] of this.deviceEls) if (id !== except) out.push(g.getBoundingClientRect());
    return out;
  }

  /* ================= 器具原地放大 ================= */
  /** 端子目前畫在哪（器具放大時跟著放大） */
  termVisualPos(tid: string): Pt | undefined {
    const p = this.termPos.get(tid); if (!p) return p;
    if (!this.magDev || tid.slice(0, tid.lastIndexOf('.')) !== this.magDev) return p;
    const c = this.magCenter, s = this.magScale;
    return { x: c.x + (p.x - c.x) * s, y: c.y + (p.y - c.y) * s };
  }
  private wirePoints(id: string): string | null {
    const r = this.wireRoutes.get(id); if (!r) return null;
    const a = this.termVisualPos(r.a), b = this.termVisualPos(r.b); if (!a || !b) return null;
    return [a, ...r.mid, b].map(p => `${p.x},${p.y}`).join(' ');
  }
  /** 器具放大／還原後，接在它身上的導線首尾點跟著移 */
  private refreshWireEnds(dev: string): void {
    for (const [id, r] of this.wireRoutes) {
      if (r.a.slice(0, r.a.lastIndexOf('.')) !== dev && r.b.slice(0, r.b.lastIndexOf('.')) !== dev) continue;
      const pts = this.wirePoints(id); if (!pts) continue;
      for (const l of this.wireLayer.querySelectorAll<SVGPolylineElement>(`polyline.wire[data-wire="${id}"]`)) l.setAttribute('points', pts);
    }
    if (this.pendingTid && this.pendingTid.slice(0, this.pendingTid.lastIndexOf('.')) === dev && this.rubber.style.display !== 'none') {
      const a = this.termVisualPos(this.pendingTid);
      const cur = this.rubber.getAttribute('points')?.split(' ')[1];
      if (a && cur) this.rubber.setAttribute('points', `${a.x},${a.y} ${cur}`);
    }
  }
  private scheduleMagnify(dev: string | null): void {
    clearTimeout(this.magTimer);
    if (this.pinnedDev) return;   // 固定中：hover 不改放大
    if (!dev || !this.ev.canWire()) { this.setMagnify(null); return; }   // 通電測試不放大，按鈕不會跑
    this.magTimer = window.setTimeout(() => this.setMagnify(dev), 60);
  }
  /** 放大倍率：hover 以畫面 2.2 倍為目標；固定時 3.2 倍。已經夠大就不放大 */
  private magFactor(kind: string, pinned: boolean): number {
    const MAX: Partial<Record<string, number>> = pinned ? { TB16: 1.6, MC: 2.6 } : { TB16: 1.25, MC: 1.7 };
    const target = pinned ? 3.2 : 2.2;
    const s = Math.min(MAX[kind] ?? target, Math.max(1, target / this.view.k));
    return pinned ? Math.max(1.3, s) : s;
  }
  /** 器具原地放大，並搬到 magLayer 浮在鄰居與導線之上 */
  setMagnify(dev: string | null, pinned = false): void {
    if (dev === this.magDev && !pinned) return;
    if (this.magDev) {
      const g = this.deviceEls.get(this.magDev)!;
      g.classList.remove('magnified', 'pinned');
      g.style.removeProperty('--s');
      this.magParent?.insertBefore(g, this.magNext); // 放回原本的疊放順序
      const prev = this.magDev;
      this.magDev = null; this.magScale = 1;
      this.refreshWireEnds(prev);
    }
    if (!dev) return;
    const g = this.deviceEls.get(dev); const d = this.devices.find(x => x.id === dev);
    if (!g || !d) return;
    const s = this.magFactor(d.kind, pinned);
    if (s < 1.05) return;
    const inner = g.querySelector<SVGGElement>(':scope > .mag')!;
    const bb = inner.getBBox();   // CSS transform-box: fill-box 以內容 bbox 中心為原點，端子座標要用同一個中心算
    this.magDev = dev; this.magScale = s;
    this.magCenter = { x: d.x + bb.x + bb.width / 2, y: d.y + bb.y + bb.height / 2 };
    this.magParent = g.parentNode; this.magNext = g.nextSibling;
    this.magLayer.appendChild(g);
    g.style.setProperty('--s', String(s));
    g.classList.add('magnified');
    g.classList.toggle('pinned', pinned);
    this.refreshWireEnds(dev);
    if (pinned) {
      // 放大後超出畫面就平移進來（不改縮放）
      const r = this.svg.getBoundingClientRect(), k = this.view.k, c = this.magCenter;
      const hw = bb.width * s * k / 2 + 12, hh = bb.height * s * k / 2 + 12;
      const sx = this.view.x + c.x * k, sy = this.view.y + c.y * k;
      const nx = Math.min(Math.max(sx, hw), r.width - hw), ny = Math.min(Math.max(sy, hh), r.height - hh);
      if (Math.abs(nx - sx) > 1 || Math.abs(ny - sy) > 1) this.flyTo({ k, x: this.view.x + (nx - sx), y: this.view.y + (ny - sy) });
    }
  }
  /** 點器具：固定放大；null 解除，並恢復目前 hover 的放大 */
  setPinned(dev: string | null): void {
    if (dev === this.pinnedDev) return;
    this.pinnedDev = dev;
    clearTimeout(this.magTimer);
    if (dev) { this.setMagnify(null); this.setMagnify(dev, true); return; }
    this.setMagnify(null);
    if (this.hoverDev && this.ev.canWire()) this.setMagnify(this.hoverDev);
  }
  /** 讓橡皮筋線跟到指定畫面座標（指標在彈出面板上時由外部呼叫） */
  rubberTo(clientX: number, clientY: number): void {
    if (!this.pendingTid) return;
    const a = this.termVisualPos(this.pendingTid); if (!a) return;
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
        // 蜂鳴器本體是灰的，鳴叫時改用紫色（與 HUD 狀態格一致）才看得出來
        const onColor = d.kind === 'BZ' ? '#d98cff' : (d.color ?? '#fff');
        lamp.style.color = onColor;
        lamp.setAttribute('fill', on ? onColor : this.dim(d.color ?? '#999'));
        lamp.classList.toggle('lamp-glow', on);
        if (d.kind === 'BZ') g.classList.toggle('buzzing', on);
      }
      if (d.kind === 'MC') g.querySelector('[data-led]')!.classList.toggle('on', !!s?.actuated);
      if (d.kind === 'TR') {
        const t = g.querySelector<SVGTextElement>('[data-trtext]')!;
        t.textContent = s?.actuated ? `${Math.max(0, (sim!.timerMs - s.timerMs) / 1000).toFixed(1)}` : '';
      }
      if (d.kind === 'THRY') { g.querySelector('[data-trip]')!.setAttribute('fill', s?.tripped ? '#ff3b3b' : '#333'); g.classList.toggle('tripped', !!s?.tripped); }
      if (d.kind === 'NFB') {
        const on = !!sim?.nfbOn;
        g.querySelector('[data-nfb]')!.setAttribute('fill', on ? '#2ecc71' : '#444');
        g.querySelector('.nfb-lever')?.classList.toggle('on', on);
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

  /** 鏡頭補間：畫面中心點走直線、縮放走對數，使用者一動滑鼠就中止 */
  private flying = 0;
  private flyTo(target: View, ms = 380): void {
    cancelAnimationFrame(this.flying);
    const r = this.svg.getBoundingClientRect();
    const from = { ...this.view };
    const center = (v: View) => ({ x: (r.width / 2 - v.x) / v.k, y: (r.height / 2 - v.y) / v.k });
    const c0 = center(from), c1 = center(target);
    const lk0 = Math.log(from.k), lk1 = Math.log(target.k);
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / ms);
      const e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;   // easeInOutQuad
      const k = Math.exp(lk0 + (lk1 - lk0) * e);
      const cx = c0.x + (c1.x - c0.x) * e, cy = c0.y + (c1.y - c0.y) * e;
      this.view = { k, x: r.width / 2 - cx * k, y: r.height / 2 - cy * k };
      this.applyView();
      if (t < 1) this.flying = requestAnimationFrame(step); else this.flying = 0;
    };
    this.flying = requestAnimationFrame(step);
  }
  private stopFly(): void { if (this.flying) { cancelAnimationFrame(this.flying); this.flying = 0; } }

  /** 整張畫布置中，兩塊板子都看得到 */
  fit(animate = true): void {
    const xs = this.boards.map(b => b.x0), ys = this.boards.map(b => b.y0);
    const x2 = Math.max(...this.boards.map(b => b.x0 + b.w)), y2 = Math.max(...this.boards.map(b => b.y0 + b.h));
    this.fitRect({ x: Math.min(...xs), y: Math.min(...ys), w: x2 - Math.min(...xs), h: y2 - Math.min(...ys) }, animate);
  }
  /** 轉身：把某一塊板子放大到剛好塞滿視窗 */
  fitBoard(id: PanelId, animate = true): void {
    const b = this.boards.find(x => x.id === id); if (!b) return;
    this.fitRect({ x: b.x0, y: b.y0, w: b.w, h: b.h }, animate);
  }
  private fitRect(b: { x: number; y: number; w: number; h: number }, animate: boolean): void {
    const r = this.svg.getBoundingClientRect();
    if (r.width < 10 || r.height < 10) return;
    const k = Math.min(r.width / (b.w + 12), (r.height - 12) / (b.h + 12));
    const v = { k, x: (r.width - b.w * k) / 2 - b.x * k, y: (r.height - b.h * k) / 2 + 4 - b.y * k };
    if (animate) this.flyTo(v); else { this.stopFly(); this.view = v; this.applyView(); }
  }
  zoomBy(f: number, cx?: number, cy?: number): void {
    this.stopFly();
    const r = this.svg.getBoundingClientRect();
    const px = cx ?? r.left + r.width / 2, py = cy ?? r.top + r.height / 2;
    const pt = this.clientToWorld(px, py);
    const k = Math.max(0.3, Math.min(14, this.view.k * f));
    this.view = { k, x: px - r.left - pt.x * k, y: py - r.top - pt.y * k };
    this.applyView();
  }
  get zoom(): number { return this.view.k; }
  /** 不改縮放；端子已在畫面內就不動，不在才平移過去 */
  panTo(tid: string): void {
    const p = this.termPos.get(tid); if (!p) return;
    const r = this.svg.getBoundingClientRect(), k = this.view.k, M = 60;
    const sx = this.view.x + p.x * k, sy = this.view.y + p.y * k;
    if (sx >= M && sx <= r.width - M && sy >= M && sy <= r.height - M) return;
    this.flyTo({ k, x: r.width / 2 - p.x * k, y: r.height / 2 - p.y * k });
  }
  /** 過門接續提示：一顆光點沿過門線從 TB3.n 滑到 TB4.n，抵達後目標端子閃兩下 */
  doorPulse(from: string, to: string): void {
    const a = this.termPos.get(from), b = this.termPos.get(to); if (!a || !b) return;
    const trail = el('line', { x1: a.x, y1: a.y, x2: a.x, y2: a.y }, 'door-trail');
    const spark = el('circle', { cx: a.x, cy: a.y, r: 3.2 }, 'door-spark');
    this.fxLayer.append(trail, spark);
    const t0 = performance.now(), MS = 450;
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / MS), e = 1 - Math.pow(1 - t, 3);
      const x = a.x + (b.x - a.x) * e, y = a.y + (b.y - a.y) * e;
      spark.setAttribute('cx', String(x)); spark.setAttribute('cy', String(y));
      trail.setAttribute('x2', String(x)); trail.setAttribute('y2', String(y));
      if (t < 1) { requestAnimationFrame(step); return; }
      spark.remove(); trail.classList.add('fade');
      const ring = el('circle', { cx: b.x, cy: b.y, r: 6 }, 'door-arrive');
      this.fxLayer.appendChild(ring);
      setTimeout(() => { trail.remove(); ring.remove(); }, 900);
    };
    requestAnimationFrame(step);
    // 分頁在背景時 rAF 不跑：保底清掉，不留殘影
    setTimeout(() => { spark.remove(); trail.remove(); }, MS + 1200);
  }
  focusTerminal(tid: string, k = 3.2, animate = true): void {
    const p = this.termPos.get(tid); if (!p) return;
    const r = this.svg.getBoundingClientRect();
    const v = { k, x: r.width / 2 - p.x * k, y: r.height / 2 - p.y * k };
    if (animate) this.flyTo(v); else { this.stopFly(); this.view = v; this.applyView(); }
  }

  private hitTarget(t: Element | null): Element | null {
    return t?.closest('.term:not(.main), .wire-hit, .wire, .pb-cap, .nfb-handle, .thry-btn') ?? null;
  }

  private bindPointer(): void {
    const svg = this.svg;
    svg.addEventListener('wheel', ev => {
      ev.preventDefault();
      this.zoomBy(Math.exp(-ev.deltaY * 0.0015), ev.clientX, ev.clientY);
    }, { passive: false });

    svg.addEventListener('pointerdown', ev => {
      if (ev.button === 2) return;   // 右鍵交給 contextmenu，不拖曳、不當左鍵點擊
      this.stopFly();
      svg.setPointerCapture(ev.pointerId);
      this.pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
        this.drag = null;
        return;
      }
      const target = this.hitTarget(this.preferTerm(ev.target as Element, ev.clientX, ev.clientY));
      // 器具要在 pointerdown 就記下來：setPointerCapture 之後 pointerup 的 target 會被改成 svg 本身
      const devDown = (ev.target as Element).closest('.device')?.getAttribute('data-dev') ?? null;
      this.drag = { start: { x: ev.clientX, y: ev.clientY }, view: { ...this.view }, moved: false, target, dev: devDown };
      // 按鈕：配線模式要點中帽子（視覺按下）；通電測試整顆按鈕都是按壓區
      let cap = (ev.target as Element).closest('.pb-cap') as SVGElement | null;
      if (!cap && !this.ev.canWire()) cap = (ev.target as Element).closest('.device')?.querySelector<SVGElement>('.pb-cap') ?? null;
      if (cap) { cap.classList.add('pressed'); this.ev.press(cap.getAttribute('data-cap')!, true); this.drag.cap = true; }
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
        const a = this.termVisualPos(this.pendingTid);
        if (a) { this.rubber.setAttribute('points', `${a.x},${a.y} ${pt.x},${pt.y}`); this.rubber.style.display = ''; }
      }
    });

    const end = (ev: PointerEvent) => {
      this.pointers.delete(ev.pointerId);
      svg.classList.remove('grabbing');
      const cap = svg.querySelector('.pb-cap.pressed') as SVGElement | null;
      if (cap) { cap.classList.remove('pressed'); this.ev.press(cap.getAttribute('data-cap')!, false); }
      const d = this.drag; this.drag = null;
      // 按住期間 hover 凍結；放開後依游標位置重新判定一次
      const under = document.elementFromPoint(ev.clientX, ev.clientY);
      if (under && svg.contains(under)) this.hoverFrom(under, ev.clientX, ev.clientY); else this.hoverFrom(null, 0, 0);
      if (!d || d.moved || ev.type === 'pointercancel' || d.cap) return;
      const t = d.target;
      if (!t) {
        if (d.dev) this.ev.deviceClick(d.dev);
        else this.ev.backgroundClick();
        return;
      }
      if (t.classList.contains('term')) { if (this.ev.canWire()) this.ev.terminalClick(t.getAttribute('data-tid')!); return; }
      if (t.classList.contains('wire-hit') || t.classList.contains('wire')) { this.ev.wireClick(t.getAttribute('data-wire')!); return; }
      if (t.classList.contains('nfb-handle')) { if (!this.ev.canWire()) this.ev.nfbToggle(); return; }
      if (t.classList.contains('thry-btn')) { if (!this.ev.canWire()) this.ev.thryTrip(t.getAttribute('data-thry') === 'trip'); return; }
    };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
    svg.addEventListener('contextmenu', ev => {
      ev.preventDefault();
      const t = ev.target as Element;
      const term = t.closest('.term:not(.main)')?.getAttribute('data-tid');
      const wire = t.closest('[data-wire]')?.getAttribute('data-wire');
      const dev = t.closest('.device')?.getAttribute('data-dev');
      if (term) this.ev.contextMenu('terminal', term, ev.clientX, ev.clientY);
      else if (wire) this.ev.contextMenu('wire', wire, ev.clientX, ev.clientY);
      else if (dev) this.ev.contextMenu('device', dev, ev.clientX, ev.clientY);
      else this.ev.contextMenu('blank', null, ev.clientX, ev.clientY);
    });

    svg.addEventListener('pointerover', ev => {
      // 按下時 setPointerCapture 會對 svg 補發 pointerover；按住期間不改 hover，放大的器具才不會在按下瞬間縮回
      if (this.drag) return;
      this.hoverFrom(ev.target as Element, ev.clientX, ev.clientY);
    });
    svg.addEventListener('pointerleave', () => { if (!this.drag) this.hoverFrom(null, 0, 0); });
  }

  /** 導線點擊區蓋在端子上時，端子優先（附近導線多時也點得到端子） */
  private preferTerm(t: Element, x: number, y: number): Element {
    if (!t.closest('.wire-hit, .wire')) return t;
    const under = document.elementsFromPoint(x, y).find(e => e.closest('.term:not(.main)') && this.svg.contains(e));
    return under ?? t;
  }

  private hoverFrom(target: Element | null, cx: number, cy: number): void {
    if (target) target = this.preferTerm(target, cx, cy);
    {
      if (!target) {
        if (this.hoverTid) { this.setHoverTerminal(null); this.ev.terminalHover(null, 0, 0); }
        if (this.hoverDev) { this.hoverDev = null; this.ev.deviceHover(null); this.scheduleMagnify(null); }
        if (this.hoverWire) { this.setHoverWire(null); this.ev.wireHover(null); }
        return;
      }
      const t = target;
      const ev = { clientX: cx, clientY: cy };
      const tid = t.closest('.term:not(.main)')?.getAttribute('data-tid') ?? null;
      if (tid !== this.hoverTid) { this.setHoverTerminal(tid); this.ev.terminalHover(tid, ev.clientX, ev.clientY); }
      const devId = t.closest('.device')?.getAttribute('data-dev') ?? null;
      if (devId !== this.hoverDev) { this.hoverDev = devId; this.ev.deviceHover(devId); this.scheduleMagnify(devId); }
      const wid = t.closest('[data-wire]')?.getAttribute('data-wire') ?? null;
      if (wid !== this.hoverWire) { this.setHoverWire(wid); this.ev.wireHover(wid); }
    }
  }
}
