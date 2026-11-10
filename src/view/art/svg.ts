/** SVG 建構小工具（面板與器具外觀模組共用） */
export const NS = 'http://www.w3.org/2000/svg';

export const el = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, cls?: string): SVGElementTagNameMap[K] => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (cls) e.setAttribute('class', cls);
  return e;
};

export const text = (x: number, y: number, s: string, size: number, cls: string, anchor?: string): SVGTextElement => {
  const t = el('text', { x, y, 'font-size': size }, cls);
  if (anchor) { t.setAttribute('text-anchor', anchor); t.style.textAnchor = anchor; }   // 用 style 才蓋得過 CSS 的 text-anchor
  t.textContent = s;
  return t;
};

/** 圓角矩形（常用於殼體層疊） */
export const rect = (x: number, y: number, w: number, h: number, r: number, cls: string, attrs: Record<string, string | number> = {}): SVGRectElement =>
  el('rect', { x, y, width: w, height: h, rx: r, ...attrs }, cls);

/**
 * 殼體邊緣亮暗線：光自左上，上、左緣亮，右、下緣暗。
 * 用兩條 path 疊在殼體上，不佔 class hook。
 */
export function bevel(parent: Element, x: number, y: number, w: number, h: number, r: number, inset = .6): void {
  const i = inset;
  parent.appendChild(el('path', { d: `M${x + i},${y + h - r} L${x + i},${y + r} Q${x + i},${y + i} ${x + r},${y + i} L${x + w - r},${y + i}` }, 'edge-hi'));
  parent.appendChild(el('path', { d: `M${x + w - i},${y + r} L${x + w - i},${y + h - r} Q${x + w - i},${y + h - i} ${x + w - r},${y + h - i} L${x + r},${y + h - i}` }, 'edge-lo'));
}

/** 端子井：凹陷的方孔（內緣亮、底部暗），螺絲由端子層另外畫在上面 */
export function well(parent: Element, cx: number, cy: number, size: number, cls = 'well'): void {
  const s = size / 2;
  parent.appendChild(rect(cx - s, cy - s, size, size, size * .12, cls));
  // 底部亮緣：讓孔看起來有深度
  parent.appendChild(el('path', { d: `M${cx - s + .5},${cy + s - .4} L${cx + s - .5},${cy + s - .4} L${cx + s - .4},${cy - s + .6}` }, 'well-rim'));
  // 壓線片（金屬方片）在孔內
  parent.appendChild(rect(cx - s * .66, cy - s * .66, s * 1.32, s * 1.32, .5, 'clamp'));
}

/** 固定螺絲孔（小圓凹） */
export function hole(parent: Element, cx: number, cy: number, r: number): void {
  parent.appendChild(el('circle', { cx, cy, r }, 'hole'));
  parent.appendChild(el('circle', { cx: cx - r * .25, cy: cy - r * .25, r: r * .45 }, 'hole-core'));
}

/** 散熱／裝飾細槽（一組等距橫槽） */
export function slits(parent: Element, x: number, y: number, w: number, n: number, pitch: number, cls = 'slit'): void {
  for (let i = 0; i < n; i++) parent.appendChild(rect(x, y + i * pitch, w, pitch * .42, pitch * .2, cls));
}
