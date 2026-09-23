import { describe, it, expect } from 'vitest';
import { Q2_1, teacherWires } from '../model/questions/q2-1';
import { teacherWiresOf } from '../model/questions/common';
import { grade, runScenario, structuralChecks, diffHints } from './grader';
import { Simulator } from './simulator';

const ref = () => teacherWires();

describe('第二站第一題 參考接線', () => {
  it('老師 18 步展開後每端子 ≤ 2 條線、無結構缺點', () => {
    const { major, minor } = structuralChecks(Q2_1, ref());
    expect(major).toEqual([]);
    expect(minor).toEqual([]);
  });

  it('功能劇本全部通過', () => {
    const r = grade(Q2_1, ref(), 5);
    for (const s of r.scenarios) expect(s.failures, s.name).toEqual([]);
    expect(r.major).toEqual([]);
    expect(r.hints).toEqual([]);
    expect(r.pass).toBe(true);
  });

  it('未投入 NFB 時全部無電', () => {
    const sim = new Simulator(Q2_1, ref());
    sim.run(500);
    expect(Object.values(sim.snapshot()).every(v => v === false)).toBe(true);
  });
});

describe('錯誤接線偵測', () => {
  it('拆掉 MCF 自保持 → 放開 FWD 後 MCF 掉電', () => {
    const wires = ref().filter(w => !(w.a === 'MCF.a左下' && w.b === 'MCR.b左上'));
    const r = runScenario(Q2_1, wires, Q2_1.scenarios[1], 5);
    expect(r.pass).toBe(false);
    expect(r.failures[0]).toContain('MCF=OFF');
  });

  it('MCR 互鎖 b 接點誤接成 a 接點 → 正轉無法啟動', () => {
    const wires = ref().map(w => {
      const fix = (t: string) => t === 'MCR.b左上' ? 'MCR.a左上' : t === 'MCR.b左下' ? 'MCR.a左下' : t;
      return { ...w, a: fix(w.a), b: fix(w.b) };
    });
    const r = runScenario(Q2_1, wires, Q2_1.scenarios[1], 5);
    expect(r.pass).toBe(false);
    expect(diffHints(Q2_1, wires).length).toBeGreaterThan(0);
  });

  it('A 相直接接到共同回線 → 短路、保險絲燒斷', () => {
    const wires = [...ref(), { id: 'x', a: 'DF1.下', b: 'TR.7', panel: 'device' as const }];
    const r = runScenario(Q2_1, wires, Q2_1.scenarios[0], 5);
    expect(r.short).toBe(true);
    expect(grade(Q2_1, wires).major.some(f => f.code === 'M2')).toBe(true);
  });

  it('接到 TB1 電源側 → 重大缺點', () => {
    const wires = ref().map(w => ({ ...w, a: w.a === 'NFB.A' ? 'TB1.A' : w.a }));
    const { major } = structuralChecks(Q2_1, wires);
    expect(major.some(f => f.code === 'M10')).toBe(true);
  });

  it('漏接 BZ → 器具未使用', () => {
    const wires = ref().filter(w => !w.a.startsWith('BZ') && !w.b.startsWith('BZ'));
    const { major } = structuralChecks(Q2_1, wires);
    expect(major.some(f => f.text.includes('BZ'))).toBe(true);
  });

  it('等效接法（a左/a右 對調）不產生差異提示且功能通過', () => {
    const swap = (t: string) => t.replace(/^MCS\.a左/, 'MCS.a右TMP').replace(/^MCS\.a右(?!TMP)/, 'MCS.a左').replace('TMP', '');
    const wires = ref().map(w => ({ ...w, a: swap(w.a), b: swap(w.b) }));
    const r = grade(Q2_1, wires);
    expect(r.hints).toEqual([]);
    expect(r.major).toEqual([]);
  });
});

describe('通用接線鏈展開', () => {
  it('第一題用通用函式展開的結果與原本相同', () => {
    expect(teacherWiresOf(Q2_1)).toEqual(teacherWires());
  });
});
