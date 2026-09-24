/**
 * 練習模式畫面：全螢幕蓋在配電盤上（不動任何接線狀態），手機直式為主、橫式與桌機也能用。
 * 首頁 → 一回合 10 題（每題倒數）→ 結算。
 */
import type { DeviceDef, DeviceKind, TerminalDef } from '../model/types';
import { buildDeviceDiagram } from '../view/deviceDiagram';
import { sfx } from '../view/sfx';
import { pinTemplates, PIN_KINDS, DEV_NAME, displayLabel, revealLabel } from './pinQuiz';
import { DrillSession, type AnswerResult } from './session';
import { loadStats, recordAnswer, recordRound, saveStats, streakDays, accuracy, type DrillStats } from './stats';
import { NEUTRAL_ROLE, type DrillKind, type DrillQ, type TapQ } from './types';

export interface DrillDeps {
  /** 本題用到的器具種類（「只出本題器具」用） */
  kinds: DeviceKind[];
  onClose(): void;
}

const KIND_LABEL: Partial<Record<DrillKind, string>> = {
  'pin-pair': '點接點', 'pin-tap': 'c／a／b', 'pin-num': '端子位置', 'pin-iec': '接點 → 端子號',
  'pin-name': '端子號 → 接點', 'pin-role': '腳位用途', 'pin-order': '排列順序',
};
const UI_KEY = 'yishipei:drill:ui';
const ROUND = 10;

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e;
};
const btn = (label: string, cls: string, on: () => void): HTMLButtonElement => { const b = h('button', cls, label); b.type = 'button'; b.onclick = on; return b; };
const sec = (ms: number) => `${(ms / 1000).toFixed(1)} 秒`;
const plain = (s: string) => s.replace(/<[^>]+>/g, '');
const vibrate = (p: number | number[]) => { try { navigator.vibrate?.(p); } catch { /* 不支援就算了 */ } };

/** 練習用的端子圖：去掉主電路端子，把示意座標縮到只包住剩下的端子（圖才不會又大又空） */
function trimDef(def: DeviceDef): DeviceDef {
  const terms = def.terminals.filter(t => t.role !== 'main');
  const pos = (t: TerminalDef): [number, number] => def.card?.pos[t.id] ?? [t.x, t.y];
  const xs = terms.map(t => pos(t)[0]), ys = terms.map(t => pos(t)[1]);
  const x0 = Math.min(...xs), y0 = Math.min(...ys);
  let w = Math.max(...xs) - x0, hh = Math.max(...ys) - y0;
  if (!w) w = hh * 0.4; if (!hh) hh = w * 0.4;
  return {
    ...def, terminals: terms,
    card: { w, h: hh, keepAspect: def.card?.keepAspect, pos: Object.fromEntries(terms.map(t => [t.id, [pos(t)[0] - x0, pos(t)[1] - y0]])) },
  };
}

export class DrillView {
  private root: HTMLElement;
  private stats: DrillStats = loadStats();
  private ses: DrillSession | null = null;
  private allKinds = false;
  private ticker = 0;
  private autoNext = 0;
  private qStart = 0;
  private pausedAt = 0;
  private answered = false;
  private picked: string[] = [];
  private el: {
    num?: HTMLElement; streak?: HTMLElement; score?: HTMLElement; bar?: HTMLElement;
    ans?: HTMLElement; fb?: HTMLElement; main?: HTMLElement;
  } = {};
  private shownScore = 0;
  private onKey = (ev: KeyboardEvent) => this.key(ev);
  private onVis = () => this.visibility();

  constructor(private deps: DrillDeps) {
    this.root = document.getElementById('drill')!;
    try { this.allKinds = !!JSON.parse(localStorage.getItem(UI_KEY) ?? '{}').all; } catch { /* ignore */ }
  }

  get isOpen(): boolean { return !this.root.hidden; }

  open(): void {
    this.root.hidden = false;
    document.body.classList.add('drilling');
    window.addEventListener('keydown', this.onKey, true);
    document.addEventListener('visibilitychange', this.onVis);
    this.stats = loadStats();
    this.home();
  }

  close(): void {
    this.stopTimers();
    this.ses = null;
    this.root.hidden = true;
    this.root.replaceChildren();
    document.body.classList.remove('drilling');
    window.removeEventListener('keydown', this.onKey, true);
    document.removeEventListener('visibilitychange', this.onVis);
    this.deps.onClose();
  }

  private stopTimers(): void { clearInterval(this.ticker); clearTimeout(this.autoNext); this.ticker = 0; this.autoNext = 0; }

  private kinds(): DeviceKind[] {
    return this.allKinds ? PIN_KINDS : PIN_KINDS.filter(k => this.deps.kinds.includes(k));
  }

  /* ---------- 首頁 ---------- */
  private home(): void {
    this.stopTimers();
    this.ses = null;
    const s = this.stats;
    const days = streakDays(s);
    const wrap = h('div', 'drill-home');
    const head = h('div', 'drill-head');
    head.append(btn('✕', 'drill-x', () => this.close()), h('div', 'drill-title', '練習模式'), h('span', 'drill-spacer'));
    const hero = h('div', 'drill-hero');
    hero.append(
      h('div', 'stat', `<b>${days ? `🔥 ${days}` : '—'}</b><small>連續天數</small>`),
      h('div', 'stat', `<b>${s.best ? s.best.score.toLocaleString() : '—'}</b><small>最佳分數</small>`),
      h('div', 'stat', `<b>${s.bestStreak || '—'}</b><small>最長連勝</small>`),
    );
    const modes = h('div', 'drill-modes');
    const pin = btn(`<span class="ic">🔌</span><span class="t">腳位練習</span><span class="d">c／a／b 接點 ↔ 端子號、位置。${ROUND} 題，每題倒數</span>`, 'drill-mode', () => this.start());
    const chain = h('div', 'drill-mode soon', `<span class="ic">⚡</span><span class="t">動作連鎖</span><span class="d">按下按鈕後誰先得電、哪個接點動作（下一版）</span>`);
    modes.append(pin, chain);

    const scope = h('div', 'drill-scope');
    const kinds = PIN_KINDS.filter(k => this.deps.kinds.includes(k));
    const mk = (all: boolean, label: string) => {
      const b = btn(label, `drill-chip${this.allKinds === all ? ' on' : ''}`, () => {
        this.allKinds = all;
        try { localStorage.setItem(UI_KEY, JSON.stringify({ all })); } catch { /* ignore */ }
        this.home();
      });
      return b;
    };
    scope.append(h('span', 'lbl', '出題範圍'), mk(false, `本題器具（${kinds.map(k => (k === 'THRY' ? 'TH-RY' : k)).join(' ')}）`), mk(true, '全部器具'));

    const acc = h('div', 'drill-acc');
    const rows = PIN_KINDS.map(k => ({ k, st: s.byDev[k] })).filter(r => r.st?.n);
    if (rows.length) {
      acc.appendChild(h('div', 'lbl', '各器具正確率'));
      for (const { k, st } of rows) {
        const p = Math.round((accuracy(st) ?? 0) * 100);
        const r = h('div', 'acc-row', `<span class="k">${k === 'THRY' ? 'TH-RY' : k}</span><span class="bar"><i style="width:${p}%"></i></span><span class="p">${p}%</span><small>${st!.n} 題</small>`);
        r.querySelector('i')!.classList.toggle('low', p < 70);
        acc.appendChild(r);
      }
    }
    const missed = Object.keys(s.missed).length;
    const foot = h('div', 'drill-foot', `${s.rounds ? `已練 ${s.rounds} 回、${s.questions} 題` : '第一次來？點「腳位練習」開始'}${missed ? `　·　待複習 ${missed} 題（會優先出）` : ''}`);
    wrap.append(head, h('div', 'drill-body', ''));
    wrap.querySelector('.drill-body')!.append(hero, modes, scope, acc, foot);
    this.root.replaceChildren(wrap);
  }

  /* ---------- 一回合 ---------- */
  private start(): void {
    sfx.click();
    const pool = pinTemplates(this.kinds());
    this.ses = new DrillSession(pool, this.stats, { length: ROUND });
    this.shownScore = 0;
    const wrap = h('div', 'drill-play');
    const head = h('div', 'drill-head');
    this.el.num = h('div', 'drill-num');
    this.el.streak = h('div', 'drill-streak');
    this.el.score = h('div', 'drill-score', '0');
    head.append(btn('✕', 'drill-x', () => this.home()), this.el.num, h('span', 'drill-spacer'), this.el.streak, this.el.score);
    const timer = h('div', 'drill-timer');
    this.el.bar = h('i');
    timer.appendChild(this.el.bar);
    this.el.main = h('div', 'drill-main');
    this.el.fb = h('div', 'drill-fb');
    wrap.append(head, timer, this.el.main, this.el.fb);
    this.root.replaceChildren(wrap);
    this.showQuestion();
  }

  private showQuestion(): void {
    const ses = this.ses!;
    const q = ses.current!;
    this.answered = false;
    this.picked = [];
    this.el.num!.textContent = `${ses.index + 1} / ${ses.total}`;
    this.renderStreak(false);
    this.el.fb!.className = 'drill-fb';
    this.el.fb!.replaceChildren();
    const qEl = h('div', 'drill-q');
    const tags = h('div', 'drill-tags');
    tags.append(h('span', 'chip', KIND_LABEL[q.kind] ?? q.kind), h('span', `lv lv${q.level}`, '★'.repeat(q.level)));
    if (q.devKind) tags.append(h('span', 'dev', DEV_NAME[q.devKind] ?? q.devKind));
    qEl.append(tags, h('div', 'prompt', q.prompt));
    if (q.answer === 'tap' && q.targets.length > 1) qEl.append(h('div', 'drill-hint', `點 ${q.targets.length} 顆（順序不拘，再點一次可取消）`));
    this.el.ans = h('div', `drill-ans ${q.answer}`);
    this.el.main!.replaceChildren(qEl, this.el.ans);
    this.el.main!.classList.remove('shake');
    this.renderAnswer(q, null);
    this.qStart = performance.now();
    this.pausedAt = 0;
    this.el.bar!.className = '';
    this.el.bar!.style.width = '100%';
    clearInterval(this.ticker);
    this.ticker = window.setInterval(() => this.tick(), 100);
  }

  private elapsed(): number { return (this.pausedAt || performance.now()) - this.qStart; }

  private tick(): void {
    if (this.answered || this.pausedAt) return;
    const q = this.ses?.current; if (!q) return;
    const left = q.timeLimitMs - this.elapsed();
    this.el.bar!.style.width = `${Math.max(0, (left / q.timeLimitMs) * 100)}%`;
    this.el.bar!.classList.toggle('low', left < 3000);
    if (left <= 0) this.finish(this.ses!.timeout(), []);
  }

  /** 切到背景時暫停倒數（手機接電話、切 App 不算時間） */
  private visibility(): void {
    if (!this.ses || this.answered) return;
    if (document.hidden) { if (!this.pausedAt) this.pausedAt = performance.now(); }
    else if (this.pausedAt) { this.qStart += performance.now() - this.pausedAt; this.pausedAt = 0; }
  }

  /** 作答區；result 不為 null 時是答後揭曉 */
  private renderAnswer(q: DrillQ, result: AnswerResult | null): void {
    const ans = this.el.ans!;
    if (q.answer === 'tap') { ans.replaceChildren(this.tapDiagram(q, result)); return; }
    if (q.answer === 'choice') {
      const grid = h('div', 'drill-opts');
      q.options.forEach((o, i) => {
        const b = btn(`<span class="k">${i + 1}</span><span class="t">${o.text}</span>`, 'drill-opt', () => this.submit([o.key]));
        b.dataset.key = o.key;
        if (result) {
          b.disabled = true;
          if (o.key === q.correct) b.classList.add('hit');
          else if (this.picked.includes(o.key)) b.classList.add('miss');
          else b.classList.add('dim');
        }
        grid.appendChild(b);
      });
      ans.replaceChildren(grid);
    }
  }

  private tapDiagram(q: TapQ, result: AnswerResult | null): HTMLElement {
    const def = trimDef(q.def);
    // 可用空間：作答區頂端到主區底部（直式在題目下方、橫式在右欄）
    const main = this.el.main!.getBoundingClientRect(), top = this.el.ans!.getBoundingClientRect().top;
    const availH = Math.max(160, main.bottom - top - 20), availW = Math.max(200, this.el.ans!.clientWidth);
    const aspect = Math.max(0.6, Math.min(2.6, def.card!.w / def.card!.h));
    const build = (size: number) => buildDeviceDiagram(def, {
      devId: 'Q', term: size, main: size, gap: size > 44 ? 4 : 2, compact: true,
      tappable: () => true,   // 揭曉後也維持大顆（點擊由 answered 擋掉），TH-RY／按鈕才不會縮成虛線小圈
      tag: id => {
        const t = def.terminals.find(x => x.id === id)!;
        if (result) { const r = revealLabel(def, t); return { label: r.label, sub: r.sub, role: t.role, title: '' }; }
        return { label: displayLabel(def, t, q.display), sub: '', role: NEUTRAL_ROLE, title: '' };
      },
      onClick: tid => this.tap(tid.slice(2)),
    });
    // 端子由大到小試，挑第一個整張圖放得下的尺寸（最小 36px 仍好點）
    const fits = (f: { w: number; h: number }) => f.w <= availW && (def.card!.keepAspect ? Math.max(f.h, f.w / aspect) : f.h) <= availH;
    let built = build(56);
    for (const size of [52, 48, 44, 40, 36]) { if (fits(built.fit)) break; built = build(size); }
    const root = built.root;
    // 等比例的底座（TR、KR）：寬度同時受高度限制，才不會撐出畫面
    if (def.card!.keepAspect) root.style.maxWidth = `${Math.max(built.fit.w, Math.min(420, availH * aspect))}px`;
    root.classList.add('drill-diagram');
    for (const b of root.querySelectorAll<HTMLElement>('.card-term')) {
      const id = b.dataset.id!;
      if (result) {
        if (q.targets.includes(id)) b.classList.add('hit');
        else if (this.picked.includes(id)) b.classList.add('miss');
        else b.classList.add('dim');
      } else if (this.picked.includes(id)) b.classList.add('picked');
    }
    const box = h('div', 'drill-diagram-box');
    box.appendChild(root);
    return box;
  }

  private tap(id: string): void {
    if (this.answered) return;
    const q = this.ses!.current as TapQ;
    const i = this.picked.indexOf(id);
    if (i >= 0) this.picked.splice(i, 1); else this.picked.push(id);
    sfx.pick();
    vibrate(8);
    this.el.ans!.querySelector<HTMLElement>(`.card-term[data-id="${CSS.escape(id)}"]`)?.classList.toggle('picked', i < 0);
    if (this.picked.length >= q.targets.length) this.submit([...this.picked]);
  }

  private submit(input: string[]): void {
    if (this.answered || !this.ses) return;
    this.picked = input;
    this.finish(this.ses.answer(input, this.elapsed()), input);
  }

  private finish(r: AnswerResult, input: string[]): void {
    const ses = this.ses!;
    const q = ses.current!;
    this.answered = true;
    this.picked = input;
    clearInterval(this.ticker);
    this.stats = recordAnswer(this.stats, ses.answers[ses.answers.length - 1]);
    saveStats(this.stats);
    this.renderAnswer(q, r);
    this.renderStreak(r.ok);
    this.animateScore(ses.score);
    if (r.ok) {
      if (r.streak === 3 || r.streak === 5 || r.streak % 10 === 0) sfx.step(); else sfx.connect();
      vibrate(15);
      this.floatGain(r.gained, r.streak);
    } else {
      if (r.timedOut) { sfx.remove(); this.el.bar!.classList.add('out'); } else sfx.error();
      vibrate([30, 40, 30]);
      this.el.main!.classList.remove('shake');
      void this.el.main!.offsetWidth;
      this.el.main!.classList.add('shake');
    }
    // 回饋列
    const fb = this.el.fb!;
    fb.className = `drill-fb show ${r.ok ? 'ok' : 'bad'}`;
    const last = ses.index + 1 >= ses.total;
    const head = r.ok
      ? `<b>✔ 正確</b>　+${r.gained}${r.streak >= 2 ? `<span class="mult">連勝 ×${(1 + Math.min(r.streak - 1, 9) * 0.1).toFixed(1)}</span>` : ''}`
      : `<b>${r.timedOut ? '⏱ 時間到' : '✘ 答錯'}</b>　正解：<span class="ans">${this.correctText(q)}</span>`;
    const nextBtn = btn(last ? '看結果 ▶' : '下一題 ▶', 'drill-next', () => this.next());
    fb.replaceChildren(h('div', 'fb-head', head), h('div', 'fb-explain', q.explain), nextBtn);
    // 答對自動下一題（熟的題不拖時間）；答錯停下來看解說
    if (r.ok) this.autoNext = window.setTimeout(() => this.next(), last ? 1400 : 1100);
  }

  private correctText(q: DrillQ): string {
    if (q.answer === 'tap') return q.targets.map(id => { const t = q.def.terminals.find(x => x.id === id)!; return revealLabel(q.def, t).label; }).join('、') + '（圖上綠圈）';
    if (q.answer === 'choice') return q.options.find(o => o.key === q.correct)?.text ?? '';
    return '';
  }

  private next(): void {
    clearTimeout(this.autoNext);
    if (!this.ses || !this.answered) return;
    if (this.ses.next()) this.showQuestion(); else this.result();
  }

  private renderStreak(bump: boolean): void {
    const n = this.ses?.streak ?? 0;
    const el = this.el.streak!;
    el.innerHTML = n >= 2 ? `🔥<b>${n}</b>` : '';
    el.className = `drill-streak${n >= 5 ? ' hot' : ''}${n >= 10 ? ' blaze' : ''}`;
    if (bump && n >= 2) { void el.offsetWidth; el.classList.add('bump'); }
  }

  private animateScore(target: number): void {
    const el = this.el.score!;
    const from = this.shownScore, t0 = performance.now(), dur = 450;
    this.shownScore = target;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      el.textContent = Math.round(from + (target - from) * (1 - (1 - k) ** 3)).toLocaleString();
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  private floatGain(n: number, streak: number): void {
    const f = h('div', `drill-float${streak >= 5 ? ' hot' : ''}`, `+${n}`);
    this.el.main!.appendChild(f);
    setTimeout(() => f.remove(), 900);
  }

  /* ---------- 結算 ---------- */
  private result(): void {
    this.stopTimers();
    const ses = this.ses!;
    const sum = ses.summary();
    const rr = recordRound(this.stats, sum.score, sum.bestStreak);
    this.stats = rr.stats;
    saveStats(this.stats);
    sfx.step();
    const pct = sum.total ? Math.round((sum.correct / sum.total) * 100) : 0;
    const wrap = h('div', 'drill-home drill-result');
    const head = h('div', 'drill-head');
    head.append(btn('✕', 'drill-x', () => this.close()), h('div', 'drill-title', '本回合結果'), h('span', 'drill-spacer'));
    const big = h('div', 'drill-big');
    const scoreEl = h('div', 'score', '0');
    big.append(scoreEl, h('div', 'sub', '分'));
    if (rr.newBest) big.appendChild(h('div', 'badge', '🏆 新紀錄！'));
    const grade = pct === 100 ? '全對！腳位都記住了' : pct >= 80 ? '很穩，再衝一回全對' : pct >= 60 ? '有印象了，錯的下回會優先再出' : '先看解說，再來一回';
    big.appendChild(h('div', 'grade', grade));
    const grid = h('div', 'drill-hero');
    grid.append(
      h('div', 'stat', `<b>${sum.correct}/${sum.total}</b><small>答對（${pct}%）</small>`),
      h('div', 'stat', `<b>${sum.bestStreak}</b><small>最長連勝</small>`),
      h('div', 'stat', `<b>${sum.fastestMs !== null ? sec(sum.fastestMs) : '—'}</b><small>最快答對</small>`),
      h('div', 'stat', `<b>${sum.avgMs !== null ? sec(sum.avgMs) : '—'}</b><small>平均每題</small>`),
      h('div', 'stat', `<b>🔥 ${streakDays(this.stats)}</b><small>連續天數</small>`),
      h('div', 'stat', `<b>${this.stats.best?.score.toLocaleString() ?? '—'}</b><small>最佳分數</small>`),
    );
    const miss = ses.answers.map((a, i) => ({ a, q: ses.qs[i] })).filter(x => !x.a.ok);
    const list = h('div', 'drill-miss');
    if (miss.length) {
      list.appendChild(h('div', 'lbl', `答錯 ${miss.length} 題（下回優先再出）`));
      for (const { q } of miss) {
        const d = h('details');
        d.append(h('summary', '', `${plain(q.prompt)}<span class="ans">→ ${this.correctText(q).replace('（圖上綠圈）', '')}</span>`), h('div', 'fb-explain', q.explain));
        list.appendChild(d);
      }
    }
    const acts = h('div', 'drill-acts');
    acts.append(btn('再來一回', 'drill-next', () => this.start()), btn('回練習首頁', 'drill-ghost', () => this.home()), btn('回配電盤', 'drill-ghost', () => this.close()));
    const body = h('div', 'drill-body');
    body.append(big, grid, list, acts);
    wrap.append(head, body);
    this.root.replaceChildren(wrap);
    // 分數滾動
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 900);
      scoreEl.textContent = Math.round(sum.score * (1 - (1 - k) ** 3)).toLocaleString();
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ---------- 鍵盤（桌機） ---------- */
  private key(ev: KeyboardEvent): void {
    if (!this.isOpen) return;
    ev.stopPropagation();
    if (ev.key === 'Escape') { if (this.ses) this.home(); else this.close(); ev.preventDefault(); return; }
    const q = this.ses?.current;
    if (!q) { if (ev.key === 'Enter' && !this.ses) this.start(); return; }
    if (this.answered && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); this.next(); return; }
    if (!this.answered && q.answer === 'choice' && /^[1-4]$/.test(ev.key)) { const o = q.options[Number(ev.key) - 1]; if (o) this.submit([o.key]); }
  }
}
