import { describe, expect, it } from 'vitest';
import { defOf } from '../library';
import { pinTemplates, PIN_KINDS, catOf, numOf, displayLabel } from './pinQuiz';
import { check, type DrillQ, type TapQ } from './types';
import { mulberry32 } from './rng';
import { DrillSession, pickTemplates, scoreFor } from './session';
import { emptyStats, loadStats, recordAnswer, recordRound, saveStats, streakDays, type StorageLike } from './stats';

const all = pinTemplates();
const byId = (id: string) => { const t = all.find(x => x.id === id); if (!t) throw new Error(`沒有 ${id}`); return t.build(mulberry32(1)); };

describe('腳位題產生器', () => {
  it('每種器具都有題目，id 不重複', () => {
    expect(new Set(all.map(t => t.id)).size).toBe(all.length);
    for (const k of PIN_KINDS) expect(all.filter(t => t.devKind === k).length).toBeGreaterThan(5);
    for (const kind of ['pin-pair', 'pin-tap', 'pin-num', 'pin-iec', 'pin-name', 'pin-role', 'pin-order'] as const)
      expect(all.some(t => t.kind === kind)).toBe(true);
  });

  it('每題都只有一個正解、選項不重複、正解判對', () => {
    for (let seed = 1; seed <= 3; seed++) for (const t of all) {
      const q = t.build(mulberry32(seed));
      if (q.answer === 'choice') {
        expect(q.options.length).toBe(4);
        expect(new Set(q.options.map(o => o.text)).size).toBe(4);
        expect(q.options.filter(o => o.key === q.correct).length).toBe(1);
        expect(check(q, [q.correct]).ok).toBe(true);
        for (const o of q.options) if (o.key !== q.correct) expect(check(q, [o.key]).ok).toBe(false);
      }
      if (q.answer === 'tap') {
        const ids = q.def.terminals.filter(x => x.role !== 'main').map(x => x.id);
        expect(q.targets.length).toBeGreaterThan(0);
        for (const id of q.targets) expect(ids).toContain(id);
        expect(check(q, [...q.targets].reverse()).ok).toBe(true);
        expect(check(q, q.targets.slice(0, -1)).ok).toBe(false);
        // 題目不能把答案寫在端子上
        const shown = (q as TapQ).targets.map(id => displayLabel(q.def, q.def.terminals.find(x => x.id === id)!, q.display));
        for (const s of shown) expect(q.prompt).not.toContain(`<b>${s}</b> 號`);
      }
    }
  });

  it('端子分類與端子號', () => {
    const tr = defOf('TR');
    expect(catOf(tr, '8')).toBe('c');
    expect(catOf(tr, '5')).toBe('b');
    expect(catOf(tr, '6')).toBe('a');
    expect(catOf(tr, '4')).toBe('empty');
    expect(catOf(tr, '2')).toBe('coil');
    const th = defOf('THRY');
    expect(numOf(th.terminals.find(t => t.id === 'c')!)).toBe('95');
    expect(catOf(th, 'c')).toBe('c');
    expect(catOf(defOf('KR'), '11')).toBe('c');
    expect(numOf(defOf('MC').terminals.find(t => t.id === 'b左上')!)).toBe('21');
  });

  it('具體答案', () => {
    const iec = byId('pin-iec:MC:b左') as Extract<DrillQ, { answer: 'choice' }>;
    expect(iec.correct).toBe('21-22');
    expect((byId('pin-iec:TR:Y (8-5)') as Extract<DrillQ, { answer: 'choice' }>).correct).toBe('8-5');
    expect((byId('pin-iec:THRY:c-a') as Extract<DrillQ, { answer: 'choice' }>).correct).toBe('95-98');
    expect((byId('pin-pair:TR:Y (8-5):num') as TapQ).targets.sort()).toEqual(['5', '8']);
    expect((byId('pin-tap:TR:c:8:num') as TapQ).targets).toEqual(['8']);
    expect((byId('pin-tap:TR:Δ (8-6):num') as TapQ).targets).toEqual(['6']);
    expect((byId('pin-order:MC:左側接點塊:cat') as Extract<DrillQ, { answer: 'choice' }>).correct).toBe('a  b  b  a');
    expect((byId('pin-order:MC:左側接點塊:num') as Extract<DrillQ, { answer: 'choice' }>).correct).toBe('13  21  22  14');
    expect((byId('pin-order:TR:上排:num') as Extract<DrillQ, { answer: 'choice' }>).correct).toBe('6  5  4  3');
    expect((byId('pin-role:THRY:c') as Extract<DrillQ, { answer: 'choice' }>).correct).toBe('共用點 c');
    expect((byId('pin-role:TR:4') as Extract<DrillQ, { answer: 'choice' }>).correct).toBe('空腳（未使用）');
    expect((byId('pin-name:TR:Y (8-5)') as Extract<DrillQ, { answer: 'choice' }>).correct).toBe('b 接點（Y 啟動）');
  });

  it('同一 seed 出同一題', () => {
    const a = JSON.stringify(all.map(t => { const q = t.build(mulberry32(7)); return 'def' in q ? { ...q, def: null } : q; }));
    const b = JSON.stringify(all.map(t => { const q = t.build(mulberry32(7)); return 'def' in q ? { ...q, def: null } : q; }));
    expect(a).toBe(b);
  });

  it('只出指定器具', () => {
    const t = pinTemplates(['TR', 'PL']);
    expect(t.length).toBeGreaterThan(0);
    expect(t.every(x => x.devKind === 'TR')).toBe(true);
  });
});

describe('回合', () => {
  it('10 題不重複、難度由淺到深、器具不連出三題', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const picked = pickTemplates(all, emptyStats(), 10, mulberry32(seed));
      expect(picked.length).toBe(10);
      expect(new Set(picked.map(t => t.id)).size).toBe(10);
      for (let i = 1; i < picked.length; i++) expect(picked[i].level).toBeGreaterThanOrEqual(picked[i - 1].level);
    }
  });

  it('錯題優先出現', () => {
    let s = emptyStats();
    s = recordAnswer(s, { id: 'pin-iec:TR:Y (8-5)', kind: 'pin-iec', devKind: 'TR', ok: false, ms: 3000 });
    const picked = pickTemplates(all, s, 10, mulberry32(3));
    expect(picked.map(t => t.id)).toContain('pin-iec:TR:Y (8-5)');
  });

  it('計分、連勝、逾時', () => {
    expect(scoreFor(0, 12000, 1)).toBe(150);
    expect(scoreFor(12000, 12000, 1)).toBe(100);
    expect(scoreFor(0, 12000, 3)).toBe(180);
    expect(scoreFor(0, 12000, 50)).toBe(285);
    const ses = new DrillSession(all, emptyStats(), { seed: 5, length: 5 });
    const right = (q: DrillQ) => (q.answer === 'tap' ? q.targets : q.answer === 'choice' ? [q.correct] : q.answer === 'multi' ? q.correct : q.correct);
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
    expect(streakDays(s, '2026-09-25')).toBe(3);   // 今天還沒練，昨天以前連續
    expect(streakDays(s, '2026-09-26')).toBe(0);
    expect(streakDays({ ...s, days: ['2026-09-20', '2026-09-24'] }, '2026-09-24')).toBe(1);
    expect(streakDays(s, '2026-10-01')).toBe(0);
  });

  it('錯題答對後遞減、移除', () => {
    let s = recordAnswer(emptyStats(), { id: 'q', kind: 'pin-iec', ok: false, ms: 1 });
    expect(s.missed.q.n).toBe(2);
    s = recordAnswer(s, { id: 'q', kind: 'pin-iec', ok: true, ms: 1 });
    expect(s.missed.q.n).toBe(1);
    s = recordAnswer(s, { id: 'q', kind: 'pin-iec', ok: true, ms: 1 });
    expect(s.missed.q).toBeUndefined();
  });

  it('破紀錄', () => {
    const a = recordRound(emptyStats(), 500, 2);
    expect(a.newBest).toBe(true);
    expect(recordRound(a.stats, 400, 1).newBest).toBe(false);
  });
});
