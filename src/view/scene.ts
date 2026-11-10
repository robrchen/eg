import type { QuestionDef } from '../model/types';
import type { Simulator } from '../engine/simulator';
import { el, rect, text } from './art/svg';

/** 題目可指定場景用到的器具 id；沒指定就依慣用代號猜（MCF／MCR／MCS／MCD、TR｜TR1、THRY、EMS） */
export interface SceneMap { fwd?: string; rev?: string; star?: string; delta?: string; timer?: string; thry?: string; ems?: string }

const h = (tag: string, cls = '', html = ''): HTMLElement => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };

/**
 * 自動化場景（SimuCir 的「Cena de automação」）：把控制電路的動作轉成電動機畫面——
 * 轉向（正轉順時針／反轉逆時針）、Y 啟動（六成轉速）→ Δ 運轉（全速）、停機慣性滑行、過載跳脫警示；
 * 旁邊的繞組圖顯示 U V W 各接哪一相、X Y Z 目前是 Y 接（短接成中性點）還是 Δ 接；下方是製程狀態清單。
 * 主電路在模擬器裡視為已配妥，所以狀態由各接觸器的吸合狀態推得。
 */
export class Scene {
  readonly root: HTMLElement;
  private svg: SVGSVGElement;
  private rotor: SVGGElement;
  private dirText: SVGTextElement;
  private speedBar: SVGRectElement;
  private speedText: SVGTextElement;
  private warn: SVGGElement;
  private warnText: SVGTextElement;
  private phaseDots: Record<'U' | 'V' | 'W', SVGCircleElement>;
  private phaseTexts: Record<'U' | 'V' | 'W', SVGTextElement>;
  private starLinks: SVGGElement;
  private deltaLinks: SVGGElement;
  private coils: SVGPathElement[];
  private chips = new Map<string, HTMLElement>();
  private map: Required<SceneMap>;
  /** 動畫狀態 */
  private angle = 0;
  private speed = 0;          // 0–1
  private target = 0;
  private dir = 1;            // +1 正轉（順時針）、-1 反轉
  private last = 0;
  private idleFrames = 0;
  onFloat?: () => void;

  constructor(private q: QuestionDef) {
    const ids = new Set(q.devices.map(d => d.id));
    const pick = (given: string | undefined, ...cands: string[]) => given ?? cands.find(c => ids.has(c)) ?? cands[0];
    const m: SceneMap = q.scene && q.scene.kind !== 'pump' ? q.scene : {};
    this.map = {
      fwd: pick(m.fwd, 'MCF'), rev: pick(m.rev, 'MCR'), star: pick(m.star, 'MCS'), delta: pick(m.delta, 'MCD'),
      timer: pick(m.timer, 'TR', 'TR1'), thry: pick(m.thry, 'THRY'), ems: pick(m.ems, 'EMS'),
    };

    this.root = h('div', 'scene');
    const head = h('div', 'scene-head');
    head.append(h('b', '', '場景'), h('span', 'scene-sub', '三相感應電動機 Y-Δ 啟動'));
    const fl = h('button', 'btn small', '⧉') as HTMLButtonElement; fl.title = '浮動視窗（可拖曳、改大小）';
    fl.onclick = () => this.onFloat?.();
    head.appendChild(fl);
    this.root.appendChild(head);

    /* ---------- SVG：電動機＋繞組圖 ---------- */
    const W = 360, H = 210;
    this.svg = el('svg', { viewBox: `0 0 ${W} ${H}` }, 'scene-svg');
    this.svg.appendChild(rect(0, 0, W, H, 10, 'sc-bg'));
    // 地板線
    this.svg.appendChild(el('line', { x1: 14, y1: 168, x2: 206, y2: 168 }, 'sc-floor'));

    // 電動機（側視）：底座、機身（散熱鰭片）、端蓋、端子盒、軸、風扇罩
    const g = el('g', {}, 'sc-motor');
    g.appendChild(rect(40, 150, 120, 10, 2, 'sc-foot'));
    g.appendChild(rect(58, 140, 14, 12, 1, 'sc-foot')); g.appendChild(rect(128, 140, 14, 12, 1, 'sc-foot'));
    g.appendChild(rect(46, 72, 118, 72, 8, 'sc-body'));
    for (let i = 0; i < 9; i++) g.appendChild(rect(50, 78 + i * 7.2, 110, 3.2, 1.2, 'sc-fin'));
    g.appendChild(rect(28, 80, 22, 56, 5, 'sc-endbell'));          // 非軸端端蓋（風扇側）
    g.appendChild(rect(160, 80, 18, 56, 4, 'sc-endbell'));         // 軸端端蓋
    g.appendChild(rect(78, 54, 56, 22, 3, 'sc-tbox'));             // 端子盒
    g.appendChild(text(106, 68.5, 'U V W · X Y Z', 6.5, 'sc-tbox-text'));
    g.appendChild(rect(178, 103, 26, 10, 2, 'sc-shaft'));          // 軸
    g.appendChild(rect(178, 103, 26, 3, 1.5, 'sc-shaft-hi'));
    this.svg.appendChild(g);
    // 轉子端的聯軸器圓盤：三支輻條，轉動時看得出方向
    this.rotor = el('g', { transform: 'rotate(0 210 108)' }, 'sc-rotor');
    this.rotor.appendChild(el('circle', { cx: 210, cy: 108, r: 20 }, 'sc-disc'));
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      this.rotor.appendChild(el('path', { d: `M210,108 L${210 + Math.cos(a) * 17},${108 + Math.sin(a) * 17} A17,17 0 0 1 ${210 + Math.cos(a + .9) * 17},${108 + Math.sin(a + .9) * 17} Z` }, 'sc-spoke'));
    }
    this.rotor.appendChild(el('circle', { cx: 210, cy: 108, r: 4.5 }, 'sc-hub'));
    this.svg.appendChild(this.rotor);
    // 轉向與轉速
    this.dirText = this.svg.appendChild(text(106, 190, '停止', 11, 'sc-dir'));
    this.svg.appendChild(rect(14, 198, 184, 6, 3, 'sc-speed-bg'));
    this.speedBar = this.svg.appendChild(rect(14, 198, 0, 6, 3, 'sc-speed'));
    for (const [p, lb] of [[.6, 'Y'], [1, 'Δ']] as const) {
      this.svg.appendChild(el('line', { x1: 14 + 184 * p, y1: 196, x2: 14 + 184 * p, y2: 206 }, 'sc-speed-mark'));
      this.svg.appendChild(text(14 + 184 * p - (p === 1 ? 6 : 0), 194, lb, 6.5, 'sc-speed-lbl'));
    }
    this.speedText = this.svg.appendChild(text(198, 194, '0%', 6.5, 'sc-speed-lbl', 'end'));
    // 警示（互鎖失效／Y-Δ 同時投入／過載）
    this.warn = el('g', {}, 'sc-warn');
    this.warn.appendChild(rect(20, 18, 172, 20, 5, 'sc-warn-bg'));
    this.warnText = this.warn.appendChild(text(106, 32, '', 8.5, 'sc-warn-text'));
    this.warn.style.display = 'none';
    this.svg.appendChild(this.warn);

    /* 繞組圖：三組線圈橫排 U–X、V–Y、W–Z；Y 接＝右側 X Y Z 短接成中性點；Δ 接＝X→V、Y→W、Z→U */
    const wx = 232, rows = [62, 104, 146], lx = wx, rx = wx + 100;
    this.svg.appendChild(text((lx + rx) / 2, 26, '繞組接法', 8, 'sc-title'));
    this.svg.appendChild(el('line', { x1: 220, y1: 18, x2: 220, y2: 198 }, 'sc-sep'));
    this.coils = [];
    this.phaseDots = {} as Scene['phaseDots']; this.phaseTexts = {} as Scene['phaseTexts'];
    (['U', 'V', 'W'] as const).forEach((n, i) => {
      const y = rows[i];
      // 線圈（鋸齒）
      let d = `M${lx + 14},${y}`;
      for (let k = 0; k < 6; k++) d += ` l6,${k % 2 ? 7 : -7}`;
      d += ` l6,${7 - 7} L${rx - 14},${y}`;
      this.coils.push(this.svg.appendChild(el('path', { d, transform: `translate(0,3.5)` }, 'sc-coil')));
      this.svg.appendChild(el('line', { x1: lx + 4, y1: y, x2: lx + 14, y2: y }, 'sc-lead'));
      this.svg.appendChild(el('line', { x1: rx - 14, y1: y, x2: rx - 4, y2: y }, 'sc-lead'));
      this.phaseDots[n] = this.svg.appendChild(el('circle', { cx: lx, cy: y, r: 4.5 }, 'sc-term'));
      this.svg.appendChild(text(lx - 9, y + 3, n, 8, 'sc-term-lbl', 'end'));
      this.phaseTexts[n] = this.svg.appendChild(text(lx - 9, y - 7, '', 6.5, 'sc-phase', 'end'));
      this.svg.appendChild(el('circle', { cx: rx, cy: y, r: 4.5 }, 'sc-term'));
      this.svg.appendChild(text(rx + 9, y + 3, ['X', 'Y', 'Z'][i], 8, 'sc-term-lbl', 'start'));
    });
    this.starLinks = el('g', {}, 'sc-links');
    this.starLinks.appendChild(el('path', { d: `M${rx + 4},${rows[0]} L${rx + 24},${rows[0]} L${rx + 24},${rows[2]} L${rx + 4},${rows[2]} M${rx + 4},${rows[1]} L${rx + 24},${rows[1]}` }, 'sc-link'));
    this.starLinks.appendChild(el('circle', { cx: rx + 24, cy: rows[1], r: 3 }, 'sc-node'));
    this.starLinks.appendChild(text(rx + 24, rows[2] + 16, 'Y', 9, 'sc-mode-lbl'));
    this.svg.appendChild(this.starLinks);
    this.deltaLinks = el('g', {}, 'sc-links');
    // X→V、Y→W：由右端往下繞到下一列左端；Z→U：由最下列右端繞上來接最上列左端
    const link = (y0: number, y1: number, far: number) => `M${rx + 4},${y0} L${rx + far},${y0} L${rx + far},${(y0 + y1) / 2} L${lx - far + 14},${(y0 + y1) / 2} L${lx - far + 14},${y1} L${lx - 4},${y1}`;
    this.deltaLinks.appendChild(el('path', { d: link(rows[0], rows[1], 14) }, 'sc-link'));
    this.deltaLinks.appendChild(el('path', { d: link(rows[1], rows[2], 14) }, 'sc-link'));
    this.deltaLinks.appendChild(el('path', { d: `M${rx + 4},${rows[2]} L${rx + 22},${rows[2]} L${rx + 22},${rows[2] + 20} L${lx - 22},${rows[2] + 20} L${lx - 22},${rows[0]} L${lx - 4},${rows[0]}` }, 'sc-link'));
    this.deltaLinks.appendChild(text(rx + 24, rows[2] + 34, 'Δ', 9, 'sc-mode-lbl'));
    this.svg.appendChild(this.deltaLinks);
    this.root.appendChild(this.svg);

    /* ---------- 狀態清單 ---------- */
    const st = h('div', 'scene-status');
    for (const [k, lb] of [['nfb', 'NFB 投入'], ['fwd', '正轉 (MCF)'], ['rev', '反轉 (MCR)'], ['star', 'Y 啟動中 (MCS)'], ['delta', 'Δ 運轉 (MCD)'], ['timer', 'TR 計時'], ['trip', '過載跳脫'], ['ems', '緊急停止']] as const) {
      if (k === 'ems' && !ids.has(this.map.ems)) continue;
      const c = h('div', 'chip', `<i></i><span>${lb}</span><em></em>`);
      c.dataset.k = k;
      this.chips.set(k, c); st.appendChild(c);
    }
    this.root.appendChild(st);

    this.update(null);
    this.last = performance.now();
    requestAnimationFrame(t => this.frame(t));
  }

  /** 由模擬器狀態更新場景（每 tick 呼叫；null＝未通電） */
  update(sim: Simulator | null): void {
    const on = (id: string) => !!sim && !!sim.state.get(id)?.actuated;
    const nfb = !!sim?.nfbOn;
    const fwd = on(this.map.fwd), rev = on(this.map.rev), star = on(this.map.star), delta = on(this.map.delta);
    const trip = !!sim?.state.get(this.map.thry)?.tripped;
    const ems = !!sim?.state.get(this.map.ems)?.pressed;
    const tr = sim?.state.get(this.map.timer);
    const trDev = this.q.devices.find(d => d.id === this.map.timer);
    const running = nfb && (fwd !== rev) && (star !== delta);
    this.target = running ? (delta ? 1 : .6) : 0;
    if (fwd && !rev) this.dir = 1; else if (rev && !fwd) this.dir = -1;

    // 警示
    let warn = '';
    if (fwd && rev) warn = '⚠ MCF 與 MCR 同時吸合：互鎖失效，主電路相間短路！';
    else if (star && delta) warn = '⚠ MCS 與 MCD 同時吸合：Y-Δ 短路！';
    else if (trip) warn = '⚠ TH-RY 過載跳脫，電動機停止';
    else if (ems) warn = '⚠ 緊急停止（EMS）';
    this.warn.style.display = warn ? '' : 'none';
    this.warnText.textContent = warn;
    this.svg.classList.toggle('fault', !!(fwd && rev) || !!(star && delta));

    // 繞組：U V W 的相別（正轉 R S T；反轉 R、T 對調），接法
    const phases: Record<'U' | 'V' | 'W', string> = fwd ? { U: 'R', V: 'S', W: 'T' } : rev ? { U: 'T', V: 'S', W: 'R' } : { U: '', V: '', W: '' };
    for (const n of ['U', 'V', 'W'] as const) {
      const ph = nfb ? phases[n] : '';
      this.phaseTexts[n].textContent = ph;
      this.phaseDots[n].setAttribute('class', 'sc-term' + (ph ? ' live ph-' + ph : ''));
    }
    this.starLinks.classList.toggle('on', star);
    this.deltaLinks.classList.toggle('on', delta);
    for (const c of this.coils) c.classList.toggle('live', running);

    // 狀態清單
    const set = (k: string, v: boolean, extra = '') => {
      const c = this.chips.get(k); if (!c) return;
      c.classList.toggle('on', v);
      c.querySelector('em')!.textContent = extra;
    };
    set('nfb', nfb);
    set('fwd', fwd); set('rev', rev);
    set('star', star); set('delta', delta);
    const timing = !!tr?.actuated && !tr.timedOut && !!sim;
    set('timer', timing, timing && trDev && sim ? `${Math.max(0, (sim.timerOf(trDev) - tr!.timerMs) / 1000).toFixed(1)} s` : (tr?.timedOut && sim ? '到' : ''));
    set('trip', trip);
    set('ems', ems);
    this.chips.get('trip')?.classList.toggle('bad', trip);
    this.chips.get('ems')?.classList.toggle('bad', ems);
    this.idleFrames = 0;
  }

  private frame(t: number): void {
    const dt = Math.min(.1, (t - this.last) / 1000); this.last = t;
    // 加速快（約 1 秒到位）、停機慣性滑行慢（約 3 秒）
    const tau = this.target > this.speed ? .45 : 1.2;
    this.speed += (this.target - this.speed) * (1 - Math.exp(-dt / tau));
    if (Math.abs(this.speed - this.target) < .004) this.speed = this.target;
    if (this.speed > .002) {
      this.angle = (this.angle + this.dir * this.speed * 900 * dt) % 360;
      this.rotor.setAttribute('transform', `rotate(${this.angle.toFixed(1)} 210 108)`);
      this.idleFrames = 0;
    } else this.idleFrames++;
    if (this.idleFrames < 3) {
      const pct = Math.round(this.speed * 100);
      this.speedBar.setAttribute('width', String(184 * this.speed));
      this.speedText.textContent = `${pct}%`;
      this.dirText.textContent = this.speed < .02 ? '停止' : `${this.dir > 0 ? '正轉 ↻' : '反轉 ↺'}　${this.target === 1 ? 'Δ 運轉' : this.target > 0 ? 'Y 啟動' : '滑行停止中'}`;
      this.dirText.setAttribute('class', 'sc-dir' + (this.speed < .02 ? '' : this.dir > 0 ? ' fwd' : ' rev'));
      this.svg.classList.toggle('spinning', this.speed > .02);
    }
    requestAnimationFrame(tt => this.frame(tt));
  }
}
