/**
 * 練習模式（Drill）的題目資料結構。純資料、不碰 DOM，vitest 可直接驗證。
 */
import type { DeviceDef, DeviceKind, TerminalRole } from '../model/types';
import type { SchDiagram } from '../model/schematic';

export type DrillKind =
  // 腳位記憶
  | 'pin-tap'     // c／a／b 配對：共用腳 c 是哪一腳、b 接點另一端是哪一腳
  | 'pin-iec'     // 接點 → 端子號（要鎖哪兩腳）
  | 'pin-name'    // 端子號 → 接點（這兩腳之間是什麼）
  | 'meter'       // 三用電表 Ω 檔量兩腳：導通／不通／線圈電阻
  // 看電路圖接線（依本題電路圖）
  | 'schem-find'  // 電路圖上框起來的接點，實物要接哪幾腳
  | 'purpose'     // 這個接點在電路裡做什麼用（自保、互鎖…）
  // 動作連鎖題（Phase 2）
  | 'chain-next' | 'chain-state' | 'chain-why' | 'chain-order' | 'chain-contact';

export type Level = 1 | 2 | 3;

export interface Option { key: string; text: string; sub?: string }

/** 端子圖怎麼顯示：num＝只顯示實物端子號；none＝全部隱藏；role＝顯示 a／b 等簡寫 */
export type Display = 'num' | 'none' | 'role';

interface Base {
  /** 確定性 id：同一題永遠同一個 id（錯題複習靠它重建題目） */
  id: string;
  kind: DrillKind;
  level: Level;
  /** 題幹（可含 <b>） */
  prompt: string;
  /** 答後顯示的解說（可含 <b>、<br>） */
  explain: string;
  timeLimitMs: number;
  devKind?: DeviceKind;
  /** 題幹下方的小字提示 */
  hint?: string;
  /** 題目附的電路圖片段（框出要看的符號） */
  figure?: Figure;
  /** 動作連鎖題：對應劇本的第幾段、第幾步（板上示範用） */
  demo?: { scIdx: number; stepIdx: number };
}

/** 電路圖片段：整張圖 + 要框起來的符號 id */
export interface Figure { diagram: SchDiagram; focus: string }

export interface TapQ extends Base {
  answer: 'tap';
  def: DeviceDef;
  display: Display;
  /** 正解端子 id（器具內 id，例 '8'、'a左上'） */
  targets: string[];
  /** 其他也算對的組合（例：MC 左右兩組 b 接點都能當互鎖用） */
  alts?: string[][];
}
export interface ChoiceQ extends Base { answer: 'choice'; options: Option[]; correct: string }
export interface MultiQ extends Base { answer: 'multi'; options: Option[]; correct: string[] }
export interface OrderQ extends Base { answer: 'order'; items: Option[]; correct: string[] }
export type DrillQ = TapQ | ChoiceQ | MultiQ | OrderQ;

export interface Verdict { ok: boolean; correctText: string }

const sameSet = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join('\u0001') === [...b].sort().join('\u0001');

/** 判分：tap＝已點的端子 id（不分順序）；choice＝[key]；multi＝已選 keys；order＝依序的 keys */
export function check(q: DrillQ, input: string[]): Verdict {
  switch (q.answer) {
    case 'tap': return { ok: [q.targets, ...(q.alts ?? [])].some(t => sameSet(t, input)), correctText: q.targets.join('、') };
    case 'choice': return { ok: input.length === 1 && input[0] === q.correct, correctText: q.options.find(o => o.key === q.correct)?.text ?? '' };
    case 'multi': return { ok: sameSet(q.correct, input), correctText: q.correct.map(k => q.options.find(o => o.key === k)?.text ?? k).join('、') || '（都不是）' };
    case 'order': return { ok: input.join('\u0001') === q.correct.join('\u0001'), correctText: q.correct.map(k => q.items.find(o => o.key === k)?.text ?? k).join(' → ') };
  }
}

/** 題庫中的一題「樣板」：id 與內容固定，build 時才洗選項 */
export interface Template {
  id: string;
  kind: DrillKind;
  level: Level;
  devKind?: DeviceKind;
  build(rng: () => number): DrillQ;
}

export const NEUTRAL_ROLE: TerminalRole = 'tb';
