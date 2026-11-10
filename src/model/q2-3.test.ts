import { describe, it, expect } from 'vitest';
import { Q2_3 } from './questions/q2-3';
import { teacherWiresOf } from './questions/common';
import { connectivity, mainPhases } from './schematic';
import { elementError, netMismatches, coverage, pinClashes } from './schematicCheck';
import { structuralChecks, runScenario, grade } from '../engine/grader';
import { Simulator } from '../engine/simulator';
import { defOf, overlaps, specOf, isGroundTerm } from '../library';

const q = Q2_3;
const ref = teacherWiresOf(q);
const D = q.schematic!;

describe('第二站第三題 題目資料', () => {
  it('器具不互相重疊，參考接線用到的端子都存在且可接', () => {
    expect(overlaps(q.devices)).toEqual([]);
    const bad = ref.flatMap(w => [w.a, w.b]).filter(tid => {
      const [d, t] = [tid.slice(0, tid.indexOf('.')), tid.slice(tid.indexOf('.') + 1)];
      const inst = q.devices.find(x => x.id === d);
      return !inst || !defOf(inst.kind).terminals.some(x => x.id === t && x.wireable !== false);
    });
    expect(bad).toEqual([]);
  });

  it('材料表的器具都在（含數量），且都帶規格', () => {
    const count = (k: string) => q.devices.filter(d => d.kind === k).length;
    // NFB 1、D-F 2、MS 2（MC＋TH-RY）、X 1、MR 1、按鈕 4、COS 1、FS 1、燈 4、61F-G 1（附電極棒）、BZ 1、TB1 1、TB2/TB5 2、TB6/TB7 2、TB3/TB4 2、G、E
    expect([count('NFB'), count('DF'), count('MC'), count('THRY2'), count('RY'), count('MR'), count('PB'), count('COS'), count('FS'), count('PL'), count('LC'), count('ELEC'), count('BZ'), count('TB1'), count('TB4M'), count('TB8'), count('TB16'), count('GBAR'), count('EBAR')])
      .toEqual([1, 2, 2, 2, 1, 1, 4, 1, 1, 4, 1, 1, 1, 1, 2, 2, 2, 1, 1]);
    expect(q.devices.filter(d => !['TBM3', 'TBM4'].includes(d.kind) && !specOf(d)).map(d => d.id)).toEqual([]);
  });

  it('參考接線：每端子 ≤ 2 條線、無結構缺點（含 E3 接地）', () => {
    const { major, minor } = structuralChecks(q, ref);
    expect(major).toEqual([]);
    expect(minor).toEqual([]);
  });

  it('TB7 的 E3 格、TB6 的 E3 格算接地端子（引接自 61F-G／電極棒的 E3）', () => {
    expect(isGroundTerm(q, 'TB7.6')).toBe(true);
    expect(isGroundTerm(q, 'TB6.1')).toBe(true);
    expect(isGroundTerm(q, 'TB7.4')).toBe(false);
    expect(isGroundTerm(q.devices, 'TB7.6')).toBe(false);   // 沒給 passThrough 就看不出來
  });

  it('沒接 E3 接地線 → 重大缺點', () => {
    const w = ref.filter(x => !(x.a === 'TB7.6' && x.b === 'G_BAR.G3'));
    expect(structuralChecks(q, w).major.some(f => f.text.includes('E3'))).toBe(true);
  });
});

describe('第二站第三題 功能劇本（參考接線）', () => {
  for (const sc of q.scenarios) {
    it(sc.name, () => {
      const r = runScenario(q, ref, sc, q.timerDefaultSec);
      expect(r.failures).toEqual([]);
    });
  }

  it('自動水位：泵運轉時水位上升、滿水停泵後下降，一個週期內兩台泵各運轉一次', () => {
    const sim = new Simulator(q, ref);
    sim.hydro = true;
    sim.nfb(true); sim.setSwitch('COS', true); sim.run(300);
    expect(sim.snapshot().MC1).toBe(true);
    const ran = new Set<string>();
    for (let i = 0; i < 1200 && ran.size < 2; i++) {   // 最多 60 秒
      sim.run(50);
      if (sim.snapshot().MC1) ran.add('MC1');
      if (sim.snapshot().MC2) ran.add('MC2');
    }
    expect([...ran].sort()).toEqual(['MC1', 'MC2']);
    expect(sim.level).toBeGreaterThan(0);
  });

  it('評審：參考接線通過', () => {
    expect(grade(q, ref, q.timerDefaultSec).pass).toBe(true);
  });
});

describe('第二站第三題 劇本抓得到錯', () => {
  const sc = (name: string) => q.scenarios.find(s => s.name.startsWith(name))!;
  it('MR 的 3／4 接反：交替順序顛倒（劇本失敗）', () => {
    const swap: Record<string, string> = { 'MR.3': 'MR.4', 'MR.4': 'MR.3' };
    const w = ref.map(x => ({ ...x, a: swap[x.a] ?? x.a, b: swap[x.b] ?? x.b }));
    expect(runScenario(q, w, sc('自動 A：低水位'), 5).pass).toBe(false);
  });
  it('X 用 a 接點（1-4）而非 b（1-3）：滿水時才通電、平時不運轉（劇本失敗）', () => {
    const w = ref.map(x => ({ ...x, a: x.a === 'X.3' ? 'X.4' : x.a, b: x.b === 'X.3' ? 'X.4' : x.b }));
    expect(runScenario(q, w, sc('手動 M：ON1'), 5).pass).toBe(false);
  });
  it('電極 E2 沒接：61F-G 不會自保持，水在 E1、E2 之間就復歸（劇本失敗）', () => {
    const w = ref.filter(x => !(x.a === 'TB7.7' && x.b === 'TB6.2'));
    expect(runScenario(q, w, sc('水塔滿水'), 5).pass).toBe(false);
  });
  it('MC1 b 互鎖沒接到 MC2 線圈回路：手動時兩台可同時運轉（劇本失敗）', () => {
    const w = ref.map(x => (x.a === 'MR.4' && x.b === 'MC1.b左上') ? { ...x, b: 'MC2.A1' } : x).filter(x => !(x.a === 'MC1.b左下' && x.b === 'MC2.A1'));
    expect(runScenario(q, w, sc('手動 M：ON1'), 5).pass).toBe(false);
  });
});

describe('第二站第三題 單線圖', () => {
  it('每個符號都對到器具庫裡真的元件', () => {
    expect(D.syms.map(s => elementError(q, s)).filter(Boolean)).toEqual([]);
  });
  it('沒有懸空線端、腳位不重疊、符號 id 不重複', () => {
    expect(connectivity(D).dangling).toEqual([]);
    expect(pinClashes(D)).toEqual([]);
    expect(new Set(D.syms.map(s => s.id)).size).toBe(D.syms.length);
  });
  it('圖上相連 ⇔ 參考接線同節點', () => {
    expect(netMismatches(q, D, ref)).toEqual([]);
  });
  it('參考接線用到的元件都畫且只畫一次', () => {
    expect(coverage(q, D, ref)).toEqual({ missing: [], dup: [] });
  });
  it('驗證器抓得到錯：MR 1-3 與 1-4 在圖上對調', () => {
    const d = JSON.parse(JSON.stringify(D)) as typeof D;
    const mr = d.syms.find(s => s.id === 'mr')!;
    [mr.t[1], mr.t[2]] = [mr.t[2], mr.t[1]];
    expect(netMismatches(q, d, ref).length).toBeGreaterThan(0);
  });
  it('主電路：MC1 閉合 → M1 三相各不同；MC2 閉合 → M2；都不閉合 → 不帶電', () => {
    const main = D.main!;
    const phaseOf = (tid: string) => ({ 'TB1.A': 'R', 'TB1.B': 'S', 'TB1.C': 'T' } as Record<string, string>)[tid] ?? null;
    const m1 = mainPhases(main, new Set(['MC1']), phaseOf);
    expect(['M1.U', 'M1.V', 'M1.W'].map(t => [...m1.phase.get(t)!][0])).toEqual(['R', 'S', 'T']);
    expect(['M2.U', 'M2.V', 'M2.W'].every(t => m1.phase.get(t)!.size === 0)).toBe(true);
    const m2 = mainPhases(main, new Set(['MC2']), phaseOf);
    expect(['M2.U', 'M2.V', 'M2.W'].map(t => [...m2.phase.get(t)!][0])).toEqual(['R', 'S', 'T']);
    const none = mainPhases(main, new Set(), phaseOf);
    expect(['M1.U', 'M2.U'].every(t => none.phase.get(t)!.size === 0)).toBe(true);
    expect(connectivity(main).dangling).toEqual([]);
  });
});
