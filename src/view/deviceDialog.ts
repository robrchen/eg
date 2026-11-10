import type { DeviceInstance, QuestionDef, Wire } from '../model/types';
import type { DeviceOverride } from '../store';
import { defOf, KIND_NAME, ROLE_COLOR, specOf } from '../library';
import { buildDeviceDiagram } from './deviceDiagram';
import { preSource, spareTerminals } from '../model/preWired';
import { openModal, closeModal } from './report';

export interface DialogDeps {
  q: QuestionDef;
  wires: Wire[];
  /** 通電分頁滑桿的秒數（計時器未個別設定時用它） */
  defaultTimer: number;
  /** 套用設定（patch 為 null＝回復預設） */
  apply(id: string, patch: DeviceOverride | null): void;
}

const h = (tag: string, cls = '', html = ''): HTMLElement => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
const field = (label: string, input: HTMLElement, hint = ''): HTMLElement => {
  const w = h('label', 'dlg-field');
  w.append(h('span', 'dlg-label', label), input);
  if (hint) w.appendChild(h('small', 'dlg-hint', hint));
  return w;
};
const inputEl = (type: string, value: string): HTMLInputElement => { const i = document.createElement('input'); i.type = type; i.value = value; i.className = 'dlg-input'; return i; };

/**
 * 器具設定視窗（SimuCir 風「Configurar」）：標籤、用途、計時秒數、顏色、自鎖；右側腳位示意與接線去向。
 * 只改外觀與動作參數，不改腳位與接線。
 */
export function openDeviceDialog(d: DeviceInstance, deps: DialogDeps): void {
  const def = defOf(d.kind);
  const wrap = h('div', 'dev-dlg');
  const head = h('div', 'dev-dlg-head');
  head.append(h('span', 'id', d.id), h('span', 'kind', KIND_NAME[d.kind]));
  wrap.appendChild(head);
  const spec = specOf(d);
  if (spec) wrap.appendChild(h('div', 'card-note', `材料表規格：${spec}`));

  const body = h('div', 'dev-dlg-body');
  const form = h('div', 'dev-form');
  const side = h('div', 'dev-side');
  body.append(form, side);
  wrap.appendChild(body);

  /* ---- 表單 ---- */
  const label = inputEl('text', d.label ?? d.id); label.placeholder = d.id; label.maxLength = 12;
  form.appendChild(field('標籤', label, '面板上印在器具上的名字（預設為器具代號）'));
  const desc = inputEl('text', d.desc ?? ''); desc.placeholder = '例：正轉用'; desc.maxLength = 40;
  form.appendChild(field('用途說明', desc, '顯示在資訊卡與器具庫'));

  let timerRange: HTMLInputElement | null = null, timerFollow: HTMLInputElement | null = null, timerNum: HTMLInputElement | null = null;
  if (d.kind === 'TR' || d.kind === 'TRF') {
    const row = h('div', 'dlg-row');
    timerFollow = inputEl('checkbox', ''); timerFollow.checked = d.timerSec === undefined;
    const fl = h('label', 'inline'); fl.append(timerFollow, document.createTextNode(` 跟隨通電分頁的滑桿（目前 ${deps.defaultTimer} 秒）`));
    timerRange = inputEl('range', String(d.timerSec ?? deps.defaultTimer)); timerRange.min = '1'; timerRange.max = '30'; timerRange.step = '0.5';
    timerNum = inputEl('number', String(d.timerSec ?? deps.defaultTimer)); timerNum.min = '0.5'; timerNum.max = '60'; timerNum.step = '0.5'; timerNum.style.width = '72px';
    const sync = () => { const on = !timerFollow!.checked; timerRange!.disabled = !on; timerNum!.disabled = !on; };
    timerFollow.onchange = sync; sync();
    timerRange.oninput = () => { timerNum!.value = timerRange!.value; };
    timerNum.oninput = () => { timerRange!.value = timerNum!.value; };
    row.append(timerRange, timerNum, h('span', 'dlg-unit', '秒'));
    form.appendChild(field(d.kind === 'TRF' ? '斷電延遲時間' : '限時（Y→Δ 切換）秒數', row));
    form.appendChild(fl);
  }
  let color: HTMLInputElement | null = null, latch: HTMLInputElement | null = null;
  if (d.kind === 'PB' || d.kind === 'PL' || d.kind === 'BZ') {
    color = inputEl('color', toHex(d.color ?? '#999999'));
    const presets = h('div', 'dlg-swatches');
    for (const c of ['#e74c3c', '#2ecc71', '#f1c40f', '#3498db', '#ecf0f1', '#95a5a6', '#1f2328']) {
      const b = h('button', 'swatch'); b.style.background = c; (b as HTMLButtonElement).type = 'button'; b.title = c;
      b.onclick = () => { color!.value = c; };
      presets.appendChild(b);
    }
    const row = h('div', 'dlg-row'); row.append(color, presets);
    form.appendChild(field(d.kind === 'PB' ? '按鈕帽顏色' : d.kind === 'PL' ? '燈罩顏色' : '面板顏色', row));
  }
  if (d.kind === 'PB') {
    latch = inputEl('checkbox', ''); latch.checked = !!d.latch;
    const fl = h('label', 'inline'); fl.append(latch, document.createTextNode(' 自鎖（蕈狀 EMS：按一下鎖住、再按解除）'));
    form.appendChild(fl);
  }

  const btns = h('div', 'dlg-btns');
  const apply = h('button', 'btn primary', '套用') as HTMLButtonElement;
  const reset = h('button', 'btn', '回復預設') as HTMLButtonElement;
  const close = h('button', 'btn', '關閉') as HTMLButtonElement;
  btns.append(apply, reset, close);
  form.appendChild(btns);

  apply.onclick = () => {
    const patch: DeviceOverride = {};
    const lb = label.value.trim(); patch.label = lb && lb !== d.id ? lb : undefined;
    const ds = desc.value.trim(); patch.desc = ds || undefined;
    if (timerFollow) patch.timerSec = timerFollow.checked ? undefined : Math.max(0.5, Number(timerNum!.value) || deps.defaultTimer);
    if (color) patch.color = color.value;
    if (latch) patch.latch = latch.checked;
    deps.apply(d.id, patch);
    closeModal();
  };
  reset.onclick = () => { deps.apply(d.id, null); closeModal(); };
  close.onclick = closeModal;

  /* ---- 右側：腳位示意＋接線去向 ---- */
  const spare = spareTerminals(deps.q);
  const { root } = buildDeviceDiagram(def, {
    devId: d.id, displayOnly: true, compact: true,
    skip: id => spare.has(`${d.id}.${id}`),
    tag: id => { const s = preSource(deps.q, `${d.id}.${id}`); return s ? { label: s.label, role: s.role, title: `${d.id}.${id}　引接自 ${s.from}` } : null; },
    mirror: !!deps.q.panels[d.panel].mirror,
  });
  side.appendChild(root);
  const list = h('ul', 'card-list');
  const wireable = def.terminals.filter(t => t.wireable !== false && !d.display && !spare.has(`${d.id}.${t.id}`));
  for (const t of wireable) {
    const tid = `${d.id}.${t.id}`;
    const partners = deps.wires.filter(w => w.a === tid || w.b === tid).map(w => (w.a === tid ? w.b : w.a));
    const li = h('li');
    const src = preSource(deps.q, tid);
    const tag = h('span', 't', src?.label || t.label || '•'); tag.style.background = ROLE_COLOR[src?.role ?? t.role];
    li.append(tag, h('span', 'to', partners.length ? partners.map(p => `<b>${p}</b>`).join('、') : '<span class="none">尚未接線</span>'));
    list.appendChild(li);
  }
  if (wireable.length) side.appendChild(list);
  else side.appendChild(h('div', 'card-note', '此器具沒有可接線端子（考場已配妥，僅顯示）。'));

  openModal(wrap);
  label.focus(); label.select();
}

/** 顏色轉 #rrggbb（<input type=color> 只吃這個格式） */
function toHex(c: string): string {
  const s = c.trim();
  if (/^#[0-9a-f]{6}$/i.test(s)) return s.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(s)) return '#' + s.slice(1).split('').map(x => x + x).join('').toLowerCase();
  return '#999999';
}
