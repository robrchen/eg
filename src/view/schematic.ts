/**
 * 單線圖浮動視窗（重繪的向量圖，符號腳位綁實體端子）：配線途中隨時叫出來看（D 鍵／工具列），
 * 可拖曳、縮放大小、滾輪縮放、拖曳平移、半透明。
 * 教學互動：
 *  - 滑到圖上的符號 → 面板上對應器具與「這個接點用到的端子」閃紅框；點符號 → 鏡頭帶過去
 *  - 滑到面板上的器具 → 圖上它的符號亮框；滑到端子 → 圖上這個端子所在的那條線（節點）亮起
 *  - 步驟引導：下一條線在圖上是哪一段（整個節點）紅色脈動，兩端的接點符號標紅，底部顯示步驟說明
 */
import { connectivity, pinPos, type SchDiagram, type SchSym } from '../model/schematic';

const NS = 'http://www.w3.org/2000/svg';
const KEY = 'yishipei:schem';

export interface SchematicEvents {
  hoverSym(sym: SchSym | null, dev?: string): void;
  clickSym(dev: string): void;
}
export interface SchematicOpts {
  /** 實體端子 → 參考接線的節點（同節點＝電氣相通） */
  netOf(tid: string): string;
  /** 引接小 TB 端子 → 器具本體端子（其他原樣） */
  body(tid: string): string;
  /** 燈的顏色 */
  color(dev: string): string | undefined;
}

interface Saved { open: boolean; left: number; top: number; width: number; height: number; ghost: boolean }

const el = (tag: string, attrs: Record<string, string | number> = {}, cls?: string) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (cls) e.setAttribute('class', cls);
  return e;
};

/** 各種符號的圖形（以符號中心為原點；直立符號腳位在 y = ±20） */
function symbolSvg(s: SchSym, color?: string): string {
  const lead = (a = 5) => `<path d="M0,-20V${-a} M0,${a}V20" class="sw"/>`;
  const plates = `<path d="M-10,-5H10 M-10,5H10" class="plate"/>`;
  const slash = `<path d="M-8,11 L8,-11" class="sw"/>`;
  const tri = `<path d="M13,-4 L19,0 L13,4 Z" class="tri"/>`;
  const name = s.label ?? s.dev;
  const side = (y = 3) => s.left
    ? `<text x="-14" y="${y}" class="sl" text-anchor="end">${name}</text>${s.note ? `<text x="-14" y="${y + 11}" class="sn" text-anchor="end">${s.note}</text>` : ''}`
    : `<text x="14" y="${y}" class="sl">${name}</text>${s.note ? `<text x="14" y="${y + 11}" class="sn">${s.note}</text>` : ''}`;
  switch (s.kind) {
    case 'no': return lead() + plates + side();
    case 'nc': return lead() + plates + slash + side();
    case 'td-no': return lead() + plates + tri + `<text x="22" y="3" class="sl">${name}</text><text x="22" y="14" class="sn">${s.note ?? ''}</text>`;
    case 'td-nc': return lead() + plates + slash + tri + `<text x="22" y="3" class="sl">${name}</text><text x="22" y="14" class="sn">${s.note ?? ''}</text>`;
    case 'pb-no': return `${lead(9)}<circle cy="-7" r="2" class="open"/><circle cy="7" r="2" class="open"/><path d="M6,-10V10 M6,0H14 M14,-5V5" class="sw"/><text x="18" y="4" class="sl">${name}</text>`;
    case 'pb-nc': return `${lead(9)}<circle cy="-7" r="2" class="open"/><circle cy="7" r="2" class="open"/><path d="M2,-9V9 M2,0H14 M14,-5V5" class="sw"/><text x="18" y="4" class="sl">${name}</text>`;
    case 'coil': return `${lead(14)}<circle r="14" class="coil"/><text y="3.5" class="ci">${name}</text>${s.note ? `<text x="17" y="-10" class="sn">${s.note}</text>` : ''}`;
    case 'lamp': return `${lead(12)}<circle r="12" class="lamp" style="stroke:${color ?? '#333'}"/><path d="M-8.5,-8.5 L-13,-13 M8.5,-8.5 L13,-13 M-8.5,8.5 L-13,13 M8.5,8.5 L13,13" class="sw"/><text y="4" class="ci" style="fill:${color ?? '#333'}">${name}</text>`;
    case 'bz': return `${lead(12)}<rect x="-14" y="-12" width="28" height="24" class="coil"/><path d="M14,-12 L21,12" class="sw"/><text y="4" class="ci">BZ</text>`;
    case 'fuse': return `<path d="M-20,0H-12 M12,0H20" class="sw"/><rect x="-12" y="-5" width="24" height="10" class="coil"/><path d="M-12,5 L12,-5" class="sw"/><text y="-9" class="sl" text-anchor="middle">${name}</text>`;
    case 'co': return `<path d="M0,20V8 M14,-20V-8 M-14,-20V-8" class="sw"/><circle cy="6" r="2" class="open"/><circle cx="14" cy="-6" r="2" class="open"/><circle cx="-14" cy="-6" r="2" class="open"/>`
      + `<path d="M1,4 L12.5,-4.5" class="sw"/><path d="M3,-6 L9,4" class="sw"/><text x="-14" y="-26" class="sn">a</text><text x="14" y="-26" class="sn">b</text><text x="4" y="22" class="sn">c</text>`
      + `<text x="20" y="4" class="sl">${name}</text>${s.note ? `<text x="20" y="15" class="sn">${s.note}</text>` : ''}`;
    case 'src': return `<path d="M-4,-5 L-14,0 L-4,5 Z" class="arrow ${name}"/><path d="M0,0H-4" class="sw"/><text x="-18" y="5" class="src ${name}" text-anchor="end">${name}</text>`;
  }
}

export class SchematicWindow {
  private el: HTMLDivElement;
  private svg: SVGSVGElement;
  private world: SVGGElement;
  private caption: HTMLDivElement;
  private symEls: { s: SchSym; g: SVGGElement }[] = [];
  private wireEls: { net: string; e: SVGPolylineElement }[] = [];
  private pinEls: { net: string; e: SVGCircleElement }[] = [];
  private hotEls: { dev: string; e: SVGRectElement }[] = [];
  /** 圖上每個網路對應的參考節點 */
  private netRef = new Map<string, string>();
  private view = { x: 0, y: 0, k: 1 };
  private hover = { devs: new Set<string>(), terms: new Set<string>(), nets: new Set<string>() };
  private guide = { terms: new Set<string>(), nets: new Set<string>() };

  constructor(private d: SchDiagram, private opts: SchematicOpts, private ev: SchematicEvents) {
    const el = document.createElement('div');
    el.className = 'schem';
    el.hidden = true;
    el.innerHTML = `<div class="schem-head"><b>單線圖</b><span class="schem-tip">滑符號看端子・點符號轉過去・滾輪縮放</span>
      <button data-a="ghost" title="半透明">◐</button><button data-a="fit" title="整張">⤢</button><button data-a="close" title="關閉 (D)">✕</button></div>
      <div class="schem-body"></div><div class="schem-cap" hidden></div>`;
    this.el = el;
    this.caption = el.querySelector('.schem-cap')!;
    this.svg = document.createElementNS(NS, 'svg');
    this.world = document.createElementNS(NS, 'g');
    this.svg.appendChild(this.world);
    this.build();
    el.querySelector('.schem-body')!.appendChild(this.svg);
    document.body.appendChild(el);
    this.bind();
    this.restore();
  }

  private build(): void {
    const d = this.d, conn = connectivity(d);
    const bg = el('rect', { x: 0, y: 0, width: d.w, height: d.h }, 'sch-bg');
    this.world.appendChild(bg);
    // 主電路（參考）
    if (d.main) {
      const g = el('g', {}, 'sch-mainpart');
      g.innerHTML = d.main.svg;
      this.world.appendChild(g);
      for (const [dev, x, y, w, h] of d.main.hot) {
        const r = el('rect', { x, y, width: w, height: h, rx: 4 }, 'hs') as SVGRectElement;
        r.addEventListener('pointerenter', () => { this.ev.hoverSym(null, dev); this.setHover({ devs: [dev] }); });
        r.addEventListener('pointerleave', () => { this.ev.hoverSym(null); this.setHover({}); });
        r.addEventListener('click', () => { if (!this.moved) this.ev.clickSym(dev); });
        this.world.appendChild(r);
        this.hotEls.push({ dev, e: r });
      }
      this.world.appendChild(el('line', { x1: 370, y1: 20, x2: 370, y2: d.h - 20 }, 'sch-sep'));
      const t = el('text', { x: 800, y: 28 }, 'sch-title'); t.textContent = '控制電路（考生配線）'; this.world.appendChild(t);
    }
    // 控制電路：線、接點、符號
    d.wires.forEach((w, i) => {
      const e = el('polyline', { points: w.map(p => p.join(',')).join(' ') }, 'sch-w') as SVGPolylineElement;
      this.world.appendChild(e);
      this.wireEls.push({ net: conn.wireNet[i], e });
    });
    for (const p of conn.junctions) this.world.appendChild(el('circle', { cx: p.x, cy: p.y, r: 3.2 }, 'sch-dot'));
    for (const s of d.syms) {
      const g = el('g', { transform: `translate(${s.x},${s.y})`, 'data-sym': s.id }, 'sym') as SVGGElement;
      g.innerHTML = symbolSvg(s, this.opts.color(s.dev));
      const hit = el('rect', { x: -22, y: -24, width: s.kind === 'fuse' ? 44 : 56, height: 48 }, 'sym-hit');
      g.insertBefore(hit, g.firstChild);
      g.addEventListener('pointerenter', () => { this.ev.hoverSym(s); this.setHover({ syms: [s] }); });
      g.addEventListener('pointerleave', () => { this.ev.hoverSym(null); this.setHover({}); });
      g.addEventListener('click', () => { if (!this.moved) this.ev.clickSym(s.dev); });
      this.world.appendChild(g);
      this.symEls.push({ s, g });
      pinPos(s).forEach((p, i) => {
        const net = conn.pinNet.get(`${s.id}:${i}`)!;
        this.netRef.set(net, this.opts.netOf(s.t[i]));
        const c = el('circle', { cx: p.x, cy: p.y, r: 2.4 }, 'sch-pin') as SVGCircleElement;
        this.world.appendChild(c);
        this.pinEls.push({ net, e: c });
      });
    }
  }

  get isOpen(): boolean { return !this.el.hidden; }
  toggle(): void { this.isOpen ? this.close() : this.open(); }
  open(): void { this.el.hidden = false; requestAnimationFrame(() => this.fit()); this.save(); }
  close(): void { this.el.hidden = true; this.ev.hoverSym(null); this.save(); }

  /** 圖上哪些網路對應到這些實體端子（同一參考節點） */
  private netsOfTerms(terms: string[]): Set<string> {
    const refs = new Set(terms.map(t => this.opts.netOf(t)));
    return new Set([...this.netRef].filter(([, r]) => refs.has(r)).map(([n]) => n));
  }

  /** 滑過：器具（符號亮框）／端子（它所在的那條線亮起）／圖上的符號本身 */
  setHover(h: { devs?: string[]; terms?: string[]; syms?: SchSym[] }): void {
    const terms = (h.terms ?? []).map(t => this.opts.body(t));
    this.hover = {
      devs: new Set(h.devs ?? []),
      terms: new Set([...terms, ...(h.syms ?? []).flatMap(s => s.t)]),
      nets: this.netsOfTerms([...(h.terms ?? []), ...(h.syms ?? []).flatMap(s => s.t)]),
    };
    this.paint();
  }
  /** 步驟引導：下一條線的兩端端子 → 圖上那一段（節點）紅色脈動、兩端接點標紅 */
  setGuide(terms: string[], caption: string): void {
    this.guide = { terms: new Set(terms.map(t => this.opts.body(t))), nets: this.netsOfTerms(terms) };
    this.caption.hidden = !caption;
    this.caption.innerHTML = caption;
    this.paint();
  }
  has(dev: string): boolean { return this.symEls.some(x => x.s.dev === dev) || this.hotEls.some(x => x.dev === dev); }

  private paint(): void {
    const H = this.hover, G = this.guide;
    for (const { s, g } of this.symEls) {
      g.classList.toggle('hover', H.devs.has(s.dev) || s.t.some(t => H.terms.has(t)));
      g.classList.toggle('guide', s.t.some(t => G.terms.has(t)));
    }
    for (const { dev, e } of this.hotEls) e.classList.toggle('hover', H.devs.has(dev));
    for (const { net, e } of this.wireEls) { e.classList.toggle('hover', H.nets.has(net)); e.classList.toggle('guide', G.nets.has(net)); }
    for (const { net, e } of this.pinEls) { e.classList.toggle('hover', H.nets.has(net)); e.classList.toggle('guide', G.nets.has(net)); }
  }

  private fit(): void {
    const r = this.svg.getBoundingClientRect(); if (r.width < 10) return;
    const k = Math.min(r.width / this.d.w, r.height / this.d.h);
    this.view = { k, x: (r.width - this.d.w * k) / 2, y: (r.height - this.d.h * k) / 2 };
    this.apply();
  }
  private apply(): void { this.world.setAttribute('transform', `translate(${this.view.x},${this.view.y}) scale(${this.view.k})`); }

  private moved = false;
  private bind(): void {
    const head = this.el.querySelector<HTMLElement>('.schem-head')!;
    head.addEventListener('click', e => {
      const a = (e.target as HTMLElement).closest('button')?.dataset.a;
      if (a === 'close') this.close();
      else if (a === 'fit') this.fit();
      else if (a === 'ghost') { this.el.classList.toggle('ghost'); this.save(); }
    });
    // 拖曳標題列移動視窗
    head.addEventListener('pointerdown', e => {
      if ((e.target as HTMLElement).closest('button')) return;
      const sx = e.clientX, sy = e.clientY, l = this.el.offsetLeft, t = this.el.offsetTop;
      head.setPointerCapture(e.pointerId);
      const mv = (m: PointerEvent) => {
        this.el.style.left = `${Math.max(0, Math.min(innerWidth - 80, l + m.clientX - sx))}px`;
        this.el.style.top = `${Math.max(0, Math.min(innerHeight - 40, t + m.clientY - sy))}px`;
      };
      const up = () => { head.removeEventListener('pointermove', mv); head.removeEventListener('pointerup', up); this.save(); };
      head.addEventListener('pointermove', mv); head.addEventListener('pointerup', up);
    });
    // 圖面：滾輪縮放、拖曳平移
    this.svg.addEventListener('wheel', e => {
      e.preventDefault();
      const r = this.svg.getBoundingClientRect();
      const px = e.clientX - r.left, py = e.clientY - r.top;
      const k = Math.max(0.2, Math.min(6, this.view.k * Math.exp(-e.deltaY * 0.0015)));
      const wx = (px - this.view.x) / this.view.k, wy = (py - this.view.y) / this.view.k;
      this.view = { k, x: px - wx * k, y: py - wy * k };
      this.apply();
    }, { passive: false });
    this.svg.addEventListener('pointerdown', e => {
      const sx = e.clientX, sy = e.clientY, v = { ...this.view };
      this.moved = false;
      const mv = (m: PointerEvent) => {
        if (Math.hypot(m.clientX - sx, m.clientY - sy) > 4) this.moved = true;
        if (!this.moved) return;
        this.view = { ...v, x: v.x + m.clientX - sx, y: v.y + m.clientY - sy };
        this.apply();
      };
      const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    });
    new ResizeObserver(() => { if (this.isOpen) this.save(); }).observe(this.el);
    this.el.addEventListener('pointerdown', e => e.stopPropagation());
  }

  private save(): void {
    const s: Saved = { open: this.isOpen, left: this.el.offsetLeft, top: this.el.offsetTop, width: this.el.offsetWidth, height: this.el.offsetHeight, ghost: this.el.classList.contains('ghost') };
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
  }
  private restore(): void {
    let s: Partial<Saved> = {};
    try { s = JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { /* ignore */ }
    const w = Math.min(s.width ?? 640, innerWidth - 20), h = Math.min(s.height ?? 420, innerHeight - 20);
    this.el.style.width = `${w}px`; this.el.style.height = `${h}px`;
    this.el.style.left = `${Math.max(0, Math.min(innerWidth - w, s.left ?? innerWidth - w - 400))}px`;
    this.el.style.top = `${Math.max(0, Math.min(innerHeight - h, s.top ?? 90))}px`;
    this.el.classList.toggle('ghost', !!s.ghost);
    if (s.open) this.open();
  }
}
