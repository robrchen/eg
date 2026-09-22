import type { GradeReport } from '../engine/grader';

const modal = () => document.getElementById('modal')!;

export function openModal(inner: HTMLElement): void {
  const m = modal();
  const box = document.createElement('div');
  box.className = 'box';
  const close = document.createElement('button');
  close.className = 'close'; close.textContent = '✕';
  close.onclick = closeModal;
  box.append(close, inner);
  m.replaceChildren(box);
  m.hidden = false;
  m.onclick = ev => { if (ev.target === m) closeModal(); };
}
export function closeModal(): void { modal().hidden = true; modal().replaceChildren(); }

export function showImage(src: string, title: string): void {
  const wrap = document.createElement('div');
  const h = document.createElement('h3'); h.textContent = title; h.style.marginTop = '0';
  const img = document.createElement('img'); img.src = src; img.alt = title;
  wrap.append(h, img);
  openModal(wrap);
}

export function showReport(r: GradeReport, onLocate: (terminals: string[]) => void): void {
  const wrap = document.createElement('div');
  wrap.className = 'report';
  wrap.innerHTML = `<h2>評審結果</h2><span class="verdict ${r.pass ? 'pass' : 'fail'}">${r.pass ? '及格' : '不及格'}</span>`;
  const sec = (title: string, items: { text: string; cls: string; terminals?: string[] }[], empty: string) => {
    const h = document.createElement('h3'); h.textContent = title;
    const ul = document.createElement('ul');
    if (!items.length) { const li = document.createElement('li'); li.className = 'ok'; li.textContent = empty; ul.appendChild(li); }
    for (const it of items) {
      const li = document.createElement('li'); li.className = it.cls; li.textContent = it.text;
      if (it.terminals?.length) {
        const a = document.createElement('span'); a.className = 'link'; a.textContent = '　定位';
        a.onclick = () => { closeModal(); onLocate(it.terminals!); };
        li.appendChild(a);
      }
      ul.appendChild(li);
    }
    wrap.append(h, ul);
  };
  sec('一、重大缺點（任一項即不及格）', r.major.map(f => ({ text: f.text, cls: 'bad', terminals: f.terminals })), '無');
  sec('二、功能測試', r.scenarios.map(s => ({ text: `${s.pass ? '✔' : '✘'} ${s.name}${s.pass ? '' : '：' + s.failures.join('；')}`, cls: s.pass ? 'ok' : 'bad' })), '無');
  sec(`三、配線缺點（達 5 個不及格，目前 ${r.minor.length} 個）`, r.minor.map(f => ({ text: f.text, cls: 'bad', terminals: f.terminals })), '無');
  sec('四、與參考接線的差異提示（非判定依據）', r.hints.map(f => ({ text: f.text, cls: 'hint', terminals: f.terminals })), '與參考接線電氣等效');
  openModal(wrap);
}
