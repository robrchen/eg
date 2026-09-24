/**
 * 練習統計（localStorage `yishipei:drill`）：最佳分數、最長連勝、各題型正確率、錯題（間隔複習）、每日練習紀錄。
 * storage 可注入，node 測試用假的 Map。
 */
import type { DrillKind } from './types';

export const STATS_KEY = 'yishipei:drill';

export interface KindStat { n: number; ok: number }
export interface DrillStats {
  v: 1;
  best: { score: number; at: string } | null;
  bestStreak: number;
  byKind: Partial<Record<DrillKind, KindStat>>;
  /** 依器具（MC、TR…）統計，抽題時熟練的器具少出一點 */
  byDev: Record<string, KindStat>;
  /** 答錯的題：n＝還要再答對幾次才移除 */
  missed: Record<string, { n: number; last: string }>;
  /** 有練習的日子（YYYY-MM-DD，最多 90 筆） */
  days: string[];
  rounds: number;
  questions: number;
}
export interface AnswerRec { id: string; kind: DrillKind; devKind?: string; ok: boolean; ms: number }
export interface StorageLike { getItem(k: string): string | null; setItem(k: string, v: string): void }

export const emptyStats = (): DrillStats => ({ v: 1, best: null, bestStreak: 0, byKind: {}, byDev: {}, missed: {}, days: [], rounds: 0, questions: 0 });

const store = (s?: StorageLike): StorageLike | null => {
  if (s) return s;
  try { return globalThis.localStorage ?? null; } catch { return null; }
};

export function loadStats(storage?: StorageLike): DrillStats {
  try {
    const raw = store(storage)?.getItem(STATS_KEY);
    if (!raw) return emptyStats();
    const o = JSON.parse(raw);
    return o?.v === 1 ? { ...emptyStats(), ...o } : emptyStats();
  } catch { return emptyStats(); }
}
export function saveStats(stats: DrillStats, storage?: StorageLike): void {
  try { store(storage)?.setItem(STATS_KEY, JSON.stringify(stats)); } catch { /* 私密模式等：不影響練習 */ }
}

/** 本地日期 YYYY-MM-DD */
export function today(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
const prevDay = (day: string): string => {
  const [y, m, d] = day.split('-').map(Number);
  return today(new Date(y, m - 1, d - 1));
};

/** 連續練習天數：今天（或昨天，今天還沒練）往回數 */
export function streakDays(stats: DrillStats, day = today()): number {
  const set = new Set(stats.days);
  let cur = set.has(day) ? day : prevDay(day);
  let n = 0;
  while (set.has(cur)) { n++; cur = prevDay(cur); }
  return n;
}

export function accuracy(s: KindStat | undefined): number | null {
  return s && s.n ? s.ok / s.n : null;
}

/** 記一題（答完立刻記，中途離開也算數） */
export function recordAnswer(stats: DrillStats, a: AnswerRec, day = today()): DrillStats {
  const s: DrillStats = structuredClone(stats);
  const k = (s.byKind[a.kind] ??= { n: 0, ok: 0 }); k.n++; if (a.ok) k.ok++;
  if (a.devKind) { const d = (s.byDev[a.devKind] ??= { n: 0, ok: 0 }); d.n++; if (a.ok) d.ok++; }
  s.questions++;
  if (!s.days.includes(day)) s.days = [...s.days, day].slice(-90);
  const m = s.missed[a.id];
  if (a.ok) { if (m) { m.n--; if (m.n <= 0) delete s.missed[a.id]; } }
  else s.missed[a.id] = { n: Math.min(3, (m?.n ?? 0) + 2), last: day };
  return s;
}

/** 回合結束：最佳分數、最長連勝、回合數。回傳是否破紀錄 */
export function recordRound(stats: DrillStats, score: number, bestStreak: number, day = today()): { stats: DrillStats; newBest: boolean } {
  const s: DrillStats = structuredClone(stats);
  const newBest = score > 0 && (!s.best || score > s.best.score);
  if (newBest) s.best = { score, at: day };
  s.bestStreak = Math.max(s.bestStreak, bestStreak);
  s.rounds++;
  return { stats: s, newBest };
}
