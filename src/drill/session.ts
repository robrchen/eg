/**
 * 一回合練習：抽題（錯題優先、難度由淺到深、同一種器具不連出三題）、計分、連勝、每題倒數。
 * 純邏輯，不碰 DOM／localStorage。
 */
import type { DrillQ, Level, Template, Verdict } from './types';
import { check } from './types';
import { accuracy, type AnswerRec, type DrillStats } from './stats';
import { mulberry32, weightedIndex } from './rng';

export interface SessionOpts { length?: number; seed?: number }
export interface AnswerResult { ok: boolean; gained: number; streak: number; verdict: Verdict; timedOut: boolean }
export interface Summary { score: number; correct: number; total: number; bestStreak: number; fastestMs: number | null; avgMs: number | null; totalMs: number }

/** 答對得分：基本 100、剩餘時間最多 +50，再乘連勝加成（每連勝一題 +10%，最多 ×1.9） */
export function scoreFor(ms: number, limitMs: number, streak: number): number {
  const base = 100 + Math.round(50 * Math.max(0, 1 - ms / limitMs));
  return Math.round(base * (1 + Math.min(Math.max(streak - 1, 0), 9) * 0.1));
}

/** 抽出一回合的題目樣板 */
export function pickTemplates(pool: Template[], stats: DrillStats, length: number, rng: () => number): Template[] {
  const byId = new Map(pool.map(t => [t.id, t]));
  const chosen: Template[] = [];
  // 1. 錯題優先（最多三分之一）
  const missed = Object.entries(stats.missed)
    .filter(([id]) => byId.has(id))
    .sort((a, b) => b[1].n - a[1].n || b[1].last.localeCompare(a[1].last))
    .slice(0, Math.min(3, Math.floor(length / 3)))
    .map(([id]) => byId.get(id)!);
  chosen.push(...missed);
  // 2. 其餘依難度配額
  const levels = [...new Set(pool.map(t => t.level))].sort() as Level[];
  const ratio: Record<number, number[]> = { 1: [1], 2: [0.6, 0.4], 3: [0.4, 0.3, 0.3] };
  const r = ratio[levels.length] ?? levels.map(() => 1 / levels.length);
  const remain = Math.min(length, pool.length) - chosen.length;
  const quota = levels.map((_, i) => Math.round(remain * r[i]));
  quota[0] += remain - quota.reduce((s, x) => s + x, 0);
  const devCount = new Map<string, number>();
  for (const t of chosen) devCount.set(t.devKind ?? '', (devCount.get(t.devKind ?? '') ?? 0) + 1);
  const weight = (t: Template) => {
    let w = 1;
    const ka = accuracy(stats.byKind[t.kind]);
    if (ka !== null && (stats.byKind[t.kind]?.n ?? 0) >= 5 && ka > 0.85) w *= 0.5;
    const da = accuracy(stats.byDev[t.devKind ?? '']);
    if (da !== null && (stats.byDev[t.devKind ?? '']?.n ?? 0) >= 5 && da > 0.85) w *= 0.5;
    return w / (1 + (devCount.get(t.devKind ?? '') ?? 0));   // 已出過的器具降低機率，題目才會分散
  };
  const take = (cands: Template[], n: number) => {
    const c = cands.filter(t => !chosen.includes(t));
    for (let i = 0; i < n && c.length; i++) {
      const j = weightedIndex(c.map(weight), rng);
      const t = c.splice(j, 1)[0];
      chosen.push(t);
      devCount.set(t.devKind ?? '', (devCount.get(t.devKind ?? '') ?? 0) + 1);
    }
  };
  levels.forEach((lv, i) => take(pool.filter(t => t.level === lv), quota[i]));
  take(pool, Math.min(length, pool.length) - chosen.length);   // 某難度題目不夠時用其他補
  // 3. 由淺到深排序；同一種器具不連續出三題
  const out = [...chosen].sort((a, b) => a.level - b.level);
  for (let i = 2; i < out.length; i++) {
    if (out[i].devKind && out[i].devKind === out[i - 1].devKind && out[i].devKind === out[i - 2].devKind) {
      const j = out.findIndex((t, k) => k > i && t.level === out[i].level && t.devKind !== out[i].devKind);
      if (j > 0) [out[i], out[j]] = [out[j], out[i]];
    }
  }
  return out;
}

export class DrillSession {
  readonly qs: DrillQ[];
  index = 0;
  score = 0;
  streak = 0;
  bestStreak = 0;
  readonly answers: AnswerRec[] = [];

  constructor(pool: Template[], stats: DrillStats, opts: SessionOpts = {}) {
    const rng = mulberry32(opts.seed ?? (Date.now() & 0x7fffffff));
    this.qs = pickTemplates(pool, stats, opts.length ?? 10, rng).map(t => t.build(rng));
  }

  get total(): number { return this.qs.length; }
  get current(): DrillQ | null { return this.qs[this.index] ?? null; }
  get done(): boolean { return this.index >= this.qs.length; }

  answer(input: string[], ms: number): AnswerResult { return this.finish(input, ms, false); }
  timeout(): AnswerResult { const q = this.current!; return this.finish([], q.timeLimitMs, true); }

  private finish(input: string[], ms: number, timedOut: boolean): AnswerResult {
    const q = this.current!;
    const verdict = check(q, input);
    const ok = verdict.ok && !timedOut;
    let gained = 0;
    if (ok) { this.streak++; this.bestStreak = Math.max(this.bestStreak, this.streak); gained = scoreFor(ms, q.timeLimitMs, this.streak); this.score += gained; }
    else this.streak = 0;
    this.answers.push({ id: q.id, kind: q.kind, devKind: q.devKind, ok, ms: Math.min(ms, q.timeLimitMs) });
    return { ok, gained, streak: this.streak, verdict, timedOut };
  }

  next(): boolean { this.index++; return !this.done; }

  summary(): Summary {
    const okMs = this.answers.filter(a => a.ok).map(a => a.ms);
    const all = this.answers.map(a => a.ms);
    return {
      score: this.score,
      correct: okMs.length,
      total: this.answers.length,
      bestStreak: this.bestStreak,
      fastestMs: okMs.length ? Math.min(...okMs) : null,
      avgMs: all.length ? Math.round(all.reduce((s, x) => s + x, 0) / all.length) : null,
      totalMs: all.reduce((s, x) => s + x, 0),
    };
  }
}
