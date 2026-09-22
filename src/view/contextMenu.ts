/** 右鍵選單：依按到的東西（端子／導線／器具／空白）給不同項目 */
export interface MenuItem {
  label?: string;
  hint?: string;          // 右側灰字（快捷鍵、數量）
  danger?: boolean;       // 紅色（刪除類）
  disabled?: boolean;
  sep?: boolean;          // 只當分隔線
  action?: () => void;
}

let menu: HTMLDivElement | null = null;
let cleanup: (() => void) | null = null;

export function hideMenu(): void {
  cleanup?.(); cleanup = null;
  menu?.remove(); menu = null;
}

export function showMenu(x: number, y: number, items: MenuItem[]): void {
  hideMenu();
  const list = items.filter((it, i, arr) => !(it.sep && (i === 0 || i === arr.length - 1 || arr[i - 1]?.sep)));
  if (!list.some(it => !it.sep)) return;
  const m = document.createElement('div');
  m.className = 'ctx-menu';
  for (const it of list) {
    if (it.sep) { const s = document.createElement('div'); s.className = 'ctx-sep'; m.appendChild(s); continue; }
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ctx-item' + (it.danger ? ' danger' : '');
    b.disabled = !!it.disabled;
    b.innerHTML = `<span>${it.label}</span>${it.hint ? `<small>${it.hint}</small>` : ''}`;
    b.addEventListener('click', ev => { ev.stopPropagation(); hideMenu(); it.action?.(); });
    m.appendChild(b);
  }
  document.body.appendChild(m);
  const r = m.getBoundingClientRect();
  let left = x + 2, top = y + 2;
  if (left + r.width > innerWidth - 6) left = Math.max(4, x - r.width - 2);
  if (top + r.height > innerHeight - 6) top = Math.max(4, innerHeight - r.height - 6);
  m.style.left = `${left}px`; m.style.top = `${top}px`;
  menu = m;

  const onDown = (ev: Event) => { if (!m.contains(ev.target as Node)) hideMenu(); };
  const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') { ev.stopPropagation(); hideMenu(); } };
  const onAway = () => hideMenu();
  // 下一個 tick 才掛，避免觸發選單的那次 pointerdown 立刻把它關掉
  setTimeout(() => {
    if (menu !== m) return;
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('wheel', onAway, { capture: true, passive: true });
    window.addEventListener('resize', onAway);
    window.addEventListener('blur', onAway);
  }, 0);
  cleanup = () => {
    window.removeEventListener('pointerdown', onDown, true);
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('wheel', onAway, { capture: true } as EventListenerOptions);
    window.removeEventListener('resize', onAway);
    window.removeEventListener('blur', onAway);
  };
}

export function menuOpen(): boolean { return menu !== null; }
