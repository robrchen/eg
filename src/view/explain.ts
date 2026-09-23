/**
 * 動作解說（通電測試的教學模式）：
 * 模擬器每一波變化（按鈕 → 接點 → 線圈 → 接點 → 燈……）整理成時間軸，並在板上逐波演示：
 * 接點閉合／打開的端子亮一圈、器具外框發光、剛帶電的導線閃一下、畫布下方字幕、單線圖同步標示。
 * 開啟時主迴圈每出現一波就暫停 stepMs（見 main.ts 的 hold），所以板子本身就是慢動作，文字與畫面永遠同步。
 */
import type { QuestionDef, Wire } from '../model/types';
import type { SimEvent } from '../engine/simulator';
import { buildRoles, groupStages, termsOf, wiredTerminals, type Roles, type Stage } from '../engine/trace';
import type { PanelView } from './panel';
import type { SchematicWindow } from './schematic';

const KEY = 'yishipei:explain';
/** 新一段因果鏈從使用者動作開始（放開按鈕、瞬停的自動復電只是同一段的延續） */
const chainStart = (s: Stage) => !!s.action && s.action.action !== 'release' && s.action.reason !== '復電';
const MAX = 300;

export class Explainer {
  readonly el: HTMLElement;
  enabled = false;
  slow = false;
  private roles: Roles = new Map();
  private wired = new Set<string>();
  /** 同一批收到多個階段時，依序排程演示（不讓字幕直接跳到最後一個） */
  private queue: number[] = [];
  private logEl: HTMLOListElement;
  private cap: HTMLDivElement;
  private items: { stage: Stage; li: HTMLLIElement }[] = [];
  /** 本段因果鏈的起點（最後一個使用者動作的模擬時間） */
  private chainT = 0;
  private timers: number[] = [];
  private capTimer = 0;

  constructor(private q: QuestionDef, private board: PanelView, private schem: SchematicWindow | null) {
    try { const s = JSON.parse(localStorage.getItem(KEY) ?? '{}'); this.enabled = !!s.on; this.slow = !!s.slow; } catch { /* ignore */ }
    const el = document.createElement('div');
    el.className = 'explain';
    el.innerHTML = `<div class="row explain-bar">
        <label class="inline"><input type="checkbox" data-a="on"> 動作解說</label>
        <label class="inline"><input type="checkbox" data-a="slow"> 慢動作</label>
        <button class="btn small" data-a="replay">重播上一段</button>
        <button class="btn small" data-a="clear">清除</button>
      </div>
      <div class="hint explain-hint">勾選後每一波動作會放慢並逐步說明因果：接點閉合／打開 → 線圈得電 → 接點動作 → 燈亮。點時間軸任一筆可從那裡重播。</div>
      <ol class="explain-log"></ol>`;
    this.el = el;
    this.logEl = el.querySelector('ol')!;
    const on = el.querySelector<HTMLInputElement>('[data-a="on"]')!, slow = el.querySelector<HTMLInputElement>('[data-a="slow"]')!;
    on.checked = this.enabled; slow.checked = this.slow;
    on.onchange = () => { this.enabled = on.checked; this.save(); if (!this.enabled) this.hideCap(); };
    slow.onchange = () => { this.slow = slow.checked; this.save(); };
    el.querySelector<HTMLButtonElement>('[data-a="replay"]')!.onclick = () => this.replayLast();
    el.querySelector<HTMLButtonElement>('[data-a="clear"]')!.onclick = () => this.clear();
    this.cap = document.createElement('div');
    this.cap.className = 'explain-cap';
    board.root.appendChild(this.cap);
  }

  /** 每一波之間的間隔 */
  stepMs(): number { return this.slow ? 1200 : 500; }

  private save(): void { try { localStorage.setItem(KEY, JSON.stringify({ on: this.enabled, slow: this.slow })); } catch { /* ignore */ } }

  /** 新一輪通電測試：依目前接線推導接點用途、清空時間軸 */
  begin(wires: Wire[]): void { this.roles = buildRoles(this.q, wires); this.wired = wiredTerminals(this.q, wires); this.clear(); }
  /** 離開通電測試 */
  end(): void { this.stopReplay(); this.stopQueue(); this.hideCap(); this.board.clearFx(); }

  clear(): void { this.stopReplay(); this.stopQueue(); this.items = []; this.logEl.replaceChildren(); this.chainT = 0; this.hideCap(); }

  /** 收下模擬器事件：整理成階段、加到時間軸、在板上演示。回傳有說明文字的階段數（給主迴圈決定要不要暫停） */
  ingest(events: SimEvent[]): number {
    if (!this.enabled || !events.length) return 0;
    let n = 0;
    for (const s of groupStages(events, this.q, this.roles, this.wired)) {
      if (!s.lines.length) { this.board.flashWires(s.liveOn, true); this.board.flashWires(s.liveOff, false); continue; }
      const run = () => { this.append(s); this.show(s); };
      if (n === 0) run(); else this.queue.push(window.setTimeout(run, n * this.stepMs()));
      n++;
    }
    return n;
  }
  private stopQueue(): void { for (const t of this.queue) clearTimeout(t); this.queue = []; }

  private append(s: Stage): void {
    if (chainStart(s)) this.chainT = s.t;
    const li = document.createElement('li');
    li.className = 'stage' + (s.action ? ' act' : '');
    const t = document.createElement('span');
    t.className = 't';
    t.textContent = chainStart(s) ? '動作' : `+${((s.t - this.chainT) / 1000).toFixed(2)} s`;
    li.appendChild(t);
    for (const l of s.lines) { const d = document.createElement('div'); d.className = 'ln'; d.textContent = l.text; li.appendChild(d); }
    const idx = this.items.length;
    li.onclick = () => this.replayFrom(idx);
    this.logEl.appendChild(li);
    this.items.push({ stage: s, li });
    if (this.items.length > MAX) {
      const drop = this.items.splice(0, this.items.length - MAX);
      for (const x of drop) x.li.remove();
      this.items.forEach((x, i) => { x.li.onclick = () => this.replayFrom(i); });
    }
    this.markCurrent(li);
  }

  private markCurrent(li: HTMLLIElement): void {
    for (const x of this.items) x.li.classList.toggle('current', x.li === li);
    li.scrollIntoView({ block: 'nearest' });
  }

  /** 板上演示一個階段 */
  private show(s: Stage): void {
    const ms = Math.max(900, this.stepMs() * 1.6);
    this.board.pulseTerminals(s.lines.flatMap(l => l.marks), ms);
    this.board.markDevices(s.lines.filter(l => l.act === 'on').map(l => l.dev), 'ex-on', ms);
    this.board.markDevices(s.lines.filter(l => l.act === 'off').map(l => l.dev), 'ex-off', ms);
    this.board.flashWires(s.liveOn, true, ms);
    this.board.flashWires(s.liveOff, false, ms);
    const pairs = s.lines.flatMap(l => l.keys).map(k => termsOf(this.q, k)).filter(t => t.length === 2) as [string, string][];
    this.schem?.setActive({ pairs, termsOn: s.liveOn, termsOff: s.liveOff }, ms);
    this.cap.innerHTML = s.lines.slice(0, 3).map(l => `<div>${esc(l.text)}</div>`).join('') + (s.lines.length > 3 ? `<div class="more">…還有 ${s.lines.length - 3} 項</div>` : '');
    this.cap.classList.add('show');
    clearTimeout(this.capTimer);
    this.capTimer = window.setTimeout(() => this.hideCap(), this.stepMs() * 2 + 800);
  }

  private hideCap(): void { clearTimeout(this.capTimer); this.cap.classList.remove('show'); }

  /** 純視覺重播（模擬本身不動）：從第 i 筆播到這段因果鏈結尾 */
  replayFrom(i: number): void {
    this.stopReplay();
    let end = i + 1;
    while (end < this.items.length && !chainStart(this.items[end].stage)) end++;
    this.items.slice(i, end).forEach((x, k) => {
      this.timers.push(window.setTimeout(() => { this.show(x.stage); this.markCurrent(x.li); }, k * this.stepMs()));
    });
  }
  /** 重播最後一段（從最後一個使用者動作開始） */
  replayLast(): void {
    let i = this.items.length - 1;
    while (i > 0 && !chainStart(this.items[i].stage)) i--;
    if (i >= 0) this.replayFrom(i);
  }
  private stopReplay(): void { for (const t of this.timers) clearTimeout(t); this.timers = []; }
}

const esc = (s: string) => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
