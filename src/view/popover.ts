import type { DeviceInstance, QuestionDef } from '../model/types';
import { defOf, KIND_NAME, ROLE_COLOR } from '../library';
import { buildDeviceDiagram } from './deviceDiagram';
import type { CardState } from './infoCard';
import { preSource, spareTerminals } from '../model/preWired';

export interface PopEvents {
  terminalClick(tid: string): void;
  terminalHover(tid: string | null, x: number, y: number): void;
  canWire(): boolean;
  /** 指標進入 / 離開彈出面板 */
  enter(): void;
  leave(): void;
  /** 指標在彈出面板上移動（讓橡皮筋線跟著走） */
  move(x: number, y: number): void;
}

const h = (tag: string, cls = '', html = ''): HTMLElement => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };

/** 滑到器具旁邊「滑出」的接點面板：顯示該器具可接的端子，點了就拉線，移開就收起 */
export class DevicePopover {
  readonly el: HTMLElement;
  private devId: string | null = null;
  private btns = new Map<string, HTMLButtonElement>();
  private hint!: HTMLElement;
  private detail!: HTMLElement;
  private pinEl!: HTMLElement;
  private pinned = false;

  constructor(private host: HTMLElement, private q: QuestionDef, private ev: PopEvents) {
    this.el = h('div', 'pop');
    this.el.hidden = true;
    host.appendChild(this.el);
    this.el.onpointerenter = () => this.ev.enter();
    this.el.onpointerleave = () => this.ev.leave();
    this.el.onpointermove = e => this.ev.move(e.clientX, e.clientY);
    // 不讓面板底下的 SVG 收到拖曳 / 點擊
    this.el.onpointerdown = e => e.stopPropagation();
    this.el.onwheel = e => e.stopPropagation();
  }

  current(): string | null { return this.devId; }
  visible(): boolean { return !this.el.hidden; }

  /** 顯示某器具；anchor 為器具在畫面上的矩形（client 座標） */
  show(devId: string, anchor: DOMRect, avoid: DOMRect[] = []): void {
    if (devId !== this.devId) {
      const d = this.q.devices.find(x => x.id === devId);
      if (!d) { this.hide(); return; }
      this.devId = devId;
      this.build(d);
    }
    this.el.hidden = false;
    this.place(anchor, avoid);
  }

  hide(): void {
    this.el.hidden = true;
    this.devId = null;
    this.btns.clear();
  }

  /** 點一下器具就把面板固定住，滑過旁邊其他器具也不會被換掉 */
  setPinned(on: boolean): void {
    this.pinned = on;
    this.el.classList.toggle('pinned', on);
    if (this.pinEl) this.pinEl.hidden = !on;
  }

  /** 附掛端子詳情：滑到本器具的端子時，詳情直接長在面板內（取代原本另外浮出的提示框） */
  setTerminalDetail(html: string | null): void {
    if (!this.detail) return;
    if (html) this.detail.innerHTML = html;
    this.detail.hidden = !html;
    this.hint.hidden = !!html;
  }

  /** 四個方向都試，選「蓋到其他器具最少」的那一側（平手依右、左、下、上），放不進畫面的方向排最後 */
  place(anchor: DOMRect, avoid: DOMRect[] = []): void {
    const hr = this.host.getBoundingClientRect();
    const pw = this.el.offsetWidth, ph = this.el.offsetHeight, gap = 10, m = 6;
    const ax = anchor.left - hr.left, ay = anchor.top - hr.top;
    const cands: { left: number; top: number; side: string }[] = [
      { left: ax + anchor.width + gap, top: ay + anchor.height / 2 - ph / 2, side: 'right' },
      { left: ax - gap - pw, top: ay + anchor.height / 2 - ph / 2, side: 'left' },
      { left: ax + anchor.width / 2 - pw / 2, top: ay + anchor.height + gap, side: 'below' },
      { left: ax + anchor.width / 2 - pw / 2, top: ay - gap - ph, side: 'above' },
    ];
    const fits = (c: { left: number; top: number }) => c.left >= m && c.top >= m && c.left + pw <= hr.width - m && c.top + ph <= hr.height - m;
    const overlap = (c: { left: number; top: number }) => avoid.reduce((sum, r) => {
      const rx = r.left - hr.left, ry = r.top - hr.top;
      const w = Math.min(c.left + pw, rx + r.width) - Math.max(c.left, rx);
      const h = Math.min(c.top + ph, ry + r.height) - Math.max(c.top, ry);
      return sum + (w > 0 && h > 0 ? w * h : 0);
    }, 0);
    const scored = cands.map((c, i) => ({ c, i, fit: fits(c), ov: overlap(c) }));
    scored.sort((p, q) => (Number(q.fit) - Number(p.fit)) || (p.ov - q.ov) || (p.i - q.i));
    let { left, top, side } = scored[0].c;
    left = Math.max(m, Math.min(hr.width - pw - m, left));
    top = Math.max(m, Math.min(hr.height - ph - m, top));
    this.el.style.left = `${left}px`;
    this.el.style.top = `${top}px`;
    this.el.dataset.side = side;
  }

  private build(d: DeviceInstance): void {
    const def = defOf(d.kind);
    this.btns.clear();
    this.el.replaceChildren();
    const head = h('div', 'pop-head');
    head.append(h('b', '', d.label ?? d.id), h('span', '', KIND_NAME[d.kind] + (d.desc ? ' · ' + d.desc : '')));
    this.pinEl = h('span', 'pop-pin', '釘選中');
    this.pinEl.hidden = !this.pinned;
    head.appendChild(this.pinEl);
    this.el.appendChild(head);

    const spare = spareTerminals(this.q);
    const mirror = !!this.q.panels[d.panel].mirror;   // 操作面板是開門背面，左右鏡射
    const wireable = def.terminals.filter(t => t.wireable !== false && !d.display && !spare.has(`${d.id}.${t.id}`));
    const useGrid = d.kind === 'TB16' || d.kind === 'TBM4' || d.kind === 'TBM3';
    if (useGrid) {
      const grid = h('div', 'pop-grid');
      grid.style.gridTemplateColumns = `repeat(${Math.min(4, wireable.length)}, 1fr)`;
      // 橫排的小端子台在鏡射面板上左右相反，格子順序跟著翻，才和面板上看到的一致
      const horizontal = d.kind === 'TBM3' || d.kind === 'TBM4';
      for (const t of (mirror && horizontal ? [...wireable].reverse() : wireable)) {
        const tid = `${d.id}.${t.id}`;
        // 小端子台沒有編號，改標出它引接自哪個接點（a上 / b下 / X1 / c…），顏色同接點角色
        const src = preSource(this.q, tid);
        const b = h('button', 'card-term', src?.label || t.label || '•') as HTMLButtonElement;
        b.style.background = ROLE_COLOR[src?.role ?? t.role];
        b.title = src ? `${tid}　引接自 ${src.from}` : tid;
        b.appendChild(h('span', 'occ'));
        b.onclick = () => { if (this.ev.canWire()) this.ev.terminalClick(tid); };
        b.onpointerenter = ev => this.ev.terminalHover(tid, ev.clientX, ev.clientY);
        b.onpointerleave = () => this.ev.terminalHover(null, 0, 0);
        this.btns.set(tid, b);
        grid.appendChild(b);
      }
      this.el.style.width = '224px';
      this.el.appendChild(grid);
    } else {
      const { root, buttons, fit } = buildDeviceDiagram(def, {
        devId: d.id,
        displayOnly: !!d.display,
        term: 32, main: 22, gap: 3, compact: true, mirror,
        skip: id => spare.has(`${d.id}.${id}`),
        onClick: tid => { if (this.ev.canWire()) this.ev.terminalClick(tid); },
        onHover: (tid, x, y) => this.ev.terminalHover(tid, x, y),
      });
      for (const [tid, b] of buttons) this.btns.set(tid, b);
      // 面板寬度跟著圖框走，端子才不會被擠到重疊
      this.el.style.width = `${Math.max(224, fit.w + 20)}px`;
      this.el.appendChild(root);
    }
    this.detail = h('div', 'pop-term');
    this.detail.hidden = true;
    this.hint = h('div', 'pop-hint');
    this.el.append(this.detail, this.hint);
  }

  refresh(st: CardState): void {
    if (!this.devId || this.el.hidden) return;
    const counts = new Map<string, number>();
    for (const w of st.wires) { counts.set(w.a, (counts.get(w.a) ?? 0) + 1); counts.set(w.b, (counts.get(w.b) ?? 0) + 1); }
    for (const [tid, b] of this.btns) {
      const n = counts.get(tid) ?? 0;
      b.classList.toggle('pending', st.pending === tid);
      b.classList.toggle('target', st.targets.has(tid) && st.pending !== tid);
      b.classList.toggle('full', n >= 2);
      b.classList.toggle('live', !!st.sim?.terminalPhase(tid));
      const occ = b.querySelector('.occ');
      if (occ) occ.innerHTML = '<i></i>'.repeat(n);
    }
    if (st.sim) this.hint.textContent = '通電中：此處僅顯示狀態';
    else if (st.pending) this.hint.innerHTML = `拉線中：<b>${st.pending}</b> → 點這裡的端子完成`;
    else if (this.pinned) this.hint.textContent = '已固定；再點一下器具、點空白處或按 Esc 解除';
    else this.hint.textContent = '點器具可固定面板；點端子開始拉線';
  }
}
