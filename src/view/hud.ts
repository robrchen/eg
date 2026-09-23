import type { PanelId, QuestionDef } from '../model/types';
import type { Store, Mode } from '../store';
import type { Simulator } from '../engine/simulator';

export interface HudCallbacks {
  setMode(m: Mode): void;
  grade(): void;
  autoWire(): void;
  showImage(which: 'circuit' | 'layout'): void;
  showLibrary(): void;
  hoverWire(id: string | null): void;
  removeWire(id: string): void;
  focusWire(id: string): void;
  resetAll(): void;
  exportJSON(): void;
  importJSON(): void;
  toggleTimer(): void;
  simNfb(on: boolean): void;
  simTrip(on: boolean): void;
  simTimer(sec: number): void;
  guideJump(step: number): void;
  toggleSound(): boolean;
  showPanel(p: PanelId): void;
  showAll(): void;
  showSide(tab: 'card' | 'drawer'): void;
  undo(): void;
}

const h = (tag: string, cls = '', html = ''): HTMLElement => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
const btn = (label: string, cls = '', on?: () => void): HTMLButtonElement => { const b = document.createElement('button'); b.className = 'btn ' + cls; b.innerHTML = label; if (on) b.onclick = on; return b; };

export class Hud {
  private timerEl!: HTMLElement;
  private timerBtn!: HTMLButtonElement;
  private modeBtns = new Map<Mode, HTMLButtonElement>();
  private wireList!: HTMLElement;
  private wireTab!: HTMLButtonElement;
  private guideMsg!: HTMLElement;
  private statusGrid!: HTMLElement;
  private nfbBtn!: HTMLButtonElement;
  private tripBtn!: HTMLButtonElement;
  private timerLabel!: HTMLElement;
  private panes = new Map<string, HTMLElement>();
  private tabs = new Map<string, HTMLButtonElement>();
  private panelTabBtns: [string, HTMLButtonElement][] = [];   // 同一個 key 會有兩顆（工具列、手機版分頁列）
  private miniWires!: HTMLElement;
  private miniTimer!: HTMLElement;
  private miniMode!: HTMLElement;
  private miniNext!: HTMLElement;
  private soundBtn!: HTMLButtonElement;

  constructor(private q: QuestionDef, private store: Store, private cb: HudCallbacks) {
    this.buildToolbar(document.getElementById('toolbar')!);
    this.buildPanelTabs(document.getElementById('panel-tabs')!);
    this.buildDrawer(document.getElementById('drawer')!);
    this.buildSideMini(document.getElementById('side')!);
  }

  /** 右側面板縮合：只留一條窄帶顯示模式、導線數、計時、下一條線 */
  private buildSideMini(side: HTMLElement): void {
    const app = document.getElementById('app')!;
    const toggle = btn('⟩', 'side-toggle', () => setCollapsed(!app.classList.contains('side-collapsed')));
    toggle.title = '縮合／展開右側面板';
    const mini = h('div', 'side-mini');
    this.miniMode = h('div', 'mini-mode');
    this.miniWires = h('div', 'mini-wires');
    this.miniTimer = h('div', 'mini-timer');
    this.miniNext = h('div', 'mini-next');
    mini.append(this.miniMode, this.miniWires, this.miniTimer, this.miniNext);
    side.prepend(toggle, mini);
    const setCollapsed = (on: boolean) => {
      app.classList.toggle('side-collapsed', on);
      toggle.textContent = on ? '⟨' : '⟩';
      try { localStorage.setItem('yishipei:ui', JSON.stringify({ sideCollapsed: on })); } catch { /* ignore */ }
    };
    try { setCollapsed(!!JSON.parse(localStorage.getItem('yishipei:ui') ?? '{}').sideCollapsed); } catch { /* ignore */ }
  }

  private buildToolbar(root: HTMLElement): void {
    root.appendChild(h('span', 'title', this.q.title));
    const seg = h('div', 'seg');
    for (const [m, label] of [['wire', '自由配線'], ['guide', '步驟引導'], ['sim', '通電測試']] as [Mode, string][]) {
      const b = document.createElement('button'); b.textContent = label; b.onclick = () => this.cb.setMode(m);
      this.modeBtns.set(m, b); seg.appendChild(b);
    }
    root.appendChild(seg);
    // 全景／器具板／操作面板：桌機放在工具列（省一列高度給畫布），手機版另有分頁列
    const view = h('div', 'seg view-seg');
    for (const [key, label, on] of [['all', '全景', () => this.cb.showAll()], ['device', '器具板', () => this.cb.showPanel('device')], ['operator', '操作面板', () => this.cb.showPanel('operator')]] as [string, string, () => void][]) {
      const b = document.createElement('button'); b.textContent = label; b.onclick = on; b.dataset.tab = key;
      this.panelTabBtns.push([key, b]); view.appendChild(b);
    }
    root.appendChild(view);
    root.appendChild(h('span', 'spacer'));
    this.timerEl = h('span', 'timer', '90:00');
    this.timerBtn = btn('開始', 'small', () => this.cb.toggleTimer());
    root.append(this.timerEl, this.timerBtn);
    root.appendChild(btn('評審', 'primary', () => this.cb.grade()));
    // 選單
    const menu = h('div', 'menu');
    const mb = btn('☰', 'icon', () => menu.classList.toggle('open'));
    const dd = h('div', 'dropdown');
    const item = (label: string, on: () => void) => { const b = document.createElement('button'); b.textContent = label; b.onclick = () => { menu.classList.remove('open'); on(); }; dd.appendChild(b); return b; };
    item('控制電路圖', () => this.cb.showImage('circuit'));
    item('器具位置圖', () => this.cb.showImage('layout'));
    item('器具庫（所有器具腳位）', () => this.cb.showLibrary());
    dd.appendChild(document.createElement('hr'));
    item('復原上一步 (Ctrl+Z)', () => this.cb.undo());
    item('匯出接線 JSON', () => this.cb.exportJSON());
    item('匯入接線 JSON', () => this.cb.importJSON());
    this.soundBtn = item('音效：開', () => { const on = this.cb.toggleSound(); this.soundBtn.textContent = `音效：${on ? '開' : '關'}`; });
    dd.appendChild(document.createElement('hr'));
    item('（開發）一鍵標準接線', () => this.cb.autoWire());
    const reset = item('全部重來', () => this.cb.resetAll()); reset.style.color = '#ff8080';
    menu.append(mb, dd);
    root.appendChild(menu);
    document.addEventListener('pointerdown', ev => { if (!menu.contains(ev.target as Node)) menu.classList.remove('open'); });
  }

  private buildPanelTabs(root: HTMLElement): void {
    // 器具板／操作面板分頁永遠顯示；資訊卡／清單只在手機版（側欄收進下方）才需要
    const mk = (key: string, label: string, on: () => void) => { const b = btn(label, 'small', on); b.dataset.tab = key; this.panelTabBtns.push([key, b]); root.appendChild(b); };
    mk('all', '全景', () => this.cb.showAll());
    mk('device', '器具板', () => this.cb.showPanel('device'));
    mk('operator', '操作面板', () => this.cb.showPanel('operator'));
    mk('card', '資訊卡', () => this.cb.showSide('card'));
    mk('drawer', '清單', () => this.cb.showSide('drawer'));
  }

  setMobileState(panel: PanelId | 'all', side: 'card' | 'drawer'): void {
    for (const [k, b] of this.panelTabBtns) b.classList.toggle('active', k === panel || k === side);
  }

  private buildDrawer(root: HTMLElement): void {
    const tabs = h('div', 'drawer-tabs');
    const body = h('div', 'drawer-body');
    const mk = (key: string, label: string) => {
      const b = document.createElement('button'); b.textContent = label; b.onclick = () => this.showTab(key);
      tabs.appendChild(b); this.tabs.set(key, b);
      const pane = h('div', 'pane'); body.appendChild(pane); this.panes.set(key, pane);
      return { b, pane };
    };
    // 導線
    const w = mk('wires', '導線');
    this.wireTab = w.b;
    this.wireList = h('ul', 'wire-list');
    w.pane.append(h('div', 'hint', '滑到清單項目會在面板上高亮該導線；點擊定位；✕ 刪除。面板上點導線選取後按 Delete 也可刪除。'), this.wireList);
    // 通電
    const s = mk('sim', '通電');
    const sRow = h('div', 'row');
    this.nfbBtn = btn('投入 NFB', '', () => this.cb.simNfb(this.nfbBtn.dataset.on !== '1'));
    this.tripBtn = btn('TH-RY 跳脫', '', () => this.cb.simTrip(this.tripBtn.dataset.on !== '1'));
    sRow.append(this.nfbBtn, this.tripBtn);
    this.timerLabel = h('label', 'inline', `TR 設定 ${this.store.state.timerSec} 秒`);
    const range = document.createElement('input');
    range.type = 'range'; range.min = '1'; range.max = '30'; range.value = String(this.store.state.timerSec);
    range.oninput = () => { this.cb.simTimer(Number(range.value)); this.timerLabel.textContent = `TR 設定 ${range.value} 秒`; };
    this.statusGrid = h('div', 'status-grid');
    s.pane.append(h('div', 'hint', '切到「通電測試」模式後，在操作面板<b>按住</b> FWD / REV / OFF 操作；NFB 可點器具板上的把手。'), sRow, this.timerLabel, range, this.statusGrid);
    // 引導
    const g = mk('guide', '引導');
    this.guideMsg = h('div', 'guide-step');
    const gRow = h('div', 'row');
    gRow.append(btn('◀ 上一步', 'small', () => this.cb.guideJump(this.store.state.guideStep - 1)), btn('下一步 ▶', 'small', () => this.cb.guideJump(this.store.state.guideStep + 1)));
    g.pane.append(this.guideMsg, gRow, h('div', 'hint', '依老師 18 步驗證接線；面板上紅色脈動圈是下一條線的兩端，資訊卡的端子也會標示「◀ 下一步」。接錯會拒絕並提示。'));
    // 說明
    const help = mk('help', '說明');
    help.pane.append(h('div', 'hint', `
      <b>拉線</b>：點一個端子 → 再點另一端子（同一面板內）。器具板與操作面板之間必經 TB3 ↔ TB4 過門線（已配妥）。<br>
      <b>滑出接點</b>：滑鼠停在器具上，旁邊會滑出它可接的端子；點一個端子開始拉線，移開就收起；再滑到另一器具、點目標端子完成，面板自動收起。點器具本體可釘住不收。<br>
      <b>資訊卡</b>：側欄同步顯示該器具每個端子的去向，端子同樣可點。<br>
      <b>導覽</b>：滾輪／雙指縮放、拖曳平移、F 置中；Esc 取消拉線；Delete 刪除選取導線；Ctrl+Z 復原。<br>
      <b>端子容量</b>：每端子最多 2 條線。操作面板為開門後的背面（左右鏡射），燈／按鈕已引接到無編號小 TB。<br>
      <b>腳位</b>：以 OMRON 實物為基礎（MC J7KN＋側掛 1a1b 接點塊、TR H3CR-G8L 於 P2CF-08 底座、TH-RY 1c）。考場以現場標示為準，可在 devices.ts 調整。`));
    root.append(tabs, body);
    this.showTab('wires');
  }

  showTab(key: string): void {
    for (const [k, b] of this.tabs) b.classList.toggle('active', k === key);
    for (const [k, p] of this.panes) p.classList.toggle('active', k === key);
  }

  render(sim: Simulator | null): void {
    const s = this.store.state;
    for (const [m, b] of this.modeBtns) b.classList.toggle('active', s.mode === m);
    const remain = Math.max(0, this.q.minutes * 60000 - this.store.elapsedMs());
    const mm = Math.floor(remain / 60000), ss = Math.floor((remain % 60000) / 1000);
    this.timerEl.textContent = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    this.timerEl.classList.toggle('low', remain < 10 * 60000);
    this.timerBtn.textContent = this.store.timerRunning() ? '暫停' : (this.store.elapsedMs() ? '繼續' : '開始');

    this.wireTab.textContent = `導線 ${s.wires.length}`;
    this.miniWires.innerHTML = `<b>${s.wires.length}</b><small>線</small>`;
    this.miniTimer.textContent = this.timerEl.textContent;
    this.miniTimer.classList.toggle('low', remain < 10 * 60000);
    this.miniMode.textContent = { wire: '配線', guide: '引導', sim: '通電' }[s.mode];
    if (s.mode !== 'guide') this.miniNext.textContent = '';
    this.wireList.replaceChildren();
    if (!s.wires.length) this.wireList.appendChild(h('li', '', '<span class="tag">尚無導線</span>'));
    for (const w of s.wires) {
      const li = document.createElement('li');
      li.className = w.id === s.selectedWire ? 'sel' : '';
      li.innerHTML = `<span><span class="tag">${w.panel === 'device' ? '器' : '操'}</span><b>${w.a}</b> ↔ <b>${w.b}</b></span>`;
      const del = h('span', 'del', '✕'); del.title = '刪除';
      del.onclick = ev => { ev.stopPropagation(); this.cb.removeWire(w.id); };
      li.appendChild(del);
      li.onclick = () => this.cb.focusWire(w.id);
      li.onpointerenter = () => this.cb.hoverWire(w.id);
      li.onpointerleave = () => this.cb.hoverWire(null);
      this.wireList.appendChild(li);
    }

    const step = this.q.teacherSteps[s.guideStep];
    if (!step) this.guideMsg.innerHTML = `<span class="n">完成！</span> 18 步驟全部接完，切到「通電測試」試功能，或按「評審」。`;
    else this.guideMsg.innerHTML = `<span class="n">步驟 ${step.n} / ${this.q.teacherSteps.length}</span>　${step.text}<div class="next" data-next></div>`;

    if (sim) {
      this.nfbBtn.dataset.on = sim.nfbOn ? '1' : '0';
      this.nfbBtn.textContent = sim.nfbOn ? '切離 NFB' : '投入 NFB';
      this.nfbBtn.classList.toggle('active', sim.nfbOn);
      const tripped = !!sim.state.get('THRY')?.tripped;
      this.tripBtn.dataset.on = tripped ? '1' : '0';
      this.tripBtn.textContent = tripped ? 'TH-RY 復歸' : 'TH-RY 跳脫';
      this.tripBtn.classList.toggle('danger', tripped);
      const snap = sim.snapshot();
      this.statusGrid.replaceChildren();
      for (const k of ['MCF', 'MCR', 'MCS', 'MCD', 'TR', 'BZ', 'R', 'Y', 'G']) {
        this.statusGrid.appendChild(h('div', `cell ${k.length === 1 ? 'lamp' + k : k === 'BZ' ? 'bz' : ''} ${snap[k] ? 'on' : ''}`, k));
      }
      if (sim.shortCircuit) { const c = h('div', 'cell on', '短路！D-F 燒斷'); c.style.cssText = 'grid-column: span 3; background:#6b2323; border-color:#ff5c5c'; this.statusGrid.appendChild(c); }
    } else {
      this.statusGrid.replaceChildren(h('div', 'hint', '尚未通電。切到「通電測試」模式。'));
    }
  }

  setGuideNext(html: string, short = ''): void {
    const n = this.guideMsg.querySelector('[data-next]');
    if (n) n.innerHTML = html;
    this.miniNext.textContent = short;
  }
}
