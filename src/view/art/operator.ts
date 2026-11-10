import type { ArtFn } from './types';
import { el, text } from './svg';

/**
 * 操作面板器具 Ø30（A22 系列）：鉻面固定環、黑色安裝井、按鈕帽／鏡頭半球漸層＋高光月牙。
 * 燈／按鈕本體端子由考場引接到小 TB，本體上不畫端子。
 * 鉤子：.body.op-bezel、.face（蜂鳴器震動）、.pb-cap[data-cap]（按下縮進）、.lamp[data-lamp]（setSim 改 fill／color）、.bz-ring[data-bzring]。
 */
export const drawOperator: ArtFn = (g, d, c) => {
  const { w } = c;
  const r = w / 2;
  g.appendChild(el('circle', { cx: r + 1.4, cy: r + 1.8, r }, 'drop'));
  // 鉻面固定環（外）與鎖緊螺帽（內，深金屬）
  g.appendChild(el('circle', { cx: r, cy: r, r }, c.bodyCls + ' op-bezel'));
  g.appendChild(el('circle', { cx: r, cy: r, r: r - 1.2 }, 'ring-hi'));
  g.appendChild(el('circle', { cx: r, cy: r, r: r - 3 }, 'op-ring'));
  const face = el('g', {}, 'face');
  g.appendChild(face);
  const gloss = (parent: Element, rr: number) => {
    parent.appendChild(el('path', { d: `M${r - rr * .72},${r - rr * .1} A${rr * .78},${rr * .78} 0 0 1 ${r + rr * .1},${r - rr * .72} A${rr * .95},${rr * .95} 0 0 0 ${r - rr * .72},${r - rr * .1}Z` }, 'op-gloss'));
  };
  if (d.kind === 'PB') {
    face.appendChild(el('circle', { cx: r, cy: r, r: r * .6 }, 'pb-well'));
    // EMS（蕈狀、自鎖）：帽子大一圈，外圈黃色警示環
    if (d.latch) {
      face.appendChild(el('circle', { cx: r, cy: r, r: r * .86 }, 'ems-ring'));
      face.appendChild(el('circle', { cx: r, cy: r, r: r * .86 }, 'dome'));
    }
    const cr = r * (d.latch ? 0.68 : 0.5);
    const cap = el('g', { 'data-cap': d.id }, 'pb-cap' + (d.latch ? ' ems' : ''));
    cap.appendChild(el('circle', { cx: r, cy: r, r: cr, fill: d.color ?? '#999' }, 'pb-top'));
    cap.appendChild(el('circle', { cx: r, cy: r, r: cr }, 'dome'));
    gloss(cap, cr);
    face.appendChild(cap);
  } else {
    const lr = r * 0.56;
    face.appendChild(el('circle', { cx: r, cy: r, r: lr + 1.6 }, 'pb-well'));
    if (d.kind === 'BZ') for (const k of [0, 1]) face.appendChild(el('circle', { cx: r, cy: r, r: lr, 'data-bzring': String(k) }, 'bz-ring'));
    const lamp = el('circle', { cx: r, cy: r, r: lr, fill: dimLamp(d.color ?? '#999'), 'data-lamp': d.id }, 'lamp');
    lamp.style.color = d.color ?? '#fff';
    face.appendChild(lamp);
    if (d.kind === 'BZ') {
      // 蜂鳴器發聲孔：中心一圈、外圈六孔
      const holes: [number, number][] = [[r, r]];
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.PI / 6; holes.push([r + Math.cos(a) * lr * .58, r + Math.sin(a) * lr * .58]); }
      for (const [hx, hy] of holes) face.appendChild(el('circle', { cx: hx, cy: hy, r: 1.3 }, 'bz-hole'));
    } else {
      // 指示燈鏡頭：半球漸層＋內緣細亮環（透明鏡頭的厚度感）
      face.appendChild(el('circle', { cx: r, cy: r, r: lr }, 'dome'));
      face.appendChild(el('circle', { cx: r, cy: r, r: lr - 1.2 }, 'lens-ring'));
    }
    gloss(face, lr);
  }
  face.appendChild(text(r, r + 2.6, c.label, 6.5, 'device-label op-label'));
};

/** 未亮時的燈色：原色調暗（setSim 熄燈時也用同一個公式） */
export function dimLamp(color: string): string {
  const c = color.replace('#', '');
  const n = parseInt(c.length === 3 ? c.split('').map(x => x + x).join('') : c, 16);
  return `rgb(${Math.round(((n >> 16) & 255) * .35)},${Math.round(((n >> 8) & 255) * .35)},${Math.round((n & 255) * .35)})`;
}
