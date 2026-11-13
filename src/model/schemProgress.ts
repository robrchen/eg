/**
 * 單線圖實時進度：把「目前接了哪些線」對到單線圖的每個節點（一段相連的線）。
 * - 節點四態：none 未接／part 接了一部分／done 全部接通／bad 接錯（和別的節點相通，或接到圖上沒有的端子）。
 * - 等效接點改認：圖上的符號綁的是參考接線用的端子，但考生用同一器具的另一組同類接點（a右 代替 a左、
 *   電驛第二組接點代替第一組）、或把接點／線圈兩端對調，電氣上一樣正確。這裡對每個器具列出它所有
 *   「換了也等效」的端子對應（automorphisms），挑最符合目前接線的那一種，圖上的符號就改認那組端子。
 * 純函式、不碰 DOM，vitest 直接驗證。
 */
import type { DeviceDef, ElementDef, QuestionDef, Wire } from './types';
import { connectivity, pinKey, type SchDiagram } from './schematic';
import { defOf } from '../library';
import { UnionFind } from '../engine/netlist';

/** 端子台與接地銅排是「透明」的：只是把線接在一起，不算圖上的元件 */
const TRANSPARENT = new Set(['TB16', 'TBM3', 'TBM4', 'TB8', 'TB12', 'GBAR', 'EBAR']);

/* ================= 器具的等效端子對應 ================= */

/** 器具內端子 → 端子（沒列到的端子對應到自己） */
export type Auto = Map<string, string>;
const autoCache = new Map<string, Auto[]>();

const sigOf = (e: ElementDef): string =>
  e.kind === 'contact' ? `contact:${e.type}:${e.driver}`     // 接點名稱只是標籤（a左／a右），功能看 a/b 與驅動方式
    : e.kind === 'coil' ? `coil:${e.name ?? ''}`              // 多線圈器具（KR 的 SC／RC）功能不同，不能互換
    : e.kind === 'link' ? `link:${e.fuse ? 1 : 0}` : e.kind;

function permutations(n: number): number[][] {
  if (n <= 1) return [[...Array(n).keys()]];
  const out: number[][] = [];
  const rec = (cur: number[], rest: number[]) => {
    if (!rest.length) { out.push(cur); return; }
    rest.forEach((x, i) => rec([...cur, x], [...rest.slice(0, i), ...rest.slice(i + 1)]));
  };
  rec([], [...Array(n).keys()]);
  return out;   // 第一個是 [0,1,…]（不換）
}

/**
 * 器具所有「換了也等效」的端子對應，第一個是恆等。
 * 共用端子的元件算一組（例：電驛一組 1c 接點 1-4／1-3）；同樣組成的組可以整組互換；
 * 只有一個元件、兩端都不與別人共用的（a 接點、線圈、燈、保險絲）兩端可以對調。
 */
export function automorphisms(def: DeviceDef): Auto[] {
  const hit = autoCache.get(def.kind);
  if (hit) return hit;
  const els = def.elements;
  const parent = els.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++)
    if (els[i].t.some(t => els[j].t.includes(t))) parent[find(i)] = find(j);
  const use = new Map<string, number>();
  for (const e of els) for (const t of e.t) use.set(t, (use.get(t) ?? 0) + 1);
  interface Cluster { order: string[]; single: boolean; sig: string }
  const groups = new Map<number, number[]>();
  els.forEach((_, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), i]));
  const clusters: Cluster[] = [...groups.values()].map(idx => {
    const sorted = [...idx].sort((a, b) => sigOf(els[a]).localeCompare(sigOf(els[b])) || a - b);
    const order: string[] = [];
    for (const i of sorted) for (const t of [...els[i].t].sort((a, b) => (use.get(b)! - use.get(a)!))) if (!order.includes(t)) order.push(t);
    return { order, single: sorted.length === 1, sig: sorted.map(i => sigOf(els[i])).join('|') + '#' + order.map(t => use.get(t)).join('') };
  });
  const classes = new Map<string, Cluster[]>();
  for (const c of clusters) classes.set(c.sig, [...(classes.get(c.sig) ?? []), c]);

  let autos: Auto[] = [new Map()];
  for (const cls of classes.values()) {
    const next: Auto[] = [];
    for (const base of autos) for (const perm of permutations(cls.length)) {
      const m = new Map(base);
      cls.forEach((c, i) => c.order.forEach((t, k) => m.set(t, cls[perm[i]].order[k])));
      next.push(m);
    }
    autos = next;
  }
  // 兩端對調：參考端子 a、b 的落點互換
  const singles = clusters.filter(c => c.single);
  if (autos.length * 2 ** singles.length <= 1024) {
    for (const c of singles) {
      const [a, b] = c.order;
      autos = autos.flatMap(m => { const f = new Map(m); f.set(a, m.get(b)!); f.set(b, m.get(a)!); return [m, f]; });
    }
    // flatMap 之後恆等仍在最前面（每次都把「不對調」排在前）
  }
  autoCache.set(def.kind, autos);
  return autos;
}

/* ================= 進度 ================= */

export type NetState = 'none' | 'part' | 'done' | 'bad';
export interface NetProgress {
  /** 單線圖的網路編號（同 connectivity(d).wireNet／pinNet） */
  id: string;
  state: NetState;
  /** 這個節點上的腳位：圖面綁的參考端子，與改認後實際對應的端子（同索引） */
  refTerms: string[];
  terms: string[];
  /** 已經互相接通的那一群（最大的一群；都還沒接就是空的）與還沒接上的 */
  connected: string[];
  missing: string[];
  /** 需要的連接數（腳位數 − 1）與已完成的連接數 */
  need: number;
  have: number;
  /** 接錯：被接在一起的別的節點的端子／接到圖上沒有的端子 */
  clash: string[];
  stray: string[];
}
export interface Progress {
  nets: NetProgress[];
  byId: Map<string, NetProgress>;
  /** 參考端子 → 實際對應端子（改認後），與反向 */
  bind: Map<string, string>;
  unbind: Map<string, string>;
  /** 計入進度的節點數、已完成、接錯 */
  total: number;
  done: number;
  bad: number;
  /** 沒有碰到任何節點的多餘接線端子 */
  strays: string[];
  /** 目前導線（含引接線、過門線、同一銅排）是否把兩個端子接在一起 */
  same(a: string, b: string): boolean;
}

interface Pin { net: string; dev: string; local: string; ref: string }
const pinCache = new WeakMap<object, Pin[]>();
function pinsOf(d: Pick<SchDiagram, 'syms' | 'wires'>): Pin[] {
  const hit = pinCache.get(d);
  if (hit) return hit;
  const conn = connectivity(d);
  const pins: Pin[] = [];
  for (const s of d.syms) s.t.forEach((t, i) => {
    if (!t.startsWith(s.dev + '.')) return;
    pins.push({ net: conn.pinNet.get(pinKey(s, i))!, dev: s.dev, local: t.slice(s.dev.length + 1), ref: t });
  });
  pinCache.set(d, pins);
  return pins;
}

export function computeProgress(q: Pick<QuestionDef, 'devices' | 'passThrough'>, d: Pick<SchDiagram, 'syms' | 'wires'>, wires: Wire[]): Progress {
  const pins = pinsOf(d);
  const kindOf = new Map(q.devices.map(x => [x.id, x.kind]));
  const devOf = (tid: string) => tid.slice(0, tid.indexOf('.'));

  const uf = new UnionFind();
  for (const w of wires) uf.union(w.a, w.b);
  for (const p of q.passThrough) uf.union(p.a, p.b);
  // 同一塊接地銅排上的螺絲本來就相通
  for (const x of q.devices) if (x.kind === 'GBAR' || x.kind === 'EBAR') {
    const ts = defOf(x.kind).terminals.map(t => `${x.id}.${t.id}`);
    for (const t of ts) uf.union(ts[0], t);
  }
  const wiredRoots = new Set(wires.flatMap(w => [uf.find(w.a), uf.find(w.b)]));

  // 每個器具目前採用哪一種等效對應（0＝恆等）
  const devs = [...new Set(pins.map(p => p.dev))].filter(id => kindOf.has(id));
  const autos = new Map(devs.map(id => [id, automorphisms(defOf(kindOf.get(id)!))]));
  const pick = new Map(devs.map(id => [id, 0]));
  const bound = (p: Pin, override?: [string, number]) => {
    const a = autos.get(p.dev);
    const i = override && override[0] === p.dev ? override[1] : pick.get(p.dev) ?? 0;
    return `${p.dev}.${a ? a[i].get(p.local) ?? p.local : p.local}`;
  };
  const netIds = [...new Set(pins.map(p => p.net))];
  /** 分數：各節點已完成的連接數總和 − 4 ×（同一群導線碰到兩個以上節點的次數） */
  const score = (override?: [string, number]): number => {
    const rootsOfNet = new Map<string, Set<string>>(), termsOfNet = new Map<string, Set<string>>(), netsOfRoot = new Map<string, Set<string>>();
    for (const p of pins) {
      const t = bound(p, override), r = uf.find(t);
      (termsOfNet.get(p.net) ?? termsOfNet.set(p.net, new Set()).get(p.net)!).add(t);
      (rootsOfNet.get(p.net) ?? rootsOfNet.set(p.net, new Set()).get(p.net)!).add(r);
      (netsOfRoot.get(r) ?? netsOfRoot.set(r, new Set()).get(r)!).add(p.net);
    }
    let s = 0;
    for (const n of netIds) s += termsOfNet.get(n)!.size - rootsOfNet.get(n)!.size;
    for (const ns of netsOfRoot.values()) s -= 4 * (ns.size - 1);
    return s;
  };
  // 只有碰到導線的器具才需要找（其餘維持恆等）；逐器具挑最好的，最多四輪
  const active = devs.filter(id => (autos.get(id)?.length ?? 1) > 1 && defOf(kindOf.get(id)!).terminals.some(t => wiredRoots.has(uf.find(`${id}.${t.id}`))));
  if (active.length) {
    let cur = score();
    for (let round = 0; round < 4; round++) {
      let changed = false;
      for (const id of active) {
        let best = pick.get(id)!, bestScore = cur;
        const n = autos.get(id)!.length;
        for (let i = 0; i < n; i++) { if (i === pick.get(id)) continue; const sc = score([id, i]); if (sc > bestScore) { best = i; bestScore = sc; } }
        if (best !== pick.get(id)) { pick.set(id, best); cur = bestScore; changed = true; }
      }
      if (!changed) break;
    }
  }

  const bind = new Map<string, string>(), unbind = new Map<string, string>();
  for (const p of pins) { const t = bound(p); bind.set(p.ref, t); unbind.set(t, p.ref); }
  const boundSet = new Set(bind.values());

  // 各節點的腳位（去重）
  const byNet = new Map<string, { ref: string[]; terms: string[] }>();
  for (const p of pins) {
    const e = byNet.get(p.net) ?? byNet.set(p.net, { ref: [], terms: [] }).get(p.net)!;
    const t = bind.get(p.ref)!;
    if (!e.terms.includes(t)) { e.terms.push(t); e.ref.push(p.ref); }
  }
  // 同一群導線碰到哪些節點
  const netsOfRoot = new Map<string, Set<string>>();
  for (const [id, e] of byNet) for (const t of e.terms) { const r = uf.find(t); (netsOfRoot.get(r) ?? netsOfRoot.set(r, new Set()).get(r)!).add(id); }
  // 多餘：導線（或經引接線）碰到圖上沒有的器具端子
  const touched = new Set(wires.flatMap(w => [w.a, w.b]));
  for (const p of q.passThrough) { if (p.a.startsWith('TB3.')) continue; if (touched.has(p.a)) touched.add(p.b); if (touched.has(p.b)) touched.add(p.a); }
  const strayOfRoot = new Map<string, string[]>();
  const strays: string[] = [];
  for (const t of touched) {
    const k = kindOf.get(devOf(t));
    if (!k || TRANSPARENT.has(k) || boundSet.has(t)) continue;
    const r = uf.find(t);
    if (netsOfRoot.has(r)) strayOfRoot.set(r, [...(strayOfRoot.get(r) ?? []), t]); else strays.push(t);
  }

  const nets: NetProgress[] = [];
  for (const [id, e] of byNet) {
    const groups = new Map<string, string[]>();
    for (const t of e.terms) { const r = uf.find(t); groups.set(r, [...(groups.get(r) ?? []), t]); }
    const need = e.terms.length - 1, have = e.terms.length - groups.size;
    const big = [...groups.values()].sort((a, b) => b.length - a.length)[0] ?? [];
    const connected = big.length >= 2 ? big : [];
    const clash: string[] = [], stray: string[] = [];
    for (const r of groups.keys()) {
      for (const other of netsOfRoot.get(r) ?? []) if (other !== id) clash.push(...byNet.get(other)!.terms.filter(t => uf.find(t) === r));
      stray.push(...(strayOfRoot.get(r) ?? []));
    }
    const state: NetState = clash.length || stray.length ? 'bad' : need > 0 && have === need ? 'done' : have > 0 ? 'part' : need === 0 ? 'done' : 'none';
    nets.push({ id, state, refTerms: e.ref, terms: e.terms, connected, missing: e.terms.filter(t => !connected.includes(t)), need, have, clash: [...new Set(clash)], stray: [...new Set(stray)] });
  }
  const counted = nets.filter(n => n.need > 0);
  return {
    nets, byId: new Map(nets.map(n => [n.id, n])), bind, unbind,
    total: counted.length, done: counted.filter(n => n.state === 'done').length, bad: nets.filter(n => n.state === 'bad').length,
    strays, same: (a, b) => uf.same(a, b),
  };
}
