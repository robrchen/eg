import { el, rect } from './svg';

/**
 * 器具共用零件（照片級）：箱型端子、金屬螺絲、旋鈕刻度盤、LED。
 * 可接線端子的螺絲由 panel.ts 的端子層畫（要有 hit／ring／halo），這裡只畫底下的口袋與壓線框；
 * 不可接的端子（主電路、引接）才在這裡連螺絲一起畫。
 */

/** 箱型端子：凹入口袋＋鉻色壓線框＋暗內框 */
export function boxTerm(g: Element, x: number, y: number, s: number): void {
  g.appendChild(rect(x - s * .58, y - s * .62, s * 1.16, s * 1.24, .9, 'pocket'));
  g.appendChild(rect(x - s * .44, y - s * .44, s * .88, s * .88, .8, 'clamp-frame'));
  g.appendChild(rect(x - s * .32, y - s * .32, s * .64, s * .64, .5, 'clamp-inner'));
}

/** 金屬十字螺絲（含落影與高光槽） */
export function screw(g: Element, x: number, y: number, r: number, attrs: Record<string, string | number> = {}, cls = 'screw'): SVGCircleElement {
  g.appendChild(el('circle', { cx: x + r * .13, cy: y + r * .18, r }, 'screw-shade'));
  const head = g.appendChild(el('circle', { cx: x, cy: y, r, ...attrs }, cls));
  const k = r * .6;
  g.appendChild(el('path', { d: `M${x - k + .3},${y + .4} L${x + k + .3},${y + .4} M${x + .4},${y - k + .3} L${x + .4},${y + k + .3}` }, 'screw-slot-hi'));
  g.appendChild(el('path', { d: `M${x - k},${y} L${x + k},${y} M${x},${y - k} L${x},${y + k}` }, 'screw-slot'));
  return head;
}

/** 旋鈕刻度盤：外環刻度、旋鈕、紅色指針（angle 0 = 正上方，順時針為正，單位度） */
export function dial(g: Element, cx: number, cy: number, r: number, angle: number, ticks = 10): void {
  g.appendChild(el('circle', { cx, cy, r: r + 1.8 }, 'dial-ring'));
  for (let i = 0; i <= ticks; i++) {
    const a = (-135 + (270 * i) / ticks) * Math.PI / 180;
    const r0 = r + .3, r1 = r + (i % 5 === 0 ? 1.5 : .9);
    g.appendChild(el('line', { x1: cx + Math.sin(a) * r0, y1: cy - Math.cos(a) * r0, x2: cx + Math.sin(a) * r1, y2: cy - Math.cos(a) * r1 }, 'dial-tick'));
  }
  g.appendChild(el('circle', { cx: cx + r * .1, cy: cy + r * .14, r }, 'screw-shade'));
  g.appendChild(el('circle', { cx, cy, r }, 'dial-knob'));
  const a = angle * Math.PI / 180;
  g.appendChild(el('line', { x1: cx - Math.sin(a) * r * .2, y1: cy + Math.cos(a) * r * .2, x2: cx + Math.sin(a) * r * .85, y2: cy - Math.cos(a) * r * .85 }, 'dial-pointer'));
  g.appendChild(el('circle', { cx: cx - r * .3, cy: cy - r * .3, r: r * .28 }, 'dial-hi'));
}

/** 小 LED（圓形，有凹座），cls 給顏色：led-green／led-orange／led-red；data 屬性讓 setSim 切 .on */
export function led(g: Element, cx: number, cy: number, r: number, cls: string, attrs: Record<string, string | number> = {}): SVGCircleElement {
  g.appendChild(el('circle', { cx, cy, r: r + .7 }, 'led-seat'));
  return g.appendChild(el('circle', { cx, cy, r, ...attrs }, 'led ' + cls));
}
