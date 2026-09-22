import type { QuestionDef, Wire, DeviceInstance } from '../model/types';
import { defOf, KIND_NAME, ROLE_COLOR, ROLE_NAME } from '../library';
import type { Simulator } from '../engine/simulator';
import { buildDeviceDiagram } from './deviceDiagram';

export interface CardEvents {
  terminalClick(tid: string): void;
  terminalHover(tid: string | null, x: number, y: number): void;
  togglePin(): void;
  canWire(): boolean;
}

export interface CardState {
  wires: Wire[];
  pending: string | null;
  targets: Set<string>;
  sim: Simulator | null;
}

const h = (tag: string, cls = '', html = ''): HTMLElement => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };

/** 附掛資訊卡：以大字顯示目前器具的端子圖與接線去向，端子可直接點選拉線 */
export class InfoCard {
  private devId: string | null = null;
  private pinned = false;
  private termBtns = new Map<string, HTMLButtonElement>();
  private toEls = new Map<string, HTMLElement>();

  constructor(private root: HTMLElement, private q: QuestionDef, private ev: CardEvents) {
    this.renderEmpty();
  }

  current(): string | null { return this.devId; }
  isPinned(): boolean { return this.pinned; }

  private renderEmpty(): void {
    this.root.innerHTML = `<div class="card-empty"><b>附掛資訊</b><br>滑鼠停在器具上，器具旁會滑出可接的端子；點端子開始拉線，移到另一器具點目標端子即完成。<br>這裡會同步列出該器具每個端子的去向。</div>`;
    this.termBtns.clear(); this.toEls.clear();
  }

  setDevice(devId: string | null, pinned: boolean): void {
    this.pinned = pinned;
    if (devId === this.devId) { this.updatePin(); return; }
    this.devId = devId;
    if (!devId) { this.renderEmpty(); return; }
    const d = this.q.devices.find(x => x.id === devId);
    if (!d) { this.renderEmpty(); return; }
    this.build(d);
  }

  private updatePin(): void {
    const b = this.root.querySelector<HTMLButtonElement>('.pin');
    if (b) { b.textContent = this.pinned ? '📌 已釘選' : '釘選'; b.classList.toggle('active', this.pinned); }
  }

  private build(d: DeviceInstance): void {
    const def = defOf(d.kind);
    this.termBtns.clear(); this.toEls.clear();
    this.root.replaceChildren();
    const head = h('div', 'card-head');
    head.append(h('span', 'id', d.label ?? d.id), h('span', 'kind', KIND_NAME[d.kind] + (d.desc ? ' · ' + d.desc : '')));
    const pin = h('button', 'btn small pin', this.pinned ? '📌 已釘選' : '釘選') as HTMLButtonElement;
    pin.classList.toggle('active', this.pinned);
    pin.onclick = () => this.ev.togglePin();
    head.appendChild(pin);
    this.root.appendChild(head);

    const wireable = def.terminals.filter(t => t.wireable !== false && !d.display);
    const isTB = d.kind === 'TB16';

    if (!isTB) {
      const { root, buttons } = buildDeviceDiagram(def, {
        devId: d.id,
        displayOnly: !!d.display,
        onClick: tid => { if (this.ev.canWire()) this.ev.terminalClick(tid); },
        onHover: (tid, x, y) => this.ev.terminalHover(tid, x, y),
      });
      for (const [tid, b] of buttons) this.termBtns.set(tid, b);
      this.root.appendChild(root);
    }

    // 角色圖例
    const roles = [...new Set(wireable.map(t => t.role))];
    if (roles.length) {
      const lg = h('div', 'card-legend');
      for (const r of roles) { const s = h('span', '', ROLE_NAME[r]); s.style.background = ROLE_COLOR[r]; lg.appendChild(s); }
      this.root.appendChild(lg);
    }

    // 接線去向清單
    const ul = h('ul', 'card-list');
    for (const t of wireable) {
      const tid = `${d.id}.${t.id}`;
      const li = h('li');
      const tag = h('span', 't', `${t.label || '•'}${t.sub && !isTB ? `<small> ${t.sub}</small>` : ''}`);
      tag.style.background = ROLE_COLOR[t.role];
      if (isTB) {
        tag.style.cursor = 'crosshair';
        tag.onclick = () => { if (this.ev.canWire()) this.ev.terminalClick(tid); };
        tag.onpointerenter = ev => this.ev.terminalHover(tid, ev.clientX, ev.clientY);
        tag.onpointerleave = () => this.ev.terminalHover(null, 0, 0);
        this.termBtns.set(tid, tag as HTMLButtonElement);
      }
      const to = h('span', 'to');
      this.toEls.set(tid, to);
      li.append(tag, to);
      ul.appendChild(li);
    }
    this.root.appendChild(ul);

    if (d.kind === 'TR') this.root.appendChild(h('div', 'card-note', '底座前視：上排 6 5 4 3、下排 7 8 1 2（OMRON P2CF-08 / PF083A）。2-7 電源，8 共用；8-5 Y 輸出（通電即閉、計時到打開），8-6 Δ 輸出（計時到閉合）。'));
    if (d.kind === 'MC') this.root.appendChild(h('div', 'card-note', '線圈 A1 在右上（a右上之上）、A2 在左下（a左下之下）。左右側掛輔助接點塊各含 1a1b；每塊由上到下為 a、b、b、a（a 接點在外側、b 接點在中間）。副標為 IEC 編號，考場以現場器具標示為準。'));
    if (d.kind === 'THRY') this.root.appendChild(h('div', 'card-note', '1c 型：c 為共用點（95），b 常閉（96）接控制電源回路，a 常開（98）接蜂鳴器。'));
    if (d.kind === 'TBM4' || d.kind === 'TBM3') this.root.appendChild(h('div', 'card-note', '無編號端子台，考場已由器具本體引接（灰色虛線）。滑鼠停在端子上可看到它引接自哪個接點，等同用三用電表量通路。'));
  }

  refresh(st: CardState): void {
    if (!this.devId) return;
    const d = this.q.devices.find(x => x.id === this.devId)!;
    const def = defOf(d.kind);
    const counts = new Map<string, number>();
    for (const w of st.wires) { counts.set(w.a, (counts.get(w.a) ?? 0) + 1); counts.set(w.b, (counts.get(w.b) ?? 0) + 1); }
    for (const t of def.terminals) {
      const tid = `${d.id}.${t.id}`;
      const b = this.termBtns.get(tid);
      const n = counts.get(tid) ?? 0;
      if (b) {
        b.classList.toggle('pending', st.pending === tid);
        b.classList.toggle('target', st.targets.has(tid) && st.pending !== tid);
        b.classList.toggle('full', n >= 2);
        b.classList.toggle('live', !!st.sim?.terminalPhase(tid));
        const occ = b.querySelector('.occ');
        if (occ) occ.innerHTML = '<i></i>'.repeat(n);
      }
      const to = this.toEls.get(tid);
      if (to) {
        const partners = st.wires.filter(w => w.a === tid || w.b === tid).map(w => (w.a === tid ? w.b : w.a));
        const pre = this.q.passThrough.find(p => (p.a === tid || p.b === tid) && !p.a.startsWith('TB3.'));
        const parts: string[] = [];
        if (pre) parts.push(`<span class="none">引接自 ${pre.a === tid ? pre.b : pre.a}</span>`);
        if (partners.length) parts.push(partners.map(p => `→ <b>${p}</b>`).join('　'));
        else if (!pre) parts.push('<span class="none">未接</span>');
        if (st.targets.has(tid)) parts.push('<span style="color:#42c48a">◀ 下一步</span>');
        to.innerHTML = parts.join('　');
      }
    }
  }
}
