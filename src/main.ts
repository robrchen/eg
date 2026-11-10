import { currentQuestion, QUESTIONS, switchQuestion } from './model/questions';
import { expandChainOf, teacherWiresOf } from './model/questions/common';
import type { PanelId, Wire } from './model/types';
import { defOf, ROLE_COLOR, ROLE_NAME, PHASE_NAME, isGroundTerm } from './library';
import { Store, type Mode } from './store';
import { Simulator } from './engine/simulator';
import { grade } from './engine/grader';
import { PanelView } from './view/panel';
import { InfoCard } from './view/infoCard';
import { Hud } from './view/hud';
import { showImage, showReport } from './view/report';
import { showLibrary } from './view/library';
import { showTooltip, hideTooltip } from './view/tooltip';
import { sfx } from './view/sfx';
import { showMenu, type MenuItem } from './view/contextMenu';
import { SchematicWindow } from './view/schematic';
import { Explainer } from './view/explain';
import { referenceNets } from './model/schematic';
import { DrillView } from './drill/view';
import { openDeviceDialog } from './view/deviceDialog';
import { Scene } from './view/scene';
import { FloatWin } from './view/floatWin';

const q = currentQuestion();
const store = new Store(q);
const toastEl = document.getElementById('toast')!;
const sideEl = document.getElementById('side')!;

let pending: string | null = null;
let sim: Simulator | null = null;
let simTimer: number | null = null;
/** 動作解說：每一波動作後暫停到這個時間（performance.now）；瞬停的復電時刻（模擬時間，解說放慢也不會拉長） */
let holdUntil = 0;
let dipRestoreAt: number | null = null;
let cardPinned: string | null = null;   // 點器具：畫布上的器具固定放大（側欄資訊卡也跟著）
let pinArmed = false;                   // 固定中的器具已選過端子 → 滑鼠移出它就自動還原
let mobilePanel: PanelId = store.state.panel;
let mobileSide: 'card' | 'drawer' = 'card';
const undoStack: Wire[][] = [];
let toastTimer = 0;

function toast(msg: string, kind: 'ok' | 'bad' | '' = ''): void {
  toastEl.textContent = msg;
  toastEl.className = `show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), 2000);
}

const isMobile = () => matchMedia('(max-width: 980px)').matches;
const canWire = () => store.state.mode !== 'sim';

/* ---------- 端子資訊 ---------- */
function terminalInfo(tid: string) {
  const [d, t] = tid.split('.');
  const inst = q.devices.find(x => x.id === d);
  const def = inst && defOf(inst.kind).terminals.find(x => x.id === t);
  return { inst, def };
}
/** 端子詳情。withDevice=false 用於附掛在器具面板內（標題已有器具名，不重複） */
function terminalDetail(tid: string, withDevice: boolean): string {
  const { inst, def } = terminalInfo(tid);
  if (!inst || !def) return tid;
  const partners = store.state.wires.filter(w => w.a === tid || w.b === tid).map(w => (w.a === tid ? w.b : w.a));
  const pre = q.passThrough.find(p => (p.a === tid || p.b === tid) && !p.a.startsWith('TB3.'));
  let to = partners.length ? `→ ${partners.map(p => `<b>${p}</b>`).join('、')}` : '<span style="color:#98a2ad">尚未接線</span>';
  if (pre) to = `<span style="color:#98a2ad">引接自 ${pre.a === tid ? pre.b : pre.a}</span>　${to}`;
  const live = sim?.terminalPhase(tid);
  const head = withDevice
    ? `${inst.label ?? inst.id}${inst.desc ? `<small style="color:#98a2ad;font-weight:400">（${inst.desc}）</small>` : ''} · `
    : '';
  return `<div class="tt-title">${head}${def.label || '無編號'}${def.sub ? ` <small>(${def.sub})</small>` : ''}<span class="role" style="background:${ROLE_COLOR[def.role]}">${ROLE_NAME[def.role]}</span></div>
    <div class="tt-sub">${partners.length}/2 條線${live ? `　· 帶電 ${PHASE_NAME[live] ?? live} 相` : ''}${canWire() ? (pending ? '　· 點擊完成拉線' : '　· 點擊開始拉線') : ''}</div>
    <div class="tt-to">${to}</div>`;
}

/* ---------- 面板 ---------- */
/** 兩塊板子（器具板、操作面板）畫在同一張畫布上 */
function makeBoard(): PanelView {
  const host = document.querySelector<HTMLElement>('.panel-wrap')!;
  return new PanelView(host, q, {
    canWire,
    countAt: tid => store.countAt(tid),
    terminalClick: tid => onTerminal(tid),
    terminalHover: (tid, x, y) => onTerminalHover(tid, x, y),
    deviceHover: dev => onDeviceHover(dev),
    deviceClick: dev => { sfx.click(); cardPinned = cardPinned === dev ? null : dev; updateCard(); },
    deviceOpen: dev => openSettings(dev),
    wireClick: wid => { sfx.click(); store.update({ selectedWire: store.state.selectedWire === wid ? null : wid }); },
    wireHover: wid => board.setHoverWire(wid),
    backgroundClick: () => { cardPinned = null; if (pending) cancelPending(); else if (store.state.selectedWire) store.update({ selectedWire: null }); else updateCard(); },
    contextMenu: (kind, id, x, y) => showMenu(x, y, menuItems(kind, id, x, y)),
    middleClick: (tid, dev, x, y) => summonSchem(tid, dev, x, y),
    viewChanged: () => updateCard(),
    press: (dev, down) => { act(s => s.press(dev, down)); if (down && sim) sfx.click(); },
    nfbToggle: () => { if (sim) { act(s => s.nfb(!s.nfbOn)); sfx.click(); } },
    thryTrip: on => { if (sim) { act(s => s.trip('THRY', on)); sfx.click(); toast(on ? 'TH-RY 跳脫（模擬過載）' : 'TH-RY 復歸', on ? 'bad' : 'ok'); } },
  });
}
const board = makeBoard();

let hoverTid: string | null = null;
let hoverAt = { x: 0, y: 0 };

/** 端子詳情：跟著游標的浮動提示框 */
function applyTerminalDetail(): void {
  if (!hoverTid) { hideTooltip(); return; }
  showTooltip(terminalDetail(hoverTid, true), hoverAt.x, hoverAt.y);
}

function onTerminalHover(tid: string | null, x: number, y: number): void {
  hoverTid = tid; hoverAt = { x, y };
  // 單線圖：這個端子所在的節點（那條線）亮起
  schem?.setHover(tid ? { terms: [tid] } : {});
  applyTerminalDetail();
  board.setHoverTerminal(tid);
}

/* ---------- 單線圖（教學互動） ---------- */
/** 面板器具 → 單線圖上的器具（引接小 TB 對應到本體；TB3/TB4 無符號） */
const schemDev = (dev: string | null): string | null => {
  if (!dev) return null;
  const base = dev.endsWith('_TB') ? dev.slice(0, -3) : dev;
  return schem?.has(base) ? base : null;
};
// 考場引接線：器具本體端子 ↔ 引接小 TB 端子（過門線 TB3↔TB4 不算）
const preLinks = q.passThrough.filter(p => !p.a.startsWith('TB3.'));
const toBody = new Map(preLinks.map(p => [p.b, p.a]));
const toSmallTb = new Map(preLinks.map(p => [p.a, p.b]));
const refNets = referenceNets(teacherWiresOf(q), q.passThrough);
const schem = q.schematic ? new SchematicWindow(q.schematic, {
  netOf: tid => refNets.root(tid),
  body: tid => toBody.get(tid) ?? tid,
  color: dev => q.devices.find(d => d.id === dev)?.color,
}, {
  // 圖上滑到符號 → 面板上的器具與這個接點實際要接的端子（按鈕／燈是在引接小 TB 上接）
  hoverSym: (sym, dev) => {
    if (!sym && !dev) { board.setSchemHighlight([]); return; }
    const d = sym?.dev ?? dev!;
    const terms = sym ? sym.t.flatMap(t => [t, toSmallTb.get(t) ?? '']).filter(Boolean) : [];
    board.setSchemHighlight([d, `${d}_TB`], terms);
  },
  clickSym: dev => board.panToDevice(dev),
}) : null;

/** 中鍵／D 鍵：已開就收起；沒開就在游標旁叫出，並聚焦到游標下的端子（它所在的那段線）或器具 */
function summonSchem(tid: string | null, dev: string | null, x: number, y: number): void {
  if (!schem) return;
  if (schem.isOpen) { schem.close(); return; }
  const d = schemDev(dev ?? (tid ? tid.slice(0, tid.lastIndexOf('.')) : null));
  schem.openAt(x, y, { terms: tid ? [tid] : [], devs: !tid && d ? [d] : [] });
}
// 記住游標位置與它底下的端子／器具，給 D 鍵用
let mouseAt = { x: innerWidth / 2, y: innerHeight / 2 };
window.addEventListener('pointermove', e => { mouseAt = { x: e.clientX, y: e.clientY }; }, { passive: true });

/** 固定放大的器具上已選過端子後，滑鼠移出它（到別的器具或空白）就自動還原，才能去接下一個端子 */
function onDeviceHover(dev: string | null): void {
  const sd = schemDev(dev); if (!hoverTid) schem?.setHover({ devs: sd ? [sd] : [] });
  if (cardPinned && pinArmed && dev !== cardPinned) { cardPinned = null; updateCard(); }
}
function closePopovers(): void { cardPinned = null; }

const panelOf = (tid: string): PanelId | null => terminalInfo(tid).inst?.panel ?? null;

function onTerminal(tid: string): void {
  if (cardPinned && tid.slice(0, tid.lastIndexOf('.')) === cardPinned) pinArmed = true;
  const panel = panelOf(tid);
  if (!panel) return;
  if (!pending) {
    if (store.countAt(tid) >= 2) { sfx.error(); toast(`${tid} 已接 2 條線（端子容量上限）`, 'bad'); return; }
    pending = tid;
    sfx.pick();
    board.setPending(tid);
    board.dimExcept(panel);
    toast(`從 ${tid} 拉線中…點另一端子完成（Esc 取消）`);
    render();
    return;
  }
  if (pending === tid) { cancelPending(); return; }
  if (panelOf(pending) !== panel) { sfx.error(); toast('器具板與操作面板之間要經過 TB3 ↔ TB4 過門線，不能直接連', 'bad'); return; }
  if (store.countAt(tid) >= 2) { sfx.error(); toast(`${tid} 已接 2 條線`, 'bad'); return; }
  if (store.hasWire(pending, tid)) { sfx.error(); toast('這兩個端子已經有導線', 'bad'); return; }
  if (isGroundTerm(q.devices, pending) !== isGroundTerm(q.devices, tid)) { sfx.error(); toast('接地端子只能與接地端子相接（G ↔ E，8mm² 綠線）', 'bad'); return; }
  const a = pending;
  if (store.state.mode === 'guide' && !guideAccepts(a, tid)) {
    sfx.error();
    toast(`步驟 ${q.teacherSteps[store.state.guideStep]?.n} 沒有這條線：${a} ↔ ${tid}`, 'bad');
    cancelPending();
    return;
  }
  undoStack.push([...store.state.wires]);
  pending = null;
  board.setPending(null); board.dimExcept(null);
  closePopovers();
  store.addWire(a, tid, panel);
  sfx.connect();
  toast(`已接 ${a} ↔ ${tid}`, 'ok');
  if (store.state.mode === 'guide') advanceGuide();
  continueThroughDoor(a, tid);
}

/** TB3.n ↔ TB4.n 過門線的另一端 */
function doorPartner(tid: string): string | null {
  const p = q.passThrough.find(l => l.a.startsWith('TB3.') && (l.a === tid || l.b === tid));
  return p ? (p.a === tid ? p.b : p.a) : null;
}
/** 接到 TB3.n（或 TB4.n）之後，自動從另一塊板的對應點接續拉線，鏡頭跟過去 */
function continueThroughDoor(a: string, b: string): void {
  const end = doorPartner(a) ? a : doorPartner(b) ? b : null;
  if (!end) return;
  const next = doorPartner(end)!;
  const panel = panelOf(next);
  // 對面那點已經有線（例如剛從那邊過門過來）就不再接續，避免兩邊乒乓
  if (!panel || store.countAt(next) > 0 || store.countAt(end) !== 1) return;
  if (store.state.mode === 'guide' && !guideRemaining(store.state.guideStep).some(([x, y]) => x === next || y === next)) return;
  pending = next;
  mobilePanel = panel; hud.setMobileState(panel, mobileSide);
  board.setPending(next); board.dimExcept(panel);
  board.doorPulse(end, next);
  board.panTo(next);
  sfx.pick();
  toast(`已接 ${a} ↔ ${b}　→ 過門線接續：從 ${next} 繼續拉線（Esc 取消）`, 'ok');
  render();
}

function cancelPending(): void {
  pending = null;
  board.setPending(null); board.dimExcept(null);
  render();
}

function removeWire(id: string): void {
  undoStack.push([...store.state.wires]);
  store.removeWire(id);
  sfx.remove();
}
/** 刪除某端子／某器具上的所有導線（一次可復原） */
function removeWiresWhere(pred: (w: Wire) => boolean, what: string): void {
  const ids = store.state.wires.filter(pred).map(w => w.id);
  if (!ids.length) return;
  undoStack.push([...store.state.wires]);
  for (const id of ids) store.removeWire(id);
  sfx.remove();
  toast(`已刪除 ${what} 的 ${ids.length} 條線（Ctrl+Z 復原）`, 'ok');
}

/* ---------- 右鍵選單 ---------- */
const wireName = (w: Wire) => `${w.a} ↔ ${w.b}`;
function menuItems(kind: 'terminal' | 'wire' | 'device' | 'blank', id: string | null, mx = 0, my = 0): MenuItem[] {
  const items: MenuItem[] = [];
  const devOf = (tid: string) => tid.slice(0, tid.lastIndexOf('.'));
  const pinItem = (dev: string): MenuItem => ({
    label: cardPinned === dev ? '解除固定' : '放大並固定',
    hint: cardPinned === dev ? 'Esc' : '',
    action: () => { cardPinned = cardPinned === dev ? null : dev; updateCard(); },
  });
  const devWires = (dev: string) => store.state.wires.filter(w => devOf(w.a) === dev || devOf(w.b) === dev);

  if (kind === 'terminal' && id) {
    const tid = id, n = store.countAt(tid);
    if (canWire()) {
      if (pending && pending !== tid) items.push({ label: `完成拉線 ${pending} ↔ ${tid}`, disabled: n >= 2, action: () => onTerminal(tid) });
      else if (pending === tid) items.push({ label: '取消拉線', hint: 'Esc', action: cancelPending });
      else items.push({ label: `從 ${tid} 開始拉線`, hint: n >= 2 ? '已滿 2 條' : `${n}/2`, disabled: n >= 2, action: () => onTerminal(tid) });
      const here = store.state.wires.filter(w => w.a === tid || w.b === tid);
      if (here.length) items.push({ sep: true });
      for (const w of here) items.push({ label: `刪除 ${wireName(w)}`, danger: true, action: () => { removeWire(w.id); toast(`已刪除 ${wireName(w)}`, 'ok'); } });
    }
    items.push({ sep: true }, pinItem(devOf(tid)));
  } else if (kind === 'wire' && id) {
    const w = store.state.wires.find(x => x.id === id);
    if (w) {
      const sel = store.state.selectedWire === w.id;
      items.push({ label: sel ? '取消選取' : `選取 ${wireName(w)}`, action: () => store.update({ selectedWire: sel ? null : w.id }) });
      items.push({ label: '定位到另一端', action: () => { store.update({ selectedWire: w.id }); board.focusTerminal(w.b, 2.6); } });
      if (canWire()) items.push({ sep: true }, { label: `刪除 ${wireName(w)}`, hint: 'Delete', danger: true, action: () => { removeWire(w.id); toast(`已刪除 ${wireName(w)}`, 'ok'); } });
    }
  } else if (kind === 'device' && id) {
    const inst = q.devices.find(d => d.id === id);
    const name = inst?.label ?? id;
    items.push(pinItem(id), { label: '⚙ 設定…', hint: '雙擊', action: () => openSettings(id) });
    if (sim && id === 'THRY') { const tr = !!sim.state.get('THRY')?.tripped; items.push({ label: tr ? 'TH-RY 復歸' : 'TH-RY 跳脫（模擬過載）', danger: !tr, action: () => act(s => s.trip('THRY', !tr)) }); }
    const ws = devWires(id);
    if (canWire() && ws.length) items.push({ sep: true }, { label: `刪除 ${name} 的所有導線`, hint: `${ws.length} 條`, danger: true, action: () => removeWiresWhere(w => devOf(w.a) === id || devOf(w.b) === id, name) });
  }

  if (pending) items.push({ sep: true }, { label: '取消拉線', hint: 'Esc', action: cancelPending });
  items.push({ sep: true },
    { label: '復原', hint: 'Ctrl+Z', disabled: !undoStack.length, action: undo },
    { sep: true },
    { label: '全景', hint: 'F / 0', action: showAll },
    { label: schem?.isOpen ? '收起單線圖' : kind === 'terminal' ? '在單線圖上看這個端子' : kind === 'device' ? '在單線圖上看這個器具' : '單線圖', hint: '中鍵 / D',
      action: () => summonSchem(kind === 'terminal' ? id : null, kind === 'device' ? id : null, mx, my) },
  );
  return items;
}

function undo(): void {
  const prev = undoStack.pop();
  if (!prev) { toast('沒有可復原的步驟'); return; }
  store.setWires(prev);
  toast('已復原', 'ok');
}

/* ---------- 資訊卡 ---------- */
const card = new InfoCard(document.getElementById('info-card')!, q, {
  canWire,
  terminalClick: tid => onTerminal(tid),
  terminalHover: (tid, x, y) => onTerminalHover(tid, x, y),
  togglePin: () => { cardPinned = cardPinned ? null : card.current(); updateCard(); },
  openSettings: () => { const id = card.current(); if (id) openSettings(id); },
});
function cardState() { return { wires: store.state.wires, pending, targets: guideTargets(), sim }; }
function updateCard(): void {
  const dev = cardPinned;
  if (!cardPinned) pinArmed = false;
  const st = cardState();
  const inst = dev ? q.devices.find(d => d.id === dev) : undefined;
  const showable = inst && !inst.display && defOf(inst.kind).terminals.some(t => t.wireable !== false);
  board.setPinned(canWire() && showable ? cardPinned : null);
  board.setDeviceFocus(dev);
  card.setDevice(dev ?? card.current(), !!cardPinned);
  card.refresh(st);
  applyTerminalDetail();
}

/* ---------- 器具設定視窗 ---------- */
function openSettings(id: string): void {
  const inst = q.devices.find(d => d.id === id);
  if (!inst) return;
  openDeviceDialog(inst, {
    q, wires: store.state.wires, defaultTimer: store.state.timerSec,
    apply: (devId, patch) => {
      store.setOverride(devId, patch);
      board.redrawDevice(devId);
      render();
      if (sim) board.setSim(sim);
      toast(patch ? `已套用 ${inst.label ?? devId} 的設定` : `已回復 ${devId} 的預設`, 'ok');
    },
  });
}

/* ---------- 步驟引導 ---------- */
function guidePairs(stepIdx: number): [string, string][] {
  const st = q.teacherSteps[stepIdx];
  return st ? expandChainOf(q.devices, st.chain, st.n).map(w => [w.a, w.b] as [string, string]) : [];
}
function guideRemaining(stepIdx: number): [string, string][] {
  return guidePairs(stepIdx).filter(([a, b]) => !store.hasWire(a, b));
}
function guideAccepts(a: string, b: string): boolean {
  return guideRemaining(store.state.guideStep).some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}
function guideTargets(): Set<string> {
  if (store.state.mode !== 'guide') return new Set();
  const next = guideRemaining(store.state.guideStep)[0];
  if (!next) return new Set();
  if (pending && (next[0] === pending || next[1] === pending)) return new Set([next[0] === pending ? next[1] : next[0]]);
  return new Set(next);
}
function advanceGuide(): void {
  let i = store.state.guideStep;
  while (i < q.teacherSteps.length && guideRemaining(i).length === 0) i++;
  if (i !== store.state.guideStep) {
    store.update({ guideStep: i });
    sfx.step();
    if (i < q.teacherSteps.length) toast(`步驟 ${q.teacherSteps[i - 1]?.n ?? ''} 完成 → 步驟 ${q.teacherSteps[i].n}`, 'ok');
    else toast(`${q.teacherSteps.length} 步驟全部完成！切到通電測試看看`, 'ok');
  }
}
function guideJump(i: number): void { store.update({ guideStep: Math.max(0, Math.min(q.teacherSteps.length, i)) }); }

/* ---------- 版面：兩塊板子在同一張畫布，分頁 / 1 2 / Q E 是把鏡頭轉到那塊板子 ---------- */
function showPanel(p: PanelId): void { mobilePanel = p; store.update({ panel: p }); hud.setMobileState(p, mobileSide); board.fitBoard(p); }
function showAll(): void { hud.setMobileState('all', mobileSide); board.fit(); }
function showSide(tab: 'card' | 'drawer'): void { mobileSide = tab; applyMobileLayout(); }
function applyMobileLayout(): void {
  sideEl.dataset.tab = mobileSide;
  hud.setMobileState('all', mobileSide);
}

/* ---------- 模式 ---------- */
function setMode(m: Mode): void {
  pending = null;
  board.setPending(null); board.dimExcept(null);
  if (m === 'sim') startSim(); else stopSim();
  store.update({ mode: m, selectedWire: null });
  if (m === 'guide') { advanceGuide(); hud.showTab('guide'); }
  if (m === 'sim') hud.showTab('sim');
  if (m === 'wire') hud.showTab('wires');
  if (isMobile()) showSide('drawer');
}
/** 通電測試中的使用者動作：先執行並重畫，再把這一波交給動作解說（有說明就暫停一步，讓「按下 FWD」先被看到） */
function act(fn: (s: Simulator) => void): void {
  if (!sim) return;
  fn(sim);
  render();
  board.setSim(sim);   // NFB 把手、TH-RY 跳脫旗、EMS 鎖定立刻反映（不等主迴圈，解說暫停時也一樣）
  scene.update(sim);
  hold(explain.ingest(sim.drainEvents()));
}
/** 解說開啟時，n 個階段依序演示完才繼續模擬 */
function hold(n: number): void { if (n && explain.enabled) holdUntil = performance.now() + n * explain.stepMs(); }
function startSim(): void {
  sim = new Simulator(q, store.state.wires, { timerSec: store.state.timerSec, trace: true });
  explain.begin(store.state.wires);
  scene.update(sim);
  holdUntil = 0; dipRestoreAt = null;
  if (simTimer) clearInterval(simTimer);
  let warned = false;
  simTimer = window.setInterval(() => {
    if (!sim) return;
    if (performance.now() < holdUntil) return;
    if (dipRestoreAt !== null && sim.elapsedMs >= dipRestoreAt) {
      dipRestoreAt = null;
      if (!sim.nfbOn) { act(s => s.nfb(true, '復電')); toast('復電', 'ok'); }
      return;
    }
    sim.tick();
    hold(explain.ingest(sim.drainEvents()));
    board.setSim(sim);
    scene.update(sim);
    sfx.buzzer(sim.energized.has('BZ.buzzer'));
    hud.render(sim);
    card.refresh(cardState());
    if (sim.shortCircuit && !warned) { warned = true; sfx.error(); toast('短路！D-F 燒斷，請檢查接線', 'bad'); }
  }, 50);
}
function stopSim(): void {
  scene.update(null);
  if (simTimer) clearInterval(simTimer);
  simTimer = null; sim = null;
  dipRestoreAt = null;
  explain.end();
  sfx.buzzer(false);
  board.setSim(null);
}

/* ---------- 評審 ---------- */
function locate(terminals: string[]): void {
  const t = terminals[0];
  const { inst } = terminalInfo(t);
  if (!inst) return;
  cardPinned = inst.id; updateCard();
  setTimeout(() => { board.focusTerminal(t, 3.2); board.setHighlight([], terminals); }, 50);
}
function doGrade(): void {
  const r = grade(q, store.state.wires, store.state.timerSec);
  if (r.pass) sfx.step(); else sfx.error();
  showReport(r, locate);
}

/* ---------- HUD ---------- */
const hud = new Hud(q, store, {
  setMode, grade: doGrade,
  autoWire: () => { undoStack.push([...store.state.wires]); store.setWires(teacherWiresOf(q).map(w => ({ ...w }))); store.update({ guideStep: q.teacherSteps.length }); toast('已載入參考接線', 'ok'); },
  showImage: which => { if (which === 'circuit' && schem) schem.toggle(); else showImage(q.images[which], which === 'circuit' ? '控制電路圖' : '器具位置圖'); },
  showLibrary,
  hoverWire: id => board.setHoverWire(id),
  removeWire,
  focusWire: id => {
    const w = store.state.wires.find(x => x.id === id); if (!w) return;
    store.update({ selectedWire: id });
    board.focusTerminal(w.a, 2.6);
  },
  resetAll: () => { if (confirm('清除所有導線與計時，重新開始？')) { undoStack.push([...store.state.wires]); store.resetAll(); toast('已重來'); } },
  exportJSON: () => {
    const blob = new Blob([store.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${q.id}-wires.json`; a.click();
  },
  importJSON: () => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json';
    inp.onchange = async () => { const f = inp.files?.[0]; if (!f) return; try { undoStack.push([...store.state.wires]); const ovr = store.importJSON(await f.text()); if (ovr) for (const d of q.devices) board.redrawDevice(d.id); toast('匯入完成', 'ok'); } catch (e) { toast(`匯入失敗：${(e as Error).message}`, 'bad'); } };
    inp.click();
  },
  toggleTimer: () => store.toggleTimer(),
  simNfb: on => act(s => s.nfb(on)),
  simTrip: on => act(s => s.trip('THRY', on)),
  // 模擬瞬時停電：NFB 切離 1 秒再投入
  powerDip: () => {
    if (!sim || !sim.nfbOn) { toast('先投入 NFB 再模擬停電'); return; }
    // 復電時刻用模擬時間排程：動作解說放慢時仍是「停電 1 秒」
    act(s => s.nfb(false, '停電')); toast('停電 1 秒…', 'bad');
    dipRestoreAt = sim.elapsedMs + 1000;
  },
  questions: QUESTIONS.map(x => ({ id: x.id, title: x.title })),
  switchQuestion: id => { if (id !== q.id) switchQuestion(id); },
  simTimer: sec => { store.update({ timerSec: sec }); if (sim) sim.timerMs = sec * 1000; },
  guideJump,
  toggleSound: () => { sfx.setEnabled(!sfx.isEnabled()); return sfx.isEnabled(); },
  showPanel, showAll, showSide,
  undo,
  openDrill,
});
/* ---------- 動作解說（通電測試分頁） ---------- */
const explain = new Explainer(q, board, schem);
hud.mount('sim', explain.el);


/* ---------- render ---------- */
/* ---------- 場景動畫（通電分頁最上面；⧉ 可浮到畫布上） ---------- */
const scene = new Scene(q);
const sceneWin = new FloatWin('場景：電動機');
scene.onFloat = () => sceneWin.toggle(scene.root);
hud.mountTop('sim', scene.root);

function render(): void {
  const s = store.state;
  const targets = guideTargets();
  board.setWires(s.wires, s.selectedWire);
  board.setTargets(targets);
  board.setHighlight([], []);
  hud.render(sim);
  if (s.mode !== 'guide') schem?.setGuide([], '');
  if (s.mode === 'guide') {
    const rem = guideRemaining(s.guideStep);
    const all = guidePairs(s.guideStep).flat();
    const next = rem[0] ?? [];
    board.setHighlight(all, next);
    if (next.length) {
      const { inst } = terminalInfo(next[0]);
      if (inst && inst.panel !== mobilePanel && !pending) setTimeout(() => { if (store.state.mode === 'guide') showPanel(inst.panel); }, 500);
      hud.setGuideNext(`下一條：<b>${next[0]}</b> ↔ <b>${next[1]}</b>${inst ? `　（${q.panels[inst.panel].name}）` : ''}`, `${next[0]} ↔ ${next[1]}`);
      const step = q.teacherSteps[s.guideStep];
      schem?.setGuide(next, step ? `<b>步驟 ${step.n}</b>　${step.text}<br>下一條：<b>${next[0]}</b> ↔ <b>${next[1]}</b>（圖上紅色那一段）` : '');
    } else { hud.setGuideNext(''); schem?.setGuide([], ''); }
  }
  updateCard();
}
store.on(render);

/* ---------- 練習模式（全螢幕，不動接線狀態） ---------- */
let drill: DrillView | null = null;
function openDrill(): void {
  if (store.state.mode === 'sim') setMode('wire');   // 通電中先停掉模擬（蜂鳴器、解說）
  if (pending) cancelPending();
  hideTooltip();
  drill ??= new DrillView({ q, onClose: () => render() });
  drill.open();
}

/* ---------- 鍵盤 ---------- */
window.addEventListener('keydown', ev => {
  if (drill?.isOpen) return;
  const tag = (ev.target as HTMLElement).tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') { ev.preventDefault(); undo(); return; }
  switch (ev.key) {
    case 'f': case 'F': case '0': showAll(); break;
    case 'Escape': if (pending) cancelPending(); else if (schem?.isOpen) schem.close(); else if (cardPinned) { cardPinned = null; updateCard(); } document.getElementById('modal')!.hidden = true; break;
    case 'Delete': case 'Backspace': if (store.state.selectedWire) removeWire(store.state.selectedWire); break;
    case 'd': case 'D': {
      const t = document.elementFromPoint(mouseAt.x, mouseAt.y);
      summonSchem(t?.closest('.panel-wrap .term')?.getAttribute('data-tid') ?? null, t?.closest('.panel-wrap .device')?.getAttribute('data-dev') ?? null, mouseAt.x, mouseAt.y);
      break;
    }
    case '1': case 'q': case 'Q': showPanel('device'); break;
    case '2': case 'e': case 'E': showPanel('operator'); break;
  }
});
window.addEventListener('resize', applyMobileLayout);

/* ---------- 啟動 ---------- */
if (store.state.mode === 'sim') store.state.mode = 'wire';
applyMobileLayout();
render();
try { if (new URLSearchParams(location.search).has('drill')) openDrill(); } catch { /* ignore */ }
setInterval(() => { if (store.timerRunning()) hud.render(sim); }, 1000);
