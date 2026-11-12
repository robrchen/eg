import type { DeviceInstance, ElementDef, QuestionDef, Wire } from '../model/types';
import { defOf } from '../library';
import { UnionFind } from './netlist';

export interface DevState {
  actuated: boolean;   // 線圈得電（MC）/ 計時中（TR）
  timerMs: number;
  timedOut: boolean;
  tripped: boolean;    // TH-RY
  pressed: boolean;    // PB（EMS 自鎖型按一下鎖住）
  blown: boolean;      // D-F
  latched: boolean;    // KR 保持電驛：設定中（斷電仍保持）
}

export interface ElementInst {
  key: string;         // 'MCF.coil' / 'MCF.a左' / 'G.lamp'
  device: DeviceInstance;
  def: ElementDef;
  t: [string, string]; // 全域端子 id
}

export type Phase = 'A' | 'B' | 'C';

export interface SimOptions { timerSec?: number; tickMs?: number; trace?: boolean }

/** 器具狀態變化（動作解說用） */
export type DeviceWhat = 'actuate' | 'release' | 'timer-start' | 'timer-done' | 'timer-reset'
  | 'offdelay-start' | 'offdelay-done' | 'offdelay-cancel' | 'latch-set' | 'latch-reset' | 'blown'
  | 'ratchet'        // 棘輪電驛翻轉
  | 'level-on' | 'level-off';   // 液面控制器內部電驛動作／復歸
export type ActionKind = 'nfb' | 'press' | 'release' | 'trip' | 'reset'
  | 'switch'   // 切換式器具（COS 手動／自動、FS 有水／無水）
  | 'level';   // 水塔水位改變（reason 為百分比）
/**
 * 模擬事件（trace 開啟才記錄）。同一個 wave 是同一波變化：
 * 使用者動作自成一波；之後每個 tick 一波——本 tick 用「上一波翻轉後的接點」算得電，所以第 n 波就是第 n-1 波的結果。
 */
export type SimEvent =
  | { kind: 'action'; wave: number; t: number; action: ActionKind; dev: string; on: boolean; reason?: string }
  | { kind: 'contact'; wave: number; t: number; key: string; dev: string; name: string; closed: boolean }
  | { kind: 'power'; wave: number; t: number; key: string; dev: string; el: 'coil' | 'lamp' | 'buzzer'; name?: string; on: boolean }
  | { kind: 'device'; wave: number; t: number; dev: string; what: DeviceWhat; ms?: number }
  | { kind: 'live'; wave: number; t: number; on: string[]; off: string[] }
  | { kind: 'short'; wave: number; t: number };

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
  /** 水塔水位 0（空）～1（滿）；E2 電極在 0.35、E1 在 0.85（第三題；其他題目用不到） */
  level = 0;
  /** 自動水位：依吸合中的泵接觸器數量注水、固定耗水（場景動畫的開關；評審劇本用 level 動作直接設定） */
  hydro = false;
  /** 上一 tick 各端子的 root 與 root 上的相別（供視圖顯示帶電） */
  lastUF: UnionFind | null = null;
  lastPhases = new Map<string, Set<Phase>>();
  elapsedMs = 0;
  /** 記錄事件給「動作解說」；評審與劇本不開，零額外負擔 */
  readonly trace: boolean;
  private events: SimEvent[] = [];
  private wave = 0;
  private tickNo = 0;
  /** 接點或電源變了，下一 tick 要比對端子帶電 */
  private dirty = true;
  private prevLive = new Map<string, Phase | null>();
  /** 按鈕按下時的 tick 編號：按下後還沒經過任何 tick 就放開，放開延到下一 tick 結尾（最短按壓一 tick） */
  private pressTick = new Map<string, number>();
  private pendingRelease = new Set<string>();

  constructor(readonly q: QuestionDef, public wires: Wire[], opts: SimOptions = {}) {
    this.timerMs = (opts.timerSec ?? q.timerDefaultSec) * 1000;
    this.tickMs = opts.tickMs ?? 50;
    this.trace = !!opts.trace;
    for (const d of q.devices) {
      // 浮球開關預設「給水源有水」（pressed＝浮起）
      this.state.set(d.id, { actuated: false, timerMs: 0, timedOut: false, tripped: false, pressed: d.kind === 'FS', blown: false, latched: false });
      for (const el of defOf(d.kind).elements) {
        const name = el.kind === 'contact' ? el.name : (el.kind === 'coil' && el.name) || el.kind;
        this.elements.push({ key: `${d.id}.${name}`, device: d, def: el, t: [`${d.id}.${el.t[0]}`, `${d.id}.${el.t[1]}`] });
      }
    }
    for (const el of this.elements) this.byPair.set(el.t[0] < el.t[1] ? `${el.t[0]}|${el.t[1]}` : `${el.t[1]}|${el.t[0]}`, el);
  }

  reset(): void {
    for (const [id, s] of this.state) Object.assign(s, { actuated: false, timerMs: 0, timedOut: false, tripped: false, pressed: this.q.devices.find(d => d.id === id)?.kind === 'FS', blown: false, latched: false });
    this.nfbOn = false; this.shortCircuit = false; this.energized.clear(); this.elapsedMs = 0; this.level = 0;
    this.lastUF = null; this.lastPhases.clear();
    this.events = []; this.prevLive.clear(); this.pressTick.clear(); this.pendingRelease.clear(); this.dirty = true;
  }

  private byPair = new Map<string, ElementInst>();
  /** 兩個端子之間那個元件的現況：接點／保險絲回 closed，線圈／燈／蜂鳴器回 on（單線圖通電常駐顯示用） */
  pairState(a: string, b: string): { closed?: boolean; on?: boolean } | null {
    const el = this.byPair.get(a < b ? `${a}|${b}` : `${b}|${a}`);
    if (!el) return null;
    const k = el.def.kind;
    return k === 'contact' || k === 'link' ? { closed: this.closed(el) } : { on: this.energized.has(el.key) };
  }

  /** 取走累積的事件（動作解說） */
  drainEvents(): SimEvent[] { const e = this.events; this.events = []; return e; }
  private emit(e: SimEvent): void {
    this.events.push(e);
    if (this.events.length > 4000) this.events.splice(0, this.events.length - 4000);
  }
  private contactState(): Map<ElementInst, boolean> | null {
    if (!this.trace) return null;
    const m = new Map<ElementInst, boolean>();
    for (const el of this.elements) if (el.def.kind === 'contact') m.set(el, this.closed(el));
    return m;
  }
  /** 比對接點前後，翻轉的記一筆 */
  private diffContacts(before: Map<ElementInst, boolean> | null, wave: number): void {
    if (!before) return;
    for (const [el, was] of before) {
      const now = this.closed(el);
      if (now === was) continue;
      this.dirty = true;
      this.emit({ kind: 'contact', wave, t: this.elapsedMs, key: el.key, dev: el.device.id, name: el.def.kind === 'contact' ? el.def.name : '', closed: now });
    }
  }
  /** 使用者動作：自成一波 */
  private userAction(action: ActionKind, dev: string, on: boolean, change: () => void, reason?: string): void {
    const before = this.contactState();
    change();
    this.dirty = true;
    if (!this.trace) return;
    const wave = ++this.wave;
    this.emit({ kind: 'action', wave, t: this.elapsedMs, action, dev, on, reason });
    this.diffContacts(before, wave);
  }

  nfb(on: boolean, reason?: string): void {
    if (on === this.nfbOn) return;
    this.userAction('nfb', 'NFB', on, () => { this.nfbOn = on; }, reason);
  }
  press(device: string, down: boolean): void {
    const s = this.state.get(device); if (!s) return;
    const inst = this.q.devices.find(d => d.id === device);
    // 切換式（COS 旋鈕、FS 浮球）：點一下換一個狀態
    if (inst?.kind === 'COS' || inst?.kind === 'FS') { if (down) this.setSwitch(device, !s.pressed); return; }
    // 自鎖型（EMS）：按一下鎖住、再按一下解除；放開不動作
    if (inst?.latch) {
      if (down) this.userAction('press', device, !s.pressed, () => { s.pressed = !s.pressed; });
      return;
    }
    if (down) {
      if (s.pressed) return;
      this.pressTick.set(device, this.tickNo);
      this.userAction('press', device, true, () => { s.pressed = true; });
    } else {
      if (!s.pressed) return;
      if (this.pressTick.get(device) === this.tickNo) { this.pendingRelease.add(device); return; }
      this.userAction('release', device, false, () => { s.pressed = false; });
    }
  }
  /** 計時器設定（毫秒）：器具自己的 timerSec 優先，否則用通電測試滑桿 */
  timerOf(d: DeviceInstance): number { return d.timerSec !== undefined ? d.timerSec * 1000 : this.timerMs; }
  trip(device: string, on: boolean): void {
    const s = this.state.get(device); if (!s || s.tripped === on) return;
    this.userAction(on ? 'trip' : 'reset', device, on, () => { s.tripped = on; });
  }
  /** 切換式器具（COS：on＝自動 A；FS：on＝有水）直接設狀態 */
  setSwitch(device: string, on: boolean): void {
    const s = this.state.get(device); if (!s || s.pressed === on) return;
    this.userAction('switch', device, on, () => { s.pressed = on; });
  }
  /** 水塔水位 0～1（自成一波：電極接點可能翻轉） */
  setLevel(v: number): void {
    const nv = Math.max(0, Math.min(1, v));
    if (nv === this.level) return;
    this.userAction('level', '水塔', nv > this.level, () => { this.level = nv; }, `${Math.round(nv * 100)}%`);
  }
  /** 水位對電極：E1（高）0.85、E2（低）0.35 */
  static readonly E1 = .85;
  static readonly E2 = .35;

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
      case 'offdelay': act = s.actuated; break;
      case 'latch': act = s.latched; break;
      case 'level': act = s.actuated; break;
      case 'water1': act = this.level >= Simulator.E1; break;
      case 'water2': act = this.level >= Simulator.E2; break;
      case 'float': act = s.pressed; break;
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
    this.tickNo++;
    const tr = this.trace;
    const wave = tr ? ++this.wave : 0;
    const before = this.contactState();
    const prevEnergized = this.energized;
    const prev = tr ? new Map([...this.state].map(([k, v]) => [k, { ...v }])) : null;
    const wasShort = this.shortCircuit;
    const doLive = tr && this.dirty;
    this.dirty = false;

    const { uf, phases } = this.solve();
    this.lastUF = uf; this.lastPhases = phases;
    this.elapsedMs += dt;
    this.hydroTick(dt);

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
        if (coilOn) { s.timerMs += dt; s.timedOut = s.timerMs >= this.timerOf(d); }
        else { s.timerMs = 0; s.timedOut = false; }
      }
      // 斷電延遲：得電立即動作；斷電後繼續計時（不需電源），到時才復歸
      if (d.kind === 'TRF') {
        if (coilOn) { s.actuated = true; s.timerMs = 0; }
        else if (s.actuated) { s.timerMs += dt; if (s.timerMs >= this.timerOf(d)) { s.actuated = false; s.timerMs = 0; } }
      }
      // 保持電驛：SC 設定、RC 復歸；兩個都沒電就維持原狀
      if (d.kind === 'KR') {
        const set = energized.has(`${d.id}.SC`), rst = energized.has(`${d.id}.RC`);
        if (set && !rst) s.latched = true;
        else if (rst && !set) s.latched = false;
        s.actuated = s.latched;
      }
      if (d.kind === 'RY') s.actuated = coilOn;
      // 棘輪電驛：線圈由無電變有電的那一刻翻轉一次
      if (d.kind === 'MR') {
        if (coilOn && !prevEnergized.has(`${d.id}.coil`)) s.latched = !s.latched;
        s.actuated = coilOn;
      }
      // 液面控制器：電源有電，E1 碰水（E1-E3 經水、經考生配線相通）就動作；動作後 E2 仍碰水就保持
      if (d.kind === 'LC') {
        const same = (a: string, b: string) => uf.same(`${d.id}.${a}`, `${d.id}.${b}`);
        s.actuated = coilOn && (same('E1', 'E3') || (s.actuated && same('E2', 'E3')));
      }
    }

    if (tr) this.traceTick(wave, prevEnergized, prev!, wasShort, before, doLive);
    // 最短按壓一 tick：按下與放開在同一個 tick 之間發生的，這時才放開
    for (const dev of this.pendingRelease) {
      const s = this.state.get(dev); if (!s) continue;
      this.userAction('release', dev, false, () => { s.pressed = false; });
    }
    this.pendingRelease.clear();
  }

  /** 本 tick 的差異：得電、器具狀態、接點翻轉、端子帶電 */
  private traceTick(wave: number, prevEnergized: Set<string>, prev: Map<string, DevState>, wasShort: boolean,
    before: Map<ElementInst, boolean> | null, doLive: boolean): void {
    const t = this.elapsedMs;
    if (this.shortCircuit && !wasShort) this.emit({ kind: 'short', wave, t });
    for (const el of this.elements) {
      const k = el.def.kind;
      if (k !== 'coil' && k !== 'lamp' && k !== 'buzzer') continue;
      const on = this.energized.has(el.key);
      if (on === prevEnergized.has(el.key)) continue;
      this.dirty = true;
      this.emit({ kind: 'power', wave, t, key: el.key, dev: el.device.id, el: k, name: el.def.kind === 'coil' ? el.def.name : undefined, on });
    }
    for (const d of this.q.devices) {
      const s = this.state.get(d.id)!, p = prev.get(d.id)!;
      const ev = (what: DeviceWhat, ms?: number) => this.emit({ kind: 'device', wave, t, dev: d.id, what, ms });
      const coilOn = this.energized.has(`${d.id}.coil`), coilWas = prevEnergized.has(`${d.id}.coil`);
      if (d.kind === 'MC' && s.actuated !== p.actuated) ev(s.actuated ? 'actuate' : 'release');
      if (d.kind === 'TR') {
        if (coilOn && !coilWas) ev('timer-start', this.timerOf(d));
        if (s.timedOut && !p.timedOut) ev('timer-done', this.timerOf(d));
        if (!coilOn && coilWas) ev('timer-reset');
      }
      if (d.kind === 'TRF') {
        if (s.actuated && !p.actuated) ev('actuate');
        else if (coilOn && !coilWas && p.actuated) ev('offdelay-cancel');
        if (!coilOn && coilWas && s.actuated) ev('offdelay-start', this.timerOf(d));
        if (!s.actuated && p.actuated) ev('offdelay-done', this.timerOf(d));
      }
      if (d.kind === 'KR' && s.latched !== p.latched) ev(s.latched ? 'latch-set' : 'latch-reset');
      if (d.kind === 'MR' && s.latched !== p.latched) ev('ratchet');
      if (d.kind === 'RY' && s.actuated !== p.actuated) ev(s.actuated ? 'actuate' : 'release');
      if (d.kind === 'LC' && s.actuated !== p.actuated) ev(s.actuated ? 'level-on' : 'level-off');
      if (d.kind === 'DF' && s.blown && !p.blown) ev('blown');
    }
    this.diffContacts(before, wave);
    if (doLive) this.diffLive(wave);
  }

  /** 端子帶電的前後差異（只在接點或電源變過之後才比對） */
  private diffLive(wave: number): void {
    const on: string[] = [], off: string[] = [];
    for (const d of this.q.devices) for (const td of defOf(d.kind).terminals) {
      const tid = `${d.id}.${td.id}`;
      const ph = this.terminalPhase(tid), was = this.prevLive.get(tid) ?? null;
      if (ph === was) continue;
      this.prevLive.set(tid, ph);
      if (ph && !was) on.push(tid); else if (!ph && was) off.push(tid);
    }
    if (on.length || off.length) this.emit({ kind: 'live', wave, t: this.elapsedMs, on, off });
  }

  /** 自動水位：每台吸合中的泵注水 0.06/s（給水源要有水），固定耗水 0.03/s */
  private hydroTick(dt: number): void {
    const sc = this.q.scene;
    if (!this.hydro || sc?.kind !== 'pump') return;
    const fsOn = this.state.get(sc.fs)?.pressed ?? true;
    const pumping = fsOn ? sc.pumps.filter(id => this.state.get(id)?.actuated).length : 0;
    const nv = Math.max(0, Math.min(1, this.level + (pumping * .06 - .03) * dt / 1000));
    if (nv !== this.level) { this.level = nv; this.dirty = true; }
  }

  run(ms: number): void { for (let t = 0; t < ms; t += this.tickMs) this.tick(); }

  /** 供劇本比對：MC/TR 動作、燈、蜂鳴器 */
  snapshot(): Record<string, boolean> {
    const out: Record<string, boolean> = {};
    for (const d of this.q.devices) {
      const s = this.state.get(d.id)!;
      if (d.kind === 'MC' || d.kind === 'TR' || d.kind === 'TRF' || d.kind === 'RY' || d.kind === 'LC') out[d.id] = s.actuated;
      if (d.kind === 'KR' || d.kind === 'MR') out[d.id] = s.latched;
      if (d.kind === 'COS' || d.kind === 'FS') out[d.id] = s.pressed;
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
