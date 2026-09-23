/**
 * 單線圖驗證（各題共用）：符號對到真的元件、圖上相連 ⇔ 參考接線同節點、用到的元件恰畫一次、無懸空線端與重疊腳位。
 */
import type { QuestionDef, Wire } from './types';
import { connectivity, referenceNets, pinKey, pinPos, type SchDiagram, type SchSym } from './schematic';
import { defOf } from '../library';

const local = (tid: string) => tid.slice(tid.indexOf('.') + 1);
const devOf = (tid: string) => tid.slice(0, tid.indexOf('.'));
type El = { kind: string; type?: string; driver?: string; fuse?: boolean; t: [string, string] };

const WANT: Record<string, (x: El) => boolean> = {
  no: x => x.kind === 'contact' && x.type === 'a' && (x.driver === 'coil' || x.driver === 'latch'),
  nc: x => x.kind === 'contact' && x.type === 'b' && (x.driver === 'coil' || x.driver === 'latch'),
  'pb-no': x => x.kind === 'contact' && x.type === 'a' && x.driver === 'press',
  'pb-nc': x => x.kind === 'contact' && x.type === 'b' && x.driver === 'press',
  'td-no': x => x.kind === 'contact' && x.type === 'a' && x.driver === 'timer',
  'td-nc': x => x.kind === 'contact' && x.type === 'b' && x.driver === 'timer',
  'tf-no': x => x.kind === 'contact' && x.type === 'a' && x.driver === 'offdelay',
  'tf-nc': x => x.kind === 'contact' && x.type === 'b' && x.driver === 'offdelay',
  ems: x => x.kind === 'contact' && x.type === 'b' && x.driver === 'press',
  'trip-nc': x => x.kind === 'contact' && x.type === 'b' && x.driver === 'trip',
  coil: x => x.kind === 'coil', lamp: x => x.kind === 'lamp', bz: x => x.kind === 'buzzer', fuse: x => x.kind === 'link' && !!x.fuse,
};

/** 符號是否對到器具庫裡真的元件、種類正確；回傳錯誤訊息或 null */
export function elementError(q: QuestionDef, s: SchSym): string | null {
  const kind = q.devices.find(d => d.id === s.dev)?.kind;
  if (!kind) return `${s.id}: 找不到器具 ${s.dev}`;
  if (s.t.some(t => devOf(t) !== s.dev)) return `${s.id}: 端子不屬於 ${s.dev}`;
  const def = defOf(kind);
  for (const t of s.t) if (!def.terminals.some(x => x.id === local(t))) return `${s.id}: ${s.dev} 沒有端子 ${local(t)}`;
  if (s.kind === 'src') return null;
  const els = def.elements as El[];
  const pair = (a: string, b: string) => els.find(e => (e.t[0] === a && e.t[1] === b) || (e.t[0] === b && e.t[1] === a));
  if (s.kind === 'co') {
    const [c, b, a] = s.t.map(local);
    const eb = pair(c, b), ea = pair(c, a);
    return eb?.kind === 'contact' && eb.type === 'b' && ea?.kind === 'contact' && ea.type === 'a' ? null : `${s.id}: 不是 1c 接點`;
  }
  const e = pair(local(s.t[0]), local(s.t[1]));
  if (!e) return `${s.id}: ${s.t.join('-')} 不是 ${s.dev} 的同一個元件`;
  return WANT[s.kind]?.(e) ? null : `${s.id}: 符號 ${s.kind} 與元件 ${e.kind}${e.type ? `/${e.type}` : ''}${e.driver ? `/${e.driver}` : ''} 不符`;
}

/** 圖上相連 ⇔ 參考接線同節點；回傳不一致的腳位對 */
export function netMismatches(q: QuestionDef, d: Pick<SchDiagram, 'syms' | 'wires'>, wires: Wire[]): string[] {
  const ref = referenceNets(wires, q.passThrough);
  const c = connectivity(d);
  const pins = d.syms.flatMap(s => s.t.map((t, i) => ({ k: pinKey(s, i), t })));
  const bad: string[] = [];
  for (let i = 0; i < pins.length; i++) for (let j = i + 1; j < pins.length; j++) {
    const drawn = c.pinNet.get(pins[i].k) === c.pinNet.get(pins[j].k);
    const real = ref.root(pins[i].t) === ref.root(pins[j].t);
    if (drawn !== real) bad.push(`${pins[i].k}(${pins[i].t}) ${drawn ? '圖上相連、實際不通' : '實際相通、圖上沒連'} ${pins[j].k}(${pins[j].t})`);
  }
  return bad;
}

/** 參考接線用到的元件都要畫、且只畫一次 */
export function coverage(q: QuestionDef, d: Pick<SchDiagram, 'syms'>, wires: Wire[]): { missing: string[]; dup: string[] } {
  const ref = referenceNets(wires, q.passThrough);
  const inNet = (tid: string) => [...ref.wired].some(w => ref.root(w) === ref.root(tid));
  const drawn = new Map<string, number>();
  const key = (a: string, b: string) => [a, b].sort().join('|');
  for (const s of d.syms) {
    if (s.kind === 'src') continue;
    if (s.kind === 'co') { drawn.set(key(s.t[0], s.t[1]), 1); drawn.set(key(s.t[0], s.t[2]), 1); continue; }
    drawn.set(key(s.t[0], s.t[1]), (drawn.get(key(s.t[0], s.t[1])) ?? 0) + 1);
  }
  const missing: string[] = [], dup: string[] = [];
  for (const dv of q.devices) for (const e of defOf(dv.kind).elements) {
    const [a, b] = e.t.map(t => `${dv.id}.${t}`);
    if (!(inNet(a) && inNet(b))) continue;
    const n = drawn.get(key(a, b)) ?? 0;
    if (n === 0) missing.push(`${a}-${b}`);
    if (n > 1) dup.push(`${a}-${b}`);
  }
  return { missing, dup };
}

/** 兩支不同腳畫在同一點 */
export function pinClashes(d: Pick<SchDiagram, 'syms'>): string[] {
  const all = d.syms.flatMap(s => pinPos(s).map((p, i) => ({ k: pinKey(s, i), p })));
  return all.filter((a, i) => all.some((b, j) => j > i && Math.abs(a.p.x - b.p.x) < .01 && Math.abs(a.p.y - b.p.y) < .01)).map(c => c.k);
}
