/**
 * 單線圖浮動視窗：配線途中隨時叫出來看（D 鍵／工具列），可拖曳、縮放大小、滾輪縮放、拖曳平移、半透明。
 * 教學互動：
 *  - 滑到圖上的符號 → 面板上對應器具閃紅框；點符號 → 鏡頭帶過去
 *  - 滑到面板上的器具 → 圖上它的所有符號亮黃框
 *  - 步驟引導時，下一條線兩端所屬器具的符號以紅色脈動框標出，底部顯示該步驟說明
 */
import type { SchematicDef } from '../model/types';

const NS = 'http://www.w3.org/2000/svg';
const KEY = 'yishipei:schem';

export interface SchematicEvents {
  hover(dev: string | null): void;
  click(dev: string): void;
}

interface Saved { open: boolean; left: number; top: number; width: number; height: number; ghost: boolean }

export class SchematicWindow {
  private el: HTMLDivElement;
  private svg: SVGSVGElement;
  private world: SVGGElement;
  private caption: HTMLDivElement;
  private rects: { dev: string; r: SVGRectElement }[] = [];
  private view = { x: 0, y: 0, k: 1 };
  private hoverSet = new Set<string>();
  private guideSet = new Set<string>();

  constructor(private def: SchematicDef, private ev: SchematicEvents) {
    const el = document.createElement('div');
    el.className = 'schem';
    el.hidden = true;
    el.innerHTML = `<div class="schem-head"><b>單線圖</b><span class="schem-tip">滑符號看器具・點符號轉過去・滾輪縮放</span>
      <button data-a="ghost" title="半透明">◐</button><button data-a="fit" title="整張">⤢</button><button data-a="close" title="關閉 (D)">✕</button></div>
      <div class="schem-body"></div><div class="schem-cap" hidden></div>`;
    this.el = el;
    this.caption = el.querySelector('.schem-cap')!;
    this.svg = document.createElementNS(NS, 'svg');
    this.world = document.createElementNS(NS, 'g');
    this.svg.appendChild(this.world);
    const img = document.createElementNS(NS, 'image');
    img.setAttribute('href', def.img);
    img.setAttribute('width', String(def.w)); img.setAttribute('height', String(def.h));
    this.world.appendChild(img);
    for (const [dev, x, y, w, h] of def.hotspots) {
      const r = document.createElementNS(NS, 'rect');
      Object.entries({ x, y, width: w, height: h, rx: 6 }).forEach(([k, v]) => r.setAttribute(k, String(v)));
      r.setAttribute('class', 'hs');
      r.addEventListener('pointerenter', () => { this.ev.hover(dev); this.setHover([dev]); });
      r.addEventListener('pointerleave', () => { this.ev.hover(null); this.setHover([]); });
      r.addEventListener('click', e => { if (!this.moved) this.ev.click(dev); e.stopPropagation(); });
      this.world.appendChild(r);
      this.rects.push({ dev, r });
    }
    el.querySelector('.schem-body')!.appendChild(this.svg);
    document.body.appendChild(el);
    this.bind();
    this.restore();
  }

  get isOpen(): boolean { return !this.el.hidden; }
  toggle(): void { this.isOpen ? this.close() : this.open(); }
  open(): void { this.el.hidden = false; requestAnimationFrame(() => this.fit()); this.save(); }
  close(): void { this.el.hidden = true; this.ev.hover(null); this.save(); }

  /** 面板上滑過的器具 → 圖上符號亮框 */
  setHover(devs: string[]): void { this.hoverSet = new Set(devs); this.paint(); }
  /** 步驟引導：下一條線兩端的器具 + 步驟說明 */
  setGuide(devs: string[], caption: string): void {
    this.guideSet = new Set(devs);
    this.caption.hidden = !caption;
    this.caption.innerHTML = caption;
    this.paint();
  }
  has(dev: string): boolean { return this.rects.some(r => r.dev === dev); }

  private paint(): void {
    for (const { dev, r } of this.rects) {
      r.classList.toggle('hover', this.hoverSet.has(dev));
      r.classList.toggle('guide', this.guideSet.has(dev));
    }
  }

  private fit(): void {
    const r = this.svg.getBoundingClientRect(); if (r.width < 10) return;
    const k = Math.min(r.width / this.def.w, r.height / this.def.h);
    this.view = { k, x: (r.width - this.def.w * k) / 2, y: (r.height - this.def.h * k) / 2 };
    this.apply();
  }
  private apply(): void { this.world.setAttribute('transform', `translate(${this.view.x},${this.view.y}) scale(${this.view.k})`); }

  private moved = false;
  private bind(): void {
    const head = this.el.querySelector<HTMLElement>('.schem-head')!;
    head.addEventListener('click', e => {
      const a = (e.target as HTMLElement).closest('button')?.dataset.a;
      if (a === 'close') this.close();
      else if (a === 'fit') this.fit();
      else if (a === 'ghost') { this.el.classList.toggle('ghost'); this.save(); }
    });
    // 拖曳標題列移動視窗
    head.addEventListener('pointerdown', e => {
      if ((e.target as HTMLElement).closest('button')) return;
      const sx = e.clientX, sy = e.clientY, l = this.el.offsetLeft, t = this.el.offsetTop;
      head.setPointerCapture(e.pointerId);
      const mv = (m: PointerEvent) => {
        this.el.style.left = `${Math.max(0, Math.min(innerWidth - 80, l + m.clientX - sx))}px`;
        this.el.style.top = `${Math.max(0, Math.min(innerHeight - 40, t + m.clientY - sy))}px`;
      };
      const up = () => { head.removeEventListener('pointermove', mv); head.removeEventListener('pointerup', up); this.save(); };
      head.addEventListener('pointermove', mv); head.addEventListener('pointerup', up);
    });
    // 圖面：滾輪縮放、拖曳平移
    this.svg.addEventListener('wheel', e => {
      e.preventDefault();
      const r = this.svg.getBoundingClientRect();
      const px = e.clientX - r.left, py = e.clientY - r.top;
      const k = Math.max(0.15, Math.min(4, this.view.k * Math.exp(-e.deltaY * 0.0015)));
      const wx = (px - this.view.x) / this.view.k, wy = (py - this.view.y) / this.view.k;
      this.view = { k, x: px - wx * k, y: py - wy * k };
      this.apply();
    }, { passive: false });
    this.svg.addEventListener('pointerdown', e => {
      const sx = e.clientX, sy = e.clientY, v = { ...this.view };
      this.moved = false;
      const mv = (m: PointerEvent) => {
        if (Math.hypot(m.clientX - sx, m.clientY - sy) > 4) this.moved = true;
        if (!this.moved) return;
        this.view = { ...v, x: v.x + m.clientX - sx, y: v.y + m.clientY - sy };
        this.apply();
      };
      const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    });
    // 視窗大小改變（CSS resize）後存起來
    new ResizeObserver(() => { if (this.isOpen) this.save(); }).observe(this.el);
    // 視窗內的操作不要傳到頁面（避免觸發面板快捷鍵以外的行為）
    this.el.addEventListener('pointerdown', e => e.stopPropagation());
  }

  private save(): void {
    const s: Saved = { open: this.isOpen, left: this.el.offsetLeft, top: this.el.offsetTop, width: this.el.offsetWidth, height: this.el.offsetHeight, ghost: this.el.classList.contains('ghost') };
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
  }
  private restore(): void {
    let s: Partial<Saved> = {};
    try { s = JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { /* ignore */ }
    const w = Math.min(s.width ?? 560, innerWidth - 20), h = Math.min(s.height ?? 400, innerHeight - 20);
    this.el.style.width = `${w}px`; this.el.style.height = `${h}px`;
    this.el.style.left = `${Math.max(0, Math.min(innerWidth - w, s.left ?? innerWidth - w - 400))}px`;
    this.el.style.top = `${Math.max(0, Math.min(innerHeight - h, s.top ?? 90))}px`;
    this.el.classList.toggle('ghost', !!s.ghost);
    if (s.open) this.open();
  }
}
