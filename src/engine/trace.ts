/**
 * 動作解說：把模擬器的事件（simulator.ts 的 SimEvent）整理成「一波一波」的因果鏈與中文句子。
 * 純函式、不碰 DOM，可以直接在 vitest 驗證。
 */
import type { DeviceInstance, QuestionDef, Wire } from '../model/types';
import { defOf } from '../library';
import { UnionFind } from './netlist';
import { Simulator, type SimEvent } from './simulator';

export type MarkCls = 'close' | 'open' | 'on' | 'off';
type ActionEv = Extract<SimEvent, { kind: 'action' }>;
type ContactEv = Extract<SimEvent, { kind: 'contact' }>;
type PowerEv = Extract<SimEvent, { kind: 'power' }>;
type DeviceEv = Extract<SimEvent, { kind: 'device' }>;

export interface StageLine {
  dev: string;
  text: string;
  /** 板上要閃的端子：接點閉合（綠）／打開（橘）、線圈與燈得電（黃）／失電（灰） */
  marks: { tid: string; cls: MarkCls }[];
  /** 本行涉及的元件 key（單線圖同步用） */
  keys: string[];
  /** 器具本身得電／失電（外框發光） */
  act?: 'on' | 'off';
}
export interface Stage {
  wave: number;
  t: number;
  action?: ActionEv;
  lines: StageLine[];
  liveOn: string[];
  liveOff: string[];
  events: SimEvent[];
}
/** 元件 key → 用途註記（自保／互鎖 MCR／→ TR1、MCS） */
export type Roles = Map<string, string>;

const LOADS = new Set(['coil', 'lamp', 'buzzer']);
const nameOf = (q: QuestionDef, id: string) => { const d = q.devices.find(x => x.id === id); return d?.label ?? id; };

/**
 * 從實際接線推導每個接點的用途（對任何等效接法都成立，不寫每題對照表）。拿掉這個接點本身後：
 * - 靜態網路：b 接點視為導通（靜止狀態），看兩側接到哪些負載；下游接到保持電驛共用點時，它的 a／b 都算（記住哪邊都有可能）。
 * - 全閉網路：所有其他接點都閉合，仍接得到電源的那側是上游（兩側都有負載時用來挑下游）。
 * 判定：MC 的 a 接點一側是自己的線圈 → 自保；MC 的 b 接點一側是別顆 MC 的線圈 → 互鎖；
 *       拿掉它就讓一半以上的負載斷電 → 整個控制回路；其他 → 供電給哪些負載。有共用點的接點只看非共用那側。
 */
export function buildRoles(q: QuestionDef, wires: Wire[]): Roles {
  const els = q.devices.flatMap(d => defOf(d.kind).elements.map(e => ({
    d, e, key: `${d.id}.${e.kind === 'contact' ? e.name : (e.kind === 'coil' && e.name) || e.kind}`,
    t: [`${d.id}.${e.t[0]}`, `${d.id}.${e.t[1]}`] as [string, string],
  })));
  const loads = els.filter(x => LOADS.has(x.e.kind)).flatMap(x => x.t.map(tid => ({ tid, dev: x.d, coil: x.e.kind === 'coil' })));
  const loadDevCount = new Set(loads.map(l => l.dev)).size;
  const sources = ['TB1.A', 'TB1.B', 'TB1.C', 'NFB.A', 'NFB.B', 'NFB.C'];
  const net = (skip: typeof els[number], closedIf: (y: typeof els[number]) => boolean) => {
    const uf = new UnionFind();
    for (const w of wires) uf.union(w.a, w.b);
    for (const p of q.passThrough) uf.union(p.a, p.b);
    for (const y of els) if (y !== skip && (y.e.kind === 'link' || (y.e.kind === 'contact' && closedIf(y)))) uf.union(y.t[0], y.t[1]);
    return { uf, power: new Set(sources.map(s => uf.find(s))) };
  };
  const latchEls = els.filter(y => y.e.kind === 'contact' && y.e.driver === 'latch');
  const latchCommons = [...new Set(latchEls.flatMap(y => y.t).filter(tid => latchEls.filter(z => z.t.includes(tid)).length > 1))];
  const roles: Roles = new Map();
  for (const x of els) {
    if (x.e.kind !== 'contact') continue;
    const st0 = net(x, y => y.e.kind === 'contact' && y.e.type === 'b');
    const all2 = net(x, () => true);
    // 下游接到保持電驛的共用點時，a／b 兩邊都算（記住正轉或反轉都有可能）
    const noLatch = net(x, y => y.e.kind === 'contact' && y.e.type === 'b' && y.e.driver !== 'latch');
    const viaLatch = latchCommons.some(c => x.t.some(tid => noLatch.uf.same(tid, c)) && !x.t.includes(c));
    const st = viaLatch ? net(x, y => y.e.kind === 'contact' && (y.e.type === 'b' || y.e.driver === 'latch')) : st0;
    // 共用點（同器具另一個接點也用到的端子）是上游，只看另一側
    const shared = (tid: string) => els.some(y => y !== x && y.d === x.d && y.e.kind === 'contact' && y.t.includes(tid));
    let sides = x.t.filter(tid => !(shared(tid) && !x.t.every(shared)) && !st.power.has(st.uf.find(tid)));
    if (sides.length > 1) {
      const down = sides.filter(tid => !all2.power.has(all2.uf.find(tid)));
      if (down.length) sides = down;
    }
    const inNet = (n: typeof st, tid: string) => { const r = n.uf.find(tid); return loads.filter(l => n.uf.find(l.tid) === r); };
    // 拿掉這個接點，全閉網路裡斷電的那側有一半以上的負載 → 它管整個控制回路（EMS、TH-RY）
    const cut = x.t.filter(tid => !all2.power.has(all2.uf.find(tid))).flatMap(tid => inNet(all2, tid));
    if (new Set(cut.map(l => l.dev)).size * 2 >= loadDevCount) { roles.set(x.key, '→ 整個控制回路'); continue; }
    const all = sides.flatMap(tid => inNet(st, tid));
    const own = all.some(l => l.coil && l.dev === x.d);
    const other = [...new Set(all.filter(l => l.coil && l.dev !== x.d && l.dev.kind === 'MC').map(l => l.dev.label ?? l.dev.id))];
    const drv = x.e.driver;
    if (x.d.kind === 'MC' && x.e.type === 'a' && drv === 'coil' && own) { roles.set(x.key, '自保'); continue; }
    if (x.d.kind === 'MC' && x.e.type === 'b' && drv === 'coil' && other.length) { roles.set(x.key, `互鎖 ${other.join('、')}`); continue; }
    // 靜態沒接到負載（下游還隔著 a 接點）→ 改看全閉網路的下游；再沒有就列出下游經過哪些器具的接點（例：→ FWD、REV）
    let hit = all;
    if (!hit.some(l => l.dev !== x.d)) hit = x.t.filter(tid => !(shared(tid) && !x.t.every(shared)) && !all2.power.has(all2.uf.find(tid))).flatMap(tid => inNet(all2, tid));
    const names: string[] = [];
    for (const d of q.devices) if (d !== x.d && hit.some(l => l.dev === d)) names.push(d.label ?? d.id);
    if (!names.length) {
      const through = els.filter(y => y.e.kind === 'contact' && y.d !== x.d && y.t.some(t => sides.some(s => st.uf.same(s, t))));
      for (const d of q.devices) if (through.some(y => y.d === d)) names.push(d.label ?? d.id);
    }
    if (names.length) roles.set(x.key, `→ ${names.slice(0, 3).join('、')}${names.length > 3 ? ' 等' : ''}`);
  }
  return roles;
}

const sec = (ms?: number) => `${Math.round((ms ?? 0) / 100) / 10}`;

function contactPhrase(cs: ContactEv[], roles: Roles): string {
  return cs.map(c => `${c.name} ${c.closed ? '閉合' : '打開'}${roles.get(c.key) ? `（${roles.get(c.key)}）` : ''}`).join('、');
}
export function termsOf(q: QuestionDef, key: string): string[] {
  const dot = key.indexOf('.');
  const dev = key.slice(0, dot), name = key.slice(dot + 1);
  const d = q.devices.find(x => x.id === dev); if (!d) return [];
  const e = defOf(d.kind).elements.find(x => (x.kind === 'contact' ? x.name : (x.kind === 'coil' && x.name) || x.kind) === name);
  return e ? e.t.map(t => `${dev}.${t}`) : [];
}

/** 有接線的端子（含經考場引接線接到的器具本體端子）；接點兩端都有接線才寫進解說 */
export function wiredTerminals(q: QuestionDef, wires: Wire[]): Set<string> {
  const uf = new UnionFind();
  for (const p of q.passThrough) uf.union(p.a, p.b);
  const roots = new Set(wires.flatMap(w => [uf.find(w.a), uf.find(w.b)]));
  const out = new Set<string>();
  for (const d of q.devices) for (const t of defOf(d.kind).terminals) { const tid = `${d.id}.${t.id}`; if (roots.has(uf.find(tid))) out.add(tid); }
  return out;
}

/** 依 wave 分組並產生中文句子（器具依題目順序，燈／蜂鳴器排最後）；給了 wired 就略過沒接成迴路（有一端沒接線）的接點 */
export function groupStages(events: SimEvent[], q: QuestionDef, roles: Roles, wired?: Set<string>): Stage[] {
  const waves = new Map<number, SimEvent[]>();
  const used = (e: SimEvent) => e.kind !== 'contact' || !wired || termsOf(q, e.key).every(t => wired.has(t));
  for (const e of events) { if (!used(e)) continue; const a = waves.get(e.wave) ?? []; a.push(e); waves.set(e.wave, a); }
  const order = [...q.devices].sort((a, b) => Number(a.kind === 'PL' || a.kind === 'BZ') - Number(b.kind === 'PL' || b.kind === 'BZ'));
  const stages: Stage[] = [];
  for (const [wave, evs] of waves) {
    const action = evs.find((e): e is ActionEv => e.kind === 'action');
    const live = evs.find(e => e.kind === 'live') as Extract<SimEvent, { kind: 'live' }> | undefined;
    const lines: StageLine[] = [];
    const markC = (cs: ContactEv[]) => cs.flatMap(c => termsOf(q, c.key).map(tid => ({ tid, cls: (c.closed ? 'close' : 'open') as MarkCls })));
    if (action) {
      const cs = evs.filter((e): e is ContactEv => e.kind === 'contact' && e.dev === action.dev);
      const ph = contactPhrase(cs, roles);
      const n = nameOf(q, action.dev);
      const why = action.reason ? `（${action.reason}）` : '';
      const inst = q.devices.find(d => d.id === action.dev);
      const text = action.action === 'nfb' ? (action.on ? `投入 NFB${why}：R、S、T 三相送電` : `切離 NFB${why}：控制電源中斷`)
        : action.action === 'level' ? `水塔水位${action.on ? '上升' : '下降'}到 ${action.reason ?? ''}${ph ? `：${ph}` : ''}`
        : action.action === 'switch' ? (inst?.kind === 'COS' ? `${n} 切到${action.on ? '自動 A' : '手動 M'}` : `${n} 浮球${action.on ? '浮起（給水源有水）' : '落下（給水源無水）'}`) + (ph ? `：${ph}` : '')
        : action.action === 'press' ? (inst?.latch && !action.on ? `解除 ${n}（再按一下）` : `按下 ${n}${inst?.latch ? '（自鎖）' : ''}`) + (ph ? `：${ph}` : '')
        : action.action === 'release' ? `放開 ${n}${ph ? `：${ph}` : ''}`
        : action.action === 'trip' ? `${n} 跳脫（過載）${ph ? `：${ph}` : ''}`
        : `${n} 復歸${ph ? `：${ph}` : ''}`;
      lines.push({ dev: action.dev, text, marks: markC(cs), keys: cs.map(c => c.key) });
    }
    for (const d of order) {
      if (action && d.id === action.dev) continue;
      const cs = evs.filter((e): e is ContactEv => e.kind === 'contact' && e.dev === d.id);
      const ps = evs.filter((e): e is PowerEv => e.kind === 'power' && e.dev === d.id);
      const ds = evs.filter((e): e is DeviceEv => e.kind === 'device' && e.dev === d.id);
      if (!cs.length && !ps.length && !ds.length) continue;
      const line = describe(d, cs, ps, ds, roles);
      line.marks.push(...markC(cs), ...ps.flatMap(p => termsOf(q, p.key).map(tid => ({ tid, cls: (p.on ? 'on' : 'off') as MarkCls }))));
      line.keys.push(...cs.map(c => c.key), ...ps.map(p => p.key));
      lines.push(line);
    }
    if (evs.some(e => e.kind === 'short')) lines.push({ dev: '', text: '短路！兩相碰在一起，保險絲燒斷', marks: [], keys: [] });
    stages.push({ wave, t: evs[0].t, action, lines, liveOn: live?.on ?? [], liveOff: live?.off ?? [], events: evs });
  }
  return stages;
}

function describe(d: DeviceInstance, cs: ContactEv[], ps: PowerEv[], ds: DeviceEv[], roles: Roles): StageLine {
  const n = d.label ?? d.id;
  const ph = contactPhrase(cs, roles);
  const has = (w: DeviceEv['what']) => ds.find(x => x.what === w);
  const coil = ps.find(p => p.el === 'coil' && !p.name);
  const tail = ph ? `：${ph}` : '';
  const line = (text: string, act?: 'on' | 'off'): StageLine => ({ dev: d.id, text, marks: [], keys: [], act });
  switch (d.kind) {
    case 'MC':
      if (coil?.on) return line(`${n} 線圈得電 → 動作${tail}`, 'on');
      if (coil) return line(`${n} 線圈失電 → 復歸${tail}`, 'off');
      break;
    case 'TR': {
      const parts: string[] = [];
      if (has('timer-start')) parts.push(`得電，開始計時 ${sec(has('timer-start')!.ms)} 秒`);
      if (has('timer-done')) parts.push(`計時 ${sec(has('timer-done')!.ms)} 秒到${tail}`);
      if (has('timer-reset')) parts.push(`失電，計時歸零${!has('timer-done') ? tail : ''}`);
      if (parts.length) return line(`${n} ${parts.join('；')}`, coil ? (coil.on ? 'on' : 'off') : undefined);
      break;
    }
    case 'TRF':
      if (has('actuate')) return line(`${n} 得電 → 立即動作${tail}`, 'on');
      if (has('offdelay-cancel')) return line(`${n} 再次得電，停止斷電延時（接點維持動作）`, 'on');
      if (has('offdelay-start')) return line(`${n} 失電，斷電延時 ${sec(has('offdelay-start')!.ms)} 秒後才復歸（接點暫時保持）`, 'off');
      if (has('offdelay-done')) return line(`${n} 斷電延時 ${sec(has('offdelay-done')!.ms)} 秒到，復歸${tail}`);
      break;
    case 'KR': {
      const parts = ps.map(p => `${p.name}（${p.name === 'SC' ? '設定' : '復歸'}線圈）${p.on ? '得電' : '失電'}`);
      if (has('latch-set')) parts.push(`設定（記住正轉）${tail}`);
      else if (has('latch-reset')) parts.push(`復歸（記住反轉）${tail}`);
      else if (ps.some(p => !p.on) && !ps.some(p => p.on)) parts.push('接點保持不變（保持電驛斷電仍記住）');
      else if (ps.some(p => p.on)) parts.push(ps.find(p => p.on)!.name === 'SC' ? '本來就在設定（正轉），接點不變' : '本來就在復歸（反轉），接點不變');
      return line(`${n} ${parts.join(' → ')}`, ps.some(p => p.on) ? 'on' : undefined);
    }
    case 'PL': {
      const p = ps[0];
      if (p) return line(`${n} ${p.on ? '亮' : '滅'}${p.on && d.desc && d.desc.length <= 12 ? `（${d.desc}）` : ''}`, p.on ? 'on' : 'off');
      break;
    }
    case 'BZ': {
      const p = ps[0];
      if (p) return line(`${n} ${p.on ? '響' : '停'}`, p.on ? 'on' : 'off');
      break;
    }
    case 'RY':
      if (coil?.on) return line(`${n} 線圈得電 → 動作${tail}`, 'on');
      if (coil) return line(`${n} 線圈失電 → 復歸${tail}`, 'off');
      break;
    case 'MR':
      if (has('ratchet')) return line(`${n} 線圈得電 → 棘輪翻轉一格（換另一台）${tail}`, 'on');
      if (coil && !coil.on) return line(`${n} 線圈失電（接點保持，等下一次脈衝）`, 'off');
      break;
    case 'LC':
      if (has('level-on')) return line(`${n} 水位到 E1 → 內部電驛動作${tail}`, 'on');
      if (has('level-off')) return line(`${n} 水位降到 E2 以下 → 復歸${tail}`, 'off');
      if (coil?.on) return line(`${n} 電源得電（等待水位）`, 'on');
      if (coil) return line(`${n} 電源失電${tail}`, 'off');
      break;
    case 'ELEC':
      if (cs.length) return line(`電極棒：${cs.map(c => `${c.name.replace(' 碰水', '')}${c.closed ? ' 碰到水' : ' 離開水面'}`).join('、')}`);
      break;
    case 'DF':
      if (has('blown')) return line(`${n} 燒斷`);
      break;
  }
  return line(ph ? `${n}：${ph}` : n);
}

/** 測試用精簡記號（排序後，不依賴器具順序） */
export function stageTokens(s: Stage, withContacts = false): string[] {
  const out: string[] = [];
  for (const e of s.events) {
    if (e.kind === 'action') out.push(e.action === 'nfb' ? `nfb:${e.on ? 'on' : 'off'}` : `${e.action}:${e.dev}`);
    else if (e.kind === 'power') out.push(`${e.key}${e.on ? '+' : '-'}`);
    else if (e.kind === 'device') out.push(`${e.dev}:${e.what}`);
    else if (e.kind === 'contact' && withContacts) out.push(`${e.key}=${e.closed ? 1 : 0}`);
    else if (e.kind === 'short') out.push('short');
  }
  return out.sort();
}

/** 測試輔助：開 trace 跑一段，回傳整理好的階段 */
export function traceRun(q: QuestionDef, wires: Wire[], drive: (sim: Simulator) => void, timerSec = 5): Stage[] {
  const sim = new Simulator(q, wires, { timerSec, trace: true });
  drive(sim);
  return groupStages(sim.drainEvents(), q, buildRoles(q, wires), wiredTerminals(q, wires));
}
