import type { QuestionDef, PumpScene as PumpMap } from '../model/types';
import { Simulator } from '../engine/simulator';
import { el, rect, text } from './art/svg';

const h = (tag: string, cls = '', html = ''): HTMLElement => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };

export interface PumpSceneEvents {
  /** 設定水塔水位 0～1 */
  level(v: number): void;
  /** 自動水位（泵運轉注水、固定耗水）開關 */
  hydro(on: boolean): void;
  /** 切換式器具（FS／COS）點一下 */
  toggle(dev: string): void;
}

/**
 * 抽水泵場景（第三題）：左邊給水源（浮球開關 FS）、中間兩台泵 M1／M2、右邊屋頂水塔（電極棒 E1 E2 E3）。
 * 泵接觸器吸合 → 葉輪轉、管路有流動；水位依模擬器 level 畫；61F-G 動作（滿水）與 MR 指向哪一台在下方狀態列。
 * 控制列：水位 −／＋、自動水位、FS 有水／無水；COS 在操作面板旋鈕上點。
 */
export class PumpScene {
  readonly root: HTMLElement;
  private svg: SVGSVGElement;
  private water: SVGRectElement;
  private srcWater: SVGRectElement;
  private ball: SVGCircleElement;
  private rods: Record<'E1' | 'E2' | 'E3', SVGLineElement>;
  private pumps: { body: SVGRectElement; imp: SVGGElement; flow: SVGPathElement; angle: number; speed: number; target: number; cx: number; cy: number }[] = [];
  private lvlText: SVGTextElement;
  private lcBox: SVGRectElement; private lcLbl: SVGTextElement;
  private mrBox: SVGRectElement; private mrLbl: SVGTextElement;
  private cosBox: SVGRectElement; private cosLbl: SVGTextElement;
  private warn: SVGGElement; private warnText: SVGTextElement;
  private chips = new Map<string, HTMLElement>();
  private hydroChk: HTMLInputElement;
  private fsBtn: HTMLButtonElement;
  private map: PumpMap;
  private last = 0;
  private level = 0;
  onFloat?: () => void;

  constructor(q: QuestionDef, private ev: PumpSceneEvents) {
    this.map = q.scene as PumpMap;
    const name = (id?: string) => (id && q.devices.find(d => d.id === id)?.label) ?? id ?? '';
    this.root = h('div', 'scene');
    const head = h('div', 'scene-head');
    head.append(h('b', '', '場景'), h('span', 'scene-sub', '兩台抽水泵・給水源浮球・屋頂水塔電極棒'));
    const fl = h('button', 'btn small', '⧉') as HTMLButtonElement; fl.title = '浮動視窗（可拖曳、改大小）';
    fl.onclick = () => this.onFloat?.();
    head.appendChild(fl);
    this.root.appendChild(head);

    /* ---------- SVG ---------- */
    const W = 360, H = 210;
    this.svg = el('svg', { viewBox: `0 0 ${W} ${H}` }, 'scene-svg');
    this.svg.appendChild(rect(0, 0, W, H, 10, 'sc-bg'));
    // 給水源（左）：水槽＋浮球
    this.svg.appendChild(text(50, 22, '給水源', 7.5, 'sp-lbl'));
    this.svg.appendChild(rect(14, 118, 72, 60, 3, 'sp-tank'));
    this.srcWater = this.svg.appendChild(el('rect', { x: 15.5, y: 134, width: 69, height: 42.5, rx: 2 }, 'sp-water src'));
    this.svg.appendChild(el('line', { x1: 44, y1: 108, x2: 44, y2: 138 }, 'fs-cable sp-cable'));
    this.ball = this.svg.appendChild(el('circle', { cx: 44, cy: 136, r: 7 }, 'sp-ball'));
    this.svg.appendChild(text(50, 190, `FS ${name(this.map.fs)}`, 6.5, 'sp-lbl'));
    // 屋頂水塔（右）：水槽＋三支電極棒
    this.svg.appendChild(text(300, 22, '屋頂水塔', 7.5, 'sp-lbl'));
    this.svg.appendChild(rect(246, 30, 100, 110, 3, 'sp-tank'));
    this.water = this.svg.appendChild(el('rect', { x: 247.5, y: 138.5, width: 97, height: 0, rx: 2 }, 'sp-water'));
    this.rods = {} as PumpScene['rods'];
    for (const [k, x, len] of [['E1', 282, 36], ['E2', 296, 78], ['E3', 310, 104]] as const) {
      this.svg.appendChild(rect(x - 3, 28, 6, 5, 1, 'sp-pump'));
      this.rods[k] = this.svg.appendChild(el('line', { x1: x, y1: 33, x2: x, y2: 33 + len }, 'sp-rod'));
      this.svg.appendChild(text(x, 33 + len + 8, k, 5.5, 'sp-rod-lbl'));
    }
    this.lvlText = this.svg.appendChild(text(340, 150, '0%', 7, 'sp-lvl', 'end'));
    this.svg.appendChild(text(296, 160, '電極棒', 6.5, 'sp-lbl'));
    // 泵（中）：兩台並排，吸水管自給水源、出水管到水塔頂
    const pumpsIds = this.map.pumps.slice(0, 2);
    pumpsIds.forEach((id, i) => {
      const cx = 128 + i * 60, cy = 150;
      // 吸水管（給水源→泵）、出水管（泵→水塔上緣）
      const suction = `M86,${160 + i * 8} L${cx - 16},${160 + i * 8} L${cx - 16},${cy}`;
      const rise = `M${cx + 16},${cy} L${cx + 30 + i * 8},${cy} L${cx + 30 + i * 8},${50 + i * 10} L252,${50 + i * 10}`;
      this.svg.appendChild(el('path', { d: suction + ' ' + rise }, 'sp-pipe'));
      const flow = this.svg.appendChild(el('path', { d: suction + ' ' + rise }, 'sp-flow'));
      const body = this.svg.appendChild(rect(cx - 16, cy - 16, 32, 32, 6, 'sp-pump'));
      const imp = el('g', { transform: `rotate(0 ${cx} ${cy})` }, 'sp-imp');
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2;
        imp.appendChild(el('path', { d: `M${cx},${cy} L${cx + Math.cos(a) * 11},${cy + Math.sin(a) * 11} A11,11 0 0 1 ${cx + Math.cos(a + .7) * 11},${cy + Math.sin(a + .7) * 11} Z` }, 'sp-impeller'));
      }
      imp.appendChild(el('circle', { cx, cy, r: 3 }, 'sc-hub'));
      this.svg.appendChild(imp);
      this.svg.appendChild(text(cx, cy + 27, `M${i + 1} ${name(id)}`, 6.5, 'sp-pump-lbl'));
      this.pumps.push({ body, imp, flow, angle: 0, speed: 0, target: 0, cx, cy });
    });
    // 狀態盒：61F-G、MR、COS
    const box = (x: number, label: string): [SVGRectElement, SVGTextElement] => {
      const b = this.svg.appendChild(rect(x, 182, 64, 20, 4, 'sp-box'));
      const t = this.svg.appendChild(text(x + 32, 195, label, 6.5, 'sp-box-lbl'));
      return [b, t];
    };
    [this.lcBox, this.lcLbl] = box(100, '61F-G');
    [this.mrBox, this.mrLbl] = box(170, 'MR');
    [this.cosBox, this.cosLbl] = box(240, 'COS');
    // 警示
    this.warn = el('g', {}, 'sc-warn');
    this.warn.appendChild(rect(94, 92, 150, 18, 5, 'sc-warn-bg'));
    this.warnText = this.warn.appendChild(text(169, 104.5, '', 7.5, 'sc-warn-text'));
    this.warn.style.display = 'none';
    this.svg.appendChild(this.warn);
    this.root.appendChild(this.svg);

    /* ---------- 控制列 ---------- */
    const ctrl = h('div', 'scene-ctrl');
    const b = (label: string, on: () => void) => { const x = h('button', 'btn small', label) as HTMLButtonElement; x.onclick = on; return x; };
    ctrl.append(h('span', 'scene-sub', '水位'), b('−', () => this.ev.level(this.level - .15)), b('＋', () => this.ev.level(this.level + .15)), b('空', () => this.ev.level(0)), b('滿', () => this.ev.level(1)));
    const lab = h('label');
    this.hydroChk = document.createElement('input'); this.hydroChk.type = 'checkbox'; this.hydroChk.checked = true;
    this.hydroChk.onchange = () => this.ev.hydro(this.hydroChk.checked);
    lab.append(this.hydroChk, document.createTextNode('自動水位（泵運轉注水、持續用水）'));
    ctrl.appendChild(lab);
    this.fsBtn = b('FS 有水', () => this.ev.toggle(this.map.fs));
    ctrl.appendChild(this.fsBtn);
    this.root.appendChild(ctrl);

    /* ---------- 狀態清單 ---------- */
    const st = h('div', 'scene-status');
    const items: [string, string][] = [['nfb', 'NFB 投入'], ['cos', 'COS 位置'], ['p0', `M1 運轉 (${name(pumpsIds[0])})`], ['p1', `M2 運轉 (${name(pumpsIds[1])})`], ['lc', '水塔滿水 (61F-G)'], ['mr', 'MR 下一台'], ['fs', '給水源有水'], ['trip', '過載跳脫']];
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

  /** 自動水位旗標是否勾選（模擬開始時由 main 讀取） */
  get hydroOn(): boolean { return this.hydroChk.checked; }

  update(sim: Simulator | null): void {
    const m = this.map;
    const nfb = !!sim?.nfbOn;
    const on = (id?: string) => !!id && !!sim && !!sim.state.get(id)?.actuated;
    const fs = sim ? !!sim.state.get(m.fs)?.pressed : true;
    const cosA = !!m.cos && !!sim && !!sim.state.get(m.cos)?.pressed;
    const mr2 = !!m.mr && !!sim && !!sim.state.get(m.mr)?.latched;
    const lc = on(m.lc);
    const trips = m.thry.map(id => !!sim?.state.get(id)?.tripped);
    this.level = sim ? sim.level : 0;
    if (sim) sim.hydro = this.hydroChk.checked;

    // 水塔水位與電極
    const hgt = 107 * this.level;
    this.water.setAttribute('height', String(hgt)); this.water.setAttribute('y', String(138.5 - hgt));
    this.lvlText.textContent = `${Math.round(this.level * 100)}%`;
    this.rods.E1.classList.toggle('wet', this.level >= Simulator.E1);
    this.rods.E2.classList.toggle('wet', this.level >= Simulator.E2);
    this.rods.E3.classList.toggle('wet', this.level > .02);
    // 給水源
    this.srcWater.setAttribute('height', fs ? '42.5' : '6'); this.srcWater.setAttribute('y', fs ? '134' : '170.5');
    this.ball.setAttribute('cy', fs ? '136' : '170');
    this.fsBtn.textContent = fs ? 'FS 有水 → 切無水' : 'FS 無水 → 切有水';
    // 泵
    m.pumps.slice(0, 2).forEach((id, i) => {
      const p = this.pumps[i]; const run = on(id);
      p.target = run && fs ? 1 : run ? .4 : 0;
      p.body.setAttribute('class', 'sp-pump' + (trips[i] ? ' trip' : run ? ' on' : ''));
      p.flow.classList.toggle('on', run && fs);
    });
    // 狀態盒
    this.lcBox.classList.toggle('on', lc); this.lcLbl.textContent = lc ? '61F-G 滿水' : '61F-G';
    this.mrBox.classList.toggle('on', !!sim && !!m.mr); this.mrLbl.textContent = m.mr ? `MR → M${mr2 ? 2 : 1}` : '';
    this.cosBox.classList.toggle('on', cosA); this.cosLbl.textContent = m.cos ? `COS ${sim ? (cosA ? '自動 A' : '手動 M') : ''}` : '';
    // 警示
    let warn = '';
    const both = m.pumps.slice(0, 2).every(id => on(id));
    if (both) warn = '⚠ 兩台泵同時運轉：互鎖失效';
    else if (trips.some(Boolean)) warn = `⚠ ${m.thry.filter((_, i) => trips[i]).join('、')} 過載跳脫`;
    else if (!fs && m.pumps.some(id => on(id))) warn = '⚠ 給水源無水仍在運轉（空轉）';
    this.warn.style.display = warn ? '' : 'none';
    this.warnText.textContent = warn;
    this.svg.classList.toggle('fault', both);
    // 狀態清單
    const set = (k: string, v: boolean, extra = '') => { const c = this.chips.get(k); if (!c) return; c.classList.toggle('on', v); c.querySelector('em')!.textContent = extra; };
    set('nfb', nfb); set('cos', cosA, sim ? (cosA ? '自動 A' : '手動 M') : '');
    set('p0', on(m.pumps[0])); set('p1', on(m.pumps[1]));
    set('lc', lc, `${Math.round(this.level * 100)}%`);
    set('mr', !!sim && !!m.mr, sim && m.mr ? `M${mr2 ? 2 : 1}` : '');
    set('fs', fs && !!sim);
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
