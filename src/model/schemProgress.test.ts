import { describe, it, expect } from 'vitest';
import { QUESTIONS } from './questions';
import { Q2_1 } from './questions/q2-1';
import { Q2_3 } from './questions/q2-3';
import { teacherWiresOf } from './questions/common';
import { automorphisms, computeProgress } from './schemProgress';
import { defOf } from '../library';
import type { Wire } from './types';

const swapWires = (wires: Wire[], map: Record<string, string>): Wire[] => wires.map(w => ({ ...w, a: map[w.a] ?? w.a, b: map[w.b] ?? w.b }));

describe('器具的等效端子對應', () => {
  it('第一個是恆等；數量符合器具結構', () => {
    for (const k of ['MC', 'RY', 'MR', 'KR', 'THRY', 'THRY2', 'TR', 'PB', 'PL', 'COS', 'ELEC'] as const) {
      const a = automorphisms(defOf(k));
      expect([...a[0]].every(([x, y]) => x === y), k).toBe(true);
    }
    expect(automorphisms(defOf('MC')).length).toBe(128);   // a 兩組互換 × b 兩組互換 × 四個接點兩端對調 × 線圈兩端對調
    expect(automorphisms(defOf('RY')).length).toBe(4);     // 兩組 1c 接點互換 × 線圈兩端對調
    expect(automorphisms(defOf('KR')).length).toBe(8);     // 兩組接點互換 × SC 對調 × RC 對調（SC／RC 不互換）
    expect(automorphisms(defOf('THRY')).length).toBe(1);   // c 共用，a／b 不能換
    expect(automorphisms(defOf('TR')).length).toBe(2);     // 只有電源 2-7 可對調
    expect(automorphisms(defOf('ELEC')).length).toBe(1);   // E1／E2 功能不同
  });
  it('電驛兩組接點互換時 共用↔共用、a↔a、b↔b', () => {
    const swap = automorphisms(defOf('RY')).find(m => m.get('1') === '8')!;
    expect([swap.get('4'), swap.get('3'), swap.get('8'), swap.get('5'), swap.get('6')]).toEqual(['5', '6', '1', '4', '3']);
  });
});

describe('單線圖實時進度', () => {
  for (const q of QUESTIONS) {
    const D = q.schematic!;
    it(`${q.id}：沒接線 → 全部未接`, () => {
      const p = computeProgress(q, D, []);
      expect(p.done).toBe(0);
      expect(p.bad).toBe(0);
      expect(p.nets.filter(n => n.need > 0).every(n => n.state === 'none')).toBe(true);
      expect(p.total).toBeGreaterThan(10);
    });
    it(`${q.id}：參考接線 → 全部完成、沒有接錯與多餘，符號不改認`, () => {
      const p = computeProgress(q, D, teacherWiresOf(q));
      expect(p.nets.filter(n => n.state !== 'done').map(n => `${n.state}:${n.terms.join(',')}`)).toEqual([]);
      expect(p.done).toBe(p.total);
      expect(p.strays).toEqual([]);
      expect([...p.bind].filter(([a, b]) => a !== b)).toEqual([]);
    });
    it(`${q.id}：只接前三步 → 有「接了一部分」的節點，沒有接錯`, () => {
      const p = computeProgress(q, D, teacherWiresOf(q, q.teacherSteps.slice(0, 3)));
      expect(p.bad).toBe(0);
      expect(p.done).toBeLessThan(p.total);
      expect(p.nets.some(n => n.state === 'part' || n.state === 'done')).toBe(true);
      const part = p.nets.find(n => n.state === 'part');
      if (part) { expect(part.missing.length).toBeGreaterThan(0); expect(part.have).toBeLessThan(part.need); }
    });
  }

  const ref3 = teacherWiresOf(Q2_3), D3 = Q2_3.schematic!;
  it('第三題：MC1 自保改用 a右、兩端還對調 → 仍全部完成，符號改認 a右', () => {
    const w = swapWires(ref3, { 'MC1.a左上': 'MC1.a右下', 'MC1.a左下': 'MC1.a右上' });
    const p = computeProgress(Q2_3, D3, w);
    expect(p.done).toBe(p.total);
    expect(p.bad).toBe(0);
    expect(p.strays).toEqual([]);
    expect(p.bind.get('MC1.a左上')).toBe('MC1.a右下');
    expect(p.unbind.get('MC1.a右上')).toBe('MC1.a左下');
  });
  it('第三題：X 改用第二組接點（8-6）、MC2 線圈 A1／A2 對調 → 仍全部完成', () => {
    const w = swapWires(ref3, { 'X.1': 'X.8', 'X.3': 'X.6', 'MC2.A1': 'MC2.A2', 'MC2.A2': 'MC2.A1' });
    const p = computeProgress(Q2_3, D3, w);
    expect(p.nets.filter(n => n.state !== 'done').map(n => n.terms.join(','))).toEqual([]);
    expect(p.bind.get('X.3')).toBe('X.6');
  });
  it('第一題：MCF 的 a左／a右 整組對調 → 仍全部完成', () => {
    const w = swapWires(teacherWiresOf(Q2_1), { 'MCF.a左上': 'MCF.a右上', 'MCF.a右上': 'MCF.a左上', 'MCF.a左下': 'MCF.a右下', 'MCF.a右下': 'MCF.a左下' });
    const p = computeProgress(Q2_1, Q2_1.schematic!, w);
    expect(p.done).toBe(p.total);
    expect(p.bad).toBe(0);
  });
  it('接錯：把 MC1 線圈上端與 MC2 線圈上端接在一起 → 兩個節點都標接錯，並指出對方', () => {
    const p = computeProgress(Q2_3, D3, [...ref3, { id: 'x', a: 'R1_TB.1', b: 'R2_TB.1', panel: 'operator' }]);
    const bad = p.nets.filter(n => n.state === 'bad');
    expect(bad.length).toBe(2);
    expect(bad.some(n => n.terms.includes('MC1.A1') && n.clash.includes('MC2.A1'))).toBe(true);
    expect(p.done).toBe(p.total - 2);
  });
  it('多餘：線接到圖上沒用到的接點（MR.5）→ 那個節點標接錯並列出多餘端子', () => {
    const p = computeProgress(Q2_3, D3, [...ref3, { id: 'x', a: 'MR.5', b: 'MC1.A1', panel: 'device' }]);
    const bad = p.nets.filter(n => n.state === 'bad');
    expect(bad.length).toBe(1);
    expect(bad[0].stray).toEqual(['MR.5']);
  });
  it('多餘：兩個都不在圖上的端子互接 → 列在 strays，不影響節點', () => {
    const p = computeProgress(Q2_3, D3, [...ref3, { id: 'x', a: 'MR.5', b: 'X.5', panel: 'device' }]);
    expect(p.bad).toBe(0);
    expect(p.strays.sort()).toEqual(['MR.5', 'X.5']);
  });
  it('E3 接地接到 G 端子板的另一顆螺絲也算（同一塊銅排）', () => {
    const w = swapWires(ref3, { 'G_BAR.G3': 'G_BAR.G5' });
    const p = computeProgress(Q2_3, D3, w);
    expect(p.done).toBe(p.total);
  });
  it('same()：參考接線下 DF1.下 與 BZ 的引接 TB 相通', () => {
    const p = computeProgress(Q2_3, D3, ref3);
    expect(p.same('DF1.下', 'BZ.1')).toBe(true);
    expect(p.same('DF1.下', 'DF2.下')).toBe(false);
  });
});
