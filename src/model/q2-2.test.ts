import { describe, it, expect } from 'vitest';
import { Q2_2 } from './questions/q2-2';
import { teacherWiresOf } from './questions/common';
import { connectivity } from './schematic';
import { elementError, netMismatches, coverage, pinClashes } from './schematicCheck';
import { structuralChecks, runScenario } from '../engine/grader';
import { Simulator } from '../engine/simulator';
import { defOf, overlaps } from '../library';

const q = Q2_2;
const ref = teacherWiresOf(q);
const D = q.schematic!;

describe('第二站第二題 題目資料', () => {
  it('器具不互相重疊，參考接線用到的端子都存在', () => {
    expect(overlaps(q.devices)).toEqual([]);
    const bad = ref.flatMap(w => [w.a, w.b]).filter(tid => {
      const [d, t] = [tid.slice(0, tid.indexOf('.')), tid.slice(tid.indexOf('.') + 1)];
      const inst = q.devices.find(x => x.id === d);
      return !inst || !defOf(inst.kind).terminals.some(x => x.id === t && x.wireable !== false);
    });
    expect(bad).toEqual([]);
  });

  it('參考接線：每端子 ≤ 2 條線、無結構缺點', () => {
    const { major, minor } = structuralChecks(q, ref);
    expect(major).toEqual([]);
    expect(minor).toEqual([]);
  });
});

describe('第二站第二題 功能劇本（參考接線）', () => {
  for (const sc of q.scenarios) {
    it(sc.name, () => {
      const r = runScenario(q, ref, sc, q.timerDefaultSec);
      expect(r.failures).toEqual([]);
    });
  }

  it('按 OFF 後 5～10 秒間按 FWD 也起動不了（TR3 鎖住），10 秒後才可以', () => {
    const sim = new Simulator(q, ref, { timerSec: 5 });
    sim.nfb(true); sim.run(300);
    sim.press('FWD', true); sim.run(300); sim.press('FWD', false); sim.run(6500);
    sim.press('OFF', true); sim.run(300); sim.press('OFF', false); sim.run(6000);
    sim.press('FWD', true); sim.run(300); sim.press('FWD', false); sim.run(300);
    expect(sim.snapshot().MCF).toBe(false);
    sim.run(5000);
    sim.press('FWD', true); sim.run(300); sim.press('FWD', false); sim.run(300);
    expect(sim.snapshot().MCF).toBe(true);
  });
});

describe('第二站第二題 單線圖', () => {
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
  it('驗證器抓得到錯：KR 1-4 與 1-3 對調（正反轉記憶接反）', () => {
    const d = JSON.parse(JSON.stringify(D)) as typeof D;
    const a = d.syms.find(s => s.id === 'krFwd')!, b = d.syms.find(s => s.id === 'krRev')!;
    [a.t, b.t] = [b.t, a.t];
    expect(netMismatches(q, d, ref).length).toBeGreaterThan(0);
  });
});

describe('第二站第二題 劇本抓得到錯', () => {
  const sc = (name: string) => q.scenarios.find(s => s.name.startsWith(name))!;
  it('拿掉 TR2/6 → KR/1：瞬停後不會自動再起動（劇本失敗）', () => {
    const w = ref.filter(x => !(x.a === 'TR2.6' && x.b === 'KR.1'));
    expect(runScenario(q, w, sc('正轉中瞬時停電'), 5).pass).toBe(false);
  });
  it('OFF 只接 b、沒接 a（TR3 不動作）：OFF 停機後會被當成停電自動再起動（劇本失敗）', () => {
    const w = ref.filter(x => !(x.a === 'OFF_TB.4' || x.b === 'OFF_TB.4'));
    expect(runScenario(q, w, sc('正轉 Y 啟動'), 5).pass).toBe(false);
  });
  it('SC 與 RC 接反：反轉瞬停後變成正轉（劇本失敗）', () => {
    const swap: Record<string, string> = { 'KR.2': 'KR.5', 'KR.5': 'KR.2', 'KR.10': 'KR.7', 'KR.7': 'KR.10' };
    const w = ref.map(x => ({ ...x, a: swap[x.a] ?? x.a, b: swap[x.b] ?? x.b }));
    expect(runScenario(q, w, sc('反轉中瞬時停電'), 5).pass).toBe(false);
  });
});
