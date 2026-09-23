import type { QuestionDef, Scenario, Wire } from '../model/types';
import { defOf, isGroundTerm } from '../library';
import { teacherWiresOf } from '../model/questions/common';
import { Simulator } from './simulator';
import { UnionFind } from './netlist';

export interface Finding { code: string; text: string; terminals?: string[] }
export interface ScenarioResult { name: string; pass: boolean; failures: string[]; short: boolean }
export interface GradeReport {
  pass: boolean;
  major: Finding[];
  minor: Finding[];
  scenarios: ScenarioResult[];
  hints: Finding[];
}

const dev = (tid: string) => tid.split('.')[0];

export function runScenario(q: QuestionDef, wires: Wire[], sc: Scenario, timerSec: number): ScenarioResult {
  const sim = new Simulator(q, wires, { timerSec });
  const failures: string[] = [];
  for (const st of sc.steps) {
    switch (st.do) {
      case 'nfb': sim.nfb(st.on); break;
      case 'wait': sim.run(st.ms); break;
      case 'press': sim.press(st.device, true); sim.run(st.ms); sim.press(st.device, false); break;
      case 'trip': sim.trip(st.device, st.on); break;
      case 'expect': {
        const snap = sim.snapshot();
        const bad = Object.entries(st.state).filter(([k, v]) => (snap[k] ?? false) !== v);
        if (bad.length) failures.push(`${st.note}；實際：${bad.map(([k]) => `${k}=${snap[k] ? 'ON' : 'OFF'}`).join(', ')}`);
        break;
      }
    }
    if (sim.shortCircuit) { failures.push('發生短路，D-F 燒斷'); break; }
  }
  return { name: sc.name, pass: failures.length === 0, failures, short: sim.shortCircuit };
}

/** 結構檢查（對應評審表可自動判定的項目） */
export function structuralChecks(q: QuestionDef, wires: Wire[]): { major: Finding[]; minor: Finding[] } {
  const major: Finding[] = [], minor: Finding[] = [];
  const used = new Map<string, number>();
  for (const w of wires) {
    used.set(w.a, (used.get(w.a) ?? 0) + 1);
    used.set(w.b, (used.get(w.b) ?? 0) + 1);
  }
  const usedDevices = new Set([...used.keys()].map(dev));

  // 每一器具均需配線使用
  for (const d of q.devices) {
    if (d.display || d.id === 'TB1' || d.kind === 'GBAR' || d.kind === 'EBAR') continue;   // 接地另外判
    if (!defOf(d.kind).terminals.some(t => t.wireable !== false)) continue;
    if (!usedDevices.has(d.id)) major.push({ code: 'M1', text: `器具 ${d.label ?? d.id} 未配線使用（未完工）` });
  }
  // 控制電路必須接至 NFB 負載側
  if (usedDevices.has('TB1')) major.push({ code: 'M10', text: '控制電路接至 TB1 電源側，未受 NFB 控制（未按電路圖接線）', terminals: [...used.keys()].filter(t => dev(t) === 'TB1') });
  if (!usedDevices.has('NFB')) major.push({ code: 'M10', text: '控制電路未接至無熔線開關負載側' });
  // 設備接地：控制箱的 G 端子板必須接至檢定崗位的 E（題目說明二）
  const gbar = q.devices.find(d => d.kind === 'GBAR'), ebar = q.devices.find(d => d.kind === 'EBAR');
  if (gbar && ebar) {
    const grounded = wires.some(w => [w.a, w.b].map(dev).sort().join('|') === [gbar.id, ebar.id].sort().join('|'));
    if (!grounded) major.push({ code: 'M11', text: '未施作設備接地：控制箱的 G 端子板未接至檢定崗位 E', terminals: [`${gbar.id}.G2`, `${ebar.id}.E1`] });
  }
  // 接地線只能接在接地端子之間
  for (const w of wires) {
    if (isGroundTerm(q.devices, w.a) !== isGroundTerm(q.devices, w.b)) major.push({ code: 'M11', text: `接地端子與控制電路相接 ${w.a} ↔ ${w.b}`, terminals: [w.a, w.b] });
  }
  // 端子容量
  for (const [t, n] of used) if (n > 2) minor.push({ code: 'C2', text: `端子 ${t} 接了 ${n} 條線（最多 2 條）`, terminals: [t] });
  // 重複 / 自接
  const seen = new Set<string>();
  for (const w of wires) {
    if (w.a === w.b) minor.push({ code: 'C2', text: `導線兩端同一端子 ${w.a}`, terminals: [w.a] });
    const k = [w.a, w.b].sort().join('|');
    if (seen.has(k)) minor.push({ code: 'C2', text: `重複導線 ${w.a} ↔ ${w.b}`, terminals: [w.a, w.b] });
    seen.add(k);
  }
  // 過門線只用了單邊（只看 TB3↔TB4）
  for (const p of q.passThrough.filter(x => x.a.startsWith('TB3.'))) {
    const ua = used.has(p.a), ub = used.has(p.b);
    if (ua !== ub) minor.push({ code: 'C8', text: `過門線 ${p.a} ↔ ${p.b} 只有一邊接線`, terminals: [ua ? p.a : p.b] });
  }
  return { major, minor };
}

/* ---------- 與參考接線的差異提示（WL 節點雜湊） ---------- */

function termClass(q: QuestionDef, tid: string): string | null {
  const [d, t] = tid.split('.');
  const inst = q.devices.find(x => x.id === d);
  if (!inst) return null;
  const def = defOf(inst.kind);
  const td = def.terminals.find(x => x.id === t);
  if (!td) return null;
  if (inst.kind === 'TB16' || inst.kind === 'TBM4' || inst.kind === 'TBM3') return null; // 端子台是透明的
  if (inst.kind === 'GBAR' || inst.kind === 'EBAR') return `${d}:gnd`;   // 同一塊銅排，接哪顆螺絲都一樣
  if (inst.kind === 'MC') return `${d}:${td.role}`;         // a/b/coil，左右上下可互換
  if (inst.kind === 'PB') return `${d}:${td.role}`;
  if (inst.kind === 'PL' || inst.kind === 'BZ') return `${d}:load`;
  if ((inst.kind === 'TR' || inst.kind === 'TRF') && (t === '2' || t === '7')) return `${d}:pwr`;
  if (inst.kind === 'KR' && (t === '2' || t === '10')) return `${d}:SC`;
  if (inst.kind === 'KR' && (t === '5' || t === '7')) return `${d}:RC`;
  return `${d}:${t}`;
}

/** 每個端子的「元件夥伴」（同一接點/線圈/燈的另一端） */
function partners(q: QuestionDef): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const d of q.devices) for (const el of defOf(d.kind).elements) {
    if (el.kind === 'link') continue;
    const a = `${d.id}.${el.t[0]}`, b = `${d.id}.${el.t[1]}`;
    m.set(a, [...(m.get(a) ?? []), b]);
    m.set(b, [...(m.get(b) ?? []), a]);
  }
  return m;
}

function staticNets(q: QuestionDef, wires: Wire[]): UnionFind {
  const uf = new UnionFind();
  for (const w of wires) uf.union(w.a, w.b);
  for (const p of q.passThrough) uf.union(p.a, p.b);
  for (const d of q.devices) for (const el of defOf(d.kind).elements)
    if (el.kind === 'link') uf.union(`${d.id}.${el.t[0]}`, `${d.id}.${el.t[1]}`);
  // 確保所有端子都有節點
  for (const d of q.devices) for (const t of defOf(d.kind).terminals) uf.find(`${d.id}.${t.id}`);
  return uf;
}

function netHashes(q: QuestionDef, wires: Wire[], rounds = 3): Map<string, string> {
  const uf = staticNets(q, wires);
  const part = partners(q);
  const groups = uf.groups();
  let hash = new Map<string, string>();
  for (const [r, ts] of groups) {
    const labels = ts.map(t => termClass(q, t)).filter((x): x is string => !!x).sort();
    hash.set(r, labels.join(','));
  }
  for (let i = 0; i < rounds; i++) {
    const next = new Map<string, string>();
    for (const [r, ts] of groups) {
      const parts: string[] = [];
      for (const t of ts) {
        const c = termClass(q, t);
        if (!c) continue;
        const far = (part.get(t) ?? []).map(p => hash.get(uf.find(p)) ?? '').sort().join('/');
        parts.push(`${c}(${far})`);
      }
      next.set(r, `${hash.get(r)}|${parts.sort().join(',')}`);
    }
    hash = next;
  }
  return hash;
}

export function diffHints(q: QuestionDef, wires: Wire[]): Finding[] {
  const ref = netHashes(q, teacherWiresOf(q));
  const usr = netHashes(q, wires);
  const refCount = new Map<string, number>();
  for (const h of ref.values()) refCount.set(h, (refCount.get(h) ?? 0) + 1);
  const uf = staticNets(q, wires);
  const groups = uf.groups();
  const hints: Finding[] = [];
  for (const [r, h] of usr) {
    const n = refCount.get(h) ?? 0;
    if (n > 0) { refCount.set(h, n - 1); continue; }
    const ts = (groups.get(r) ?? []).filter(t => termClass(q, t) !== null && !t.startsWith('TB'));
    // 單一未接端子不提示（由「未使用」處理）
    const wired = ts.filter(t => wires.some(w => w.a === t || w.b === t));
    if (wired.length === 0) continue;
    hints.push({ code: 'H', text: `此節點與參考接線不同：${wired.join('、')}`, terminals: wired });
  }
  return hints;
}

export function grade(q: QuestionDef, wires: Wire[], timerSec = 5): GradeReport {
  const { major, minor } = structuralChecks(q, wires);
  const scenarios = q.scenarios.map(sc => runScenario(q, wires, sc, timerSec));
  for (const r of scenarios) {
    if (r.short) major.push({ code: 'M2', text: `短路：${r.name} 過程中 D-F 燒斷` });
    else if (!r.pass) major.push({ code: 'M2', text: `功能錯誤（${r.name}）：${r.failures.join('；')}` });
  }
  const hints = diffHints(q, wires);
  return { pass: major.length === 0 && minor.length < 5, major, minor, scenarios, hints };
}
