import { describe, it, expect } from 'vitest';
import { Q2_1, teacherWires } from '../model/questions/q2-1';
import { teacherWiresOf } from '../model/questions/common';
import { grade, runScenario, structuralChecks, diffHints } from './grader';
import { Simulator } from './simulator';
import { isGroundWire } from '../library';

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

describe('設備接地（G → E）', () => {
  it('參考接線含 G→E，且畫成接地線', () => {
    const g = ref().filter(w => isGroundWire(Q2_1.devices, w));
    expect(g.map(w => `${w.a}-${w.b}`)).toEqual(['G_BAR.G2-E.E1']);
    expect(isGroundWire(Q2_1.devices, { a: 'MCF.A1', b: 'MCF.A2' })).toBe(false);
  });
  it('沒接 G→E：重大缺點「未施作設備接地」', () => {
    const w = ref().filter(x => !isGroundWire(Q2_1.devices, x));
    expect(structuralChecks(Q2_1, w).major.map(f => f.code)).toEqual(['M11']);
  });
  it('接到 G 的另一顆螺絲、E 的另一顆也算對（沒有差異提示）', () => {
    const w = ref().map(x => isGroundWire(Q2_1.devices, x) ? { ...x, a: 'G_BAR.G4', b: 'E.E3' } : x);
    expect(structuralChecks(Q2_1, w).major).toEqual([]);
    expect(diffHints(Q2_1, w)).toEqual([]);
  });
  it('接地端子接到控制電路：重大缺點', () => {
    const w = [...ref(), { id: 'x', a: 'G_BAR.G3', b: 'MCF.A1', panel: 'device' as const }];
    expect(structuralChecks(Q2_1, w).major.some(f => f.code === 'M11')).toBe(true);
  });
});
