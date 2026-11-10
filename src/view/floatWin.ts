/**
 * 浮動視窗：把右側面板裡的內容（場景）搬到畫布上方，可拖曳、改大小；關閉時把內容放回原位。
 */
export class FloatWin {
  private el: HTMLElement;
  private body: HTMLElement;
  private placeholder = document.createComment('floatwin');
  private content: HTMLElement | null = null;
  private drag: { x: number; y: number; left: number; top: number } | null = null;

  constructor(title: string) {
    this.el = document.createElement('div');
    this.el.className = 'floatwin';
    this.el.hidden = true;
    const head = document.createElement('div'); head.className = 'floatwin-head';
    const b = document.createElement('b'); b.textContent = title;
    const close = document.createElement('button'); close.textContent = '✕'; close.title = '放回右側面板'; close.onclick = () => this.close();
    head.append(b, close);
    this.body = document.createElement('div'); this.body.className = 'floatwin-body';
    this.el.append(head, this.body);
    document.body.appendChild(this.el);
    head.addEventListener('pointerdown', ev => {
      if ((ev.target as Element).tagName === 'BUTTON') return;
      head.setPointerCapture(ev.pointerId);
      const r = this.el.getBoundingClientRect();
      this.drag = { x: ev.clientX, y: ev.clientY, left: r.left, top: r.top };
    });
    head.addEventListener('pointermove', ev => {
      if (!this.drag) return;
      const left = Math.max(0, Math.min(innerWidth - 80, this.drag.left + ev.clientX - this.drag.x));
      const top = Math.max(0, Math.min(innerHeight - 40, this.drag.top + ev.clientY - this.drag.y));
      this.el.style.left = `${left}px`; this.el.style.top = `${top}px`;
    });
    const end = () => { this.drag = null; };
    head.addEventListener('pointerup', end); head.addEventListener('pointercancel', end);
  }

  get isOpen(): boolean { return !this.el.hidden; }

  /** 把 content 搬進浮動視窗（原位置留一個佔位符） */
  open(content: HTMLElement): void {
    if (this.content && this.content !== content) this.close();
    if (!this.isOpen || this.content !== content) {
      content.parentNode?.insertBefore(this.placeholder, content);
      this.body.appendChild(content);
      this.content = content;
    }
    if (!this.el.style.left) {
      const stage = document.getElementById('stage')?.getBoundingClientRect();
      this.el.style.left = `${Math.max(8, (stage?.right ?? innerWidth) - 420)}px`;
      this.el.style.top = `${(stage?.top ?? 60) + 48}px`;
    }
    this.el.hidden = false;
  }

  close(): void {
    if (this.content && this.placeholder.parentNode) {
      this.placeholder.parentNode.insertBefore(this.content, this.placeholder);
      this.placeholder.remove();
    }
    this.content = null;
    this.el.hidden = true;
  }

  toggle(content: HTMLElement): void { if (this.isOpen) this.close(); else this.open(content); }
}
