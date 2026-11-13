import type { ArtFn } from './types';
import { el, rect, text, bevel } from './svg';
import { boxTerm, screw } from './parts';
import { preSource } from '../../model/preWired';
import { ROLE_COLOR } from '../../library';

/** 小端子台上排（考場引接）螺絲的 y (mm) */
export const TB_TOP = 6;
/** TB2 下排（引出到電動機）螺絲的 y */
export const TB2_LOW = 30;

/**
 * 端子台（照片級）：深色底座上一格一格淺灰聚醯胺端子格，每格箱型端子＋金屬螺絲，
 * 同一格上下（或左右）兩顆螺絲以金屬片相連。可接線的螺絲由端子層畫（要有 hit／ring），
 * 考場已配妥的螺絲在這裡畫。
 */

/** 3P 電源端子台：三格並排，上方引入電源、下方引到 NFB（都是考場已配妥） */
export const drawTB1: ArtFn = (g, _d, c) => {
  const { w, h, def } = c;
  g.appendChild(rect(1.4, 2, w, h, 2, 'drop'));
  g.appendChild(rect(0, 0, w, h, 2, 'shell-dark ' + c.bodyCls));
  for (let i = 0; i < 3; i++) {
    const x = 11 + i * 24;
    g.appendChild(rect(x, 4, 22, h - 8, 1.4, 'tb-cell'));
    bevel(g, x, 4, 22, h - 8, 1.4, .4);
  }
  for (const t of def.terminals) boxTerm(g, c.tx(t), t.y, 9.4);
  const lb = text(5.5, h / 2, c.label, 5, 'device-label on-dark');
  lb.setAttribute('transform', `rotate(-90 5.5 ${h / 2})`);
  lb.setAttribute('dominant-baseline', 'middle');
  g.appendChild(lb);
};

/** 8P 雙排（主電路）：上排盤內主電路、下排引出到電動機；兩排同一金屬片 */
export const drawTB2: ArtFn = (g, _d, c) => {
  const { w, h, def } = c;
  g.appendChild(rect(1.4, 2, w, h, 2, 'drop'));
  g.appendChild(rect(0, 0, w, h, 2, 'shell-dark ' + c.bodyCls));
  for (const t of def.terminals) {
    const ux = c.tx(t);
    g.appendChild(rect(ux - 12, 3, 24, h - 6, 1.2, 'tb-cell'));
    bevel(g, ux - 12, 3, 24, h - 6, 1.2, .4);
    g.appendChild(rect(ux - 1.6, t.y, 3.2, TB2_LOW - t.y, .4, 'clamp'));
    boxTerm(g, ux, t.y, 8); screw(g, ux, t.y, 3);
    boxTerm(g, ux, TB2_LOW, 8); screw(g, ux, TB2_LOW, 3);
    g.appendChild(text(ux + 6.2, (t.y + TB2_LOW) / 2 + 1.6, t.label, 4, t.role === 'ground' || t.label === 'G' ? 'tb2-g' : 'print', 'start'));
  }
  g.appendChild(text(w + 3, h / 2 + 2, c.label, 5, 'device-label', 'start'));
};

/** 16P 雙排端子台：每個腳位左右各一顆螺絲同一金屬片；考生接線側可點，過門線側已配妥 */
export const drawTB16: ArtFn = (g, _d, c) => {
  const { w, h, def } = c;
  g.appendChild(rect(1.4, 2, w, h, 2, 'drop'));
  g.appendChild(rect(0, 0, w, h, 2, 'shell-dark ' + c.bodyCls));
  g.appendChild(text(w / 2, -5, c.label, 7, 'device-label'));
  const doorX = c.mirror ? 10 : w - 10;   // 過門線側朝門（器具板在右、操作面板鏡射後在左）
  const stubX = c.mirror ? -6 : w + 6;
  for (const t of def.terminals) {
    const ux = c.tx(t);
    g.appendChild(rect(2, t.y - 11, w - 4, 22, 1.2, 'tb-cell'));
    bevel(g, 2, t.y - 11, w - 4, 22, 1.2, .4);
    g.appendChild(rect(Math.min(ux, doorX), t.y - 1.4, Math.abs(doorX - ux), 2.8, .4, 'clamp'));
    boxTerm(g, ux, t.y, 8.2);
    boxTerm(g, doorX, t.y, 8.2); screw(g, doorX, t.y, 3.1);
    g.appendChild(el('path', { d: `M${doorX},${t.y} L${stubX},${t.y}` }, 'prewire'));
  }
};

/** 引接小端子台 3P／4P（無編號）：上排螺絲壓考場引接線（僅顯示），下排給考生；沒引接到器具的空位整格不畫 */
export const drawTBM: ArtFn = (g, d, c) => {
  const { w, h, def } = c;
  g.appendChild(rect(1.2, 1.6, w, h, 1.5, 'drop'));
  g.appendChild(rect(0, 0, w, h, 1.5, 'shell-dark ' + c.bodyCls));
  g.appendChild(text(w / 2, h + 5.5, c.label, 4.2, 'device-sub'));
  // 格寬跟著腳距（12P 的腳距 10mm，格子窄一點才不會互相蓋到）
  const pitch = def.terminals.length > 1 ? Math.abs(def.terminals[1].x - def.terminals[0].x) : 12;
  const cw = Math.min(11.2, pitch - .8), narrow = pitch < 11.5;
  for (const t of def.terminals) {
    const tid = `${d.id}.${t.id}`;
    if (c.spares.has(tid)) continue;
    const ux = c.tx(t);
    g.appendChild(rect(ux - cw / 2, 1.2, cw, h - 2.4, 1, 'tb-cell'));
    bevel(g, ux - cw / 2, 1.2, cw, h - 2.4, 1, .35);
    g.appendChild(rect(ux - 1.2, TB_TOP, 2.4, t.y - TB_TOP, .3, 'clamp'));
    boxTerm(g, ux, t.y, 7.4);
    boxTerm(g, ux, TB_TOP, 6.4); screw(g, ux, TB_TOP, 2.3);
    c.anchor(tid, ux, TB_TOP);
    // 標出這一格引接到器具的哪個接點（a 上 / b 下 / X1 / c …），顏色同接點角色
    const src = preSource(c.q, tid);
    if (src) {
      const mk = text(ux, -1.8, src.label, narrow ? 3.6 : 4.4, 'tb-mark');
      mk.setAttribute('fill', ROLE_COLOR[src.role]);
      g.appendChild(mk);
    }
  }
};

/** 接地線端子板 G（箱內）／接地極端子板 E（箱外、檢定崗位）：銅排＋螺絲＋接地符號 */
export const drawGroundBar: ArtFn = (g, d, c) => {
  const { w, h, def } = c;
  if (d.kind === 'EBAR') g.appendChild(rect(-6, -6, w + 26, h + 20, 3, 'ebar-zone'));
  g.appendChild(rect(1, 3.4, w, h - 4, 1.5, 'drop'));
  g.appendChild(rect(0, 2, w, h - 4, 1.5, 'copper'));
  bevel(g, 0, 2, w, h - 4, 1.5, .4);
  for (const t of def.terminals) g.appendChild(el('circle', { cx: c.tx(t) + .4, cy: t.y + .6, r: 3.4 }, 'screw-shade'));
  const gx = w + 7, gy = h / 2;
  const sym = d.kind === 'EBAR'
    ? `M${w},${gy} L${gx},${gy} M${gx},${gy} L${gx},${gy + 3} M${gx - 5},${gy + 3} L${gx + 5},${gy + 3} M${gx - 3.2},${gy + 5.4} L${gx + 3.2},${gy + 5.4} M${gx - 1.4},${gy + 7.8} L${gx + 1.4},${gy + 7.8}`
    : `M${w},${gy} L${gx},${gy} M${gx - 5},${gy} L${gx + 5},${gy} M${gx - 3.2},${gy + 2.4} L${gx + 3.2},${gy + 2.4} M${gx - 1.4},${gy + 4.8} L${gx + 1.4},${gy + 4.8}`;
  g.appendChild(el('path', { d: sym }, 'gnd-symbol'));
  g.appendChild(text(w / 2, h + (d.kind === 'EBAR' ? 7.5 : 5.5), d.kind === 'EBAR' ? '接地極端子板 E（檢定崗位）' : '接地線端子板 G', 4.2, 'device-sub'));
};
