import { el } from './svg';

/**
 * 共用 <defs>：器具「照片級」外觀用的漸層與濾鏡，一次掛在 svg 根。
 * 光源統一左上；漸層用 objectBoundingBox（預設），每個形狀各自套用。
 * CSS 以 fill: url(#id) 引用，所以 id 要穩定。
 */
export function buildDefs(): SVGDefsElement {
  const defs = el('defs');
  const lin = (id: string, stops: [number, string, number?][], x1 = 0, y1 = 0, x2 = 0, y2 = 1) => {
    const g = el('linearGradient', { id, x1, y1, x2, y2 });
    for (const [o, c, a] of stops) g.appendChild(el('stop', { offset: o, 'stop-color': c, ...(a !== undefined ? { 'stop-opacity': a } : {}) }));
    defs.appendChild(g);
  };
  const rad = (id: string, stops: [number, string, number?][], cx = .35, cy = .3, r = .75) => {
    const g = el('radialGradient', { id, cx, cy, r, fx: cx, fy: cy });
    for (const [o, c, a] of stops) g.appendChild(el('stop', { offset: o, 'stop-color': c, ...(a !== undefined ? { 'stop-opacity': a } : {}) }));
    defs.appendChild(g);
  };

  // 金屬螺絲頭：左上亮點、邊緣暗
  rad('g-screw', [[0, '#ffffff'], [.35, '#d9dde2'], [.75, '#9aa1aa'], [1, '#5f666f']]);
  rad('g-screw-dark', [[0, '#9aa0a8'], [.4, '#5d636b'], [1, '#2a2e34']]);
  // 鉻面固定環（按鈕／燈）：多段冷暖交錯的金屬反射
  lin('g-chrome', [[0, '#ffffff'], [.18, '#c9ced5'], [.36, '#f6f7f9'], [.55, '#8d949d'], [.72, '#dfe3e8'], [.88, '#7c838c'], [1, '#e8ebef']], 0, 0, 1, 1);
  // 塑膠殼體：淺灰（MC 本體、TH-RY）、中灰（端子罩）、黑（底座、NFB）
  lin('g-shell-light', [[0, '#f6f5f1'], [.5, '#e3e1db'], [1, '#cfccc4']]);
  lin('g-shell-mid', [[0, '#8a9099'], [.5, '#666c75'], [1, '#4a4f57']]);
  lin('g-shell-dark', [[0, '#4c5159'], [.5, '#33373d'], [1, '#202327']]);
  lin('g-shell-black', [[0, '#3a3d42'], [.5, '#222427'], [1, '#101113']]);
  // 白色銘牌：微微往下變灰，像有層透明膜
  lin('g-plate', [[0, '#ffffff'], [1, '#e6e5df']]);
  // 深色指示窗玻璃：上緣反光
  lin('g-glass', [[0, '#5b616a'], [.35, '#23262b'], [1, '#17191c']]);
  // 端子井內部：中心深、邊緣更深
  rad('g-well', [[0, '#3b3f45'], [.7, '#1e2125'], [1, '#0f1113']], .5, .4, .7);
  // 上緣高光（白→透明）
  lin('g-gloss', [[0, '#ffffff', .55], [.6, '#ffffff', .08], [1, '#ffffff', 0]]);
  // 按鈕帽／鏡頭：半球體（左上亮、右下暗）
  rad('g-dome', [[0, '#ffffff', .75], [.35, '#ffffff', .12], [.8, '#000000', .08], [1, '#000000', .45]], .35, .32, .8);
  // EMS 黃色警示環
  lin('g-ems', [[0, '#ffe36b'], [.5, '#f5c518'], [1, '#c99a00']]);
  // 紅／藍按鈕
  rad('g-btn-red', [[0, '#ff8a80'], [.5, '#e03a3a'], [1, '#8e1c1c']]);
  rad('g-btn-blue', [[0, '#8fc1ff'], [.5, '#3a7be0'], [1, '#1b4a94']]);
  // 銅排
  lin('g-copper', [[0, '#e3a462'], [.5, '#c98a4b'], [1, '#8f5a2a']]);

  // 柔和落影（整個器具群組用）
  const sh = el('filter', { id: 'f-shadow', x: '-10%', y: '-10%', width: '125%', height: '130%' });
  sh.appendChild(el('feDropShadow', { dx: 1.2, dy: 1.8, stdDeviation: 1.2, 'flood-color': '#000', 'flood-opacity': .35 }));
  defs.appendChild(sh);
  // 內陰影（大面積凹面用，少用）
  const ins = el('filter', { id: 'f-inset', x: '-5%', y: '-5%', width: '110%', height: '110%' });
  ins.appendChild(el('feOffset', { dx: .8, dy: 1.2, in: 'SourceAlpha', result: 'off' }));
  ins.appendChild(el('feGaussianBlur', { in: 'off', stdDeviation: .9, result: 'blur' }));
  ins.appendChild(el('feComposite', { in: 'blur', in2: 'SourceAlpha', operator: 'arithmetic', k2: -1, k3: 1, result: 'inner' }));
  ins.appendChild(el('feFlood', { 'flood-color': '#000', 'flood-opacity': .55 }));
  ins.appendChild(el('feComposite', { in2: 'inner', operator: 'in', result: 'shade' }));
  const m = el('feMerge'); m.appendChild(el('feMergeNode', { in: 'SourceGraphic' })); m.appendChild(el('feMergeNode', { in: 'shade' }));
  ins.appendChild(m);
  defs.appendChild(ins);
  return defs;
}
