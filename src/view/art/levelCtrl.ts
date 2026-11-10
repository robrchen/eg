import type { ArtFn } from './types';
import { el, rect, text, bevel, hole } from './svg';
import { screw, led } from './parts';

/**
 * 液面控制器 61F-G：淺灰方盒，上緣一排 8 顆小螺絲端子（S0 S2 Tc Ta Tb E3 E2 E1，引線已配至 TB7，不可接），
 * 面板上 POWER（綠）／OPERATE（紅）燈。鉤子：[data-lcled=pwr|out]。
 */
export const drawLC: ArtFn = (g, _d, c) => {
  const { w, h, def } = c;
  g.appendChild(rect(1.6, 2.2, w, h, 2.4, 'drop'));
  g.appendChild(rect(0, 0, w, h, 2.4, 'shell-light ' + c.bodyCls));
  bevel(g, 0, 0, w, h, 2.4, .6);
  // 端子排（上緣深色帶）＋小螺絲
  g.appendChild(rect(2, 2, w - 4, 12, 1.2, 'shell-dark'));
  for (const t of def.terminals) screw(g, c.tx(t), t.y, 2.2);
  // 面板
  g.appendChild(rect(5, 18, w - 10, h - 23, 1.6, 'relay-face'));
  bevel(g, 5, 18, w - 10, h - 23, 1.6, .5);
  g.appendChild(text(w / 2, 32, c.label, 6.5, 'relay-label'));
  g.appendChild(text(w / 2, 39.5, 'FLOATLESS LEVEL CONTROLLER', 1.9, 'print faint'));
  led(g, 20, 48, 1.8, 'led-green', { 'data-lcled': 'pwr' });
  led(g, w - 20, 48, 1.8, 'led-red', { 'data-lcled': 'out' });
  g.appendChild(text(20, 54.5, 'POWER', 2, 'print'));
  g.appendChild(text(w - 20, 54.5, 'OPERATE', 2, 'print'));
  g.appendChild(text(w / 2, 52, 'OMRON', 2.4, 'print faint'));
  hole(g, 4, h - 4, 1.2); hole(g, w - 4, h - 4, 1.2);
};

/**
 * 電極棒（屋頂水塔）：固定座下垂三支不同長度的不鏽鋼棒——E1 最短（高水位）、E2 居中（低水位）、E3 最長（共用）。
 * 下方畫水面示意（[data-water]，setSim 依水位升降）。
 */
export const drawElectrode: ArtFn = (g, d, c) => {
  const { w, h, def } = c;
  g.appendChild(rect(1.2, 1.6, w, 12, 2, 'drop'));
  g.appendChild(rect(0, 0, w, 12, 2, 'shell-mid ' + c.bodyCls));
  bevel(g, 0, 0, w, 12, 2, .5);
  // 水面（淡藍，半透明）：高度由 setSim 設定
  g.appendChild(el('rect', { x: 2, y: h - 10, width: w - 4, height: 10, rx: 1, 'data-water': d.id }, 'elec-water'));
  const len: Record<string, number> = { E1: 26, E2: 38, E3: 54 };
  for (const t of def.terminals) {
    const x = c.tx(t);
    g.appendChild(rect(x - 1.1, 12, 2.2, (len[t.id] ?? 40) - 12, .6, 'clamp'));
    g.appendChild(rect(x - .4, 12, .6, (len[t.id] ?? 40) - 12, .3, 'edge-hi'));
    g.appendChild(text(x, (len[t.id] ?? 40) + 4.2, t.id, 3, 'elec-lbl'));
  }
  g.appendChild(text(w / 2, h + 6, '電極棒（屋頂水塔）', 3.6, 'device-sub'));
};

/**
 * 浮球開關（給水源）：黑色本體（接線端子在上）、電纜、浮球。有水時浮球浮起（.up）。
 * 鉤子：.fs-ball[data-cap]（通電測試點一下切換有水／無水）。
 */
export const drawFloat: ArtFn = (g, d, c) => {
  const { w, h } = c;
  g.appendChild(rect(1.2, 1.6, w, 12, 2, 'drop'));
  g.appendChild(rect(0, 0, w, 12, 2, 'shell-black ' + c.bodyCls));
  bevel(g, 0, 0, w, 12, 2, .5);
  g.appendChild(el('rect', { x: 2, y: h - 10, width: w - 4, height: 10, rx: 1, 'data-water': d.id }, 'elec-water'));
  // 電纜
  g.appendChild(el('path', { d: `M${w / 2},12 L${w / 2},${h - 22}` }, 'fs-cable'));
  // 位置用外層 g 的屬性 transform；內層 .pb-cap.fs-ball 用 CSS transform 做浮起／按下（CSS transform 會蓋掉屬性 transform，所以分兩層）
  const pos = el('g', { transform: `translate(${w / 2},${h - 14})` });
  const ball = el('g', { 'data-cap': d.id }, 'pb-cap fs-ball');
  pos.appendChild(ball);
  ball.appendChild(el('ellipse', { cx: .6, cy: .8, rx: 8.5, ry: 7 }, 'screw-shade'));
  ball.appendChild(el('ellipse', { cx: 0, cy: 0, rx: 8.5, ry: 7 }, 'fs-float'));
  ball.appendChild(el('ellipse', { cx: 0, cy: 0, rx: 8.5, ry: 7 }, 'dome'));
  ball.appendChild(el('title')).textContent = '浮球：通電測試點一下切換給水源有水／無水';
  g.appendChild(pos);
  g.appendChild(text(w / 2, h + 6, '浮球開關 FS（給水源）', 3.6, 'device-sub'));
};
