import type { QuestionDef, SumpScene as SumpMap } from '../model/types';
import { Simulator } from '../engine/simulator';
import { el, rect, text } from './art/svg';

const h = (tag: string, cls = '', html = ''): HTMLElement => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };

export interface SumpSceneEvents {
  /** 設定污水池水位 0～1 */
  level(v: number): void;
  /** 切換式器具（浮球用手抬起／放下）點一下 */
  toggle(dev: string): void;
}

/**
 * 污排水泵場景（第四題）：污水從左上流入污水池，池裡兩顆水銀浮球開關（BS1 高水位、BS2 異常水位）與兩台沉水泵，
 * 泵把水往上排出。泵接觸器吸合 → 葉輪轉、排水管有流動；水位依模擬器 level 畫。
 * 控制列：水位 −／＋、自動水位、進水量（一般／大量）、用手抬浮球；COS 在操作面板旋鈕上點。
 */
export class SumpScene {
  readonly root: HTMLElement;
  private svg: SVGSVGElement;
  private water: SVGRectElement;
  private inFlow: SVGPathElement;
  private floats: { id: string; ball: SVGCircleElement; cable: SVGLineElement; x: number; upY: number; downY: number }[] = [];
  private pumps: { body: SVGRectElement; imp: SVGGElement; flow: SVGPathElement; angle: number; speed: number; target: number; cx: number; cy: number }[] = [];
  private lvlText: SVGTextElement;
  private boxes = new Map<string, [SVGRectElement, SVGTextElement]>();
  private warn: SVGGElement; private warnText: SVGTextElement;
  private chips = new Map<string, HTMLElement>();
  private hydroChk: HTMLInputElement;
  private inflowBtn: HTMLButtonElement;
  private heavy = false;
  private map: SumpMap;
  private last = 0;
  private level = 0;
  onFloat?: () => void;

  /** 池子內緣：左、上、寬、高（水位 0～1 對到 TOP+H … TOP） */
  private static readonly TX = 92; private static readonly TOP = 42; private static readonly TW = 148; private static readonly TH = 126;
  private yOf(lv: number): number { return SumpScene.TOP + SumpScene.TH * (1 - lv); }

  constructor(private q: QuestionDef, private ev: SumpSceneEvents) {
    this.map = q.scene as SumpMap;
    const inst = (id?: string) => q.devices.find(d => d.id === id);
    const name = (id?: string) => inst(id)?.label ?? id ?? '';
    this.root = h('div', 'scene');
    const head = h('div', 'scene-head');
    head.append(h('b', '', '場景'), h('span', 'scene-sub', '污水池・兩台污排水泵・水銀浮球開關'));
    const fl = h('button', 'btn small', '⧉') as HTMLButtonElement; fl.title = '浮動視窗（可拖曳、改大小）';
    fl.onclick = () => this.onFloat?.();
    head.appendChild(fl);
    this.root.appendChild(head);

    /* ---------- SVG ---------- */
    const W = 360, H = 214;
    const { TX, TOP, TW, TH } = SumpScene;
    this.svg = el('svg', { viewBox: `0 0 ${W} ${H}` }, 'scene-svg');
    this.svg.appendChild(rect(0, 0, W, H, 10, 'sc-bg'));
    // 進水管（左上）
    const inPath = `M8,62 L${TX - 2},62`;
    this.svg.appendChild(el('path', { d: inPath }, 'sp-pipe'));
    this.inFlow = this.svg.appendChild(el('path', { d: inPath }, 'sp-flow'));
    this.svg.appendChild(text(46, 52, '污水流入', 6.5, 'sp-lbl'));
    // 污水池
    this.svg.appendChild(rect(TX - 2, TOP - 2, TW + 4, TH + 4, 3, 'sp-tank'));
    this.water = this.svg.appendChild(el('rect', { x: TX, y: TOP + TH, width: TW, height: 0, rx: 2 }, 'sp-water sump'));
    this.svg.appendChild(text(46, 84, '污水池', 7.5, 'sp-lbl'));
    // 水位刻度（右緣外）：低水位＝兩顆浮球落下、BS1 高水位、BS2 異常水位
    const bs = this.map.bs.map(id => inst(id));
    const marks: [number, string][] = [[bs[0]?.levelOff ?? .2, '低水位'], [bs[0]?.levelOn ?? .6, '高水位'], [bs[1]?.levelOn ?? .9, '異常水位']];
    for (const [lv, lb] of marks) {
      const y = this.yOf(lv);
      this.svg.appendChild(el('path', { d: `M${TX},${y} H${TX + TW + 6}` }, 'ss-mark'));
      this.svg.appendChild(text(TX + TW + 9, y + 2.4, lb, 6, 'ss-mark-lbl', 'start'));
    }
    // 泵（池底兩側）與排水管（往上、往右排出）
    const pumpsIds = this.map.pumps.slice(0, 2);
    pumpsIds.forEach((id, i) => {
      const cx = i === 0 ? TX + 22 : TX + TW - 22, cy = TOP + TH - 18;
      const outY = 12 + i * 10;
      const d = `M${cx},${cy - 14} L${cx},${outY} L352,${outY}`;
      this.svg.appendChild(el('path', { d }, 'sp-pipe'));
      const flow = this.svg.appendChild(el('path', { d }, 'sp-flow'));
      const body = this.svg.appendChild(rect(cx - 14, cy - 14, 28, 28, 6, 'sp-pump'));
      const imp = el('g', { transform: `rotate(0 ${cx} ${cy})` }, 'sp-imp');
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2;
        imp.appendChild(el('path', { d: `M${cx},${cy} L${cx + Math.cos(a) * 9.5},${cy + Math.sin(a) * 9.5} A9.5,9.5 0 0 1 ${cx + Math.cos(a + .7) * 9.5},${cy + Math.sin(a + .7) * 9.5} Z` }, 'sp-impeller'));
      }
      imp.appendChild(el('circle', { cx, cy, r: 2.6 }, 'sc-hub'));
      this.svg.appendChild(imp);
      this.svg.appendChild(text(cx, TOP + TH + 12, `M${i + 1} ${name(id)}`, 6.5, 'sp-pump-lbl'));
      this.pumps.push({ body, imp, flow, angle: 0, speed: 0, target: 0, cx, cy });
    });
    this.svg.appendChild(text(346, 42, '排出', 6.5, 'sp-lbl', 'end'));
    // 浮球（池中央兩顆）：浮起時停在自己的動作水位、落下時垂在低水位下方
    this.map.bs.slice(0, 2).forEach((id, i) => {
      const d = inst(id);
      const x = TX + TW / 2 + (i === 0 ? -16 : 16);
      const upY = this.yOf(d?.levelOn ?? (i ? .9 : .6)) + 1, downY = this.yOf((d?.levelOff ?? .2)) + 12 + i * 3;
      const cable = this.svg.appendChild(el('line', { x1: x, y1: TOP - 2, x2: x, y2: downY }, 'ss-cable'));
      const ball = this.svg.appendChild(el('circle', { cx: x, cy: downY, r: 6 }, 'sp-ball ss-ball'));
      ball.appendChild(el('title')).textContent = `${id}：點一下用手抬起／放下`;
      ball.addEventListener('click', () => this.ev.toggle(id));
      this.svg.appendChild(text(x, TOP - 6, id, 6, 'sp-lbl'));
      this.floats.push({ id, ball, cable, x, upY, downY });
    });
    this.lvlText = this.svg.appendChild(text(TX + 4, TOP + 10, '0%', 7, 'sp-lvl', 'start'));
    // 狀態盒：61F-G2、交互電驛、COS
    const box = (key: string, x: number, label: string) => {
      const b = this.svg.appendChild(rect(x, 190, 104, 18, 4, 'sp-box'));
      const t = this.svg.appendChild(text(x + 52, 202, label, 6.5, 'sp-box-lbl'));
      this.boxes.set(key, [b, t]);
    };
    box('lc', 14, name(this.map.lc)); box('apn', 128, name(this.map.apn)); box('cos', 242, 'COS');
    // 警示
    this.warn = el('g', {}, 'sc-warn');
    this.warn.appendChild(rect(TX + 4, 108, TW - 8, 18, 5, 'sc-warn-bg'));
    this.warnText = this.warn.appendChild(text(TX + TW / 2, 120.5, '', 7, 'sc-warn-text'));
    this.warn.style.display = 'none';
    this.svg.appendChild(this.warn);
    this.root.appendChild(this.svg);

    /* ---------- 控制列 ---------- */
    const ctrl = h('div', 'scene-ctrl');
    const b = (label: string, on: () => void) => { const x = h('button', 'btn small', label) as HTMLButtonElement; x.onclick = on; return x; };
    ctrl.append(h('span', 'scene-sub', '水位'), b('−', () => this.ev.level(this.level - .15)), b('＋', () => this.ev.level(this.level + .15)), b('空', () => this.ev.level(0)), b('滿', () => this.ev.level(1)));
    const lab = h('label');
    this.hydroChk = document.createElement('input'); this.hydroChk.type = 'checkbox'; this.hydroChk.checked = true;
    lab.append(this.hydroChk, document.createTextNode('自動水位（持續進水、泵運轉排水）'));
    ctrl.appendChild(lab);
    this.inflowBtn = b('進水量：一般', () => { this.heavy = !this.heavy; this.inflowBtn.textContent = this.heavy ? '進水量：大量' : '進水量：一般'; this.inflowBtn.classList.toggle('danger', this.heavy); });
    this.inflowBtn.title = '大量進水時一台泵排不完，水位會升到異常水位，兩台並列運轉';
    ctrl.appendChild(this.inflowBtn);
    for (const id of this.map.bs.slice(0, 2)) ctrl.appendChild(b(`抬／放 ${id}`, () => this.ev.toggle(id)));
    this.root.appendChild(ctrl);

    /* ---------- 狀態清單 ---------- */
    const st = h('div', 'scene-status');
    const items: [string, string][] = [['nfb', 'NFB 投入'], ['cos', 'COS 位置'], ['p0', `M1 運轉 (${name(pumpsIds[0])})`], ['p1', `M2 運轉 (${name(pumpsIds[1])})`],
      ['u1', `高水位 (${this.map.bs[0]}・U1)`], ['u2', `異常水位 (${this.map.bs[1]}・U2)`], ['apn', '交互電驛下一台'], ['trip', '過載跳脫']];
    for (const [k, lb] of items) {
      const c = h('div', 'chip', `<i></i><span>${lb}</span><em></em>`);
      c.dataset.k = k;
      this.chips.set(k, c); st.appendChild(c);
    }
    this.root.appendChild(st);

    this.update(null);
    this.last = performance.now();
    requestAnimationFrame(t => this.frame(t));
  }

  update(sim: Simulator | null): void {
    const m = this.map;
    const nfb = !!sim?.nfbOn;
    const st = (id?: string) => (id && sim ? sim.state.get(id) : undefined);
    const on = (id?: string) => !!st(id)?.actuated;
    const cosA = !!st(m.cos)?.pressed;
    const next2 = !!st(m.apn)?.latched;
    const u1 = on(m.lc), u2 = !!st(m.lc)?.actuated2;
    const trips = m.thry.map(id => !!st(id)?.tripped);
    const run = m.pumps.slice(0, 2).map(id => on(id));
    this.level = sim ? sim.level : 0;
    if (sim) { sim.hydro = this.hydroChk.checked; sim.inflow = this.heavy ? .10 : .03; }

    // 水位
    const { TOP, TH } = SumpScene;
    const hgt = TH * this.level;
    this.water.setAttribute('height', String(hgt)); this.water.setAttribute('y', String(TOP + TH - hgt));
    this.lvlText.textContent = `${Math.round(this.level * 100)}%`;
    this.inFlow.classList.toggle('on', !!sim && this.hydroChk.checked);
    this.inFlow.classList.toggle('heavy', this.heavy);
    // 浮球：浮起時跟著水面（不超過自己的動作水位太多），落下時垂著
    for (const f of this.floats) {
      const up = !!st(f.id)?.pressed;
      const y = up ? Math.min(f.upY, Math.max(this.yOf(this.level), TOP + 6)) : f.downY;
      f.ball.setAttribute('cy', String(y)); f.cable.setAttribute('y2', String(y));
      f.ball.classList.toggle('up', up);
    }
    // 泵
    run.forEach((r, i) => {
      const p = this.pumps[i];
      p.target = r ? 1 : 0;
      p.body.setAttribute('class', 'sp-pump' + (trips[i] ? ' trip' : r ? ' on' : ''));
      p.flow.classList.toggle('on', r && this.level > .01);
    });
    // 狀態盒
    const setBox = (k: string, lit: boolean, label: string) => { const bx = this.boxes.get(k); if (!bx) return; bx[0].classList.toggle('on', lit); bx[1].textContent = label; };
    const lcName = this.q.devices.find(d => d.id === m.lc)?.label ?? m.lc;
    setBox('lc', u1 || u2, u2 ? `${lcName} 異常水位` : u1 ? `${lcName} 高水位` : lcName);
    setBox('apn', !!sim && !!m.apn, m.apn ? `交互 → M${next2 ? 2 : 1}` : '');
    setBox('cos', cosA, `COS ${sim ? (cosA ? '自動 A' : '手動 M') : ''}`);
    // 警示
    let warn = '';
    if (trips.some(Boolean)) warn = `⚠ ${m.thry.filter((_, i) => trips[i]).map(id => this.q.devices.find(d => d.id === id)?.label ?? id).join('、')} 過載跳脫`;
    else if (u2 && run.every(Boolean)) warn = '異常水位：兩台並列運轉';
    else if (sim && this.level >= .98 && !run.every(Boolean)) warn = '⚠ 污水池滿了，泵沒有全部運轉';
    this.warn.style.display = warn ? '' : 'none';
    this.warnText.textContent = warn;
    this.svg.classList.toggle('fault', trips.some(Boolean));
    // 狀態清單
    const set = (k: string, v: boolean, extra = '') => { const c = this.chips.get(k); if (!c) return; c.classList.toggle('on', v); c.querySelector('em')!.textContent = extra; };
    set('nfb', nfb); set('cos', cosA, sim ? (cosA ? '自動 A' : '手動 M') : '');
    set('p0', run[0]); set('p1', run[1]);
    set('u1', u1, `${Math.round(this.level * 100)}%`); set('u2', u2);
    set('apn', !!sim && !!m.apn, sim && m.apn ? `M${next2 ? 2 : 1}` : '');
    set('trip', trips.some(Boolean));
    this.chips.get('trip')?.classList.toggle('bad', trips.some(Boolean));
  }

  private frame(t: number): void {
    const dt = Math.min(.1, (t - this.last) / 1000); this.last = t;
    for (const p of this.pumps) {
      const tau = p.target > p.speed ? .4 : 1;
      p.speed += (p.target - p.speed) * (1 - Math.exp(-dt / tau));
      if (Math.abs(p.speed - p.target) < .004) p.speed = p.target;
      if (p.speed > .002) {
        p.angle = (p.angle + p.speed * 720 * dt) % 360;
        p.imp.setAttribute('transform', `rotate(${p.angle.toFixed(1)} ${p.cx} ${p.cy})`);
      }
    }
    requestAnimationFrame(tt => this.frame(tt));
  }
}
