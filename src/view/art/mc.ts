import type { ArtFn } from './types';
import { el, rect, text, bevel, well, hole, slits } from './svg';

/**
 * 電磁接觸器 MC（OMRON J7KN 外觀，正視 2.5D，光自左上）
 * 幾何同器具庫：本體 x 16–92、左右側掛接點塊各 16mm、線圈端子座 A1 右上／A2 左下。
 * 保留的鉤子：.body（hover／focus／解說描邊）、[data-led].mc-led（吸合旗標）。
 */
export const drawMC: ArtFn = (g, d, c) => {
  const { w, h, def } = c;
  const main = def.terminals.filter(t => t.role === 'main');
  const aux = def.terminals.filter(t => t.role === 'a' || t.role === 'b');
  const coil = def.terminals.filter(t => t.role === 'coil');

  /* 落影：整個輪廓往右下偏一點 */
  for (const [x, y, bw, bh] of [[16, 0, w - 32, h], [0, 12, 16, 72], [w - 16, 12, 16, 72]] as const) g.appendChild(rect(x + 1.6, y + 2.2, bw, bh, 2.4, 'drop'));

  /* 側掛輔助接點塊（1a1b）＋線圈端子座：獨立殼體、端子井凹陷 */
  const block = (x: number, y: number, bw: number, bh: number) => {
    g.appendChild(rect(x, y, bw, bh, 1.6, 'shell-light mc-aux2'));
    bevel(g, x, y, bw, bh, 1.6);
  };
  block(0, 12, 16, 72); block(w - 16, 12, 16, 72);
  block(w - 16, 0, 16, 10); block(0, h - 10, 16, 10);
  for (const t of aux) well(g, c.tx(t), t.y, 10.4);
  for (const t of coil) well(g, c.tx(t), t.y, 8.4);
  // 接點塊上緣卡榫（扣在本體上的小舌片）
  for (const x of [4, w - 12]) g.appendChild(rect(x, 10.6, 8, 2.6, .6, 'shell-mid'));

  /* 本體：深色底盤露出一圈，淺灰殼體在上 */
  g.appendChild(rect(16, 0, w - 32, h, 2.6, 'shell-dark mc-chassis'));
  g.appendChild(rect(17.2, 1.2, w - 34.4, h - 2.4, 2, c.bodyCls + ' mc-face'));
  bevel(g, 17.2, 1.2, w - 34.4, h - 2.4, 2, .7);
  // 兩側散熱槽
  for (const x of [18.6, w - 18.6 - 2.2]) slits(g, x, 31, 2.2, 7, 5);
  // 安裝螺絲孔
  hole(g, 20, 48, 1.5); hole(g, w - 20, 48, 1.5);

  /* 上下主接點端子罩（深灰塑膠）：分極隔板、進線口、金屬螺絲 */
  const mx = main.map(t => t.x).sort((p, q) => p - q);
  const pitch = mx.length > 1 ? mx[1] - mx[0] : 16;
  const cx0 = mx[0] - pitch / 2, cx1 = mx[mx.length - 1] + pitch / 2;
  for (const [y0, top] of [[4, true], [h - 26, false]] as const) {
    g.appendChild(rect(cx0 - 2, y0, cx1 - cx0 + 4, 22, 1.6, 'shell-dark mc-cover2'));
    bevel(g, cx0 - 2, y0, cx1 - cx0 + 4, 22, 1.6);
    // 分極隔板（亮稜）
    for (let i = 1; i < mx.length; i++) {
      const rx = (mx[i - 1] + mx[i]) / 2;
      g.appendChild(rect(rx - .6, y0 + 1, 1.2, 20, .4, 'rib'));
    }
    // 進線口：靠外側那一邊的方孔
    for (const x of mx) g.appendChild(rect(x - 3.6, top ? y0 + 1.6 : y0 + 22 - 1.6 - 4, 7.2, 4, .8, 'slot'));
  }
  for (const t of main) {
    const x = t.x;
    g.appendChild(el('circle', { cx: x, cy: t.y, r: 4.4 }, 'screw'));
    g.appendChild(el('path', { d: `M${x - 2.1},${t.y + .5} L${x + 2.5},${t.y + .5} M${x + .5},${t.y - 2.1} L${x + .5},${t.y + 2.5}` }, 'screw-slot-hi'));
    g.appendChild(el('path', { d: `M${x - 2.4},${t.y} L${x + 2.4},${t.y} M${x},${t.y - 2.4} L${x},${t.y + 2.4}` }, 'screw-slot'));
  }

  /* 中央銘牌（白色、微亮膜）＋印字＋動作指示窗 */
  g.appendChild(rect(22, 29, w - 44, 38, 2, 'plate'));
  g.appendChild(rect(22.6, 29.6, w - 45.2, 6, 1.4, 'gloss'));
  g.appendChild(text(24.5, 34.6, 'OMRON', 2.9, 'print', 'start'));
  g.appendChild(text(w - 24.5, 34.6, 'J7KN  2a2b', 2.6, 'print', 'end'));
  g.appendChild(text(w / 2, 47.5, c.label, 11, 'device-label'));
  if (d.desc) g.appendChild(text(w / 2, 64.2, d.desc.length > 8 ? d.desc.slice(0, 8) + '…' : d.desc, 3, 'print'));
  // 指示窗：深色玻璃、上緣反光；吸合時旗標往右滑並亮綠
  g.appendChild(rect(w / 2 - 9, 52, 18, 9, 1.4, 'glass mc-win'));
  g.appendChild(el('rect', { x: w / 2 - 8, y: 53, width: 8, height: 7, rx: 1, 'data-led': d.id }, 'mc-led'));
  g.appendChild(rect(w / 2 - 8.6, 52.4, 17.2, 3, 1.2, 'gloss'));
  g.appendChild(text(w / 2 - 10.6, 57.6, 'OFF', 2.4, 'print', 'end'));
  g.appendChild(text(w / 2 + 10.6, 57.6, 'ON', 2.4, 'print', 'start'));
};
