import type { ArtFn } from './types';
import { rect, text, bevel, hole } from './svg';
import { boxTerm, led } from './parts';

/**
 * 保持電驛 KR：11 腳前接線底座（黑）＋中央窄長的電驛本體（SET／RESET 燈）。
 * 端子：上排 2 1 10 11、左欄 3 4、右欄 9、下排 5 6 7 8；端子號由端子層印在端子旁（白字）。
 * 鉤子：.tr-base、[data-krtext]、[data-krled=set|reset]。
 */
export const drawKeepRelay: ArtFn = (g, d, c) => {
  const { w, h, def } = c;
  g.appendChild(rect(1.6, 2.2, w, h, 3, 'drop'));
  g.appendChild(rect(0, 0, w, h, 3, 'shell-black tr-base'));
  bevel(g, 0, 0, w, h, 3, .6);
  for (const t of def.terminals) boxTerm(g, c.tx(t), t.y, 8.6);
  hole(g, 3.2, h / 2, 1.3); hole(g, w - 3.2, h / 2, 1.3);

  // 電驛本體：夾在左右端子號之間
  const fx = c.mirror ? w - 40.5 : 23.5, fy = 19.5, fw = 17, fh = 33;
  g.appendChild(rect(fx + 1.2, fy + 1.2, fw, fh, 1.6, 'drop'));
  g.appendChild(rect(fx, fy, fw, fh, 1.6, 'relay-face'));
  bevel(g, fx, fy, fw, fh, 1.6, .5);
  g.appendChild(text(fx + fw / 2, fy + 7.4, c.label, 4.4, 'relay-label'));
  led(g, fx + fw / 2 - 4.2, fy + 14.5, 1.4, 'led-green', { 'data-krled': 'set' });
  led(g, fx + fw / 2 + 4.2, fy + 14.5, 1.4, 'led-orange', { 'data-krled': 'reset' });
  g.appendChild(text(fx + fw / 2 - 4.2, fy + 19.6, 'SET', 1.8, 'print', 'middle'));
  g.appendChild(text(fx + fw / 2 + 4.2, fy + 19.6, 'RST', 1.8, 'print', 'middle'));
  g.appendChild(text(fx + fw / 2, fy + 26.6, '', 2.8, 'relay-count')).setAttribute('data-krtext', d.id);
  g.appendChild(text(fx + fw / 2, fy + fh - 1.6, '2c 11P', 1.8, 'print faint'));
};
