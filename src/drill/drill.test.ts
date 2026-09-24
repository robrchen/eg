import { describe, expect, it } from 'vitest';
import { defOf } from '../library';
import { Q2_1 } from '../model/questions/q2-1';
import { Q2_2 } from '../model/questions/q2-2';
import { pinTemplates, PIN_KINDS, catOf, numOf, displayLabel, meterReading, METER } from './pinQuiz';
import { circuitTemplates } from './circuitQuiz';
import { check, type DrillQ, type TapQ } from './types';
import { mulberry32 } from './rng';
import { DrillSession, pickTemplates, scoreFor } from './session';
import { emptyStats, loadStats, recordAnswer, recordRound, saveStats, streakDays, type StorageLike } from './stats';

type Choice = Extract<DrillQ, { answer: 'choice' }>;
const pins = pinTemplates();
const circ = [...circuitTemplates(Q2_1), ...circuitTemplates(Q2_2)];
const all = [...pins, ...circ];
const byId = (id: string) => { const t = all.find(x => x.id === id); if (!t) throw new Error(`沒有 ${id}`); return t.build(mulberry32(1)); };
const correctOf = (id: string) => (byId(id) as Choice).correct;

describe('題目共通規則', () => {
  it('id 不重複、每種題型都有', () => {
    expect(new Set(all.map(t => t.id)).size).toBe(all.length);
    for (const k of PIN_KINDS) expect(pins.filter(t => t.devKind === k).length).toBeGreaterThan(3);
    for (const kind of ['pin-tap', 'pin-iec', 'pin-name', 'meter', 'schem-find', 'purpose'] as const) expect(all.some(t => t.kind === kind)).toBe(true);
  });

  it('每題只有一個正解、選項不重複、題幹不露答案', () => {
    for (let seed = 1; seed <= 3; seed++) for (const t of all) {
      const q = t.build(mulberry32(seed));
      if (q.answer === 'choice') {
        expect(q.options.length).toBeGreaterThanOrEqual(3);
        expect(new Set(q.options.map(o => o.text)).size).toBe(q.options.length);
        expect(q.options.filter(o => o.key === q.correct).length).toBe(1);
        for (const o of q.options) expect(check(q, [o.key]).ok).toBe(o.key === q.correct);
      }
      if (q.answer === 'tap') {
        const ids = q.def.terminals.filter(x => x.role !== 'main').map(x => x.id);
        for (const set of [q.targets, ...(q.alts ?? [])]) {
          for (const id of set) expect(ids).toContain(id);
          expect(check(q, [...set].reverse()).ok).toBe(true);
          expect(set.length).toBe(q.targets.length);
        }
        expect(check(q, q.targets.slice(0, -1)).ok).toBe(false);
        // 題幹不能直接寫出要點的那一腳的號碼（c／a／b 配對題）
        if (q.kind === 'pin-tap') for (const id of q.targets) expect(q.prompt).not.toContain(`<b>${displayLabel(q.def, q.def.terminals.find(x => x.id === id)!, 'num')}</b>，另一端`);
      }
    }
  });

  it('同一 seed 出同一題', () => {
    const dump = () => JSON.stringify(all.map(t => { const q = t.build(mulberry32(7)); return { ...q, def: null, figure: null }; }));
    expect(dump()).toBe(dump());
  });
});

describe('腳位記憶', () => {
  it('端子分類與端子號', () => {
    const tr = defOf('TR');
    expect(catOf(tr, '8')).toBe('c');
    expect(catOf(tr, '5')).toBe('b');
    expect(catOf(tr, '6')).toBe('a');
    expect(catOf(tr, '2')).toBe('coil');
    expect(numOf(defOf('THRY').terminals.find(t => t.id === 'c')!)).toBe('95');
    expect(catOf(defOf('KR'), '11')).toBe('c');
    expect(numOf(defOf('MC').terminals.find(t => t.id === 'b左上')!)).toBe('21');
  });

  it('c／a／b 配對與接點↔端子號', () => {
    expect((byId('pin-tap:TR:c:8:num') as TapQ).targets).toEqual(['8']);
    expect((byId('pin-tap:TR:Y (8-5):num') as TapQ).targets).toEqual(['5']);
    expect((byId('pin-tap:THRY:c-a:num') as TapQ).targets).toEqual(['a']);
    expect((byId('pin-tap:KR:c:11:num') as TapQ).targets).toEqual(['11']);
    expect(correctOf('pin-iec:MC:b左')).toBe('21-22');
    expect(correctOf('pin-iec:TR:Y (8-5)')).toBe('8-5');
    expect(correctOf('pin-iec:THRY:c-a')).toBe('95-98');
    expect(correctOf('pin-name:TR:Δ (8-6)')).toBe('a 接點（Δ 運轉用）');
    // MC 接點題的錯誤選項優先用其他真實組合（13-14、43-44…），不是亂湊的號碼
    const mc = byId('pin-iec:MC:b左') as Choice;
    for (const o of mc.options) expect(['21-22', '13-14', '43-44', '31-32', 'A1-A2']).toContain(o.text);
  });

  it('三用電表讀數', () => {
    const tr = defOf('TR'), mc = defOf('MC'), th = defOf('THRY'), kr = defOf('KR'), pb = defOf('PB');
    expect(meterReading(tr, '8', '5', false)).toBe('short');
    expect(meterReading(tr, '8', '6', false)).toBe('open');
    expect(meterReading(tr, '2', '7', false)).toBe('coil');
    expect(meterReading(tr, '5', '6', false)).toBe('open');
    expect(meterReading(mc, 'a左上', 'a左下', true)).toBe('short');
    expect(meterReading(mc, 'b左上', 'b左下', true)).toBe('open');
    expect(meterReading(th, 'c', 'a', true)).toBe('short');
    expect(meterReading(th, 'c', 'b', true)).toBe('open');
    expect(meterReading(kr, '1', '4', false)).toBe('open');
    expect(meterReading(kr, '1', '4', true)).toBe('short');
    expect(meterReading(pb, 'b上', 'b下', true)).toBe('open');
    expect(correctOf('meter:TR:8-5:rest')).toBe(METER.short);
    expect(correctOf('meter:THRY:96-98:act')).toBe(METER.open);
  });

  it('只出指定器具', () => {
    const t = pinTemplates(['TR', 'PL']);
    expect(t.length).toBeGreaterThan(0);
    expect(t.every(x => x.devKind === 'TR')).toBe(true);
  });
});

describe('看電路圖接線', () => {
  it('看圖找端子：MC 左右兩組同種接點都算對', () => {
    const q = byId('schem-find:q2-1:mcfLock') as TapQ;
    expect(q.figure?.focus).toBe('mcfLock');
    expect(q.targets.sort()).toEqual(['b左上', 'b左下']);
    expect(check(q, ['b右上', 'b右下']).ok).toBe(true);
    expect(check(q, ['a左上', 'a左下']).ok).toBe(false);
    expect(check(q, ['b左上', 'b右下']).ok).toBe(false);
    expect((byId('schem-find:q2-1:trY') as TapQ).targets).toEqual(['8', '5']);
    expect((byId('schem-find:q2-1:trY') as TapQ).alts ?? []).toEqual([]);
    expect((byId('schem-find:q2-1:thry') as TapQ).targets.length).toBe(3);
    expect((byId('schem-find:q2-2:krSC') as TapQ).targets).toEqual(['2', '10']);
  });

  it('接點用途', () => {
    expect(correctOf('purpose:q2-1:mcfHold')).toMatch(/^自保持/);
    expect(correctOf('purpose:q2-1:mcfLock')).toBe('互鎖（自己動作時，讓 MCR 不能得電）');
    expect(correctOf('purpose-hold:q2-1:MCF')).toBe('MCF 的 a 接點');
    expect(correctOf('purpose-lock:q2-1:MCF:MCR')).toBe('MCF 的 b 接點');
    expect(correctOf('purpose-timer:q2-1:trY')).toBe('8-5 b 接點（Y 啟動用）');
    expect(correctOf('purpose-timer:q2-1:trD')).toBe('8-6 a 接點（Δ 運轉用）');
    // 「讓自己不能得電」不會出現在選項
    for (const t of circ.filter(x => x.id.startsWith('purpose:'))) {
      const q = t.build(mulberry32(2)) as Choice;
      const self = q.prompt.match(/<b>(\S+)<\/b>/)![1];
      for (const o of q.options) expect(o.text).not.toContain(`讓 ${self} 不能`);
    }
  });
});

describe('回合', () => {
  it('10 題不重複、難度由淺到深', () => {
    for (const pool of [pins, circuitTemplates(Q2_1)]) for (let seed = 1; seed <= 20; seed++) {
      const picked = pickTemplates(pool, emptyStats(), 10, mulberry32(seed));
      expect(picked.length).toBe(10);
      expect(new Set(picked.map(t => t.id)).size).toBe(10);
      for (let i = 1; i < picked.length; i++) expect(picked[i].level).toBeGreaterThanOrEqual(picked[i - 1].level);
    }
  });

  it('錯題優先出現', () => {
    const s = recordAnswer(emptyStats(), { id: 'pin-iec:TR:Y (8-5)', kind: 'pin-iec', devKind: 'TR', ok: false, ms: 3000 });
    expect(pickTemplates(pins, s, 10, mulberry32(3)).map(t => t.id)).toContain('pin-iec:TR:Y (8-5)');
  });

  it('計分、連勝、逾時', () => {
    expect(scoreFor(0, 12000, 1)).toBe(150);
    expect(scoreFor(12000, 12000, 1)).toBe(100);
    expect(scoreFor(0, 12000, 3)).toBe(180);
    expect(scoreFor(0, 12000, 50)).toBe(285);
    const ses = new DrillSession(pins, emptyStats(), { seed: 5, length: 5 });
    const right = (q: DrillQ) => (q.answer === 'tap' ? q.targets : q.answer === 'choice' ? [q.correct] : q.correct);
    let r = ses.answer(right(ses.current!), 1000); expect(r.ok).toBe(true); expect(r.streak).toBe(1);
    ses.next();
    r = ses.answer(right(ses.current!), 1000); expect(r.streak).toBe(2);
    ses.next();
    r = ses.timeout(); expect(r.ok).toBe(false); expect(r.streak).toBe(0); expect(r.gained).toBe(0);
    expect(ses.bestStreak).toBe(2);
    expect(ses.summary().correct).toBe(2);
  });
});

describe('統計', () => {
  const mem = (): StorageLike => { const m = new Map<string, string>(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) }; };

  it('存取', () => {
    const st = mem();
    let s = recordAnswer(emptyStats(), { id: 'x', kind: 'pin-tap', devKind: 'TR', ok: true, ms: 1 }, '2026-09-24');
    s = recordRound(s, 900, 4, '2026-09-24').stats;
    saveStats(s, st);
    const back = loadStats(st);
    expect(back.best?.score).toBe(900);
    expect(back.bestStreak).toBe(4);
    expect(back.byKind['pin-tap']).toEqual({ n: 1, ok: 1 });
    expect(back.byDev.TR).toEqual({ n: 1, ok: 1 });
  });

  it('連續天數', () => {
    const s = { ...emptyStats(), days: ['2026-09-22', '2026-09-23', '2026-09-24'] };
    expect(streakDays(s, '2026-09-24')).toBe(3);
    expect(streakDays(s, '2026-09-25')).toBe(3);
    expect(streakDays(s, '2026-09-26')).toBe(0);
    expect(streakDays({ ...s, days: ['2026-09-20', '2026-09-24'] }, '2026-09-24')).toBe(1);
  });

  it('錯題答對後遞減、移除；破紀錄', () => {
    let s = recordAnswer(emptyStats(), { id: 'q', kind: 'pin-iec', ok: false, ms: 1 });
    expect(s.missed.q.n).toBe(2);
    s = recordAnswer(s, { id: 'q', kind: 'pin-iec', ok: true, ms: 1 });
    s = recordAnswer(s, { id: 'q', kind: 'pin-iec', ok: true, ms: 1 });
    expect(s.missed.q).toBeUndefined();
    const a = recordRound(emptyStats(), 500, 2);
    expect(a.newBest).toBe(true);
    expect(recordRound(a.stats, 400, 1).newBest).toBe(false);
  });
});
