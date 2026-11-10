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
export function symbolSvg(s: SchSym, color?: string): string {
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
    // 斷電延遲接點：延時記號朝反方向
    case 'tf-no': return lead() + plates + `<path d="M19,-4 L13,0 L19,4 Z" class="tri"/>` + `<text x="22" y="3" class="sl">${name}</text><text x="22" y="14" class="sn">${s.note ?? ''}</text>`;
    case 'tf-nc': return lead() + plates + slash + `<path d="M19,-4 L13,0 L19,4 Z" class="tri"/>` + `<text x="22" y="3" class="sl">${name}</text><text x="22" y="14" class="sn">${s.note ?? ''}</text>`;
    case 'ems': return `<path d="M-20,0H-9 M9,0H20" class="sw"/><circle cx="-7" r="2" class="open"/><circle cx="7" r="2" class="open"/><path d="M-9,2 H9 M0,2 V-8 M-8,-8 Q0,-17 8,-8 Z" class="sw"/><text y="-19" class="sl" text-anchor="middle">${name}</text>`;
    case 'trip-nc': return lead() + plates + slash + `<path d="M-4,-14 L4,-6 M4,-14 L-4,-6" class="sw"/>` + side();
    case 'pb-no': return `${lead(9)}<circle cy="-7" r="2" class="open"/><circle cy="7" r="2" class="open"/><path d="M6,-10V10 M6,0H14 M14,-5V5" class="sw"/><text x="18" y="4" class="sl">${name}</text>`;
    case 'pb-nc': return `${lead(9)}<circle cy="-7" r="2" class="open"/><circle cy="7" r="2" class="open"/><path d="M2,-9V9 M2,0H14 M14,-5V5" class="sw"/><text x="18" y="4" class="sl">${name}</text>`;
    case 'coil': return `${lead(14)}<circle r="14" class="coil"/><text y="3.5" class="ci">${name}</text>${s.note ? `<text x="17" y="-10" class="sn">${s.note}</text>` : ''}`;
    case 'lamp': return `${lead(12)}<circle r="12" class="lamp" style="stroke:${color ?? '#333'}"/><path d="M-8.5,-8.5 L-13,-13 M8.5,-8.5 L13,-13 M-8.5,8.5 L-13,13 M8.5,8.5 L13,13" class="sw"/><text y="4" class="ci" style="fill:${color ?? '#333'}">${name}</text>`;
    case 'bz': return `${lead(12)}<rect x="-14" y="-12" width="28" height="24" class="coil"/><path d="M14,-12 L21,12" class="sw"/><text y="4" class="ci">BZ</text>`;
    case 'fuse': return `<path d="M-20,0H-12 M12,0H20" class="sw"/><rect x="-12" y="-5" width="24" height="10" class="coil"/><path d="M-12,5 L12,-5" class="sw"/><text y="-9" class="sl" text-anchor="middle">${name}</text>`;
    case 'co': return (s.flip
      ? `<path d="M0,-20V-8 M14,20V8 M-14,20V8" class="sw"/><circle cy="-6" r="2" class="open"/><circle cx="14" cy="6" r="2" class="open"/><circle cx="-14" cy="6" r="2" class="open"/>`
        + `<path d="M1,-4 L12.5,4.5" class="sw"/><path d="M3,6 L9,-4" class="sw"/><text x="-14" y="30" class="sn" text-anchor="middle">a</text><text x="14" y="30" class="sn" text-anchor="middle">b</text><text x="4" y="-24" class="sn">c</text>`
      : `<path d="M0,20V8 M14,-20V-8 M-14,-20V-8" class="sw"/><circle cy="6" r="2" class="open"/><circle cx="14" cy="-6" r="2" class="open"/><circle cx="-14" cy="-6" r="2" class="open"/>`
        + `<path d="M1,4 L12.5,-4.5" class="sw"/><path d="M3,-6 L9,4" class="sw"/><text x="-14" y="-26" class="sn">a</text><text x="14" y="-26" class="sn">b</text><text x="4" y="22" class="sn">c</text>`)
      + `<text x="20" y="4" class="sl">${name}</text>${s.note ? `<text x="20" y="15" class="sn">${s.note}</text>` : ''}`;
    case 'trip-no': return lead() + plates + `<path d="M-4,-14 L4,-6 M4,-14 L-4,-6" class="sw"/>` + side();
    case 'src': return `<path d="M-4,-5 L-14,0 L-4,5 Z" class="arrow ${name}"/><path d="M0,0H-4" class="sw"/><text x="-18" y="5" class="src ${name}" text-anchor="end">${name}</text>`;
    // 二段式切換開關：c 在下、M（b）左上、A（a）右上，旋鈕以小圓與把手示意
    case 'cos': return `<path d="M0,-20V-8 M-14,20V8 M14,20V8" class="sw"/><circle cy="-6" r="2" class="open"/><circle cx="-14" cy="6" r="2" class="open"/><circle cx="14" cy="6" r="2" class="open"/>`
      + `<path d="M-1,-4 L-12.5,4.5" class="sw"/><path d="M-5,0 L22,0" class="sw" stroke-dasharray="2 2"/><circle cx="25" cy="0" r="3.4" class="coil"/><path d="M25,-3.4 L25,-8" class="sw"/>`
      + `<text x="-14" y="30" class="sn" text-anchor="middle">M</text><text x="14" y="30" class="sn" text-anchor="middle">A</text><text x="4" y="-24" class="sn">c</text>`
      + `<text x="32" y="4" class="sl">${name}</text>${s.note ? `<text x="32" y="15" class="sn">${s.note}</text>` : ''}`;
    // 浮球開關 a 接點：接點旁畫浮球
    case 'fs': return lead() + plates + `<circle cx="-13" cy="0" r="4" class="coil"/><path d="M-13,-4 V-12 M-10,-3 L-4,-5" class="sw"/>` + side();
    // 液面控制器輸出接點：接點旁加「水位」記號（三橫線）
    case 'lv-no': return lead() + plates + `<path d="M-16,-6 H-8 M-16,-1 H-8 M-16,4 H-8" class="sw"/>` + side();
    case 'lv-nc': return lead() + plates + slash + `<path d="M-16,-6 H-8 M-16,-1 H-8 M-16,4 H-8" class="sw"/>` + side();
    // 電極棒：三支腳在上（E3 E2 E1），棒子向下插入水面，長短不同
    case 'electrode': return `<path d="M-14,-20V14 M0,-20V2 M14,-20V-8" class="sw" stroke-width="2.2"/><path d="M-22,8 H22 M-19,12 H19 M-16,16 H16" class="sw" opacity=".55"/>`
      + `<text x="-14" y="-24" class="sn" text-anchor="middle">E3</text><text x="0" y="-24" class="sn" text-anchor="middle">E2</text><text x="14" y="-24" class="sn" text-anchor="middle">E1</text>`
      + `<text x="26" y="4" class="sl">${name}</text>`;
    case 'motor3': return `<circle r="22" class="coil"/><text y="5" class="ci" style="font-size:14px">${s.label ?? 'M'}</text>`;
    // 主電路（label 空字串就不標）
    case 'main-no': return `<path d="M0,-20V-6 M0,6V20" class="sw"/><path d="M-10,-6H10 M-10,6H10" class="plate"/>${s.label ? `<text x="14" y="4" class="sl">${s.label}</text>` : ''}`;
    case 'heater': return `<path d="M0,-20V-6 H8 V6 H0 V20" class="sw"/>${s.label ? `<text x="14" y="4" class="sl">${s.label}</text>` : ''}`;
    case 'breaker': return `<circle cy="-17.5" r="2.5" class="open"/><circle cy="17.5" r="2.5" class="open"/><path d="M0,-20V-20 M1,-15 C14,-9 14,9 1,15" class="sw"/>${s.label ? `<text x="16" y="4" class="sl">${s.label}</text>` : ''}`;
    case 'term': return `<circle r="3" class="open"/><text x="6" y="-3" class="sn ph-${s.label}">${s.label ?? ''}</text>`;
    case 'motor': return `<circle r="22" class="coil"/><text y="5" class="ci" style="font-size:14px">${s.label ?? 'M'}</text>`;
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
  /** 圖上每個網路對應的參考節點 */
  private netRef = new Map<string, Set<string>>();
  private view = { x: 0, y: 0, k: 1 };
  private hover = { devs: new Set<string>(), terms: new Set<string>(), nets: new Set<string>() };
  private guide = { terms: new Set<string>(), nets: new Set<string>() };

  constructor(private d: SchDiagram, private opts: SchematicOpts, private ev: SchematicEvents) {
    const el = document.createElement('div');
    el.className = 'schem';
    el.hidden = true;
    el.innerHTML = `<div class="schem-head"><b>單線圖</b><span class="schem-tip">滑符號看端子・點符號轉過去・滾輪縮放</span>
      <span class="schem-zoom"><button data-a="out" title="縮小">−</button><button data-a="fit" class="pct" title="整張（雙擊圖面也可放大）">100%</button><button data-a="in" title="放大">＋</button></span>
      <button data-a="ghost" title="切換：白紙／霧化玻璃">◐</button><button data-a="close" title="關閉 (D)">✕</button></div>
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
    const d = this.d;
    if (d.main) {
      const g = el('g', {}, 'sch-decopart');
      g.innerHTML = d.main.deco;
      this.world.appendChild(g);
      this.world.appendChild(el('line', { x1: 370, y1: 20, x2: 370, y2: d.h - 20 }, 'sch-sep'));
      const t = el('text', { x: 800, y: 28 }, 'sch-title'); t.textContent = '控制電路（考生配線）'; this.world.appendChild(t);
      this.buildPart(d.main.syms, d.main.wires, 'm', 'main');
    }
    this.buildPart(d.syms, d.wires, '', 'ctl');
  }

  /** 一個部分（主電路／控制電路）：線、接點、符號、腳位 */
  private buildPart(syms: SchSym[], wires: [number, number][][], prefix: string, cls: string): void {
    const conn = connectivity({ syms, wires }, prefix);
    wires.forEach((w, i) => {
      const e = el('polyline', { points: w.map(p => p.join(',')).join(' ') }, `sch-w ${cls}`) as SVGPolylineElement;
      this.world.appendChild(e);
      this.wireEls.push({ net: conn.wireNet[i], e });
    });
    for (const p of conn.junctions) this.world.appendChild(el('circle', { cx: p.x, cy: p.y, r: 3.2 }, 'sch-dot'));
    for (const s of syms) {
      const g = el('g', { transform: `translate(${s.x},${s.y})`, 'data-sym': s.id }, `sym ${cls}`) as SVGGElement;
      g.innerHTML = symbolSvg(s, this.opts.color(s.dev));
      const hit = s.kind === 'ems' ? el('rect', { x: -22, y: -24, width: 44, height: 32 }, 'sym-hit')
        : s.kind === 'motor' || s.kind === 'motor3' ? el('circle', { r: 26 }, 'sym-hit')
        : s.kind === 'term' ? el('rect', { x: -8, y: -10, width: 22, height: 18 }, 'sym-hit')
        : el('rect', { x: -22, y: -24, width: s.kind === 'fuse' ? 44 : 56, height: 48 }, 'sym-hit');
      g.insertBefore(hit, g.firstChild);
      g.addEventListener('pointerenter', () => { this.ev.hoverSym(s); this.setHover({ syms: [s] }); });
      g.addEventListener('pointerleave', () => { this.ev.hoverSym(null); this.setHover({}); });
      g.addEventListener('click', () => { if (!this.moved) this.ev.clickSym(s.dev); });
      this.world.appendChild(g);
      this.symEls.push({ s, g });
      pinPos(s).forEach((p, i) => {
        const net = conn.pinNet.get(`${s.id}:${i}`)!;
        const refs = this.netRef.get(net) ?? new Set<string>();
        refs.add(this.opts.netOf(s.t[i]));
        this.netRef.set(net, refs);
        const c = el('circle', { cx: p.x, cy: p.y, r: 2.4 }, 'sch-pin') as SVGCircleElement;
        this.world.appendChild(c);
        this.pinEls.push({ net, e: c });
      });
    }
  }

  get isOpen(): boolean { return !this.el.hidden; }
  toggle(): void { this.isOpen ? this.close() : this.open(); }

  /**
   * 在游標旁邊叫出（不蓋住游標那一點：右側放得下就放右側，否則左側；垂直置中於游標），
   * 從游標方向縮放展開，並把圖稍微放大聚焦到對應的符號／節點。
   */
  openAt(cx: number, cy: number, focus: { devs?: string[]; terms?: string[] } = {}): void {
    // 呼叫時確保夠大：至少視窗寬 55%、高 65%（之前被拉小也會撐回來），但不超出畫面
    const gap = 28, m = 8;
    const w = Math.min(innerWidth - 2 * m, Math.max(this.el.offsetWidth || 0, innerWidth * 0.55, 640));
    const h = Math.min(innerHeight - 2 * m, Math.max(this.el.offsetHeight || 0, innerHeight * 0.65, 440));
    this.el.style.width = `${w}px`; this.el.style.height = `${h}px`;
    let left = cx + gap <= innerWidth - w - m ? cx + gap : cx - gap - w;
    left = Math.max(m, Math.min(innerWidth - w - m, left));
    const top = Math.max(m, Math.min(innerHeight - h - m, cy - h / 2));
    this.el.style.left = `${left}px`; this.el.style.top = `${top}px`;
    this.el.style.setProperty('--ox', `${cx - left}px`);
    this.el.style.setProperty('--oy', `${cy - top}px`);
    this.el.hidden = false;
    this.el.classList.remove('summon'); void this.el.offsetWidth; this.el.classList.add('summon');
    requestAnimationFrame(() => { this.fit(); this.focusOn(focus); });
    this.save();
  }

  /** 稍微聚焦：把相關符號框起來，放大到約 1.3～2.2 倍並置中；沒有對應符號就維持整張 */
  private focusOn(f: { devs?: string[]; terms?: string[] }): void {
    const devs = new Set(f.devs ?? []);
    const nets = this.netsOfTerms(f.terms ?? []);
    const body = new Set((f.terms ?? []).map(t => this.opts.body(t)));
    const hit = this.symEls.filter(({ s }) => devs.has(s.dev) || s.t.some(t => body.has(t)));
    const ptsX: number[] = [], ptsY: number[] = [];
    for (const { s } of hit) { ptsX.push(s.x - 30, s.x + 40); ptsY.push(s.y - 28, s.y + 28); }
    for (const { net, e } of this.wireEls) if (nets.has(net)) for (const p of e.getAttribute('points')!.split(' ')) { const [x, y] = p.split(',').map(Number); ptsX.push(x); ptsY.push(y); }
    this.setHover({ devs: [...devs], terms: f.terms ?? [] });
    if (!ptsX.length) return;
    const r = this.size(), fk = this.fitK();
    const bx = Math.min(...ptsX), by = Math.min(...ptsY), bw = Math.max(...ptsX) - bx, bh = Math.max(...ptsY) - by;
    const k = Math.max(fk * 1.3, Math.min(fk * 2.2, Math.min(r.width / (bw * 1.6), r.height / (bh * 1.6))));
    this.fitted = false;
    this.go({ k, x: r.width / 2 - (bx + bw / 2) * k, y: r.height / 2 - (by + bh / 2) * k }, true);
  }
  open(): void { this.el.hidden = false; requestAnimationFrame(() => this.fit()); this.save(); }
  close(): void { this.el.hidden = true; this.ev.hoverSym(null); this.save(); }

  /** 圖上哪些網路對應到這些實體端子（同一參考節點） */
  private netsOfTerms(terms: string[]): Set<string> {
    const refs = new Set(terms.map(t => this.opts.netOf(t)));
    return new Set([...this.netRef].filter(([, rs]) => [...rs].some(r => refs.has(r))).map(([n]) => n));
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
  has(dev: string): boolean { return this.symEls.some(x => x.s.dev === dev); }

  /** 動作解說同步：這一波動作的元件（以兩端端子對應符號）亮框，新帶電／斷電的那幾段線短暫標色 */
  setActive(a: { pairs: [string, string][]; termsOn: string[]; termsOff: string[] }, ms = 900): void {
    if (!this.isOpen) return;
    const syms = this.symEls.filter(({ s }) => a.pairs.some(([p, q]) => s.t.includes(p) && s.t.includes(q)));
    const on = this.netsOfTerms(a.termsOn), off = this.netsOfTerms(a.termsOff);
    const wires = this.wireEls.filter(w => on.has(w.net) || off.has(w.net));
    for (const { g } of syms) g.classList.add('act');
    for (const w of wires) w.e.classList.add(on.has(w.net) ? 'act-on' : 'act-off');
    setTimeout(() => {
      for (const { g } of syms) g.classList.remove('act');
      for (const w of wires) w.e.classList.remove('act-on', 'act-off');
    }, ms);
  }

  private paint(): void {
    const H = this.hover, G = this.guide;
    for (const { s, g } of this.symEls) {
      g.classList.toggle('hover', H.devs.has(s.dev) || s.t.some(t => H.terms.has(t)));
      g.classList.toggle('guide', s.t.some(t => G.terms.has(t)));
    }
    for (const { net, e } of this.wireEls) { e.classList.toggle('hover', H.nets.has(net)); e.classList.toggle('guide', G.nets.has(net)); }
    for (const { net, e } of this.pinEls) { e.classList.toggle('hover', H.nets.has(net)); e.classList.toggle('guide', G.nets.has(net)); }
  }

  /** 圖面區的版面尺寸（不受展開動畫的 CSS scale 影響，所以不用 getBoundingClientRect） */
  private size(): { width: number; height: number } {
    const b = this.svg.parentElement!;
    return { width: b.clientWidth, height: b.clientHeight };
  }
  /** 整張剛好塞滿的倍率（縮放百分比以它為 100%） */
  private fitK(): number {
    const r = this.size();
    return r.width < 10 ? 1 : Math.min(r.width / this.d.w, r.height / this.d.h) * 0.96;
  }
  private fitted = true;
  private fit(animate = false): void {
    const r = this.size(); if (r.width < 10) return;
    const k = this.fitK();
    this.fitted = true;
    this.go({ k, x: (r.width - this.d.w * k) / 2, y: (r.height - this.d.h * k) / 2 }, animate);
  }
  /** 以畫面上某點為中心縮放；超過範圍就夾住 */
  private zoomAt(f: number, px?: number, py?: number, animate = false): void {
    const r = this.size();
    const cx = px ?? r.width / 2, cy = py ?? r.height / 2;
    const fk = this.fitK();
    const k = Math.max(fk * 0.5, Math.min(fk * 8, this.view.k * f));
    const wx = (cx - this.view.x) / this.view.k, wy = (cy - this.view.y) / this.view.k;
    this.fitted = false;
    this.go({ k, x: cx - wx * k, y: cy - wy * k }, animate);
  }
  /** 不讓整張圖被拖出視窗外：至少留四分之一在畫面內 */
  private clamp(v: { x: number; y: number; k: number }) {
    const r = this.size();
    const w = this.d.w * v.k, h = this.d.h * v.k, mx = Math.min(w, r.width) * 0.25, my = Math.min(h, r.height) * 0.25;
    return { k: v.k, x: Math.min(r.width - mx, Math.max(mx - w, v.x)), y: Math.min(r.height - my, Math.max(my - h, v.y)) };
  }
  private anim = 0;
  private go(v: { x: number; y: number; k: number }, animate: boolean): void {
    cancelAnimationFrame(this.anim);
    const to = this.clamp(v);
    if (!animate) { this.view = to; this.apply(); return; }
    const from = { ...this.view }, t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / 180), e = 1 - Math.pow(1 - t, 3);
      this.view = { k: from.k + (to.k - from.k) * e, x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e };
      this.apply();
      if (t < 1) this.anim = requestAnimationFrame(step);
    };
    this.anim = requestAnimationFrame(step);
  }
  private apply(): void {
    this.world.setAttribute('transform', `translate(${this.view.x},${this.view.y}) scale(${this.view.k})`);
    const pct = this.el.querySelector<HTMLElement>('.pct');
    if (pct) pct.textContent = `${Math.round((this.view.k / this.fitK()) * 100)}%`;
  }

  private moved = false;
  private bind(): void {
    const head = this.el.querySelector<HTMLElement>('.schem-head')!;
    head.addEventListener('click', e => {
      const a = (e.target as HTMLElement).closest('button')?.dataset.a;
      if (a === 'close') this.close();
      else if (a === 'fit') this.fit(true);
      else if (a === 'in') this.zoomAt(1.4, undefined, undefined, true);
      else if (a === 'out') this.zoomAt(1 / 1.4, undefined, undefined, true);
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
      this.zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    // 雙擊：以該點放大 2 倍；已經很大就回到整張
    this.svg.addEventListener('dblclick', e => {
      const r = this.svg.getBoundingClientRect();
      if (this.view.k >= this.fitK() * 5) this.fit(true); else this.zoomAt(2, e.clientX - r.left, e.clientY - r.top, true);
    });
    this.svg.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      const sx = e.clientX, sy = e.clientY, v = { ...this.view };
      this.moved = false;
      const mv = (m: PointerEvent) => {
        if (Math.hypot(m.clientX - sx, m.clientY - sy) > 4) { this.moved = true; this.svg.classList.add('panning'); }
        if (!this.moved) return;
        this.fitted = false;
        this.go({ ...v, x: v.x + m.clientX - sx, y: v.y + m.clientY - sy }, false);
      };
      const up = () => { this.svg.classList.remove('panning'); window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    });
    // 視窗大小改變：原本是整張就重新塞滿；否則維持畫面中心那一點不動
    let last = { w: 0, h: 0 };
    new ResizeObserver(() => {
      if (!this.isOpen) return;
      const r = this.size();
      if (this.fitted || !last.w) this.fit();
      else this.go({ ...this.view, x: this.view.x + (r.width - last.w) / 2, y: this.view.y + (r.height - last.h) / 2 }, false);
      last = { w: r.width, h: r.height };
      this.save();
    }).observe(this.svg);
    this.el.addEventListener('pointerdown', e => {
      e.stopPropagation();
      if (e.button === 1) { e.preventDefault(); this.close(); }   // 中鍵：收起
    });
    this.el.addEventListener('mousedown', e => { if (e.button === 1) e.preventDefault(); });
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
