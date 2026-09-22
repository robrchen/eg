import { Q2_1, expandChain, teacherWires } from './model/questions/q2-1';
import type { PanelId, Wire } from './model/types';
import { defOf, ROLE_COLOR, ROLE_NAME } from './library';
import { Store, type Mode } from './store';
import { Simulator } from './engine/simulator';
import { grade } from './engine/grader';
import { PanelView } from './view/panel';
import { InfoCard } from './view/infoCard';
import { DevicePopover } from './view/popover';
import { Hud } from './view/hud';
import { showImage, showReport } from './view/report';
import { showLibrary } from './view/library';
import { showTooltip, hideTooltip } from './view/tooltip';
import { sfx } from './view/sfx';

const q = Q2_1;
const store = new Store(q);
const toastEl = document.getElementById('toast')!;
const sideEl = document.getElementById('side')!;

let pending: string | null = null;
let sim: Simulator | null = null;
let simTimer: number | null = null;
let cardPinned: string | null = null;   // 點器具釘選（彈出面板與側欄資訊卡都跟著）
let popHover: string | null = null;     // 指標目前停在哪個器具
let popInside = false;                  // 指標是否在彈出面板上
let popSwitchTimer = 0;                 // 換到另一個器具的緩衝計時
let popHideTimer = 0;
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
    <div class="tt-sub">${partners.length}/2 條線${live ? `　· 帶電 ${live} 相` : ''}${canWire() ? (pending ? '　· 點擊完成拉線' : '　· 點擊開始拉線') : ''}</div>
    <div class="tt-to">${to}</div>`;
}

/* ---------- 面板 ---------- */
function makePanel(id: PanelId): PanelView {
  const host = document.querySelector<HTMLElement>(`.panel-wrap[data-panel="${id}"]`)!;
  return new PanelView(host, q, id, {
    canWire,
    countAt: tid => store.countAt(tid),
    terminalClick: tid => onTerminal(tid),
    terminalHover: (tid, x, y) => onTerminalHover(tid, x, y),
    deviceHover: dev => onDeviceHover(dev),
    deviceClick: dev => { sfx.click(); cardPinned = cardPinned === dev ? null : dev; popHover = null; updateCard(); },
    wireClick: wid => { sfx.click(); store.update({ selectedWire: store.state.selectedWire === wid ? null : wid }); },
    wireHover: wid => { for (const p of Object.values(panels)) p.setHoverWire(wid); },
    backgroundClick: () => { cardPinned = null; if (pending) cancelPending(); else if (store.state.selectedWire) store.update({ selectedWire: null }); else updateCard(); },
    viewChanged: () => updateCard(),
    press: (dev, down) => { sim?.press(dev, down); if (down) sfx.click(); },
    nfbToggle: () => { if (sim) { sim.nfb(!sim.nfbOn); sfx.click(); render(); } },
  });
}
const panels: Record<PanelId, PanelView> = { device: makePanel('device'), operator: makePanel('operator') };

/** 端子詳情的來源：面板 SVG / 器具滑出面板 / 右側資訊卡 */
type HoverSrc = 'panel' | 'pop' | 'card';
let hoverTid: string | null = null;
let hoverSrc: HoverSrc = 'panel';
let hoverAt = { x: 0, y: 0 };

/** 該端子所屬器具的滑出面板正開著就回傳它 */
function popShowing(tid: string): DevicePopover | null {
  const dev = tid.slice(0, tid.lastIndexOf('.'));
  for (const p of Object.values(popovers)) if (p.visible() && p.current() === dev) return p;
  return null;
}

/**
 * 同一器具只留一個提示面板：滑出面板開著時，端子詳情附掛在面板內；
 * 面板沒開（或來源是資訊卡）才用跟著游標的浮動提示框。
 */
function applyTerminalDetail(): void {
  for (const p of Object.values(popovers)) p.setTerminalDetail(null);
  if (!hoverTid) { hideTooltip(); return; }
  const pop = hoverSrc === 'card' ? null : popShowing(hoverTid);
  if (pop) { pop.setTerminalDetail(terminalDetail(hoverTid, false)); hideTooltip(); }
  else if (hoverSrc === 'pop') hideTooltip();
  else showTooltip(terminalDetail(hoverTid, true), hoverAt.x, hoverAt.y);
}

function onTerminalHover(tid: string | null, x: number, y: number, src: HoverSrc = 'panel'): void {
  hoverTid = tid; hoverSrc = src; hoverAt = { x, y };
  applyTerminalDetail();
  if (!tid) { for (const p of Object.values(panels)) p.setHoverTerminal(null); return; }
  for (const p of Object.values(panels)) if (p.hasTerminal(tid)) p.setHoverTerminal(tid);
}

/* ---------- 滑出接點面板 ---------- */
function makePop(id: PanelId): DevicePopover {
  return new DevicePopover(panels[id].root, q, !!q.panels[id].mirror, {
    canWire,
    terminalClick: tid => onTerminal(tid),
    terminalHover: (tid, x, y) => onTerminalHover(tid, x, y, 'pop'),
    enter: () => { popInside = true; clearTimeout(popHideTimer); clearTimeout(popSwitchTimer); },
    leave: () => { popInside = false; schedulePopHide(); },
    move: (x, y) => panels[id].rubberTo(x, y),
  });
}
const popovers: Record<PanelId, DevicePopover> = { device: makePop('device'), operator: makePop('operator') };

function onDeviceHover(dev: string | null): void {
  clearTimeout(popSwitchTimer);
  if (!dev) { schedulePopHide(); return; }
  clearTimeout(popHideTimer);
  if (dev === popHover) return;
  // 已經有面板開著時，換到別的器具先緩一下：
  // 滑鼠往那個面板移動的途中會掠過旁邊的器具，直接換掉就點不到原本要點的面板
  const open = popHover !== null && Object.values(popovers).some(p => p.visible());
  if (open) popSwitchTimer = window.setTimeout(() => { popHover = dev; updateCard(); }, 180);
  else { popHover = dev; updateCard(); }
}
function schedulePopHide(): void {
  clearTimeout(popHideTimer);
  popHideTimer = window.setTimeout(() => { if (!popInside && popHover) { popHover = null; updateCard(); } }, 140);
}
function closePopovers(): void { popHover = null; cardPinned = null; popInside = false; clearTimeout(popHideTimer); clearTimeout(popSwitchTimer); }

const panelOf = (tid: string): PanelId | null => terminalInfo(tid).inst?.panel ?? null;

function onTerminal(tid: string): void {
  const panel = panelOf(tid);
  if (!panel) return;
  if (!pending) {
    if (store.countAt(tid) >= 2) { sfx.error(); toast(`${tid} 已接 2 條線（端子容量上限）`, 'bad'); return; }
    pending = tid;
    sfx.pick();
    panels[panel].setPending(tid);
    panels[panel === 'device' ? 'operator' : 'device'].setDim(true);
    toast(`從 ${tid} 拉線中…點另一端子完成（Esc 取消）`);
    render();
    return;
  }
  if (pending === tid) { cancelPending(); return; }
  if (panelOf(pending) !== panel) { sfx.error(); toast('器具板與操作面板之間要經過 TB3 ↔ TB4 過門線，不能直接連', 'bad'); return; }
  if (store.countAt(tid) >= 2) { sfx.error(); toast(`${tid} 已接 2 條線`, 'bad'); return; }
  if (store.hasWire(pending, tid)) { sfx.error(); toast('這兩個端子已經有導線', 'bad'); return; }
  const a = pending;
  if (store.state.mode === 'guide' && !guideAccepts(a, tid)) {
    sfx.error();
    toast(`步驟 ${q.teacherSteps[store.state.guideStep]?.n} 沒有這條線：${a} ↔ ${tid}`, 'bad');
    cancelPending();
    return;
  }
  undoStack.push([...store.state.wires]);
  pending = null;
  for (const p of Object.values(panels)) { p.setPending(null); p.setDim(false); }
  closePopovers();
  store.addWire(a, tid, panel);
  sfx.connect();
  toast(`已接 ${a} ↔ ${tid}`, 'ok');
  if (store.state.mode === 'guide') advanceGuide();
}

function cancelPending(): void {
  pending = null;
  for (const p of Object.values(panels)) { p.setPending(null); p.setDim(false); }
  render();
}

function removeWire(id: string): void {
  undoStack.push([...store.state.wires]);
  store.removeWire(id);
  sfx.remove();
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
  terminalHover: (tid, x, y) => onTerminalHover(tid, x, y, 'card'),
  togglePin: () => { cardPinned = cardPinned ? null : card.current(); updateCard(); },
});
function cardState() { return { wires: store.state.wires, pending, targets: guideTargets(), sim }; }
function updateCard(): void {
  // 釘選優先：點過的器具面板固定住，滑過旁邊器具不會被換掉
  const dev = cardPinned ?? popHover;
  const st = cardState();
  for (const pid of Object.keys(panels) as PanelId[]) {
    const pv = panels[pid], pop = popovers[pid];
    const inst = dev ? q.devices.find(d => d.id === dev) : undefined;
    const showable = inst && inst.panel === pid && !inst.display && defOf(inst.kind).terminals.some(t => t.wireable !== false);
    if (showable) { const r = pv.deviceRect(inst.id); if (r) { pop.setPinned(cardPinned === inst.id); pop.show(inst.id, r); pop.refresh(st); } }
    else pop.hide();
    pv.setDeviceFocus(dev);
  }
  card.setDevice(dev ?? card.current(), !!cardPinned);
  card.refresh(st);
  applyTerminalDetail();
}

/* ---------- 步驟引導 ---------- */
function guidePairs(stepIdx: number): [string, string][] {
  const st = q.teacherSteps[stepIdx];
  return st ? expandChain(st.chain, st.n).map(w => [w.a, w.b] as [string, string]) : [];
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
    else toast('18 步驟全部完成！切到通電測試看看', 'ok');
  }
}
function guideJump(i: number): void { store.update({ guideStep: Math.max(0, Math.min(q.teacherSteps.length, i)) }); }

/* ---------- 手機版面 ---------- */
function showPanel(p: PanelId): void { mobilePanel = p; store.update({ panel: p }); applyMobileLayout(); }
function showSide(tab: 'card' | 'drawer'): void { mobileSide = tab; applyMobileLayout(); }
function applyMobileLayout(): void {
  const mobile = isMobile();
  for (const [id, pv] of Object.entries(panels)) pv.root.dataset.hidden = mobile && id !== mobilePanel ? '1' : '0';
  sideEl.dataset.tab = mobileSide;
  hud.setMobileState(mobilePanel, mobileSide);
  requestAnimationFrame(() => { for (const p of Object.values(panels)) p.fit(); });
}

/* ---------- 模式 ---------- */
function setMode(m: Mode): void {
  pending = null;
  for (const p of Object.values(panels)) { p.setPending(null); p.setDim(false); }
  if (m === 'sim') startSim(); else stopSim();
  store.update({ mode: m, selectedWire: null });
  if (m === 'guide') { advanceGuide(); hud.showTab('guide'); }
  if (m === 'sim') hud.showTab('sim');
  if (m === 'wire') hud.showTab('wires');
  if (isMobile()) showSide('drawer');
}
function startSim(): void {
  sim = new Simulator(q, store.state.wires, { timerSec: store.state.timerSec });
  if (simTimer) clearInterval(simTimer);
  let warned = false;
  simTimer = window.setInterval(() => {
    if (!sim) return;
    sim.tick();
    for (const p of Object.values(panels)) p.setSim(sim);
    sfx.buzzer(sim.energized.has('BZ.buzzer'));
    hud.render(sim);
    card.refresh(cardState());
    for (const p of Object.values(popovers)) p.refresh(cardState());
    if (sim.shortCircuit && !warned) { warned = true; sfx.error(); toast('短路！D-F 燒斷，請檢查接線', 'bad'); }
  }, 50);
}
function stopSim(): void {
  if (simTimer) clearInterval(simTimer);
  simTimer = null; sim = null;
  sfx.buzzer(false);
  for (const p of Object.values(panels)) p.setSim(null);
}

/* ---------- 評審 ---------- */
function locate(terminals: string[]): void {
  const t = terminals[0];
  const { inst } = terminalInfo(t);
  if (!inst) return;
  if (isMobile()) showPanel(inst.panel);
  cardPinned = inst.id; updateCard();
  setTimeout(() => { panels[inst.panel].focusTerminal(t, 3.2); panels[inst.panel].setHighlight([], terminals); }, 50);
}
function doGrade(): void {
  const r = grade(q, store.state.wires, store.state.timerSec);
  if (r.pass) sfx.step(); else sfx.error();
  showReport(r, locate);
}

/* ---------- HUD ---------- */
const hud = new Hud(q, store, {
  setMode, grade: doGrade,
  autoWire: () => { undoStack.push([...store.state.wires]); store.setWires(teacherWires().map(w => ({ ...w }))); store.update({ guideStep: q.teacherSteps.length }); toast('已載入老師標準接線', 'ok'); },
  showImage: which => showImage(q.images[which], which === 'circuit' ? '控制電路圖' : '器具位置圖'),
  showLibrary,
  hoverWire: id => { for (const p of Object.values(panels)) p.setHoverWire(id); },
  removeWire,
  focusWire: id => {
    const w = store.state.wires.find(x => x.id === id); if (!w) return;
    if (isMobile()) showPanel(w.panel);
    store.update({ selectedWire: id });
    panels[w.panel].focusTerminal(w.a, 2.6);
  },
  resetAll: () => { if (confirm('清除所有導線與計時，重新開始？')) { undoStack.push([...store.state.wires]); store.resetAll(); toast('已重來'); } },
  exportJSON: () => {
    const blob = new Blob([store.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${q.id}-wires.json`; a.click();
  },
  importJSON: () => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json';
    inp.onchange = async () => { const f = inp.files?.[0]; if (!f) return; try { undoStack.push([...store.state.wires]); store.importJSON(await f.text()); toast('匯入完成', 'ok'); } catch (e) { toast(`匯入失敗：${(e as Error).message}`, 'bad'); } };
    inp.click();
  },
  toggleTimer: () => store.toggleTimer(),
  simNfb: on => { sim?.nfb(on); render(); },
  simTrip: on => { sim?.trip('THRY', on); render(); },
  simTimer: sec => { store.update({ timerSec: sec }); if (sim) sim.timerMs = sec * 1000; },
  guideJump,
  toggleSound: () => { sfx.setEnabled(!sfx.isEnabled()); return sfx.isEnabled(); },
  showPanel, showSide,
  undo,
});

/* ---------- render ---------- */
function render(): void {
  const s = store.state;
  const targets = guideTargets();
  for (const p of Object.values(panels)) {
    p.setWires(s.wires, s.selectedWire);
    p.setTargets(targets);
    p.setHighlight([], []);
  }
  hud.render(sim);
  if (s.mode === 'guide') {
    const rem = guideRemaining(s.guideStep);
    const all = guidePairs(s.guideStep).flat();
    const next = rem[0] ?? [];
    for (const p of Object.values(panels)) p.setHighlight(all, next);
    if (next.length) {
      const { inst } = terminalInfo(next[0]);
      if (inst && isMobile() && inst.panel !== mobilePanel && !pending) setTimeout(() => { if (store.state.mode === 'guide') showPanel(inst.panel); }, 500);
      hud.setGuideNext(`下一條：<b>${next[0]}</b> ↔ <b>${next[1]}</b>${inst ? `　（${q.panels[inst.panel].name}）` : ''}`);
    } else hud.setGuideNext('');
  }
  updateCard();
}
store.on(render);

/* ---------- 鍵盤 ---------- */
window.addEventListener('keydown', ev => {
  const tag = (ev.target as HTMLElement).tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') { ev.preventDefault(); undo(); return; }
  switch (ev.key) {
    case 'f': case 'F': for (const p of Object.values(panels)) p.fit(); break;
    case 'Escape': if (pending) cancelPending(); else if (cardPinned) { cardPinned = null; updateCard(); } document.getElementById('modal')!.hidden = true; break;
    case 'Delete': case 'Backspace': if (store.state.selectedWire) removeWire(store.state.selectedWire); break;
    case '1': if (isMobile()) showPanel('device'); break;
    case '2': if (isMobile()) showPanel('operator'); break;
  }
});
window.addEventListener('resize', applyMobileLayout);

/* ---------- 啟動 ---------- */
if (store.state.mode === 'sim') store.state.mode = 'wire';
applyMobileLayout();
render();
setInterval(() => { if (store.timerRunning()) hud.render(sim); }, 1000);
