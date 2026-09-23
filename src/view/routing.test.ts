import { describe, it, expect } from 'vitest';
import { routeWire } from './routing';
import { Q2_1 } from '../model/questions/q2-1';

const ducts = Q2_1.ducts.filter(d => d.panel === 'device');
// 橫向線槽看 y 是否在槽內（x 允許在槽端外一小段：端子不在槽的正下方時，線是從槽口側出），直向線槽反之
const inside = (p: { x: number; y: number }) =>
  ducts.some(d => d.w >= d.h
    ? p.y >= d.y && p.y <= d.y + d.h && p.x >= d.x - 20 && p.x <= d.x + d.w + 20
    : p.x >= d.x && p.x <= d.x + d.w && p.y >= d.y - 20 && p.y <= d.y + d.h + 20);

describe('routeWire', () => {
  it('不論導線 id 為何（含雜湊為負的長 id），中途轉折點都在線槽內', () => {
    // NFB.A 與 DF1.上 的出線點（器具外 8mm）
    const a = { x: 52, y: 189 }, b = { x: 181, y: 107 };
    const ids = ['t1-0', 'wmuddqr972', ...Array.from({ length: 300 }, (_, i) => `w${(1790056435080 + i * 7919).toString(36)}${(i % 36).toString(36)}`)];
    for (const id of ids) {
      const pts = routeWire(a, b, ducts, id);
      // 首尾是出線點（在線槽外），其餘每個轉折點都必須落在某條線槽矩形內
      for (const p of pts.slice(1, -1)) expect(inside(p), `${id} → ${p.x},${p.y}`).toBe(true);
    }
  });
});
