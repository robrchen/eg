import type { QuestionDef, TerminalDef } from './types';
import { defOf } from '../library';

/**
 * 考場預先引接的小端子台（TBM3 / TBM4）相關查詢。
 * 這些端子台本身沒有編號，每一格接到哪個接點要靠三用電表量；
 * 模擬器直接標出來，練習時才看得懂線要接哪一格。
 */

const spareCache = new WeakMap<QuestionDef, Set<string>>();

/** 引接線（器具本體 → 小端子台），不含 TB3 ↔ TB4 過門線 */
const isPreWire = (a: string, b: string) => !a.startsWith('TB3.') && !b.startsWith('TB3.');

/**
 * 小端子台上沒有被引接到任何器具的空位。
 * 實物上那一格確實存在但接不到東西，畫出來只會誤導，所以一律不顯示、不可接線。
 */
export function spareTerminals(q: QuestionDef): Set<string> {
  const hit = spareCache.get(q);
  if (hit) return hit;
  const linked = new Set<string>();
  for (const p of q.passThrough) { linked.add(p.a); linked.add(p.b); }
  const out = new Set<string>();
  for (const d of q.devices) {
    if (d.kind !== 'TBM3' && d.kind !== 'TBM4') continue;
    for (const t of defOf(d.kind).terminals) {
      const tid = `${d.id}.${t.id}`;
      if (!linked.has(tid)) out.add(tid);
    }
  }
  spareCache.set(q, out);
  return out;
}

export interface PreSource {
  /** 引接來源的端子全域 id，例如 REV.a上 */
  from: string;
  /** 顯示文字，例如 a / X1 / c；有簡寫就用簡寫 */
  label: string;
  role: TerminalDef['role'];
}

/** 小端子台的某一格是從哪個接點引接過來的 */
export function preSource(q: QuestionDef, tid: string): PreSource | null {
  const p = q.passThrough.find(x => (x.a === tid || x.b === tid) && isPreWire(x.a, x.b));
  if (!p) return null;
  const from = p.a === tid ? p.b : p.a;
  const cut = from.lastIndexOf('.');
  const inst = q.devices.find(x => x.id === from.slice(0, cut));
  if (!inst) return null;
  const def = defOf(inst.kind).terminals.find(x => x.id === from.slice(cut + 1));
  return def ? { from, label: def.short || def.label || def.id, role: def.role } : null;
}
