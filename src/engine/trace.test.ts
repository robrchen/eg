import { describe, it, expect } from 'vitest';
import { Q2_1, teacherWires } from '../model/questions/q2-1';
import { Q2_2 } from '../model/questions/q2-2';
import { teacherWiresOf } from '../model/questions/common';
import { traceRun, stageTokens, buildRoles, type Stage } from './trace';
import { Simulator } from './simulator';

/** 有事件的階段（依序），每階段的記號已排序 */
const toks = (st: Stage[]) => st.map(s => stageTokens(s)).filter(t => t.length);
const ref1 = teacherWires();
const ref2 = teacherWiresOf(Q2_2);
const start = (sim: Simulator, dev = 'FWD') => { sim.nfb(true); sim.run(300); sim.press(dev, true); sim.run(300); sim.press(dev, false); sim.run(6000); };

describe('動作解說：因果鏈（依 tick 分波）', () => {
  it('第一題按 FWD：MCF → MCS/TR/Y → TR 到時 → MCS 放開 → MCD', () => {
    expect(toks(traceRun(Q2_1, ref1, s => start(s)))).toEqual([
      ['nfb:on'],
      ['G.lamp+'],
      ['press:FWD'],
      ['MCF.coil+', 'MCF:actuate'],
      ['G.lamp-', 'MCS.coil+', 'MCS:actuate', 'TR.coil+', 'TR:timer-start', 'Y.lamp+'],
      ['release:FWD'],
      ['TR:timer-done'],
      ['MCS.coil-', 'MCS:release', 'Y.lamp-'],
      ['MCD.coil+', 'MCD:actuate', 'R.lamp+'],
    ]);
  });

  it('第二題按 FWD：MCF 與 KR 設定同一波，Δ 之後 TR2 動作、R1 亮', () => {
    expect(toks(traceRun(Q2_2, ref2, s => start(s)))).toEqual([
      ['nfb:on'],
      ['G.lamp+'],
      ['press:FWD'],
      ['KR.SC+', 'KR:latch-set', 'MCF.coil+', 'MCF:actuate'],
      ['G.lamp-', 'MCS.coil+', 'MCS:actuate', 'R2.lamp+', 'TR1.coil+', 'TR1:timer-start'],
      ['release:FWD'],
      ['TR1:timer-done'],
      ['MCS.coil-', 'MCS:release'],
      ['MCD.coil+', 'MCD:actuate'],
      ['R1.lamp+', 'R2.lamp-', 'TR2.coil+', 'TR2:actuate'],
    ]);
  });

  it('第二題瞬停：停電全部失磁但 KR 不動、TR2 開始斷電延時；復電依記憶正轉再起動', () => {
    const st = traceRun(Q2_2, ref2, s => { start(s); s.nfb(false, '停電'); s.run(1000); s.nfb(true, '復電'); s.run(7000); });
    const t = toks(st);
    const off = t.findIndex(x => x.includes('nfb:off'));
    expect(t[off + 1]).toEqual(expect.arrayContaining(['MCF:release', 'MCD:release', 'TR1:timer-reset', 'TR2:offdelay-start', 'R1.lamp-']));
    expect(t[off + 1].some(x => x.startsWith('KR:latch'))).toBe(false);
    const on = t.findIndex((x, i) => i > off && x.includes('nfb:on'));
    expect(t[on + 1]).toEqual(['G.lamp+', 'KR.SC+', 'MCF.coil+', 'MCF:actuate']);
    expect(t[on + 2]).toEqual(expect.arrayContaining(['MCS.coil+', 'TR1:timer-start']));
    // 再起動的 Y 啟動期間 TR2 還沒得電，斷電延時先到而復歸；之後 TR1 才到時切 Δ
    const after = t.slice(on).flat();
    expect(after.indexOf('TR2:offdelay-done')).toBeGreaterThan(-1);
    expect(after.indexOf('TR2:offdelay-done')).toBeLessThan(after.indexOf('TR1:timer-done'));
    const reasons = st.filter(s => s.action?.action === 'nfb').map(s => s.action!.reason);
    expect(reasons).toEqual([undefined, '停電', '復電']);
  });

  it('第一題過載：TH-RY 跳脫 → BZ 響、全部放開 → 下一波 G 亮', () => {
    const t = toks(traceRun(Q2_1, ref1, s => { start(s); s.trip('THRY', true); s.run(300); }));
    const i = t.findIndex(x => x.includes('trip:THRY'));
    expect(t[i + 1]).toEqual(expect.arrayContaining(['BZ.buzzer+', 'MCF:release', 'MCD:release', 'TR:timer-reset']));
    expect(t[i + 2]).toEqual(['G.lamp+']);
  });
});

describe('動作解說：接點用途（由接線結構推導）', () => {
  it('第一題：自保、互鎖、供電對象', () => {
    const r = buildRoles(Q2_1, ref1);
    expect(r.get('MCF.a左')).toBe('自保');
    expect(r.get('MCR.b左')).toBe('互鎖 MCF');
    expect(r.get('MCD.b左')).toBe('互鎖 MCS');
    expect(r.get('THRY.c-a')).toBe('→ BZ');
    expect(r.get('THRY.c-b')).toBe('→ 整個控制回路');
  });
  it('第二題：按鈕、保持電驛、燈', () => {
    const r = buildRoles(Q2_2, ref2);
    expect(r.get('FWD.a')).toBe('→ MCF、KR');
    expect(r.get('KR.接點二 a (11-8)')).toBe('→ R1');
    expect(r.get('MCD.a左')).toBe('→ R1、R3');
    expect(r.get('MCF.b右')).toBe('→ G');
    expect(r.get('TR2.延時a (8-6)')).toBe('→ MCF、MCR、KR');
    expect(r.get('EMS.b')).toBe('→ 整個控制回路');
    expect(r.get('OFF.b')).toBe('→ TR2');
  });
  it('自保接點左右對調（等效接法）仍然恰有一個自保', () => {
    const sw = (t: string) => t.replace('MCF.a左', 'MCF.aX').replace('MCF.a右', 'MCF.a左').replace('MCF.aX', 'MCF.a右');
    const w = ref1.map(x => ({ ...x, a: sw(x.a), b: sw(x.b) }));
    const r = buildRoles(Q2_1, w);
    expect(r.get('MCF.a右')).toBe('自保');
    expect(r.get('MCF.a左')).not.toBe('自保');
  });
});

describe('動作解說：沒接線的接點不寫進解說', () => {
  it('第一題 FWD 只用 a 接點：「按下 FWD」那行沒有 b', () => {
    const st = traceRun(Q2_1, ref1, s => start(s));
    const l = st.find(s => s.action?.action === 'press')!.lines[0].text;
    expect(l).toContain('a 閉合');
    expect(l).not.toContain('b 打開');
  });
  it('第二題沒有 BZ：TH-RY 跳脫只寫 c-b', () => {
    const st = traceRun(Q2_2, ref2, s => { start(s); s.trip('THRY', true); s.run(100); });
    const l = st.find(s => s.action?.action === 'trip')!.lines[0].text;
    expect(l).toContain('c-b 打開');
    expect(l).not.toContain('c-a');
  });
});

describe('動作解說：句子與帶電', () => {
  const st = traceRun(Q2_2, ref2, s => start(s)).filter(s => s.lines.length);
  it('MCF 那一行：線圈得電、自保、互鎖、→ G', () => {
    const l = st[3].lines.find(x => x.dev === 'MCF')!;
    expect(l.text).toContain('線圈得電');
    expect(l.text).toContain('a左 閉合（自保）');
    expect(l.text).toContain('互鎖 MCR');
    expect(l.text).toContain('→ G');
    expect(st[3].lines.find(x => x.dev === 'KR')!.text).toContain('設定（記住正轉）');
  });
  it('下一波：R2 亮（Y 啟動中）、G 滅、TR1 開始計時', () => {
    const txt = st[4].lines.map(x => x.text);
    expect(txt).toContain('R2 亮（Y 啟動中）');
    expect(txt).toContain('G 滅');
    expect(txt).toContain('TR1 得電，開始計時 5 秒');
  });
  it('新帶電的端子：MCF 線圈那一波含 MCF.A1、KR.2；下一波 G 斷電', () => {
    expect(st[3].liveOn).toEqual(expect.arrayContaining(['MCF.A1', 'KR.2']));
    expect(st[4].liveOff).toContain('G.X1');
  });
});

describe('模擬器：最短按壓一 tick、trace 關閉不記錄', () => {
  it('按下馬上放開（中間沒有 tick）也能起動', () => {
    const sim = new Simulator(Q2_1, ref1, { timerSec: 5 });
    sim.nfb(true); sim.run(100);
    sim.press('FWD', true); sim.press('FWD', false); sim.run(100);
    expect(sim.snapshot().MCF).toBe(true);
    expect(sim.state.get('FWD')!.pressed).toBe(false);
  });
  it('trace 關閉時不累積事件', () => {
    const sim = new Simulator(Q2_2, ref2);
    start(sim);
    expect(sim.drainEvents()).toEqual([]);
  });
});
