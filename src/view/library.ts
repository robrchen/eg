import { LIBRARY, KIND_NAME, KIND_NOTE, ROLE_COLOR, ROLE_NAME } from '../library';
import type { DeviceKind } from '../model/types';
import { buildDeviceDiagram } from './deviceDiagram';
import { openModal } from './report';

const h = (tag: string, cls = '', html = ''): HTMLElement => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };

/** 器具庫瀏覽：列出所有器具與端子圖 */
export function showLibrary(): void {
  const wrap = h('div', 'library');
  wrap.appendChild(h('h2', '', '器具庫'));
  wrap.appendChild(h('div', 'hint', '所有題目共用這一套器具定義（<code>src/library/</code>，每種一個檔案）。題目檔用 <code>place(kind, id, panel, x, y)</code> 把器具放到圖紙座標。考場實物腳位不同時只改對應檔案。'));
  const grid = h('div', 'library-grid');
  const order: DeviceKind[] = ['MC', 'TR', 'TRF', 'KR', 'THRY', 'PB', 'PL', 'BZ', 'DF', 'NFB', 'TB1', 'TB16', 'TBM4', 'TBM3', 'TB2', 'GBAR', 'EBAR'];
  for (const kind of order) {
    const def = LIBRARY[kind];
    const item = h('div', 'library-item');
    item.appendChild(h('div', 'card-head', `<span class="id">${kind}</span><span class="kind">${KIND_NAME[kind]}</span><span class="kind" style="margin-left:auto">${def.w} × ${def.h} mm</span>`));
    if (def.terminals.some(t => t.wireable !== false)) item.appendChild(buildDeviceDiagram(def, { displayOnly: true }).root);
    const roles = [...new Set(def.terminals.map(t => t.role))];
    const lg = h('div', 'card-legend');
    for (const r of roles) { const s = h('span', '', ROLE_NAME[r]); s.style.background = ROLE_COLOR[r]; lg.appendChild(s); }
    item.appendChild(lg);
    const els = def.elements.filter(e => e.kind !== 'link').map(e => e.kind === 'contact' ? `${e.name}（${e.type} 接點 ${e.t[0]}–${e.t[1]}）` : `${e.kind === 'coil' ? '線圈' : e.kind === 'lamp' ? '燈' : '蜂鳴器'} ${e.t[0]}–${e.t[1]}`);
    if (els.length) item.appendChild(h('div', 'card-note', '內部元件：' + els.join('；')));
    if (KIND_NOTE[kind]) item.appendChild(h('div', 'card-note', KIND_NOTE[kind]!));
    grid.appendChild(item);
  }
  wrap.appendChild(grid);
  openModal(wrap);
}
