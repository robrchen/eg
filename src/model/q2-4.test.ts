import { describe, it, expect } from 'vitest';
import { Q2_4 } from './questions/q2-4';
import { teacherWiresOf } from './questions/common';
import { connectivity, mainPhases } from './schematic';
import { elementError, netMismatches, coverage, pinClashes } from './schematicCheck';
import { structuralChecks, runScenario, grade } from '../engine/grader';
import { Simulator } from '../engine/simulator';
import { defOf, overlaps, specOf, isGroundTerm, isFloatLead, groundOk, isGroundWire } from '../library';
import { computeProgress } from './schemProgress';
import { spareTerminals } from './preWired';

const q = Q2_4;
const ref = teacherWiresOf(q);
const D = q.schematic!;
const swapWires = (map: Record<string, string>) => ref.map(w => ({ ...w, a: map[w.a] ?? w.a, b: map[w.b] ?? w.b }));

describe('第二站第四題 題目資料', () => {
  it('器具不互相重疊，參考接線用到的端子都存在且可接', () => {
    expect(overlaps(q.devices)).toEqual([]);
    const bad = ref.flatMap(w => [w.a, w.b]).filter(tid => {
      const [d, t] = [tid.slice(0, tid.indexOf('.')), tid.slice(tid.indexOf('.') + 1)];
      const inst = q.devices.find(x => x.id === d);
      return !inst || inst.display || !defOf(inst.kind).terminals.some(x => x.id === t && x.wireable !== false);
    });
    expect(bad).toEqual([]);
  });

  it('材料表的器具都在（含數量），且都帶規格', () => {
    const count = (k: string) => q.devices.filter(d => d.kind === k).length;
    // NFB 3、D-F 2、MC 2、TH-RY 2、X 1、61F-APN2 1、按鈕 4、COS 1、燈 5、BZ 1、61F-G2 1、浮球 2、TB1 1、TB2/TB6 2、TB5 1、TB3/TB4 2、G、E
    expect([count('NFB'), count('DF'), count('MC'), count('THRY'), count('RY'), count('MR'), count('PB'), count('COS2'), count('PL'), count('BZ'), count('LC2'), count('BS'), count('TB1'), count('TB4M'), count('TB12'), count('TB16'), count('GBAR'), count('EBAR')])
      .toEqual([3, 2, 2, 2, 1, 1, 4, 1, 5, 1, 1, 2, 1, 2, 1, 2, 1, 1]);
    expect(q.devices.filter(d => !['TBM3', 'TBM4'].includes(d.kind) && !specOf(d)).map(d => d.id)).toEqual([]);
  });

  it('參考接線：13 條過門線、每端子 ≤ 2 條線、無結構缺點（含 E3 接地）', () => {
    const door = new Set(ref.flatMap(w => [w.a, w.b]).filter(t => t.startsWith('TB3.')));
    expect(door.size).toBe(13);
    const { major, minor } = structuralChecks(q, ref);
    expect(major).toEqual([]);
    expect(minor).toEqual([]);
  });

  it('TB5 只有第 12 格是空位；E3 格算接地端子，浮球引線可同時接 E3（接地）與 E1／E4', () => {
    expect([...spareTerminals(q)].filter(t => t.startsWith('TB5.'))).toEqual(['TB5.12']);
    expect(isGroundTerm(q, 'TB5.10')).toBe(true);
    expect(isGroundTerm(q, 'TB5.8')).toBe(false);
    expect(isFloatLead(q, 'TB7.1')).toBe(true);
    expect(isFloatLead(q, 'TB5.8')).toBe(false);
    expect(groundOk(q, 'TB5.10', 'TB7.1')).toBe(true);    // E3 → 浮球共用線
    expect(groundOk(q, 'TB7.2', 'TB5.8')).toBe(true);     // 浮球 → E1
    expect(groundOk(q, 'TB5.10', 'G_BAR.G3')).toBe(true); // E3 接地
    expect(groundOk(q, 'TB5.10', 'TB5.8')).toBe(false);   // E3 不能直接接 E1
    expect(groundOk(q, 'G_BAR.G1', 'MC1.A1')).toBe(false);
    expect(isGroundWire(q, { a: 'TB5.10', b: 'G_BAR.G3' })).toBe(true);
    expect(isGroundWire(q, { a: 'TB5.10', b: 'TB7.1' })).toBe(false);   // 浮球共用線是一般控制線
  });

  it('沒接 E3 接地線 → 重大缺點', () => {
    const w = ref.filter(x => !(x.a === 'TB5.10' && x.b === 'G_BAR.G3'));
    expect(structuralChecks(q, w).major.some(f => f.text.includes('E3'))).toBe(true);
  });
});

describe('第二站第四題 功能劇本（參考接線）', () => {
  for (const sc of q.scenarios) {
    it(sc.name, () => {
      const r = runScenario(q, ref, sc, q.timerDefaultSec);
      expect(r.failures).toEqual([]);
    });
  }

  it('TB1 在 NFB3 負載側：沒投入時不帶電', () => {
    const sim = new Simulator(q, ref);
    sim.run(100);
    expect(sim.terminalPhase('TB1.A')).toBe(null);
    sim.nfb(true); sim.run(100);
    expect(sim.terminalPhase('TB1.A')).toBe('A');
  });

  it('自動水位（一般進水）：兩台泵輪流運轉，不會同時運轉', () => {
    const sim = new Simulator(q, ref);
    sim.hydro = true;
    sim.nfb(true); sim.setSwitch('COS', true);
    const order: string[] = [];
    let both = false;
    for (let i = 0; i < 2400 && order.length < 3; i++) {   // 最多 120 秒
      sim.run(50);
      const s = sim.snapshot();
      if (s.MC1 && s.MC2) both = true;
      const cur = s.MC1 ? 'MC1' : s.MC2 ? 'MC2' : '';
      if (cur && order[order.length - 1] !== cur) order.push(cur);
    }
    expect(both).toBe(false);
    expect(order.length).toBe(3);
    expect(order[0]).not.toBe(order[1]);
    expect(order[2]).toBe(order[0]);
  });

  it('自動水位（大量進水）：一台排不完 → 升到異常水位 → 兩台並列、Y 亮，之後水位退到低水位全停', () => {
    const sim = new Simulator(q, ref);
    sim.hydro = true; sim.inflow = .10;
    sim.nfb(true); sim.setSwitch('COS', true);
    let parallel = false, stopped = false, peak = 0;
    for (let i = 0; i < 2400 && !stopped; i++) {
      sim.run(50);
      const s = sim.snapshot();
      peak = Math.max(peak, sim.level);
      if (s.MC1 && s.MC2 && s.Y && s.X) parallel = true;
      if (parallel && !s.MC1 && !s.MC2) stopped = true;
    }
    expect(parallel).toBe(true);
    expect(stopped).toBe(true);
    expect(peak).toBeGreaterThanOrEqual(.9);
    expect(sim.level).toBeLessThanOrEqual(.25);
  });

  it('用手抬浮球（不改水位）：抬 BS1 → 一台運轉；再抬 BS2 → 兩台並列；放下 → 停', () => {
    const sim = new Simulator(q, ref);
    sim.nfb(true); sim.setSwitch('COS', true); sim.run(300);
    sim.press('BS1', true); sim.run(300);
    const a = sim.snapshot();
    expect([a.MC1, a.MC2].filter(Boolean).length).toBe(1);
    sim.press('BS2', true); sim.run(300);
    expect(sim.snapshot()).toMatchObject({ MC1: true, MC2: true, Y: true });
    sim.press('BS2', true); sim.press('BS1', true); sim.run(300);
    expect(sim.snapshot()).toMatchObject({ MC1: false, MC2: false, Y: false });
  });

  it('切換開關先斷後接：手動運轉中切到 A 再切回 M，泵不會被自保帶著繼續轉', () => {
    const sim = new Simulator(q, ref);
    sim.nfb(true); sim.run(100);
    sim.press('ON1', true); sim.run(200); sim.press('ON1', false); sim.run(200);
    expect(sim.snapshot().MC1).toBe(true);
    sim.setSwitch('COS', true); sim.run(300);
    expect(sim.snapshot().MC1).toBe(false);
    sim.setSwitch('COS', false); sim.run(300);
    expect(sim.snapshot().MC1).toBe(false);
  });

  it('評審：參考接線通過', () => {
    expect(grade(q, ref, q.timerDefaultSec).pass).toBe(true);
  });

  it('評審：等效接法也通過（MC1 自保改 a右、X 改第二組接點、浮球兩條引線對調、COS 的 M 兩端對調）', () => {
    const w = swapWires({ 'MC1.a左上': 'MC1.a右下', 'MC1.a左下': 'MC1.a右上', 'X.1': 'X.8', 'X.4': 'X.5', 'TB7.1': 'TB7.2', 'TB7.2': 'TB7.1', 'COS_TB.3': 'COS_TB.4', 'COS_TB.4': 'COS_TB.3' });
    const r = grade(q, w, q.timerDefaultSec);
    expect(r.major).toEqual([]);
    expect(r.pass).toBe(true);
    const p = computeProgress(q, D, w);
    expect(p.done).toBe(p.total);
    expect(p.bad).toBe(0);
  });
});

describe('第二站第四題 劇本抓得到錯', () => {
  const sc = (name: string) => q.scenarios.find(s => s.name.startsWith(name))!;
  it('APN 第二組的 5／6 接反：兩組接點指向同一台，異常水位時不會並列（劇本失敗）', () => {
    const w = swapWires({ 'APN.5': 'APN.6', 'APN.6': 'APN.5' });
    expect(runScenario(q, w, sc('自動 A：異常水位'), 5).pass).toBe(false);
  });
  it('Tb1 沒接到 APN 線圈：不會交互，每次都是同一台（劇本失敗）', () => {
    const w = ref.filter(x => !(x.a === 'TB5.6' && x.b === 'APN.2'));
    expect(runScenario(q, w, sc('自動 A：高水位'), 5).pass).toBe(false);
  });
  it('Ta1 沒跨接到 Tc2：異常水位時 X 不動作（劇本失敗）', () => {
    const w = ref.filter(x => !(x.a === 'TB5.5' && x.b === 'TB5.4')).concat([{ id: 'x', a: 'TB5.5', b: 'APN.8', panel: 'device' }]).filter(x => !(x.a === 'TB5.4' && x.b === 'APN.8'));
    expect(runScenario(q, w, sc('自動 A：異常水位'), 5).pass).toBe(false);
  });
  it('BS1、BS2 接反（BS1 接 E4、BS2 接 E1）：高水位時不起動（劇本失敗）', () => {
    const w = swapWires({ 'TB5.8': 'TB5.11', 'TB5.11': 'TB5.8' });
    expect(runScenario(q, w, sc('自動 A：高水位'), 5).pass).toBe(false);
  });
  it('COS 的 M、A 沒有跨接共用點：自動時 61F-G2 沒電（劇本失敗）', () => {
    const w = ref.filter(x => !(x.a === 'COS_TB.3' && x.b === 'COS_TB.1'));
    expect(runScenario(q, w, sc('自動 A：高水位'), 5).pass).toBe(false);
  });
  it('TH-RY1 的 b、a 接反：一送電 BZ 就響（劇本失敗）', () => {
    const w = swapWires({ 'THRY1_TB.2': 'THRY1_TB.3', 'THRY1_TB.3': 'THRY1_TB.2' });
    expect(runScenario(q, w, sc('手動 M'), 5).pass).toBe(false);
  });
});

describe('第二站第四題 單線圖', () => {
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
  it('驗證器抓得到錯：APN 第二組 8-6 與 8-5 在圖上對調', () => {
    const d = JSON.parse(JSON.stringify(D)) as typeof D;
    const s = d.syms.find(x => x.id === 'apn2')!;
    [s.t[1], s.t[2]] = [s.t[2], s.t[1]];
    expect(netMismatches(q, d, ref).length).toBeGreaterThan(0);
  });
  it('接線進度：空白全未接、參考接線全完成', () => {
    const p0 = computeProgress(q, D, []);
    expect(p0.done).toBe(0);
    const p = computeProgress(q, D, ref);
    expect(p.nets.filter(n => n.state !== 'done').map(n => `${n.state}:${n.terms.join(',')}`)).toEqual([]);
    expect(p.strays).toEqual([]);
  });
  it('主電路：NFB3 → TB1 → NFB1 → MC1 閉合 → M1 三相各不同；MC2 閉合 → M2；都不閉合 → 不帶電', () => {
    const main = D.main!;
    const phaseOf = (tid: string) => ({ 'NFB.電源A': 'R', 'NFB.電源B': 'S', 'NFB.電源C': 'T' } as Record<string, string>)[tid] ?? null;
    const m1 = mainPhases(main, new Set(['MC1']), phaseOf);
    expect(['M1.U', 'M1.V', 'M1.W'].map(t => [...m1.phase.get(t)!][0])).toEqual(['R', 'S', 'T']);
    expect(['TB1.A', 'TB1.B', 'TB1.C'].map(t => [...m1.phase.get(t)!][0])).toEqual(['R', 'S', 'T']);
    expect(['M2.U', 'M2.V', 'M2.W'].every(t => m1.phase.get(t)!.size === 0)).toBe(true);
    const m2 = mainPhases(main, new Set(['MC2']), phaseOf);
    expect(['M2.U', 'M2.V', 'M2.W'].map(t => [...m2.phase.get(t)!][0])).toEqual(['R', 'S', 'T']);
    const none = mainPhases(main, new Set(), phaseOf);
    expect(['M1.U', 'M2.U'].every(t => none.phase.get(t)!.size === 0)).toBe(true);
    expect(connectivity(main).dangling).toEqual([]);
  });
});
