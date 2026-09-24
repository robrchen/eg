/**
 * 看電路圖接線題：依本題的電路圖（q.schematic）與參考接線自動出題。
 * - schem-find：電路圖上框起來的接點／線圈，實物要接哪幾腳（同器具上同種接點換一組也算對）
 * - purpose：框起來的接點在電路裡做什麼用；反過來問「自保／互鎖／Y 啟動要用哪個接點」
 */
import type { DeviceKind, QuestionDef } from '../model/types';
import type { SchSym } from '../model/schematic';
import { defOf } from '../library';
import { teacherWiresOf } from '../model/questions/common';
import { buildRoles, wiredTerminals, type Roles } from '../engine/trace';
import type { DrillQ, Level, Template } from './types';
import { DEV_FULL, choice, elemDesc, elemKey, elemNums, elemsOf, pairText, type Contact, type Elem } from './pinQuiz';

const FIND_KINDS: DeviceKind[] = ['MC', 'TR', 'TRF', 'KR', 'THRY'];
const SKIP_SYM = new Set(['src', 'fuse', 'lamp', 'bz', 'pb-no', 'pb-nc', 'ems', 'main-no', 'heater', 'breaker', 'term', 'motor']);

/** 接點用途的白話說法（不含器具自己的名字，選項才不會一看就知道） */
export function roleText(role: string, e: Contact): string {
  if (role === '自保') return '自保持（放開啟動按鈕後，維持自己的線圈得電）';
  const lock = role.match(/^互鎖 (.+)$/);
  if (lock) return `互鎖（自己動作時，讓 ${lock[1]} 不能得電）`;
  if (role === '→ 整個控制回路') return e.type === 'b' ? '保護（打開時，整個控制回路斷電）' : '動作時接通整個控制回路';
  const to = role.match(/^→ (.+)$/)?.[1] ?? role;
  const on = e.type === 'a';
  switch (e.driver) {
    case 'timer': return on ? `計時到才接通 ${to}` : `計時中接通 ${to}，計時到切斷`;
    case 'offdelay': return on ? `得電立即接通 ${to}，斷電後延遲才切斷` : `得電立即切斷 ${to}，斷電後延遲才接通`;
    case 'trip': return on ? `過載跳脫時接通 ${to}` : `過載跳脫時切斷 ${to}`;
    case 'latch': return on ? `設定（記住正轉）時接通 ${to}` : `復歸（記住反轉）時接通 ${to}`;
    default: return on ? `動作時接通 ${to}` : `動作時切斷 ${to}`;
  }
}

interface SymInfo { s: SchSym; devId: string; kind: DeviceKind; label: string; elems: Elem[]; local: string[] }

/** 電路圖符號 → 器具元件（co 符號＝TH-RY 1c 的兩個接點） */
function symInfos(q: QuestionDef): SymInfo[] {
  const out: SymInfo[] = [];
  for (const s of q.schematic?.syms ?? []) {
    if (SKIP_SYM.has(s.kind)) continue;
    const inst = q.devices.find(d => d.id === s.dev);
    if (!inst || !FIND_KINDS.includes(inst.kind)) continue;
    const def = defOf(inst.kind);
    const local = s.t.map(t => t.slice(s.dev.length + 1));
    const elems = elemsOf(def).filter(e => e.t.every(t => local.includes(t)));
    if (!elems.length) continue;
    out.push({ s, devId: s.dev, kind: inst.kind, label: inst.label ?? inst.id, elems, local });
  }
  return out;
}

export function circuitTemplates(q: QuestionDef): Template[] {
  if (!q.schematic) return [];
  const diagram = q.schematic;
  const wires = teacherWiresOf(q);
  const roles: Roles = buildRoles(q, wires);
  const wired = wiredTerminals(q, wires);
  const infos = symInfos(q);
  const out: Template[] = [];
  const add = (id: string, kind: Template['kind'], level: Level, devKind: DeviceKind, build: (rng: () => number) => DrillQ | null) => {
    if (!build(() => 0.5)) return;
    out.push({ id, kind, level, devKind, build: rng => build(rng)! });
  };
  const roleOf = (devId: string, e: Elem) => roles.get(`${devId}.${elemKey(e)}`);
  // 參考接線裡真的有用到的接點（兩端都有線）
  const used = (devId: string, e: Elem) => e.t.every(t => wired.has(`${devId}.${t}`));

  for (const x of infos) {
    const def = defOf(x.kind);
    const figure = { diagram, focus: x.s.id };
    const single = x.elems.length === 1 ? x.elems[0] : null;
    const isCoil = single?.kind === 'coil';
    if (isCoil && x.kind === 'MC') continue;   // MC 線圈 A1／A2 印在本體上，不用考

    // 1. 看圖找端子
    {
      const id = `schem-find:${q.id}:${x.s.id}`;
      const contact = single?.kind === 'contact' ? single : null;
      // 同器具、同種、同驅動的其他接點也算對（MC 左右兩組 b 都能當互鎖）
      const alts = contact ? elemsOf(def).filter((e): e is Contact => e !== contact && e.kind === 'contact' && e.type === contact.type && e.driver === contact.driver).map(e => [...e.t]) : [];
      const what = isCoil ? elemDesc(x.kind, single!) : single ? `${single.type} 接點` : '1c 接點（c、b、a 三腳都有用到）';
      const role = contact ? roleOf(x.devId, contact) : undefined;
      const altNums = alts.map(t => pairText(elemNums(def, elemsOf(def).find(e => e.t.every(y => t.includes(y)))!)));
      add(id, 'schem-find', 1, x.kind, () => ({
        id, kind: 'schem-find', level: 1, devKind: x.kind, timeLimitMs: 20000, figure,
        prompt: `電路圖上框起來的是 <b>${x.label}</b> 的 <b>${what}</b>，實物上要接哪${x.local.length === 3 ? '三' : '兩'}腳？`,
        hint: alts.length ? '同一顆器具上，同種接點用哪一組都可以' : undefined,
        explain: `${x.label} 的${what}${role && contact ? `（${roleText(role, contact)}）` : ''}：接 <b>${x.elems.map(e => pairText(elemNums(def, e))).join('、')}</b>${altNums.length ? `，或 ${altNums.join('、')} 也可以` : ''}。<br>${DEV_FULL[x.kind]}：${elemsOf(def).map(e => `${pairText(elemNums(def, e))} ${elemDesc(x.kind, e)}`).join('；')}`,
        answer: 'tap', def, display: 'num', targets: x.local, alts,
      }));
    }

    // 2. 這個接點做什麼用？
    if (single?.kind === 'contact' && used(x.devId, single)) {
      const role = roleOf(x.devId, single);
      if (role) {
        const correct = roleText(role, single);
        const others = infos.flatMap(y => y.elems.length === 1 && y.elems[0].kind === 'contact' && used(y.devId, y.elems[0]) ? [roleOf(y.devId, y.elems[0]) ? roleText(roleOf(y.devId, y.elems[0])!, y.elems[0] as Contact) : ''] : []).filter(Boolean);
        // 常見的錯誤想法也放進來
        const common = ['自保持（放開啟動按鈕後，維持自己的線圈得電）', '保護（打開時，整個控制回路斷電）'];
        const id = `purpose:${q.id}:${x.s.id}`;
        add(id, 'purpose', 2, x.kind, rng => choice({
          id, kind: 'purpose', level: 2, devKind: x.kind, timeLimitMs: 20000, figure,
          prompt: `電路圖上框起來的 <b>${x.label}</b> ${single.type} 接點，在這個電路裡是做什麼用的？`,
          explain: `${x.label} 的 ${single.type} 接點：<b>${correct}</b>`,
        }, correct, [...others, ...common].filter(t => !t.includes(`讓 ${x.label} `)), rng));   // 「讓自己不能得電」這種選項沒意義
      }
    }
  }

  // 3. 反過來問：自保、互鎖要用哪個接點
  const mcIds = q.devices.filter(d => d.kind === 'MC').map(d => d.id);
  const lbl = (id: string) => q.devices.find(d => d.id === id)?.label ?? id;
  const doneHold = new Set<string>(), doneLock = new Set<string>();
  for (const x of infos) {
    const e = x.elems.length === 1 ? x.elems[0] : null;
    if (!e || e.kind !== 'contact' || x.kind !== 'MC') continue;
    const role = roleOf(x.devId, e);
    const others = mcIds.filter(m => m !== x.devId);
    if (!role || !others.length) continue;
    if (role === '自保' && !doneHold.has(x.devId)) {
      doneHold.add(x.devId);
      // 對手：和它互鎖的那顆 MC（正轉對反轉），找不到就取另一顆
      const partner = others.find(m => [...roles].some(([k, v]) => (k.startsWith(`${x.devId}.`) && v === `互鎖 ${lbl(m)}`) || (k.startsWith(`${m}.`) && v === `互鎖 ${lbl(x.devId)}`))) ?? others[0];
      const id = `purpose-hold:${q.id}:${x.devId}`;
      add(id, 'purpose', 2, 'MC', rng => choice({
        id, kind: 'purpose', level: 2, devKind: 'MC', timeLimitMs: 15000,
        prompt: `按一下啟動按鈕放開後，要讓 <b>${lbl(x.devId)}</b> 繼續得電（自保持），啟動按鈕要並聯哪個接點？`,
        explain: `自保持用<b>自己的 a 接點</b>並聯在啟動按鈕上：${lbl(x.devId)} 吸合後 a 接點閉合，放開按鈕電流改走這個接點。`,
      }, `${lbl(x.devId)} 的 a 接點`, [`${lbl(x.devId)} 的 b 接點`, `${lbl(partner)} 的 a 接點`, `${lbl(partner)} 的 b 接點`], rng));
    }
    const lock = role.match(/^互鎖 (.+)$/)?.[1];
    if (lock && mcIds.includes(lock) && !doneLock.has(`${x.devId}>${lock}`)) {
      doneLock.add(`${x.devId}>${lock}`);
      const id = `purpose-lock:${q.id}:${x.devId}:${lock}`;
      add(id, 'purpose', 2, 'MC', rng => choice({
        id, kind: 'purpose', level: 2, devKind: 'MC', timeLimitMs: 15000,
        prompt: `為了讓 <b>${lbl(x.devId)}</b> 動作時 <b>${lbl(lock)}</b> 不能動作（互鎖），<b>${lbl(lock)}</b> 線圈的迴路要串哪個接點？`,
        explain: `互鎖是在對方線圈迴路串<b>自己的 b 接點</b>：${lbl(x.devId)} 吸合時它的 b 接點打開，${lbl(lock)} 就接不到電。`,
      }, `${lbl(x.devId)} 的 b 接點`, [`${lbl(x.devId)} 的 a 接點`, `${lbl(lock)} 的 a 接點`, `${lbl(lock)} 的 b 接點`], rng));
    }
  }

  // 4. 計時器接點控制哪顆 MC：「MCS 線圈的迴路要串 TR 的哪個接點？」
  for (const x of infos) {
    const e = x.elems.length === 1 ? x.elems[0] : null;
    if (!e || e.kind !== 'contact' || (x.kind !== 'TR' && x.kind !== 'TRF') || !used(x.devId, e)) continue;
    const to = roleOf(x.devId, e)?.match(/^→ (.+)$/)?.[1];
    const target = to?.split(/、| 等/).map(s => s.trim()).find(n => mcIds.includes(n));
    if (!target) continue;
    const def = defOf(x.kind);
    const id = `purpose-timer:${q.id}:${x.s.id}`;
    add(id, 'purpose', 2, x.kind, rng => choice({
      id, kind: 'purpose', level: 2, devKind: x.kind, timeLimitMs: 15000,
      prompt: `<b>${lbl(target)}</b> 線圈的迴路，要串 <b>${x.label}</b> 的哪個接點？`,
      explain: `${lbl(target)} 經過 ${x.label} 的 <b>${pairText(elemNums(def, e))} ${elemDesc(x.kind, e, true)}</b>。`,
    }, `${pairText(elemNums(def, e))} ${elemDesc(x.kind, e)}`, elemsOf(def).map(y => `${pairText(elemNums(def, y))} ${elemDesc(x.kind, y)}`), rng));
  }
  return out;
}
