/**
 * 單線圖（控制電路）資料模型：符號 + 連線，符號的每支腳對應到實體端子。
 * 連線的電氣關係完全由「畫出來的幾何」決定（端點落在另一條線上才算相連，單純交叉不算），
 * 測試會拿這個幾何連通性去和老師參考接線的節點比對，保證圖面與模擬器一致。
 */
import type { PassThrough, Wire } from './types';

export type SymKind = 'no' | 'nc' | 'pb-no' | 'pb-nc' | 'td-no' | 'td-nc' | 'coil' | 'lamp' | 'bz' | 'fuse' | 'co' | 'src'
  // 主電路
  | 'main-no' | 'heater' | 'breaker' | 'term' | 'motor';

export interface SchSym {
  id: string;
  dev: string;          // 面板上的器具 id
  kind: SymKind;
  x: number; y: number; // 符號中心
  /** 每支腳對應的實體端子：直立 2 腳 [上, 下]；fuse [左, 右]；co（1c 接點）[c, b, a]；src／term [端子]；motor [U V W X Y Z] */
  t: string[];
  label?: string;       // 主標（預設 dev）
  note?: string;        // 副標（接點名稱，例如 a左、8-5）
  /** 標籤放左側（右邊緊鄰其他符號時） */
  left?: boolean;
}

export interface Pt { x: number; y: number }
export interface SchDiagram {
  w: number; h: number;
  syms: SchSym[];
  /** 連線（折線），座標與符號腳位同一座標系 */
  wires: [number, number][][];
  /** 主電路（考場已配妥）：同樣是符號＋連線，另有純裝飾的 SVG（外框、機械連動線、接地符號） */
  main?: { syms: SchSym[]; wires: [number, number][][]; deco: string };
}

export const PIN = 20;   // 直立符號腳位離中心的距離

/** 符號各腳位的座標，順序同 t */
export function pinPos(s: SchSym): Pt[] {
  switch (s.kind) {
    case 'fuse': return [{ x: s.x - PIN, y: s.y }, { x: s.x + PIN, y: s.y }];
    case 'co': return [{ x: s.x, y: s.y + PIN }, { x: s.x + 14, y: s.y - PIN }, { x: s.x - 14, y: s.y - PIN }];
    case 'src': case 'term': return [{ x: s.x, y: s.y }];
    // 電動機：上 U V W、下 X Y Z（繞組 U-X、V-Y、W-Z）
    case 'motor': return [[-16, -16], [0, -22], [16, -16], [-16, 16], [0, 22], [16, 16]].map(([dx, dy]) => ({ x: s.x + dx, y: s.y + dy }));
    default: return [{ x: s.x, y: s.y - PIN }, { x: s.x, y: s.y + PIN }];
  }
}

const EPS = 0.01;
const onSeg = (p: Pt, a: Pt, b: Pt): boolean => {
  const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
  if (Math.abs(cross) > EPS) return false;
  return p.x >= Math.min(a.x, b.x) - EPS && p.x <= Math.max(a.x, b.x) + EPS && p.y >= Math.min(a.y, b.y) - EPS && p.y <= Math.max(a.y, b.y) + EPS;
};
const pts = (w: [number, number][]): Pt[] => w.map(([x, y]) => ({ x, y }));
const onWire = (p: Pt, w: Pt[]): boolean => w.some((a, i) => i > 0 && onSeg(p, w[i - 1], a));

class UF {
  private p = new Map<string, string>();
  find(a: string): string { let r = this.p.get(a) ?? a; if (r !== a) { r = this.find(r); this.p.set(a, r); } else this.p.set(a, a); return r; }
  union(a: string, b: string): void { const ra = this.find(a), rb = this.find(b); if (ra !== rb) this.p.set(ra, rb); }
}

export const pinKey = (s: SchSym, i: number) => `${s.id}:${i}`;

/**
 * 依幾何算連通：線 i、j 相連 ⇔ 其中一條的端點落在另一條上；腳位落在線上即接上。
 * 回傳每支腳、每條線所屬的網路編號，以及自動算出的接點（T 形分支或三條以上交會）。
 */
export function connectivity(d: Pick<SchDiagram, 'syms' | 'wires'>, prefix = ''): { pinNet: Map<string, string>; wireNet: string[]; junctions: Pt[]; dangling: Pt[] } {
  const uf = new UF();
  const w_ = (i: number) => `${prefix}w${i}`;
  const W = d.wires.map(pts);
  W.forEach((w, i) => {
    for (const e of [w[0], w[w.length - 1]]) W.forEach((o, j) => { if (i !== j && onWire(e, o)) uf.union(w_(i), w_(j)); });
  });
  const pinNet = new Map<string, string>();
  const pinPts: Pt[] = [];
  for (const s of d.syms) pinPos(s).forEach((p, i) => {
    pinPts.push(p);
    const k = pinKey(s, i);
    uf.find(k);
    W.forEach((w, j) => { if (onWire(p, w)) uf.union(k, w_(j)); });
  });
  for (const s of d.syms) pinPos(s).forEach((_, i) => pinNet.set(pinKey(s, i), uf.find(pinKey(s, i))));
  const wireNet = W.map((_, i) => uf.find(w_(i)));
  // 接點：某條線的端點落在另一條線的「中間」（不是它的端點），或同一點有三個以上端點
  const junctions: Pt[] = [];
  const same = (a: Pt, b: Pt) => Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS;
  const ends = W.flatMap(w => [w[0], w[w.length - 1]]);
  W.forEach((w, i) => {
    for (const e of [w[0], w[w.length - 1]]) {
      const tee = W.some((o, j) => j !== i && onWire(e, o) && !same(e, o[0]) && !same(e, o[o.length - 1]));
      const many = ends.filter(x => same(x, e)).length >= 3;
      if ((tee || many) && !junctions.some(p => same(p, e))) junctions.push(e);
    }
  });
  // 懸空端點：線的端點既不在腳位上，也不在其他線上
  const dangling: Pt[] = [];
  W.forEach((w, i) => {
    for (const e of [w[0], w[w.length - 1]]) {
      const ok = pinPts.some(p => same(p, e)) || W.some((o, j) => j !== i && onWire(e, o));
      if (!ok) dangling.push(e);
    }
  });
  return { pinNet, wireNet, junctions, dangling };
}

/**
 * 主電路功能驗證用：給定哪些器具的主接點閉合，算出每支腳帶哪些相（只看圖面幾何與 TB1 電源）。
 * NFB、積熱電驛加熱器（heater）預設導通；openHeaters 可指定斷開的加熱器符號 id。
 */
export function mainPhases(main: NonNullable<SchDiagram['main']>, closed: Set<string>, phaseOf: (tid: string) => string | null, openHeaters: Set<string> = new Set()): { phase: Map<string, Set<string>>; node: Map<string, string> } {
  const { pinNet } = connectivity(main, 'm');
  const uf = new UF();
  for (const [k, n] of pinNet) uf.union(k, n);
  for (const s of main.syms) {
    const conduct = s.kind === 'breaker' || (s.kind === 'heater' && !openHeaters.has(s.id)) || (s.kind === 'main-no' && closed.has(s.dev));
    if (conduct) uf.union(pinKey(s, 0), pinKey(s, 1));
  }
  const phases = new Map<string, Set<string>>();
  for (const s of main.syms) s.t.forEach((t, i) => {
    const ph = phaseOf(t); if (!ph) return;
    const r = uf.find(pinKey(s, i));
    phases.set(r, (phases.get(r) ?? new Set()).add(ph));
  });
  const phase = new Map<string, Set<string>>(), node = new Map<string, string>();
  for (const s of main.syms) s.t.forEach((t, i) => { const r = uf.find(pinKey(s, i)); phase.set(t, phases.get(r) ?? new Set()); node.set(t, r); });
  return { phase, node };
}

/** 參考接線的節點：導線 + 考場已配妥的引接線／過門線（不經過器具內部接點） */
export function referenceNets(wires: Wire[], pass: PassThrough[]): { root: (tid: string) => string; wired: Set<string> } {
  const uf = new UF();
  const wired = new Set<string>();
  for (const w of wires) { uf.union(w.a, w.b); wired.add(w.a); wired.add(w.b); }
  for (const p of pass) uf.union(p.a, p.b);
  return { root: (tid: string) => uf.find(tid), wired };
}
