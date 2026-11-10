import type { ArtFn } from './types';
import { el, rect, text, bevel, hole } from './svg';
import { boxTerm, dial, led } from './parts';

/**
 * 限時電驛：P2CF-08 前接線 8P 底座（黑）＋插在中央的 H3CR-G8L 本體（淺灰面板、時間旋鈕、POWER／OUT 燈）。
 * 端子上排 6 5 4 3、下排 7 8 1 2，端子號由端子層印在端子排與本體之間（白字）。
 * 鉤子：.tr-base（hover／解說描邊）、[data-trtext]（倒數）、[data-trled=pwr|out]（燈）。
 */
export const drawTimer: ArtFn = (g, d, c) => {
  const { w, h, def } = c;
  g.appendChild(rect(1.6, 2.2, w, h, 3, 'drop'));
  g.appendChild(rect(0, 0, w, h, 3, 'shell-black tr-base'));
  bevel(g, 0, 0, w, h, 3, .6);
  // 上下端子排：略亮一階的黑，端子口袋＋壓線框；極間小隔板
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

  // 電驛本體（面板）：介於兩排端子號之間
  const fy = 27.5, fh = 15;
  g.appendChild(rect(8.6, fy + 1.2, w - 14, fh, 1.6, 'drop'));
  g.appendChild(rect(7, fy, w - 14, fh, 1.6, 'relay-face'));
  bevel(g, 7, fy, w - 14, fh, 1.6, .5);
  // 時間旋鈕（刻度 0–30 s；指針位置只是示意）
  dial(g, 16.5, fy + fh / 2, 4.2, 20, 10);
  // POWER（綠）／OUT（橘）指示燈
  led(g, 28.5, fy + 4.2, 1.3, 'led-green', { 'data-trled': 'pwr' });
  led(g, 28.5, fy + fh - 4.2, 1.3, 'led-orange', { 'data-trled': 'out' });
  g.appendChild(text(31.4, fy + 5.3, 'PWR', 2, 'print', 'start'));
  g.appendChild(text(31.4, fy + fh - 3.1, 'OUT', 2, 'print', 'start'));
  // 名稱與倒數
  g.appendChild(text(41, fy + 6.2, c.label, 4.6, 'relay-label', 'start'));
  g.appendChild(text(41, fy + fh - 2.6, '', 4, 'relay-count', 'start')).setAttribute('data-trtext', d.id);
  g.appendChild(text(w - 8.4, fy + 3.4, d.kind === 'TRF' ? 'OFF-DELAY' : 'H3CR', 1.9, 'print faint', 'end'));
  g.appendChild(text(w - 8.4, fy + fh - 1.4, '0–30 s', 1.9, 'print faint', 'end'));
  // 本體上的小卡榫（扣住底座）
  for (const x of [11, w - 12.6]) g.appendChild(rect(x, fy - 1.3, 1.6, 1.3, .3, 'shell-mid'));
  g.appendChild(el('path', { d: `M${7.6},${fy + .5} L${w - 7.6},${fy + .5}` }, 'edge-hi'));
};
