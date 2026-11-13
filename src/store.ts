import type { DeviceInstance, PanelId, QuestionDef, Wire } from './model/types';

/** 器具設定視窗可改的欄位（只動外觀與動作參數，不動腳位） */
export type DeviceOverride = Partial<Pick<DeviceInstance, 'label' | 'desc' | 'color' | 'timerSec' | 'latch'>>;
const OVR_KEYS = ['label', 'desc', 'color', 'timerSec', 'latch'] as const;

export type Mode = 'wire' | 'guide' | 'sim';

export interface AppState {
  wires: Wire[];
  mode: Mode;
  panel: PanelId;
  guideStep: number;      // 0-based index into teacherSteps
  timerSec: number;       // TR 秒數
  startedAt: number | null;
  elapsedBefore: number;  // 暫停前累計 ms
  selectedWire: string | null;
}

type Listener = () => void;

export class Store {
  state: AppState;
  /** 器具設定（依器具 id），隨題目存 localStorage；套用時直接改 q.devices 的實例欄位 */
  overrides: Record<string, DeviceOverride> = {};
  private baseline = new Map<string, DeviceOverride>();
  private listeners = new Set<Listener>();
  private key: string;
  private seq = 0;

  constructor(readonly q: QuestionDef) {
    this.key = `yishipei:${q.id}:v${q.rev ?? 2}`; // v2：小 TB 腳位順序改為講義實物（a a b b / 3P），舊存檔不相容
    this.state = {
      wires: [], mode: 'wire', panel: 'device', guideStep: 0,
      timerSec: q.timerDefaultSec, startedAt: null, elapsedBefore: 0, selectedWire: null,
    };
    for (const d of q.devices) this.baseline.set(d.id, Object.fromEntries(OVR_KEYS.map(k => [k, d[k]])) as DeviceOverride);
    this.load();
    for (const id of Object.keys(this.overrides)) this.applyOverride(id);
  }

  /** 設定（或清除：patch 為 null）某器具的覆寫，並套到 q.devices */
  setOverride(id: string, patch: DeviceOverride | null): void {
    if (!patch) delete this.overrides[id];
    else {
      const next: DeviceOverride = { ...this.overrides[id], ...patch };
      for (const k of OVR_KEYS) if (next[k] === undefined) delete next[k];
      if (Object.keys(next).length) this.overrides[id] = next; else delete this.overrides[id];
    }
    this.applyOverride(id);
    this.save(); this.emit();
  }
  private applyOverride(id: string): void {
    const d = this.q.devices.find(x => x.id === id); const base = this.baseline.get(id);
    if (!d || !base) return;
    const o = this.overrides[id] ?? {};
    for (const k of OVR_KEYS) {
      const v = o[k] !== undefined ? o[k] : base[k];
      if (v === undefined) delete (d as unknown as Record<string, unknown>)[k]; else (d as unknown as Record<string, unknown>)[k] = v;
    }
  }

  on(fn: Listener): () => void { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  private emit(): void { for (const l of this.listeners) l(); }

  update(patch: Partial<AppState>): void { Object.assign(this.state, patch); this.save(); this.emit(); }

  addWire(a: string, b: string, panel: PanelId): Wire {
    const w: Wire = { id: `w${Date.now().toString(36)}${(this.seq++).toString(36)}`, a, b, panel };
    this.state.wires = [...this.state.wires, w];
    if (this.state.startedAt === null && this.state.elapsedBefore === 0) this.state.startedAt = Date.now();
    this.save(); this.emit();
    return w;
  }

  removeWire(id: string): void {
    this.state.wires = this.state.wires.filter(w => w.id !== id);
    if (this.state.selectedWire === id) this.state.selectedWire = null;
    this.save(); this.emit();
  }

  setWires(wires: Wire[]): void { this.state.wires = wires; this.state.selectedWire = null; this.save(); this.emit(); }

  countAt(tid: string): number { return this.state.wires.reduce((n, w) => n + (w.a === tid ? 1 : 0) + (w.b === tid ? 1 : 0), 0); }
  hasWire(a: string, b: string): boolean { return this.state.wires.some(w => (w.a === a && w.b === b) || (w.a === b && w.b === a)); }

  elapsedMs(): number { return this.state.elapsedBefore + (this.state.startedAt ? Date.now() - this.state.startedAt : 0); }
  timerRunning(): boolean { return this.state.startedAt !== null; }
  toggleTimer(): void {
    if (this.state.startedAt) { this.state.elapsedBefore += Date.now() - this.state.startedAt; this.state.startedAt = null; }
    else this.state.startedAt = Date.now();
    this.save(); this.emit();
  }
  resetAll(): void {
    this.state.wires = []; this.state.guideStep = 0; this.state.startedAt = null; this.state.elapsedBefore = 0; this.state.selectedWire = null;
    this.save(); this.emit();
  }

  save(): void {
    try {
      const { wires, guideStep, timerSec, elapsedBefore, startedAt, panel, mode } = this.state;
      localStorage.setItem(this.key, JSON.stringify({ wires, guideStep, timerSec, elapsedBefore, startedAt, panel, mode, overrides: this.overrides }));
    } catch { /* ignore */ }
  }
  load(): void {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.overrides && typeof d.overrides === 'object') this.overrides = d.overrides;
      delete d.overrides;
      Object.assign(this.state, d);
      if (this.state.mode === 'sim') this.state.mode = 'wire';
    } catch { /* ignore */ }
  }

  exportJSON(): string { return JSON.stringify({ question: this.q.id, wires: this.state.wires, overrides: this.overrides }, null, 2); }
  /** 匯入接線（與器具設定）；回傳是否有帶器具設定（呼叫端要重畫器具） */
  importJSON(text: string): boolean {
    const d = JSON.parse(text);
    if (!Array.isArray(d.wires)) throw new Error('格式錯誤');
    const hasOvr = !!d.overrides && typeof d.overrides === 'object';
    if (hasOvr) {
      const ids = new Set([...Object.keys(this.overrides), ...Object.keys(d.overrides)]);
      this.overrides = d.overrides;
      for (const id of ids) this.applyOverride(id);
    }
    this.setWires(d.wires);
    return hasOvr;
  }
}
