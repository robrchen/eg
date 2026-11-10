import type { ArtFn } from './types';
import { el, text } from './svg';
import { boxTerm } from './parts';

/**
 * 栓型保險絲 D-F：黑色圓形栓座、鉻色旋蓋（滾花環）、中央琥珀色視窗（熔斷後 setSim 改成暗色）。
 * 上下兩個端子（可接，螺絲由端子層畫）。
 * 鉤子：.body、[data-fuse]。
 */
export const drawFuse: ArtFn = (g, d, c) => {
  const { w, h, def } = c;
  const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2;
  g.appendChild(el('circle', { cx: cx + 1.4, cy: cy + 2, r }, 'drop'));
  g.appendChild(el('circle', { cx, cy, r }, 'shell-black ' + c.bodyCls));
  g.appendChild(el('circle', { cx, cy, r: r - .8 }, 'ring-hi'));
  for (const t of def.terminals) boxTerm(g, c.tx(t), t.y, 7.6);
  // 旋蓋：鉻環＋滾花（細齒）
  g.appendChild(el('circle', { cx: cx + .6, cy: cy + .9, r: 12.4 }, 'screw-shade'));
  g.appendChild(el('circle', { cx, cy, r: 12.4 }, 'chrome'));
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    g.appendChild(el('line', { x1: cx + Math.cos(a) * 10.8, y1: cy + Math.sin(a) * 10.8, x2: cx + Math.cos(a) * 12.2, y2: cy + Math.sin(a) * 12.2 }, 'knurl'));
  }
  g.appendChild(el('circle', { cx, cy, r: 9.6 }, 'ring-dark'));
  // 琥珀色視窗（熔絲）：setSim 以 fill 切換
  g.appendChild(el('circle', { cx, cy, r: 8, fill: '#c9b458', stroke: 'rgba(0,0,0,.4)', 'stroke-width': .3, 'data-fuse': d.id }));
  g.appendChild(el('circle', { cx, cy, r: 8 }, 'dome'));
  g.appendChild(text(cx, cy + 1.6, 'D-F', 3.8, 'device-label'));
  g.appendChild(text(cx, cy + 16.8, '2A', 2.2, 'print on-dark faint'));
};
