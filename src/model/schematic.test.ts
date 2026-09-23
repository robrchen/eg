import { describe, it, expect } from 'vitest';
import { connectivity, referenceNets, pinKey, pinPos, mainPhases, type SchSym } from './schematic';
import { Q2_1, teacherWires } from './questions/q2-1';
import { Q2_1_SCHEMATIC as D } from './questions/q2-1.schematic';
import { defOf } from '../library';

const ref = referenceNets(teacherWires(), Q2_1.passThrough);
const conn = connectivity(D);
const devKind = (dev: string) => Q2_1.devices.find(d => d.id === dev)?.kind;
const local = (tid: string) => tid.slice(tid.indexOf('.') + 1);
const devOf = (tid: string) => tid.slice(0, tid.indexOf('.'));

/** 符號種類 → 器具元件種類與接點型式 */
function elementOk(s: SchSym): string | null {
  const kind = devKind(s.dev);
  if (!kind) return `${s.id}: 找不到器具 ${s.dev}`;
  if (s.t.some(t => devOf(t) !== s.dev)) return `${s.id}: 端子不屬於 ${s.dev}`;
  const def = defOf(kind);
  for (const t of s.t) if (!def.terminals.some(x => x.id === local(t))) return `${s.id}: ${s.dev} 沒有端子 ${local(t)}`;
  if (s.kind === 'src') return null;
  const pair = (a: string, b: string) => def.elements.find(e => 'kind' in e && (e.t[0] === a && e.t[1] === b || e.t[0] === b && e.t[1] === a));
  if (s.kind === 'co') {
    const [c, b, a] = s.t.map(local);
    const eb = pair(c, b), ea = pair(c, a);
    return eb?.kind === 'contact' && eb.type === 'b' && ea?.kind === 'contact' && ea.type === 'a' ? null : `${s.id}: 不是 1c 接點（c-b 常閉、c-a 常開）`;
  }
  const e = pair(local(s.t[0]), local(s.t[1]));
  if (!e) return `${s.id}: ${s.t.join('-')} 不是 ${s.dev} 的同一個元件`;
  type El = { kind: string; type?: string; driver?: string; fuse?: boolean };
  const want: Record<string, (x: El) => boolean> = {
    no: x => x.kind === 'contact' && x.type === 'a' && (x.driver === 'coil' || x.driver === 'latch'),
    nc: x => x.kind === 'contact' && x.type === 'b' && (x.driver === 'coil' || x.driver === 'latch'),
    'tf-no': x => x.kind === 'contact' && x.type === 'a' && x.driver === 'offdelay',
    'tf-nc': x => x.kind === 'contact' && x.type === 'b' && x.driver === 'offdelay',
    ems: x => x.kind === 'contact' && x.type === 'b' && x.driver === 'press',
    'trip-nc': x => x.kind === 'contact' && x.type === 'b' && x.driver === 'trip',
    'pb-no': x => x.kind === 'contact' && x.type === 'a' && x.driver === 'press',
    'pb-nc': x => x.kind === 'contact' && x.type === 'b' && x.driver === 'press',
    'td-no': x => x.kind === 'contact' && x.type === 'a' && x.driver === 'timer',
    'td-nc': x => x.kind === 'contact' && x.type === 'b' && x.driver === 'timer',
    coil: x => x.kind === 'coil', lamp: x => x.kind === 'lamp', bz: x => x.kind === 'buzzer', fuse: x => x.kind === 'link' && !!x.fuse,
  };
  return want[s.kind]?.(e as El) ? null : `${s.id}: 符號 ${s.kind} 與元件 ${e.kind}${'type' in e ? `/${e.type}` : ''} 不符`;
}

describe('單線圖（第一題）', () => {
  it('每個符號都對到器具庫裡真的元件，符號種類（a/b、按鈕、限時、線圈…）正確', () => {
    expect(D.syms.map(elementOk).filter(Boolean)).toEqual([]);
  });

  it('沒有懸空的線端，符號 id 不重複', () => {
    expect(conn.dangling).toEqual([]);
    expect(new Set(D.syms.map(s => s.id)).size).toBe(D.syms.length);
  });

  it('圖上相連 ⇔ 參考接線（老師 18 步 + 引接線 + 過門線）同一節點', () => {
    const pins = D.syms.flatMap(s => s.t.map((t, i) => ({ k: pinKey(s, i), t })));
    const bad: string[] = [];
    for (let i = 0; i < pins.length; i++) for (let j = i + 1; j < pins.length; j++) {
      const drawn = conn.pinNet.get(pins[i].k) === conn.pinNet.get(pins[j].k);
      const real = ref.root(pins[i].t) === ref.root(pins[j].t);
      if (drawn !== real) bad.push(`${pins[i].k}(${pins[i].t}) ${drawn ? '圖上相連、實際不通' : '實際相通、圖上沒連'} ${pins[j].k}(${pins[j].t})`);
    }
    expect(bad).toEqual([]);
  });

  it('參考接線用到的每個元件都在圖上出現一次（未使用的接點不畫）', () => {
    const inNet = (tid: string) => [...ref.wired].some(w => ref.root(w) === ref.root(tid));
    const drawn = new Map<string, number>();
    for (const s of D.syms) {
      if (s.kind === 'src') continue;
      if (s.kind === 'co') { drawn.set(`${s.t[0]}|${s.t[1]}`, 1); drawn.set(`${s.t[0]}|${s.t[2]}`, 1); continue; }
      const k = [...s.t].sort().join('|');
      drawn.set(k, (drawn.get(k) ?? 0) + 1);
    }
    const missing: string[] = [], dup: string[] = [];
    for (const d of Q2_1.devices) {
      for (const e of defOf(d.kind).elements) {
        const [a, b] = e.t.map(t => `${d.id}.${t}`);
        if (!(inNet(a) && inNet(b))) continue;
        const n = drawn.get([a, b].sort().join('|')) ?? drawn.get(`${a}|${b}`) ?? drawn.get(`${b}|${a}`) ?? 0;
        if (n === 0) missing.push(`${a}-${b}`);
        if (n > 1) dup.push(`${a}-${b}`);
      }
    }
    expect({ missing, dup }).toEqual({ missing: [], dup: [] });
  });

  it('腳位不重疊（兩支不同腳不能畫在同一點）', () => {
    const all = D.syms.flatMap(s => pinPos(s).map((p, i) => ({ k: pinKey(s, i), p })));
    const clash = all.filter((a, i) => all.some((b, j) => j > i && Math.abs(a.p.x - b.p.x) < .01 && Math.abs(a.p.y - b.p.y) < .01));
    expect(clash.map(c => c.k)).toEqual([]);
  });
});

/* ---------- 驗證器本身：故意畫錯，確認會被抓到 ---------- */
function netMismatches(d: typeof D): string[] {
  const c = connectivity(d);
  const pins = d.syms.flatMap(s => s.t.map((t, i) => ({ k: pinKey(s, i), t })));
  const bad: string[] = [];
  for (let i = 0; i < pins.length; i++) for (let j = i + 1; j < pins.length; j++) {
    if ((c.pinNet.get(pins[i].k) === c.pinNet.get(pins[j].k)) !== (ref.root(pins[i].t) === ref.root(pins[j].t))) bad.push(`${pins[i].k}~${pins[j].k}`);
  }
  return bad;
}
const clone = () => JSON.parse(JSON.stringify(D)) as typeof D;

describe('單線圖驗證器會抓到錯誤', () => {
  it('Y 燈改接到 MCS b 之後（應接 MCD b 之後）→ 抓到', () => {
    const d = clone();
    const i = d.wires.findIndex(w => w[0][0] === 900 && w[0][1] === 420);
    d.wires[i] = [[1020, 420], [960, 420], [960, 440]];
    expect(netMismatches(d).length).toBeGreaterThan(0);
  });
  it('少畫一條線（MCF 自保下端沒接回）→ 抓到', () => {
    const d = clone();
    d.wires = d.wires.filter(w => !(w[0][0] === 600 && w[0][1] === 250));
    expect(netMismatches(d).length).toBeGreaterThan(0);
  });
  it('只是交叉、端點沒落在線上 → 不算相連（不會誤判成通）', () => {
    const d = clone();
    // 把 BZ 下端那條改成橫越 TH-RY b 腳的線但不停在上面
    const i = d.wires.findIndex(w => w[0][0] === 520 && w[0][1] === 400);
    d.wires[i] = [[520, 400], [520, 545], [600, 545]];
    expect(connectivity(d).dangling.length).toBeGreaterThan(0);
  });
  it('TR 限時接點 8-5 與 8-6 對調 → 抓到', () => {
    const d = clone();
    const y = d.syms.find(s => s.id === 'trY')!, dd = d.syms.find(s => s.id === 'trD')!;
    [y.t, dd.t] = [dd.t, y.t];
    expect(netMismatches(d).length).toBeGreaterThan(0);
  });
  it('a 接點畫成 b 接點符號 → 抓到', () => {
    const d = clone();
    d.syms.find(s => s.id === 'mcfHold')!.kind = 'nc';
    expect(d.syms.map(elementOk).filter(Boolean).length).toBe(1);
  });
});

/* ---------- 主電路：以「接觸器閉合時電動機各端帶哪一相」驗證 ---------- */
const PH: Record<string, string> = { 'TB1.A': 'R', 'TB1.B': 'S', 'TB1.C': 'T' };
const phaseOf = (t: string) => PH[t] ?? null;
type Main = NonNullable<typeof D.main>;
const M0 = D.main!;
const run = (m: Main, on: string[], open: string[] = []) => mainPhases(m, new Set(on), phaseOf, new Set(open));
const one = (r: ReturnType<typeof run>, t: string) => { const s = [...(r.phase.get(t) ?? [])]; return s.length === 1 ? s[0] : s.length ? `短路(${s.join('')})` : '—'; };
const shorted = (r: ReturnType<typeof run>) => [...r.phase.values()].some(s => s.size > 1);
const motor = (r: ReturnType<typeof run>) => ['U', 'V', 'W', 'X', 'Y', 'Z'].map(k => one(r, `M.${k}`)).join(' ');

/** 檢查一組接觸器狀態下，電動機接法是否正確：Y（X Y Z 同一中性點不帶電）或 Δ（X=V、Y=W、Z=U 的相） */
function checkMotor(m: Main, on: string[], seq: string[], mode: 'Y' | 'D'): string[] {
  const r = run(m, on), err: string[] = [];
  if (shorted(r)) err.push(`${on.join('+')} 短路`);
  const [u, v, w] = ['U', 'V', 'W'].map(k => one(r, `M.${k}`));
  if ([u, v, w].join('') !== seq.join('')) err.push(`${on.join('+')}：U V W 應為 ${seq.join(' ')}，實際 ${u} ${v} ${w}`);
  const [x, y, z] = ['X', 'Y', 'Z'].map(k => one(r, `M.${k}`));
  if (mode === 'Y') {
    if ([x, y, z].some(p => p !== '—')) err.push(`${on.join('+')}：Y 接時 X Y Z 不該帶電（${x} ${y} ${z}）`);
    if (new Set(['M.X', 'M.Y', 'M.Z'].map(t => r.node.get(t))).size !== 1) err.push(`${on.join('+')}：X Y Z 沒有短接成中性點`);
  } else if (!(x === v && y === w && z === u)) err.push(`${on.join('+')}：Δ 接應 X=${v} Y=${w} Z=${u}，實際 ${x} ${y} ${z}`);
  return err;
}
const allChecks = (m: Main) => [
  ...checkMotor(m, ['MCF', 'MCS'], ['R', 'S', 'T'], 'Y'),
  ...checkMotor(m, ['MCF', 'MCD'], ['R', 'S', 'T'], 'D'),
  ...checkMotor(m, ['MCR', 'MCS'], ['T', 'S', 'R'], 'Y'),
  ...checkMotor(m, ['MCR', 'MCD'], ['T', 'S', 'R'], 'D'),
];

describe('單線圖主電路（功能驗證）', () => {
  it('每個主電路符號綁的是器具庫裡真的主端子（接觸器 R-U／S-V／T-W、加熱器 L-T、NFB 電源側-負載側）', () => {
    const bad: string[] = [];
    for (const s of M0.syms) for (const t of s.t) {
      if (t.startsWith('M.')) continue;
      const kind = devKind(devOf(t));
      if (!kind || !defOf(kind).terminals.some(x => x.id === local(t))) bad.push(`${s.id}: ${t}`);
      if (devOf(t) !== s.dev) bad.push(`${s.id}: ${t} 不屬於 ${s.dev}`);
    }
    const pairs: Record<string, string[][]> = {
      'main-no': [['R', 'U'], ['S', 'V'], ['T', 'W']], heater: [['L1', 'T1'], ['L2', 'T2'], ['L3', 'T3']],
      breaker: [['電源A', 'A'], ['電源B', 'B'], ['電源C', 'C']],
    };
    for (const s of M0.syms) if (pairs[s.kind] && !pairs[s.kind].some(([a, b]) => local(s.t[0]) === a && local(s.t[1]) === b)) bad.push(`${s.id}: ${s.t.join('-')} 不是同一極`);
    expect(bad).toEqual([]);
    expect(connectivity(M0, 'm').dangling).toEqual([]);
  });

  it('正轉 Y／正轉 Δ／反轉 Y／反轉 Δ 接法都正確，且正反轉相序相反', () => {
    expect(allChecks(M0)).toEqual([]);
  });

  it('全部接觸器斷開 → 電動機不帶電；NFB 下方仍有電', () => {
    const r = run(M0, []);
    expect(motor(r)).toBe('— — — — — —');
    expect(['NFB.A', 'NFB.B', 'NFB.C'].map(t => one(r, t))).toEqual(['R', 'S', 'T']);
  });

  it('互鎖失效會短路：MCF+MCR 同時、或 MCS+MCD 同時', () => {
    expect(shorted(run(M0, ['MCF', 'MCR']))).toBe(true);
    expect(shorted(run(M0, ['MCF', 'MCS', 'MCD']))).toBe(true);
  });

  it('TH-RY 三個加熱器分別串在 U V W 迴路上（斷開任一個，對應那相就斷電）', () => {
    expect(one(run(M0, ['MCF', 'MCS'], ['th1']), 'M.U')).toBe('—');
    expect(one(run(M0, ['MCF', 'MCS'], ['th2']), 'M.V')).toBe('—');
    expect(one(run(M0, ['MCF', 'MCS'], ['th3']), 'M.W')).toBe('—');
  });
});

describe('主電路驗證器會抓到錯誤', () => {
  const cloneMain = () => JSON.parse(JSON.stringify(M0)) as Main;
  it('MCR 出線沒有 R、T 對調（直接平行接回）→ 反轉失敗', () => {
    const m = cloneMain();
    const i = m.wires.findIndex(w => w[0][0] === 250 && w[0][1] === 260), j = m.wires.findIndex(w => w[0][0] === 330 && w[0][1] === 260);
    m.wires[i] = [[250, 260], [250, 280], [70, 280]];      // 應接回 T，改成接回 R
    m.wires[j] = [[330, 260], [330, 312], [190, 312]];     // 應接回 R，改成接回 T
    expect(allChecks(m).length).toBeGreaterThan(0);
  });
  it('MCD 出線 X、Y 對調 → Δ 接錯', () => {
    const m = cloneMain();
    const i = m.wires.findIndex(w => w[0][0] === 250 && w[0][1] === 540), j = m.wires.findIndex(w => w[0][0] === 290 && w[0][1] === 540);
    m.wires[i] = [[250, 540], [250, 588], [70, 588]];
    m.wires[j] = [[290, 540], [290, 612], [130, 612]];
    expect(allChecks(m).length).toBeGreaterThan(0);
  });
  it('MCS 少短接一相 → Y 接沒有中性點', () => {
    const m = cloneMain();
    m.wires = m.wires.filter(w => !(w[0][0] === 130 && w[0][1] === 660));
    expect(allChecks(m).length).toBeGreaterThan(0);
  });
});
