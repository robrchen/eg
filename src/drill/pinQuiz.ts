/**
 * 腳位記憶題：全部從器具庫（src/library）自動產生，不手寫題庫。
 * 問法照考場實務：「共用腳是哪一腳」「b 接點要鎖哪兩腳」「三用電表量這兩腳會怎樣」。
 */
import type { DeviceDef, DeviceKind, ElementDef, TerminalDef } from '../model/types';
import { defOf } from '../library';
import type { Display, DrillQ, Level, Option, Template } from './types';
import { shuffle } from './rng';

export const PIN_KINDS: DeviceKind[] = ['MC', 'TR', 'TRF', 'KR', 'THRY', 'PB'];

/** 題目裡的器具稱呼（短，手機一行放得下） */
export const DEV_NAME: Partial<Record<DeviceKind, string>> = {
  MC: 'MC', TR: 'TR（Y-Δ 計時器）', TRF: 'TR（斷電延遲計時器）', KR: 'KR（保持電驛）', THRY: 'TH-RY', PB: '按鈕',
};
/** 標籤列用的全名 */
export const DEV_FULL: Partial<Record<DeviceKind, string>> = {
  MC: '電磁接觸器 MC', TR: 'Y-Δ 限時電驛 TR', TRF: '斷電延遲限時電驛', KR: '保持電驛 KR', THRY: '積熱電驛 TH-RY', PB: '按鈕開關 1a1b',
};
const dn = (k: DeviceKind) => DEV_NAME[k] ?? k;

export type Cat = 'a' | 'b' | 'c' | 'coil' | 'empty';
export const CAT_SHORT: Record<Cat, string> = { a: 'a', b: 'b', c: 'c', coil: '線圈', empty: '空' };

export type Elem = Extract<ElementDef, { kind: 'coil' | 'contact' }>;
export type Contact = Extract<ElementDef, { kind: 'contact' }>;
export const elemsOf = (def: DeviceDef): Elem[] => def.elements.filter((e): e is Elem => e.kind === 'coil' || e.kind === 'contact');
export const elemKey = (e: Elem) => (e.kind === 'contact' ? e.name : e.name ?? 'coil');

/** 實物上印的端子號：TR／KR 就是標籤；MC 看 IEC 編號（A1／A2 除外）；TH-RY 95／96／98；按鈕 1～4 */
export function numOf(t: TerminalDef): string | null {
  if (/^\d+$/.test(t.label) || /^A\d$/.test(t.label)) return t.label;
  const m = t.sub?.match(/^\d+/);
  return m ? m[0] : null;
}
const isEmpty = (t: TerminalDef) => t.sub === '空';
const term = (def: DeviceDef, id: string) => def.terminals.find(t => t.id === id)!;
export const num = (def: DeviceDef, id: string) => numOf(term(def, id)) ?? id;

/** 端子分類：兩個接點共用的腳＝c；屬於某個接點＝a／b；屬於線圈＝線圈；標「空」＝空腳 */
export function catOf(def: DeviceDef, tid: string): Cat {
  const t = term(def, tid);
  if (isEmpty(t)) return 'empty';
  const cs = elemsOf(def).filter((e): e is Contact => e.kind === 'contact' && e.t.includes(tid));
  if (cs.length >= 2 || (t.role === 'common' && cs.length)) return 'c';
  if (cs.length === 1) return cs[0].type;
  if (elemsOf(def).some(e => e.kind === 'coil' && e.t.includes(tid))) return 'coil';
  return 'empty';
}

/** 元件的說法：短（選項用）與長（題幹用，附動作說明） */
export function elemDesc(kind: DeviceKind, e: Elem, long = false): string {
  if (e.kind === 'coil') {
    if (kind === 'KR') return `${e.name} ${e.name === 'SC' ? '設定' : '復歸'}線圈`;
    if (kind === 'TR' || kind === 'TRF') return long ? '電源（線圈，通電開始計時）' : '電源（線圈）';
    return '線圈';
  }
  const ab = `${e.type} 接點`;
  const a = e.type === 'a';
  switch (kind) {
    case 'MC': return `${e.name.includes('左') ? '左側' : '右側'}接點塊的 ${ab}`;
    case 'TR': return long ? `${ab}（${a ? 'Δ 運轉用，計時到閉合' : 'Y 啟動用，計時到打開'}）` : `${ab}（${a ? 'Δ 運轉用' : 'Y 啟動用'}）`;
    case 'TRF': return long ? `延時 ${ab}（得電立即${a ? '閉合' : '打開'}，斷電後延遲才復歸）` : `延時 ${ab}`;
    case 'KR': return `${e.name.startsWith('接點一') ? '接點一' : '接點二'}的 ${ab}${long ? `（${a ? '設定' : '復歸'}時閉合）` : ''}`;
    case 'THRY': return long ? `${ab}（平常${a ? '打開' : '閉合'}，過載跳脫時${a ? '閉合' : '打開'}）` : ab;
    case 'PB': return long ? `${ab}（按下${a ? '閉合' : '打開'}）` : ab;
    default: return ab;
  }
}

/** 元件的端子號，共用點 c 排前面：8-5、95-96、13-14 */
export function elemNums(def: DeviceDef, e: Elem): string[] {
  const ts = [...e.t].sort((x, y) => Number(catOf(def, y) === 'c') - Number(catOf(def, x) === 'c'));
  return ts.map(id => num(def, id));
}
export const pairText = (nums: string[]) => nums.join('-');
const pairNorm = (nums: string[]) => [...nums].sort().join('-');

/** 器具重點整理（答後解說用） */
export function deviceFacts(kind: DeviceKind): string {
  const def = defOf(kind);
  const parts = elemsOf(def).map(e => `<b>${pairText(elemNums(def, e))}</b> ${elemDesc(kind, e)}`);
  return `${DEV_FULL[kind] ?? kind}：${parts.join('；')}`;
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

export const opt = (text: string): Option => ({ key: text, text });

/** 選擇題：正解＋2～3 個錯誤選項（去重後不足 2 個就不出） */
export function choice(base: Omit<Extract<DrillQ, { answer: 'choice' }>, 'answer' | 'options' | 'correct'>, correct: string, wrong: string[], rng: () => number): DrillQ | null {
  const pool = [...new Set(wrong)].filter(w => w !== correct);
  if (pool.length < 2) return null;
  return { ...base, answer: 'choice', options: shuffle([correct, ...shuffle(pool, rng).slice(0, 3)], rng).map(opt), correct };
}

/* ---------- 三用電表 ---------- */
export const METER = { short: '導通（約 0 Ω）', open: '不通（∞，指針不動）', coil: '線圈電阻（數百 Ω）' } as const;
export type Reading = keyof typeof METER;

/** 各器具「靜止」「動作」狀態的說法；TR 通電中不能用 Ω 檔量，只問未通電 */
const ACT_STATE: Partial<Record<DeviceKind, { rest: string; act?: string }>> = {
  MC: { rest: '未動作', act: '用手把接觸器可動部壓到底，模擬吸合' },
  TR: { rest: '未通電' }, TRF: { rest: '未通電' },
  KR: { rest: '停在復歸狀態、未通電', act: '停在設定狀態（SC 動作過）、未通電' },
  THRY: { rest: '正常、未跳脫', act: '按 TEST 讓它跳脫後' },
  PB: { rest: '未按', act: '按住不放' },
};

/** 用 Ω 檔量兩腳：只經閉合接點相連＝導通；要經過線圈＝線圈電阻；否則不通 */
export function meterReading(def: DeviceDef, a: string, b: string, act: boolean): Reading {
  const closed = (e: Contact) => (e.type === 'b') !== (act && e.driver !== 'timer' && e.driver !== 'offdelay');
  const linked = (withCoil: boolean) => {
    const parent = new Map<string, string>();
    const f = (x: string): string => { while (parent.has(x)) x = parent.get(x)!; return x; };
    for (const e of elemsOf(def)) {
      if (!((e.kind === 'contact' && closed(e)) || (withCoil && e.kind === 'coil'))) continue;
      const [x, y] = [f(e.t[0]), f(e.t[1])];
      if (x !== y) parent.set(x, y);
    }
    return f(a) === f(b);
  };
  return linked(false) ? 'short' : linked(true) ? 'coil' : 'open';
}

/** 列出所有腳位題樣板（id 固定、可重建） */
export function pinTemplates(kinds: DeviceKind[] = PIN_KINDS): Template[] {
  const out: Template[] = [];
  const add = (id: string, kind: Template['kind'], level: Level, devKind: DeviceKind, build: (rng: () => number) => DrillQ | null) => {
    if (!build(() => 0.5)) return;   // 建不出來（選項不足）的不收
    out.push({ id, kind, level, devKind, build: rng => build(rng)! });
  };
  for (const kind of kinds.filter(k => PIN_KINDS.includes(k))) {
    const def = defOf(kind);
    const D = dn(kind);
    // 「TR（Y-Δ 計時器）的」不要多一個空白；「MC 的」要空白
    const Db = /）$/.test(D) ? `<b>${D}</b>` : `<b>${D}</b> `;
    const facts = deviceFacts(kind);
    const elems = elemsOf(def);
    const terms = def.terminals.filter(t => t.role !== 'main');
    const base = (id: string, k: DrillQ['kind'], level: Level, prompt: string, ms: number, hint?: string) => ({ id, kind: k, level, prompt, explain: facts, timeLimitMs: ms, devKind: kind, hint });

    // 1. c／a／b 配對：共用腳 c 是哪一腳；某接點一端是 c，另一端是哪一腳
    const seenC = new Set<string>();
    for (const e of elems) {
      if (e.kind !== 'contact') continue;
      const c = e.t.find(id => catOf(def, id) === 'c');
      if (!c) continue;
      const other = e.t.find(id => id !== c)!;
      const group = kind === 'KR' ? (e.name.startsWith('接點一') ? '接點一' : '接點二') : '';
      for (const [display, level] of [['num', 1], ['none', 2]] as [Display, Level][]) {
        const hint = display === 'none' ? '端子上不標號碼，憑位置找' : undefined;
        if (!seenC.has(`${c}:${display}`)) {
          seenC.add(`${c}:${display}`);
          const id = `pin-tap:${kind}:c:${c}:${display}`;
          add(id, 'pin-tap', level, kind, () => ({
            ...base(id, 'pin-tap', level, `${Db}${group}的<b>共用腳 c</b> 是哪一腳？`, 12000, hint),
            answer: 'tap', def, display, targets: [c],
          }));
        }
        const id = `pin-tap:${kind}:${elemKey(e)}:${display}`;
        add(id, 'pin-tap', level, kind, () => ({
          ...base(id, 'pin-tap', level, `<b>${D}</b>「<b>${elemDesc(kind, e, true)}</b>」一端是共用腳 <b>${num(def, c)}</b>，另一端是哪一腳？`, 12000, hint),
          answer: 'tap', def, display, targets: [other],
        }));
      }
    }

    // 2. 接點 → 端子號：線要鎖哪兩腳？
    const realNums = terms.filter(t => !isEmpty(t)).map(numOf).filter((n): n is string => !!n);
    for (const e of elems) {
      const nums = elemNums(def, e);
      const id = `pin-iec:${kind}:${elemKey(e)}`;
      add(id, 'pin-iec', 1, kind, rng => {
        const norm = pairNorm(nums);
        const real = elems.filter(x => x !== e).map(x => pairText(elemNums(def, x)));
        // 「共用同一腳」的錯誤組合最像真的（例 8-6、8-7）
        // 先用其他元件的真實組合（最容易搞混），不夠再補「共用同一腳」的錯誤組合（例 8-7）
        const fake = nums.flatMap(a => shuffle(realNums.filter(b => b !== a && !nums.includes(b)), rng).map(b => pairText([a, b])));
        const wrong = [...new Map([...shuffle(real, rng), ...fake].filter(w => pairNorm(w.split('-')) !== norm).map(w => [pairNorm(w.split('-')), w])).values()].slice(0, 3);
        return choice(base(id, 'pin-iec', 1, `要接 <b>${D}</b>「<b>${elemDesc(kind, e, true)}</b>」，線要鎖在哪兩腳？`, 12000), pairText(nums), wrong, rng);
      });
    }

    // 3. 端子號 → 接點：這兩腳之間是什麼？
    for (const e of elems) {
      const id = `pin-name:${kind}:${elemKey(e)}`;
      add(id, 'pin-name', 1, kind, rng => choice(
        base(id, 'pin-name', 1, `${Db}的 <b>${pairText(elemNums(def, e))}</b> 這兩腳之間是什麼？`, 12000),
        elemDesc(kind, e), elems.map(x => elemDesc(kind, x)), rng));
    }

    // 4. 三用電表 Ω 檔量兩腳
    const st = ACT_STATE[kind];
    if (!st) continue;
    const pairs: { a: string; b: string; why: string }[] = elems.map(e => ({ a: e.t[0], b: e.t[1], why: elemDesc(kind, e, true) }));
    // 陷阱題：兩個接點各取非共用的一端（TR 5-6、TH-RY 96-98、KR 3-4）
    for (const x of elems) for (const y of elems) {
      if (x.kind !== 'contact' || y.kind !== 'contact' || x.name >= y.name) continue;
      const c = x.t.find(id => y.t.includes(id));
      if (!c) continue;
      const [pa, pb] = [x.t.find(id => id !== c)!, y.t.find(id => id !== c)!].sort((m, n) => Number(num(def, m)) - Number(num(def, n)));
      pairs.push({ a: pa, b: pb, why: `兩腳分屬${elemDesc(kind, x)}與${elemDesc(kind, y)}，中間隔著共用腳 ${num(def, c)}，要兩個接點同時閉合才會通` });
    }
    for (const p of pairs) for (const act of st.act ? [false, true] : [false]) {
      const isCoil = elems.some(e => e.kind === 'coil' && e.t.includes(p.a) && e.t.includes(p.b));
      if (act && isCoil) continue;   // 線圈讀數與狀態無關，不重複出
      const nums = `${num(def, p.a)}-${num(def, p.b)}`;
      const reading = meterReading(def, p.a, p.b, act);
      const state = act ? st.act! : st.rest;
      const id = `meter:${kind}:${nums}:${act ? 'act' : 'rest'}`;
      const cross = !elems.some(e => e.t.includes(p.a) && e.t.includes(p.b));
      const level: Level = act || cross ? 2 : 1;
      add(id, 'meter', level, kind, () => ({
        ...base(id, 'meter', level, `三用電表撥 Ω 檔，量 ${Db}的 <b>${nums}</b>（<b>${state}</b>），讀數會是？`, 12000),
        explain: `${nums}：${p.why}。${state} → <b>${METER[reading]}</b>`,
        answer: 'choice', options: (['short', 'open', 'coil'] as Reading[]).map(r => opt(METER[r])), correct: METER[reading],
      }));
    }
  }
  return out;
}
