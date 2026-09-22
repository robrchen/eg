import type { DeviceDef, TerminalDef } from '../model/types';
import { ROLE_COLOR } from '../library';

export interface DiagramOpts {
  /** 器具實例 id（端子全域 id 前綴）；省略則只做展示 */
  devId?: string;
  displayOnly?: boolean;
  /** 可接端子直徑 (px) */
  term?: number;
  /** 主電路等不可接端子直徑 (px) */
  main?: number;
  /** 端子間至少預留的間隙 (px) */
  gap?: number;
  /** 緊湊模式：高度只取剛好夠用的，不依器具長寬比拉高 */
  compact?: boolean;
  /** 回 true 的端子不畫（例：小端子台未引接的空位） */
  skip?(id: string): boolean;
  /** 覆寫端子的顯示文字與顏色（例：小端子台標出它引接自哪個接點） */
  tag?(id: string): { label: string; role: TerminalDef['role']; title?: string } | null;
  /** 器具在鏡射面板（開門背面）上時左右翻轉，與面板上看到的一致 */
  mirror?: boolean;
  onClick?(tid: string): void;
  onHover?(tid: string | null, x: number, y: number): void;
}

const PAD = 12;   // 圖框內邊距（%）

/**
 * 算出圖框至少要多大，端子才不會互相重疊。
 * 先由同欄（x 相同）推垂直縮放、同列（y 相同）推水平縮放，
 * 再檢查斜向配對，兩軸都不夠就整體放大。
 */
function fitBox(
  pts: { x: number; y: number; s: number }[],
  W: number, H: number, gap: number,
): { w: number; h: number } {
  if (pts.length < 2) return { w: 0, h: 0 };
  const need = (a: typeof pts[0], b: typeof pts[0]) => (a.s + b.s) / 2 + gap;
  let sx = 0, sy = 0;
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    const a = pts[i], b = pts[j];
    const dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y), n = need(a, b);
    if (dx < 0.5 && dy >= 0.5) sy = Math.max(sy, n / dy);
    else if (dy < 0.5 && dx >= 0.5) sx = Math.max(sx, n / dx);
  }
  if (!sx) sx = sy;
  if (!sy) sy = sx;
  if (!sx && !sy) return { w: 0, h: 0 };
  let k = 1;
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    const a = pts[i], b = pts[j];
    const dx = Math.abs(a.x - b.x) * sx, dy = Math.abs(a.y - b.y) * sy, n = need(a, b);
    const far = Math.max(dx, dy);
    if (far < n) k = Math.max(k, far > 0.5 ? n / far : 1);
  }
  const inner = 1 - 2 * PAD / 100;
  return { w: Math.ceil(W * sx * k / inner), h: Math.ceil(H * sy * k / inner) };
}

const h = (tag: string, cls = '', html = ''): HTMLElement => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };

/** 器具端子示意圖（大字、可點）；資訊卡與器具庫共用 */
export function buildDeviceDiagram(def: DeviceDef, opts: DiagramOpts = {}): { root: HTMLElement; buttons: Map<string, HTMLButtonElement>; fit: { w: number; h: number } } {
  const buttons = new Map<string, HTMLButtonElement>();
  const W = def.card?.w ?? def.w, H = def.card?.h ?? def.h;
  const P = (t: { id: string; x: number; y: number }): [number, number] => {
    const [x, y] = def.card?.pos[t.id] ?? [t.x, t.y];
    return opts.mirror ? [(def.card?.w ?? def.w) - x, y] : [x, y];
  };
  const termSize = opts.term ?? 40, mainSize = opts.main ?? 30, gap = opts.gap ?? 4;
  const sizeOf = (t: { wireable?: boolean }) => (t.wireable === false ? mainSize : termSize);
  const root = h('div', 'card-diagram');
  root.style.setProperty('--term', `${termSize}px`);
  root.style.setProperty('--main', `${mainSize}px`);
  // 圖框至少要這麼大，端子才不會疊在一起
  const shown = def.terminals.filter(t => !opts.skip?.(t.id));
  const fit = fitBox(shown.map(t => { const [x, y] = P(t); return { x, y, s: sizeOf(t) }; }), W, H, gap);
  if (fit.w) root.style.minWidth = `${fit.w}px`;
  if (fit.h) root.style.minHeight = `${fit.h}px`;
  if (opts.compact && fit.h && !def.card?.keepAspect) root.style.height = `${fit.h}px`;
  else root.style.aspectRatio = `${Math.max(0.6, Math.min(2.6, W / H))}`;
  const px = (x: number) => PAD + (x / W) * (100 - 2 * PAD);
  const py = (y: number) => PAD + (y / H) * (100 - 2 * PAD);


  for (const t of shown) {
    const tid = `${opts.devId ?? def.kind}.${t.id}`;
    const isW = t.wireable !== false && !opts.displayOnly;
    const tag = opts.tag?.(t.id) ?? null;
    const b = h('button', 'card-term' + (t.wireable === false ? ' disabled' : ''), `${tag?.label || t.short || t.label || '•'}`) as HTMLButtonElement;
    const [cx, cy] = P(t);
    b.style.left = `${px(cx)}%`; b.style.top = `${py(cy)}%`;
    b.style.background = ROLE_COLOR[tag?.role ?? t.role];
    b.title = tag?.title ?? `${tid}${t.sub ? '（' + t.sub + '）' : ''}`;
    if (t.sub) b.appendChild(h('span', 'sub', t.sub));
    if (isW) {
      b.appendChild(h('span', 'occ'));
      b.onclick = () => opts.onClick?.(tid);
      b.onpointerenter = ev => opts.onHover?.(tid, ev.clientX, ev.clientY);
      b.onpointerleave = () => opts.onHover?.(null, 0, 0);
      buttons.set(tid, b);
    }
    root.appendChild(b);
  }
  return { root, buttons, fit };
}
