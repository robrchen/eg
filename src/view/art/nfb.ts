import type { ArtFn } from './types';
import { el, rect, text, bevel } from './svg';
import { boxTerm, screw } from './parts';
import { PHASE_COLOR } from '../../library';

/**
 * 無熔線開關 NFB 3P：黑色模鑄殼體、三極並排（極間溝槽）、上下端子罩（箱型端子；電源側已配妥，負載側可接）、
 * 中央共用把手（凹槽內上下翻）。
 * 鉤子：.body、.nfb-slot.nfb-handle、.nfb-lever[data-nfb-lever]、.nfb-grip[data-nfb]（setSim 改 fill）、[data-nfbtext]。
 */
export const drawNfb: ArtFn = (g, d, c) => {
  const { w, h, def } = c;
  g.appendChild(rect(1.6, 2.2, w, h, 2.4, 'drop'));
  g.appendChild(rect(0, 0, w, h, 2.4, 'shell-black ' + c.bodyCls));
  bevel(g, 0, 0, w, h, 2.4, .6);
  // 三極：略亮的面板，極間溝槽
  for (let i = 0; i < 3; i++) {
    const x = 11 + i * 24;
    g.appendChild(rect(x, 2, 22, h - 4, 1.6, 'nfb-pole2'));
    bevel(g, x, 2, 22, h - 4, 1.6, .4);
    g.appendChild(text(x + 11, 24.4, '75AT', 2.4, 'print on-dark'));
  }
  g.appendChild(text(w / 2, 53.2, c.label, 5.2, 'nfb-brand'));
  g.appendChild(text(w / 2, 57.6, '3P 220V 100AF  IC 10kA', 2, 'print on-dark faint'));
  // 端子：電源側（上，已配妥）畫螺絲並以相色小點標示；負載側（下）口袋，螺絲由端子層畫
  for (const t of def.terminals) {
    const x = c.tx(t);
    boxTerm(g, x, t.y, 8.8);
    if (t.wireable === false) {
      screw(g, x, t.y, 3.2);
      if (t.phase) g.appendChild(el('circle', { cx: x + 5.6, cy: t.y - 4.6, r: 1.4, fill: PHASE_COLOR[t.phase], stroke: 'rgba(0,0,0,.5)', 'stroke-width': .3 }));
    }
  }
  // 把手凹槽（整條都可點）
  g.appendChild(rect(7, 20, 78, 26, 3, 'nfb-slot nfb-handle'));
  g.appendChild(rect(7.4, 20.4, 77.2, 4, 2.4, 'gloss'));
  g.appendChild(text(w - .6, 23.6, 'ON', 2.6, 'nfb-mark', 'end'));
  g.appendChild(text(w - .6, 45, 'OFF', 2.6, 'nfb-mark', 'end'));
  // 把手：底色由 setSim 以 fill 切換（OFF 深灰／ON 綠），上面疊亮面與下緣暗邊做立體
  const lever = el('g', { 'data-nfb-lever': d.id }, 'nfb-handle nfb-lever');
  lever.appendChild(rect(9.6, 28.8, 74, 10, 2, 'screw-shade'));
  lever.appendChild(el('rect', { x: 9, y: 28, width: 74, height: 10, rx: 2, fill: '#444', 'data-nfb': d.id }, 'nfb-grip'));
  lever.appendChild(rect(9.6, 28.5, 72.8, 4, 1.6, 'gloss'));
  lever.appendChild(el('path', { d: 'M10.5,37.3 L81.5,37.3' }, 'edge-lo'));
  // 把手上的防滑橫紋
  for (const x of [20, 24, 28, 64, 68, 72]) lever.appendChild(rect(x, 30.2, 1, 5.6, .4, 'grip-rib'));
  lever.appendChild(text(w / 2, 35.2, 'OFF', 4.5, 'nfb-state')).setAttribute('data-nfbtext', d.id);
  g.appendChild(lever);
};
