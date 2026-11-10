import type { ArtFn } from './types';
import { el, rect, text, bevel, hole } from './svg';
import { boxTerm, screw, dial } from './parts';

/**
 * 積熱電驛 TH-RY：淺灰殼體；左側主端子兩排（1 3 5／2 4 6，箱型端子，考場已配妥）、
 * 中段電流設定旋鈕、輔助接點座 95／96／98（引接到下方小 TB，本體只畫小螺絲）、右側深色操作區：
 * 跳脫指示窗、紅色 TEST（過載）鈕、藍色 RESET（復歸）鈕。
 * 鉤子：.body（跳脫時閃紅框）、[data-trip]（指示窗旗標，setSim 改 fill）、[data-thry=trip|reset].thry-btn。
 */
export const drawThry: ArtFn = (g, d, c) => {
  const { w, h, def } = c;
  g.appendChild(rect(1.6, 2.2, w, h, 2.4, 'drop'));
  g.appendChild(rect(0, 0, w, h, 2.4, 'shell-dark'));
  g.appendChild(rect(.5, .5, w - 1, h - 1, 2, c.bodyCls + ' thry-face'));
  bevel(g, .5, .5, w - 1, h - 1, 2, .5);

  // 主端子：上排 L1 L2 L3、下排 T1 T2 T3，黑色端子罩＋箱型端子＋金屬螺絲（不可接）
  const main = def.terminals.filter(t => t.role === 'main');
  for (const [ty] of [[9], [25]] as const) {
    const row = main.filter(t => t.y === ty);
    const xs = row.map(t => c.tx(t)).sort((p, q) => p - q);
    g.appendChild(rect(xs[0] - 8.5, ty - 7, xs[xs.length - 1] - xs[0] + 17, 14, 1.2, 'shell-black'));
    for (let i = 0; i <= xs.length; i++) {
      const rx = i === 0 ? xs[0] - 8 : i === xs.length ? xs[xs.length - 1] + 8 : (xs[i - 1] + xs[i]) / 2;
      g.appendChild(rect(rx - .6, ty - 7.6, 1.2, 15.2, .4, 'barrier'));
    }
    for (const x of xs) { boxTerm(g, x, ty, 8.6); screw(g, x, ty, 3.2); }
  }
  // 電流設定旋鈕（A）
  dial(g, 62, 9.5, 4.6, 35, 8);
  g.appendChild(text(62, 17.6, 'A', 2.2, 'print'));
  // 輔助接點座 95 / 96 98（引接到下方小 TB）：小螺絲＋印字
  g.appendChild(rect(35, 34, 36, 15, 1.2, 'shell-mid'));
  bevel(g, 35, 34, 36, 15, 1.2, .4);
  for (const [x, y, n] of [[62, 25, '95'], [44, 42, '96'], [62, 42, '98']] as const) {
    screw(g, x, y, 2.2);
    g.appendChild(text(x + 3.4, y + 1, n, 2.6, 'print' + (y === 25 ? '' : ' on-dark'), 'start'));
  }
  // 名稱
  g.appendChild(text(17, 45, c.label, 6.5, 'device-label'));
  hole(g, 4, h - 5, 1.2);

  // 右側操作區（深色）
  g.appendChild(rect(74, 2, 20, h - 4, 2, 'shell-black'));
  bevel(g, 74, 2, 20, h - 4, 2, .5);
  // 跳脫指示窗：玻璃＋旗標（setSim 以 fill 改色）
  g.appendChild(rect(76.6, 4.6, 14.8, 7, 1.2, 'glass'));
  g.appendChild(el('rect', { x: 77, y: 5, width: 14, height: 6, rx: 1, fill: '#333', 'data-trip': d.id }, 'thry-flag'));
  g.appendChild(rect(77.2, 5.2, 13.6, 2.4, 1, 'gloss'));
  // TEST（紅）：圓鈕，帽子有半球漸層與高光
  const tb = el('g', { 'data-thry': 'trip' }, 'thry-btn thry-test');
  tb.appendChild(el('circle', { cx: 84.5, cy: 21.6, r: 5.5 }, 'screw-shade'));
  tb.appendChild(el('circle', { cx: 84, cy: 21, r: 5.5 }, 'btn-red'));
  tb.appendChild(el('circle', { cx: 84, cy: 21, r: 5.5 }, 'dome'));
  tb.appendChild(el('title')).textContent = '過載：模擬跳脫（通電測試時）';
  g.appendChild(tb);
  g.appendChild(text(84, 31.5, '過載', 3.6, 'thry-cap'));
  // RESET（藍）：方鈕
  const rb = el('g', { 'data-thry': 'reset' }, 'thry-btn thry-reset');
  rb.appendChild(rect(77.5, 35.6, 14, 9, 1.5, 'screw-shade'));
  rb.appendChild(rect(77, 35, 14, 9, 1.5, 'btn-blue'));
  rb.appendChild(rect(77.6, 35.5, 12.8, 3.4, 1.2, 'gloss'));
  rb.appendChild(el('title')).textContent = '復歸 RESET';
  g.appendChild(rb);
  g.appendChild(text(84, 50, '復歸', 3.6, 'thry-cap'));
};
