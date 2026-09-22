import type { DeviceInstance, ElementDef, QuestionDef, Wire } from '../model/types';
import { defOf } from '../library';
import { UnionFind } from './netlist';

export interface DevState {
  actuated: boolean;   // 線圈得電（MC）/ 計時中（TR）
  timerMs: number;
  timedOut: boolean;
  tripped: boolean;    // TH-RY
  pressed: boolean;    // PB
  blown: boolean;      // D-F
}

export interface ElementInst {
  key: string;         // 'MCF.coil' / 'MCF.a左' / 'G.lamp'
  device: DeviceInstance;
  def: ElementDef;
  t: [string, string]; // 全域端子 id
}

export type Phase = 'A' | 'B' | 'C';

export interface SimOptions { timerSec?: number; tickMs?: number }

/**
 * 逐 tick 的電驛邏輯模擬器。
 * 每 tick 以「上一 tick 的接點狀態」建立導通網路，判定負載是否跨接兩相而得電，再更新狀態。
 */
export class Simulator {
  readonly elements: ElementInst[] = [];
  readonly state = new Map<string, DevState>();
  nfbOn = false;
  shortCircuit = false;
  timerMs: number;
  readonly tickMs: number;
  /** 上一 tick 得電的元件 key */
  energized = new Set<string>();
  /** 上一 tick 各端子的 root 與 root 上的相別（供視圖顯示帶電） */
  lastUF: UnionFind | null = null;
  lastPhases = new Map<string, Set<Phase>>();
  elapsedMs = 0;

  constructor(readonly q: QuestionDef, public wires: Wire[], opts: SimOptions = {}) {
    this.timerMs = (opts.timerSec ?? q.timerDefaultSec) * 1000;
    this.tickMs = opts.tickMs ?? 50;
    for (const d of q.devices) {
      this.state.set(d.id, { actuated: false, timerMs: 0, timedOut: false, tripped: false, pressed: false, blown: false });
      for (const el of defOf(d.kind).elements) {
        const name = el.kind === 'contact' ? el.name : el.kind;
        this.elements.push({ key: `${d.id}.${name}`, device: d, def: el, t: [`${d.id}.${el.t[0]}`, `${d.id}.${el.t[1]}`] });
      }
    }
  }

  reset(): void {
    for (const s of this.state.values()) Object.assign(s, { actuated: false, timerMs: 0, timedOut: false, tripped: false, pressed: false, blown: false });
    this.nfbOn = false; this.shortCircuit = false; this.energized.clear(); this.elapsedMs = 0;
    this.lastUF = null; this.lastPhases.clear();
  }

  nfb(on: boolean): void { this.nfbOn = on; }
  press(device: string, down: boolean): void { const s = this.state.get(device); if (s) s.pressed = down; }
  trip(device: string, on: boolean): void { const s = this.state.get(device); if (s) s.tripped = on; }

  /** 接點目前是否閉合 */
  private closed(el: ElementInst): boolean {
    const d = el.def;
    const s = this.state.get(el.device.id)!;
    if (d.kind === 'link') return !(d.fuse && s.blown);
    if (d.kind !== 'contact') return false;
    let act = false;
    switch (d.driver) {
      case 'coil': act = s.actuated; break;
      case 'timer': act = s.timedOut; break;
      case 'trip': act = s.tripped; break;
      case 'press': act = s.pressed; break;
    }
    return d.type === 'a' ? act : !act;
  }

  private sources(): [string, Phase][] {
    const out: [string, Phase][] = [['TB1.A', 'A'], ['TB1.B', 'B'], ['TB1.C', 'C']];
    if (this.nfbOn) out.push(['NFB.A', 'A'], ['NFB.B', 'B'], ['NFB.C', 'C']);
    return out;
  }

  /** 建立目前導通網路並回傳 root→相別 */
  solve(): { uf: UnionFind; phases: Map<string, Set<Phase>> } {
    const uf = new UnionFind();
    for (const w of this.wires) uf.union(w.a, w.b);
    for (const p of this.q.passThrough) uf.union(p.a, p.b);
    for (const el of this.elements) if (this.closed(el)) uf.union(el.t[0], el.t[1]);
    const phases = new Map<string, Set<Phase>>();
    for (const [tid, ph] of this.sources()) {
      const r = uf.find(tid);
      const set = phases.get(r) ?? new Set<Phase>();
      set.add(ph);
      phases.set(r, set);
    }
    return { uf, phases };
  }

  tick(dt = this.tickMs): void {
    const { uf, phases } = this.solve();
    this.lastUF = uf; this.lastPhases = phases;
    this.elapsedMs += dt;

    // 短路：同一節點出現兩相 → 保險絲燒斷
    let short = false;
    for (const set of phases.values()) if (set.size > 1) short = true;
    if (short) {
      this.shortCircuit = true;
      for (const d of this.q.devices) if (d.kind === 'DF') this.state.get(d.id)!.blown = true;
    }

    const energized = new Set<string>();
    for (const el of this.elements) {
      const k = el.def.kind;
      if (k !== 'coil' && k !== 'lamp' && k !== 'buzzer') continue;
      const p1 = phases.get(uf.find(el.t[0])), p2 = phases.get(uf.find(el.t[1]));
      if (p1 && p2 && p1.size === 1 && p2.size === 1 && [...p1][0] !== [...p2][0]) energized.add(el.key);
    }
    this.energized = energized;

    for (const d of this.q.devices) {
      const s = this.state.get(d.id)!;
      const coilOn = energized.has(`${d.id}.coil`);
      if (d.kind === 'MC') s.actuated = coilOn;
      if (d.kind === 'TR') {
        s.actuated = coilOn;
        if (coilOn) { s.timerMs += dt; s.timedOut = s.timerMs >= this.timerMs; }
        else { s.timerMs = 0; s.timedOut = false; }
      }
    }
  }

  run(ms: number): void { for (let t = 0; t < ms; t += this.tickMs) this.tick(); }

  /** 供劇本比對：MC/TR 動作、燈、蜂鳴器 */
  snapshot(): Record<string, boolean> {
    const out: Record<string, boolean> = {};
    for (const d of this.q.devices) {
      const s = this.state.get(d.id)!;
      if (d.kind === 'MC' || d.kind === 'TR') out[d.id] = s.actuated;
      if (d.kind === 'PL') out[d.id] = this.energized.has(`${d.id}.lamp`);
      if (d.kind === 'BZ') out[d.id] = this.energized.has(`${d.id}.buzzer`);
    }
    return out;
  }

  /** 端子是否帶電（供視圖） */
  terminalPhase(tid: string): Phase | null {
    if (!this.lastUF) return null;
    const set = this.lastPhases.get(this.lastUF.find(tid));
    return set && set.size === 1 ? [...set][0] : null;
  }
}
