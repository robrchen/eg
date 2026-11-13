import type { ArtFn } from './types';
import { el, rect, text, bevel, hole } from './svg';
import { boxTerm, led } from './parts';

/**
 * 8 腳底座上的電驛（與限時電驛同一種 P2CF-08 底座）：
 * - RY 輔助電驛（MK2P 風）：透明防塵蓋，看得到裡面的線圈與銜鐵；POWER 燈隨線圈亮。
 * - MR 棘輪電驛（G4Q 風）：黑色本體，位置小窗顯示目前在第 1／第 2 台。
 * 鉤子：.tr-base、[data-trled=pwr]（線圈得電）、[data-mrtext]（MR 位置）、.ry-arm（RY 銜鐵，吸合時下壓）。
 */
export const drawRelay8: ArtFn = (g, d, c) => {
  const { w, h, def } = c;
  g.appendChild(rect(1.6, 2.2, w, h, 3, 'drop'));
  g.appendChild(rect(0, 0, w, h, 3, 'shell-black tr-base'));
  bevel(g, 0, 0, w, h, 3, .6);
  const rows = [def.terminals.filter(t => t.y < h / 2), def.terminals.filter(t => t.y >= h / 2)];
  for (const row of rows) {
    const xs = row.map(t => c.tx(t)).sort((p, q) => p - q);
    const ty = row[0].y;
    g.appendChild(rect(3, ty - 9.5, w - 6, 19, 1.4, 'shell-dark'));
    for (const x of xs) boxTerm(g, x, ty, 9.4);
    for (let i = 0; i <= xs.length; i++) {
      const rx = i === 0 ? xs[0] - 7 : i === xs.length ? xs[xs.length - 1] + 7 : (xs[i - 1] + xs[i]) / 2;
      g.appendChild(rect(rx - .7, ty - 9.5, 1.4, 19, .5, 'barrier'));
    }
  }
  hole(g, 3.6, h / 2, 1.5); hole(g, w - 3.6, h / 2, 1.5);

  const fy = 27.5, fh = 15, fx = 7, fw = w - 14;
  g.appendChild(rect(fx + 1.6, fy + 1.2, fw, fh, 1.6, 'drop'));
  if (d.kind === 'RY') {
    // 透明蓋：淺色玻璃，裡面深色線圈、銜鐵片、接點簧片
    g.appendChild(rect(fx, fy, fw, fh, 1.6, 'relay-face'));
    g.appendChild(rect(fx + 3, fy + 3, 16, fh - 6, 1, 'shell-dark'));            // 線圈
    for (let i = 0; i < 4; i++) g.appendChild(rect(fx + 4.5 + i * 3.4, fy + 4, 1.6, fh - 8, .4, 'copper'));
    g.appendChild(rect(fx + 21, fy + 3.2, 12, 1.6, .4, 'clamp ry-arm'));             // 銜鐵
    for (let i = 0; i < 2; i++) g.appendChild(rect(fx + 22 + i * 5, fy + 6, 1, fh - 8.5, .3, 'clamp'));   // 簧片
    g.appendChild(rect(fx + .8, fy + .8, fw - 1.6, 3.2, 1.2, 'gloss'));   // 透明蓋的反光
    led(g, fx + fw - 6, fy + 4.4, 1.3, 'led-green', { 'data-trled': 'pwr' });
    g.appendChild(text(fx + fw - 6, fy + fh - 2.2, 'PWR', 1.9, 'print'));
    g.appendChild(text(fx + 38, fy + fh / 2 + 1.8, c.label, 4.8, 'relay-label'));
    g.appendChild(text(fx + 1.6, fy + fh - 1.2, 'MK2P 2c', 1.8, 'print faint', 'start'));
  } else {
    // 棘輪電驛：黑色本體、白字標籤、位置小窗
    g.appendChild(rect(fx, fy, fw, fh, 1.6, 'shell-black'));
    bevel(g, fx, fy, fw, fh, 1.6, .5);
    g.appendChild(text(fx + 13, fy + fh / 2 + (c.label.length > 4 ? 1.1 : 1.8), c.label, c.label.length > 4 ? 3 : 4.8, 'relay-label')).style.fill = '#e9ecf0';
    g.appendChild(rect(fx + 25, fy + 3, 11, fh - 6, 1, 'mc-win-soft'));
    const t = g.appendChild(text(fx + 30.5, fy + fh / 2 + 2, '', 5, 'relay-count'));
    t.setAttribute('data-mrtext', d.id);
    led(g, fx + fw - 6, fy + 4.4, 1.3, 'led-green', { 'data-trled': 'pwr' });
    g.appendChild(text(fx + fw - 6, fy + fh - 2.2, 'PWR', 1.9, 'print on-dark'));
    g.appendChild(text(fx + 38, fy + fh - 1.6, 'RATCHET', 1.8, 'print faint on-dark', 'start'));
  }
  for (const x of [11, w - 12.6]) g.appendChild(rect(x, fy - 1.3, 1.6, 1.3, .3, 'shell-mid'));
  g.appendChild(el('path', { d: `M${fx + .6},${fy + .5} L${fx + fw - .6},${fy + .5}` }, 'edge-hi'));
};
