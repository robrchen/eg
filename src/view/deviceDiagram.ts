import type { DeviceDef } from '../model/types';
import { ROLE_COLOR } from '../library';

export interface DiagramOpts {
  /** 器具實例 id（端子全域 id 前綴）；省略則只做展示 */
  devId?: string;
  displayOnly?: boolean;
  onClick?(tid: string): void;
  onHover?(tid: string | null, x: number, y: number): void;
}

const h = (tag: string, cls = '', html = ''): HTMLElement => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };

/** 器具端子示意圖（大字、可點）；資訊卡與器具庫共用 */
export function buildDeviceDiagram(def: DeviceDef, opts: DiagramOpts = {}): { root: HTMLElement; buttons: Map<string, HTMLButtonElement> } {
  const buttons = new Map<string, HTMLButtonElement>();
  const pad = 12;
  const W = def.card?.w ?? def.w, H = def.card?.h ?? def.h;
  const P = (t: { id: string; x: number; y: number }): [number, number] => def.card?.pos[t.id] ?? [t.x, t.y];
  const root = h('div', 'card-diagram');
  root.style.aspectRatio = `${Math.max(0.6, Math.min(2.6, W / H))}`;
  const px = (x: number) => pad + (x / W) * (100 - 2 * pad);
  const py = (y: number) => pad + (y / H) * (100 - 2 * pad);


  for (const t of def.terminals) {
    const tid = `${opts.devId ?? def.kind}.${t.id}`;
    const isW = t.wireable !== false && !opts.displayOnly;
    const b = h('button', 'card-term' + (t.wireable === false ? ' disabled' : ''), `${t.label || '•'}`) as HTMLButtonElement;
    const [cx, cy] = P(t);
    b.style.left = `${px(cx)}%`; b.style.top = `${py(cy)}%`;
    b.style.background = ROLE_COLOR[t.role];
    b.title = `${tid}${t.sub ? '（' + t.sub + '）' : ''}`;
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
  return { root, buttons };
}
