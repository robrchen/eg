import type { ArtFn } from './types';
import { el, rect, text, bevel, hole, slits } from './svg';

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
  // 輔助接點／線圈端子：同主接點的箱型端子（凹入口袋＋鉻色壓線框），螺絲由端子層畫在上面
  const boxTerm = (x: number, y: number, s: number) => {
    g.appendChild(rect(x - s * .58, y - s * .62, s * 1.16, s * 1.24, .9, 'pocket'));
    g.appendChild(rect(x - s * .44, y - s * .44, s * .88, s * .88, .8, 'clamp-frame'));
    g.appendChild(rect(x - s * .32, y - s * .32, s * .64, s * .64, .5, 'clamp-inner'));
  };
  for (const t of aux) boxTerm(c.tx(t), t.y, 8.6);   // 與 A1／A2 同樣大小
  for (const t of coil) boxTerm(c.tx(t), t.y, 8.6);
  // 接點塊上緣卡榫（扣在本體上的小舌片）
  for (const x of [4, w - 12]) g.appendChild(rect(x, 10.6, 8, 2.6, .6, 'shell-mid'));

  /* 本體：深色底盤露出一圈，淺灰殼體在上 */
  g.appendChild(rect(16, 0, w - 32, h, 2.6, 'shell-dark mc-chassis'));
  g.appendChild(rect(16.5, .5, w - 33, h - 1, 2.2, c.bodyCls + ' mc-face'));
  bevel(g, 16.5, .5, w - 33, h - 1, 2.2, .5);
  // 兩側散熱槽
  for (const x of [18.6, w - 18.6 - 2.2]) slits(g, x, 31, 2.2, 7, 5);
  // 安裝螺絲孔
  hole(g, 20, 48, 1.5); hole(g, w - 20, 48, 1.5);

  /* 上下主接點端子罩（黑色塑膠）：每極一個凹入的端子口袋，裡面是方形壓線框（箱型端子）＋金屬螺絲；
     極間與兩端有絕緣隔板突出；導線由外側進線口進入 */
  const mx = main.map(t => t.x).sort((p, q) => p - q);
  const pitch = mx.length > 1 ? mx[1] - mx[0] : 16;
  const cx0 = mx[0] - pitch / 2, cx1 = mx[mx.length - 1] + pitch / 2;
  for (const [y0, top] of [[4, true], [h - 26, false]] as const) {
    const sy = top ? 15 : h - 15;   // 螺絲中心 y
    g.appendChild(rect(cx0 - 2, y0, cx1 - cx0 + 4, 22, 1.6, 'shell-dark mc-cover2'));
    bevel(g, cx0 - 2, y0, cx1 - cx0 + 4, 22, 1.6);
    for (const x of mx) {
      // 端子口袋（凹入）
      g.appendChild(rect(x - 6, y0 + 2.2, 12, 17.6, 1, 'pocket'));
      // 進線口：外側邊上的圓角方孔，與口袋相連
      g.appendChild(rect(x - 3.4, top ? y0 - .6 : y0 + 22 - 3.2, 6.8, 3.8, 1.3, 'slot'));
      // 箱型壓線框：金屬方框（外亮內暗），螺絲穿過中央
      g.appendChild(rect(x - 4.9, sy - 4.9, 9.8, 9.8, .9, 'clamp-frame'));
      g.appendChild(rect(x - 3.6, sy - 3.6, 7.2, 7.2, .6, 'clamp-inner'));
      // 壓線框下方可見的導線壓板（亮金屬薄片）
      g.appendChild(rect(x - 4.2, top ? sy + 5.6 : sy - 7, 8.4, 1.4, .4, 'clamp'));
    }
    // 絕緣隔板：極間與兩端，略突出端子罩
    for (let i = 0; i <= mx.length; i++) {
      const rx = i === 0 ? cx0 : i === mx.length ? cx1 : (mx[i - 1] + mx[i]) / 2;
      g.appendChild(rect(rx - .9, y0 - 1.2, 1.8, 24.4, .5, 'barrier'));
      g.appendChild(el('path', { d: `M${rx - .5},${y0 - .8} L${rx - .5},${y0 + 22.6}` }, 'edge-hi'));
    }
  }
  for (const t of main) {
    const x = t.x;
    g.appendChild(el('circle', { cx: x + .5, cy: t.y + .7, r: 3.9 }, 'screw-shade'));
    g.appendChild(el('circle', { cx: x, cy: t.y, r: 3.9 }, 'screw'));
    g.appendChild(el('path', { d: `M${x - 2},${t.y + .45} L${x + 2.4},${t.y + .45} M${x + .45},${t.y - 2} L${x + .45},${t.y + 2.4}` }, 'screw-slot-hi'));
    g.appendChild(el('path', { d: `M${x - 2.3},${t.y} L${x + 2.3},${t.y} M${x},${t.y - 2.3} L${x},${t.y + 2.3}` }, 'screw-slot'));
  }

  /* 中央銘牌（白色、微亮膜）＋印字＋動作指示窗 */
  g.appendChild(rect(22, 29, w - 44, 38, 2, 'plate'));
  g.appendChild(rect(22.6, 29.6, w - 45.2, 6, 1.4, 'gloss'));
  g.appendChild(text(24.5, 34.6, 'OMRON', 2.9, 'print', 'start'));
  g.appendChild(text(w - 24.5, 34.6, 'J7KN  2a2b', 2.6, 'print', 'end'));
  g.appendChild(text(w / 2, 47.5, c.label, 11, 'device-label'));
  if (d.desc) g.appendChild(text(w / 2, 64.2, d.desc.length > 8 ? d.desc.slice(0, 8) + '…' : d.desc, 3, 'print'));
  // 動作指示窗：網頁上只是吸合時旗標變綠的小裝飾，畫得低調（淺灰窗、灰旗標，無反光與字）
  g.appendChild(rect(w / 2 - 7, 53, 14, 6.5, 1.2, 'mc-win-soft'));
  g.appendChild(el('rect', { x: w / 2 - 6.4, y: 53.6, width: 6, height: 5.3, rx: .9, 'data-led': d.id }, 'mc-led'));
};
