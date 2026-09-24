/**
 * 腳位題：全部從器具庫（src/library）自動產生，不手寫題庫。
 * 重點是把「c／a／b 接點」和「端子號、位置」連起來記：TR 8 共用、8-5 b、8-6 a；MC 側掛塊 a b b a（13 21 22 14）；TH-RY 95 c／96 b／98 a…
 */
import type { DeviceDef, DeviceKind, ElementDef, TerminalDef } from '../model/types';
import { defOf, KIND_NOTE } from '../library';
import type { Display, DrillQ, Level, Option, Template } from './types';
import { shuffle } from './rng';

export const PIN_KINDS: DeviceKind[] = ['MC', 'TR', 'TRF', 'KR', 'THRY', 'PB'];

export const DEV_NAME: Partial<Record<DeviceKind, string>> = {
  MC: 'MC 電磁接觸器', TR: 'TR（Y-Δ 限時電驛）', TRF: 'TRF（斷電延遲電驛）', KR: 'KR（保持電驛）', THRY: 'TH-RY（積熱電驛）', PB: 'PB（按鈕 1a1b）',
};
const dn = (k: DeviceKind) => DEV_NAME[k] ?? k;

export type Cat = 'a' | 'b' | 'c' | 'coil' | 'empty';
export const CAT_TEXT: Record<Cat, string> = { a: 'a 接點（常開）', b: 'b 接點（常閉）', c: '共用點 c', coil: '線圈（電源）', empty: '空腳（未使用）' };
export const CAT_SHORT: Record<Cat, string> = { a: 'a', b: 'b', c: 'c', coil: '線圈', empty: '空' };

type Elem = Extract<ElementDef, { kind: 'coil' | 'contact' }>;
const elemsOf = (def: DeviceDef): Elem[] => def.elements.filter((e): e is Elem => e.kind === 'coil' || e.kind === 'contact');
const elemKey = (e: Elem) => (e.kind === 'contact' ? e.name : e.name ?? 'coil');

/** 實物上印的端子號：TR／KR 就是標籤；MC 看 IEC 編號（A1／A2 除外）；TH-RY 95／96／98；按鈕 1～4 */
export function numOf(t: TerminalDef): string | null {
  if (/^\d+$/.test(t.label) || /^A\d$/.test(t.label)) return t.label;
  const m = t.sub?.match(/^\d+/);
  return m ? m[0] : null;
}
const isEmpty = (t: TerminalDef) => t.sub === '空';
/** 可出題的端子：不含主電路 */
const shownTerms = (def: DeviceDef) => def.terminals.filter(t => t.role !== 'main');

/** 端子分類：兩個接點共用的腳＝c；屬於某個接點＝a／b；屬於線圈＝線圈；標「空」＝空腳 */
export function catOf(def: DeviceDef, tid: string): Cat {
  const t = def.terminals.find(x => x.id === tid)!;
  if (isEmpty(t)) return 'empty';
  const cs = elemsOf(def).filter(e => e.kind === 'contact' && e.t.includes(tid)) as Extract<Elem, { kind: 'contact' }>[];
  if (cs.length >= 2 || (t.role === 'common' && cs.length)) return 'c';
  if (cs.length === 1) return cs[0].type;
  if (elemsOf(def).some(e => e.kind === 'coil' && e.t.includes(tid))) return 'coil';
  return 'empty';
}

/** 元件的口語說法（同器具內不重複） */
export function elemDesc(kind: DeviceKind, e: Elem): string {
  if (e.kind === 'coil') {
    if (kind === 'KR') return `${e.name} ${e.name === 'SC' ? '設定' : '復歸'}線圈`;
    if (kind === 'TR' || kind === 'TRF') return '電源（線圈）';
    return '線圈';
  }
  const ab = `${e.type} 接點`;
  switch (kind) {
    case 'MC': return `${e.name.includes('左') ? '左側' : '右側'} ${ab}`;
    case 'TR': return `${ab}（${e.type === 'b' ? 'Y 啟動' : 'Δ 運轉'}）`;
    case 'TRF': return `延時 ${ab}`;
    case 'KR': return `${e.name.startsWith('接點一') ? '接點一' : '接點二'} ${ab}`;
    default: return ab;
  }
}
/** KR 的接點一／接點二（共用點要分開問） */
const groupOf = (kind: DeviceKind, e: Elem) => (kind === 'KR' && e.kind === 'contact' ? (e.name.startsWith('接點一') ? '接點一' : '接點二') : '');

/** 元件的端子號，共用點 c 排前面：8-5、95-96、13-14 */
export function elemNums(def: DeviceDef, e: Elem): string[] {
  const ts = [...e.t].sort((x, y) => Number(catOf(def, y) === 'c') - Number(catOf(def, x) === 'c'));
  return ts.map(id => numOf(def.terminals.find(t => t.id === id)!) ?? id);
}
const pairText = (nums: string[]) => nums.join('-');
const pairNorm = (nums: string[]) => [...nums].sort().join('-');

/** 器具重點整理（答後解說用） */
export function deviceFacts(kind: DeviceKind): string {
  const def = defOf(kind);
  const parts = elemsOf(def).map(e => `<b>${pairText(elemNums(def, e))}</b> ${elemDesc(kind, e)}`);
  const empties = shownTerms(def).filter(isEmpty).map(t => numOf(t) ?? t.id);
  if (empties.length) parts.push(`空腳 ${empties.join('、')}`);
  return `${dn(kind)}：${parts.join('；')}`;
}

/** 端子圖顯示：練習時用中性色，只露出題目允許的文字 */
export function displayLabel(_def: DeviceDef, t: TerminalDef, display: Display): string {
  if (display === 'none') return '';
  if (display === 'num') return numOf(t) ?? '';
  return t.short || t.label;
}
/** 答後揭曉：大字端子號、小字 c／a／b */
export function revealLabel(def: DeviceDef, t: TerminalDef): { label: string; sub: string } {
  return { label: numOf(t) ?? t.label, sub: CAT_SHORT[catOf(def, t.id)] };
}

const opt = (text: string): Option => ({ key: text, text });

/** 由樣板組出選擇題：正解＋最多 3 個錯誤選項（先去重，不足 3 個就不出這題） */
function choice(base: Omit<Extract<DrillQ, { answer: 'choice' }>, 'answer' | 'options' | 'correct'>, correct: string, wrong: string[], rng: () => number): DrillQ | null {
  const pool = [...new Set(wrong)].filter(w => w !== correct);
  if (pool.length < 3) return null;
  const picked = shuffle(pool, rng).slice(0, 3);
  return { ...base, answer: 'choice', options: shuffle([correct, ...picked], rng).map(opt), correct };
}

/** 不重複的全排列（最多 6 個元素） */
function perms(tokens: string[]): string[][] {
  if (tokens.length <= 1) return [tokens];
  const out = new Map<string, string[]>();
  tokens.forEach((t, i) => { for (const rest of perms([...tokens.slice(0, i), ...tokens.slice(i + 1)])) { const p = [t, ...rest]; out.set(p.join('\u0001'), p); } });
  return [...out.values()];
}

/** 一排／一列（≥3 顆）端子，照示意圖座標由左到右或由上到下 */
function lines(def: DeviceDef, kind: DeviceKind): { where: string; dir: string; terms: TerminalDef[] }[] {
  const pos = (t: TerminalDef) => def.card?.pos[t.id] ?? [t.x, t.y];
  // MC 的側掛接點塊只看接點（A1／A2 不算在塊內）
  const ts = shownTerms(def).filter(t => !(kind === 'MC' && catOf(def, t.id) === 'coil'));
  const group = (axis: 0 | 1) => {
    const m = new Map<number, TerminalDef[]>();
    for (const t of ts) { const k = Math.round(pos(t)[axis]); m.set(k, [...(m.get(k) ?? []), t]); }
    return [...m.entries()].filter(([, v]) => v.length >= 3).sort((a, b) => a[0] - b[0]);
  };
  const out: { where: string; dir: string; terms: TerminalDef[] }[] = [];
  const rows = group(1);
  rows.forEach(([, v], i) => out.push({
    where: rows.length === 1 ? '這一排' : i === 0 ? '上排' : i === rows.length - 1 ? '下排' : `第 ${i + 1} 排`,
    dir: '左→右', terms: v.sort((a, b) => pos(a)[0] - pos(b)[0]),
  }));
  const cols = group(0);
  cols.forEach(([, v], i) => out.push({
    where: kind === 'MC' ? (i === 0 ? '左側接點塊' : '右側接點塊') : cols.length === 1 ? '這一列' : i === 0 ? '左列' : '右列',
    dir: '上→下', terms: v.sort((a, b) => pos(a)[1] - pos(b)[1]),
  }));
  return out;
}

/** 列出所有腳位題樣板（id 固定、可重建） */
export function pinTemplates(kinds: DeviceKind[] = PIN_KINDS): Template[] {
  const out: Template[] = [];
  const add = (id: string, kind: Template['kind'], level: Level, devKind: DeviceKind, build: (rng: () => number) => DrillQ | null) => {
    // 先試建一次：建不出來（選項不足）的題目不收
    if (!build(() => 0.5)) return;
    out.push({ id, kind, level, devKind, build: rng => build(rng)! });
  };
  for (const kind of kinds.filter(k => PIN_KINDS.includes(k))) {
    const def = defOf(kind);
    const D = dn(kind);
    const facts = deviceFacts(kind);
    const elems = elemsOf(def);
    const terms = shownTerms(def);
    const numUnique = (t: TerminalDef) => { const n = numOf(t); return !!n && terms.filter(x => numOf(x) === n).length === 1; };
    const base = (id: string, k: DrillQ['kind'], level: Level, prompt: string, ms: number) => ({ id, kind: k, level, prompt, explain: facts, timeLimitMs: ms, devKind: kind });

    // A. 點出接點／線圈的兩端
    for (const e of elems) for (const [display, level] of [['num', 1], ['none', 2]] as [Display, Level][]) {
      const id = `pin-pair:${kind}:${elemKey(e)}:${display}`;
      add(id, 'pin-pair', level, kind, () => ({
        ...base(id, 'pin-pair', level, `點出 <b>${D}</b> 的 <b>${elemDesc(kind, e)}</b> 兩端`, 15000),
        answer: 'tap', def, display, targets: [...e.t],
      }));
    }

    // B. c／a／b 連結：共用點 c 是哪顆、與 c 配對的 a／b 是哪一腳
    const cTerms = new Set<string>();
    for (const e of elems) {
      if (e.kind !== 'contact') continue;
      const c = e.t.find(id => catOf(def, id) === 'c');
      if (!c) continue;
      const other = e.t.find(id => id !== c)!;
      const g = groupOf(kind, e);
      for (const [display, level] of [['num', 1], ['none', 2]] as [Display, Level][]) {
        if (!cTerms.has(`${c}:${display}`)) {
          cTerms.add(`${c}:${display}`);
          const id = `pin-tap:${kind}:c:${c}:${display}`;
          add(id, 'pin-tap', level, kind, () => ({
            ...base(id, 'pin-tap', level, `點出 <b>${D}</b> ${g ? `${g}的` : '的'}<b>共用點 c</b>`, 12000),
            answer: 'tap', def, display, targets: [c],
          }));
        }
        const id = `pin-tap:${kind}:${elemKey(e)}:${display}`;
        add(id, 'pin-tap', level, kind, () => ({
          ...base(id, 'pin-tap', level, `點出 <b>${D}</b> 的 <b>${elemDesc(kind, e)}</b>（與共用點 c 配對的那一腳）`, 12000),
          answer: 'tap', def, display, targets: [other],
        }));
      }
    }

    // C. 點出 N 號端子（位置記憶）；MC／按鈕／TH-RY 保留 a／b 簡寫，其他全隱藏
    const roleDisplay = terms.some(t => t.short) || kind === 'THRY';
    for (const t of terms) {
      if (isEmpty(t) || !numUnique(t)) continue;
      if (roleDisplay && displayLabel(def, t, 'role') === numOf(t)) continue;   // 顯示出來就等於答案（MC 的 A1／A2）
      const id = `pin-num:${kind}:${t.id}`;
      const display: Display = roleDisplay ? 'role' : 'none';
      add(id, 'pin-num', 2, kind, () => ({
        ...base(id, 'pin-num', 2, `點出 <b>${D}</b> 的 <b>${numOf(t)}</b> 號端子`, 12000),
        answer: 'tap', def, display, targets: [t.id],
      }));
    }

    // D. 某接點是哪兩個端子號？
    const realNums = terms.map(numOf).filter((n): n is string => !!n);
    // 相鄰號碼（例 TH-RY 只有 95 96 98，補 94、97、99），只在真實端子號湊不出 3 個錯誤選項時才用
    const nearNums = [...new Set(realNums.filter(n => /^\d+$/.test(n)).flatMap(n => [+n - 1, +n + 1]).filter(n => n > 0).map(String))].filter(n => !realNums.includes(n));
    for (const e of elems) {
      const nums = elemNums(def, e);
      const id = `pin-iec:${kind}:${elemKey(e)}`;
      add(id, 'pin-iec', 1, kind, rng => {
        const norm = pairNorm(nums);
        const real = elems.filter(x => x !== e).map(x => pairText(elemNums(def, x)));
        // 「共用一腳」的假組合（例 8-4、8-1），比隨便亂湊更像真的
        const fakes = (pool: string[]) => {
          const f: string[] = [];
          for (const a of nums) for (const b of pool) if (a !== b) f.push(pairText([a, b]));
          return shuffle(f, rng);
        };
        const uniqOf = (ws: string[]) => [...new Map(ws.filter(w => pairNorm(w.split('-')) !== norm).map(w => [pairNorm(w.split('-')), w])).values()];
        let uniq = uniqOf([...real, ...fakes(realNums)]);
        if (uniq.length < 3) uniq = uniqOf([...real, ...fakes(realNums), ...fakes(nearNums)]);
        return choice(base(id, 'pin-iec', 1, `<b>${D}</b> 的 <b>${elemDesc(kind, e)}</b> 是哪兩個端子？`, 12000), pairText(nums), uniq, rng);
      });
    }

    // E. 反過來：x-y 是什麼接點？
    for (const e of elems) {
      const nums = elemNums(def, e);
      const id = `pin-name:${kind}:${elemKey(e)}`;
      const descs = elems.map(x => elemDesc(kind, x));
      const extra = ['空腳（未使用）', ...(descs.some(d => d.includes('線圈')) ? [] : ['線圈'])];
      add(id, 'pin-name', 1, kind, rng => choice(base(id, 'pin-name', 1, `<b>${D}</b> 的 <b>${pairText(nums)}</b> 是？`, 12000), elemDesc(kind, e), [...descs, ...extra], rng));
    }

    // F. N 號腳是 c／a／b／線圈／空？
    for (const t of terms) {
      if (!numUnique(t)) continue;
      const cat = catOf(def, t.id);
      const id = `pin-role:${kind}:${t.id}`;
      add(id, 'pin-role', 1, kind, rng => choice(base(id, 'pin-role', 1, `<b>${D}</b> 的 <b>${numOf(t)}</b> 號腳是？`, 12000), CAT_TEXT[cat], Object.values(CAT_TEXT), rng));
    }

    // G. 一排端子依序是？（端子號、c／a／b 兩種問法）
    for (const ln of lines(def, kind)) for (const variant of ['num', 'cat'] as const) {
      const tokens = ln.terms.map(t => (variant === 'num' ? numOf(t) ?? t.id : CAT_SHORT[catOf(def, t.id)]));
      const correct = tokens.join('  ');
      const id = `pin-order:${kind}:${ln.where}:${variant}`;
      add(id, 'pin-order', 2, kind, rng => choice(
        base(id, 'pin-order', 2, `<b>${D}</b> ${ln.where}（${ln.dir}）的${variant === 'num' ? '端子號' : '接點種類'}依序是？`, 15000),
        correct, perms(tokens).map(p => p.join('  ')), rng));
    }
  }
  return out;
}

/** 器具說明（器具庫附註），結算畫面「看解說」用 */
export const kindNote = (k: DeviceKind): string => KIND_NOTE[k] ?? '';
