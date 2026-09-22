import type { PanelId, QuestionDef, Wire } from './model/types';

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
  private listeners = new Set<Listener>();
  private key: string;
  private seq = 0;

  constructor(readonly q: QuestionDef) {
    this.key = `yishipei:${q.id}:v2`; // v2：小 TB 腳位順序改為講義實物（a a b b / 3P），舊存檔不相容
    this.state = {
      wires: [], mode: 'wire', panel: 'device', guideStep: 0,
      timerSec: q.timerDefaultSec, startedAt: null, elapsedBefore: 0, selectedWire: null,
    };
    this.load();
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
      localStorage.setItem(this.key, JSON.stringify({ wires, guideStep, timerSec, elapsedBefore, startedAt, panel, mode }));
    } catch { /* ignore */ }
  }
  load(): void {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return;
      const d = JSON.parse(raw);
      Object.assign(this.state, d);
      if (this.state.mode === 'sim') this.state.mode = 'wire';
    } catch { /* ignore */ }
  }

  exportJSON(): string { return JSON.stringify({ question: this.q.id, wires: this.state.wires }, null, 2); }
  importJSON(text: string): void {
    const d = JSON.parse(text);
    if (!Array.isArray(d.wires)) throw new Error('格式錯誤');
    this.setWires(d.wires);
  }
}
