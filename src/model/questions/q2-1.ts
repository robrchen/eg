import type { QuestionDef, TeacherStep, Wire, PassThrough } from '../types';
import { place } from '../../library';
import circuitImg from '../../assets/circuit.png';
import layoutImg from '../../assets/layout.png';

/**
 * 第二站第一題：電動機正反轉兼 Y-Δ 啟動控制電路
 * 座標由器具位置圖（500×700mm）換算。
 */

/** 過門線 TB3.n ↔ TB4.n（已配妥） */
const doorLinks: PassThrough[] = Array.from({ length: 16 }, (_, i) => ({ a: `TB3.${i + 1}`, b: `TB4.${i + 1}` }));

/**
 * 考場已引接（依講義實物布局圖）：
 * - 按鈕本體 → 4P 小 TB（TB.1-2 為 b 接點、TB.3-4 為 a 接點）；
 *   操作面板是鏡射的背面，畫出來由左到右正好是講義上的 a a b b
 * - 燈／BZ 本體 → 3P 小 TB，只用兩側 TB.1、TB.3，中間空
 * - TH-RY 輔助接點 c b a → 本體下方 3P 小 TB，順序 c b a
 */
const PB_MAP = ['b上', 'b下', 'a上', 'a下'];
const preWired: PassThrough[] = [
  ...['FWD', 'REV', 'OFF'].flatMap(id => PB_MAP.map((t, i) => ({ a: `${id}.${t}`, b: `${id}_TB.${i + 1}` }))),
  ...['R', 'Y', 'G'].flatMap(id => [{ a: `${id}.X1`, b: `${id}_TB.1` }, { a: `${id}.X2`, b: `${id}_TB.3` }]),
  { a: 'BZ.1', b: 'BZ_TB.1' }, { a: 'BZ.2', b: 'BZ_TB.3' },
  { a: 'THRY.c', b: 'THRY_TB.1' }, { a: 'THRY.b', b: 'THRY_TB.2' }, { a: 'THRY.a', b: 'THRY_TB.3' },
];
const passThrough: PassThrough[] = [...doorLinks, ...preWired];

/** 老師 18 步驟。⊘n = 過門線 TB3.n ↔ TB4.n；括號線圈以 A1/A2 明示；> 為串接。 */
const teacherSteps: TeacherStep[] = [
  { n: 1, text: 'NFB/A → DF1', chain: 'NFB.A > DF1.上' },
  { n: 2, text: 'DF1 → MCF/b右 → ⊘1 → BZ → OFF/b', chain: 'DF1.下 > MCF.b右上 > ⊘1 > BZ_TB.1 > OFF_TB.1' },
  { n: 3, text: 'TH-RY/a → ⊘2 → BZ', chain: 'THRY_TB.3 > ⊘2 > BZ_TB.3' },
  { n: 4, text: 'DF2 → TH-RY/c → ⊘3 → G', chain: 'DF2.下 > THRY_TB.1 > ⊘3 > G_TB.3' },
  { n: 5, text: 'NFB/C → DF2', chain: 'NFB.C > DF2.上' },
  { n: 6, text: 'MCF/a左 → MCF/a右 → MCR/a左 → MCR/a右 → ⊘4 → OFF/b → FWD/a → REV/a',
    chain: 'MCF.a左上 > MCF.a右上 > MCR.a左上 > MCR.a右上 > ⊘4 > OFF_TB.2 > FWD_TB.3 > REV_TB.3' },
  { n: 7, text: 'MCF/a左 → MCR/b左 → ⊘5 → FWD/a', chain: 'MCF.a左下 > MCR.b左上 > ⊘5 > FWD_TB.4' },
  { n: 8, text: 'MCR/b左 → (MCF 線圈)', chain: 'MCR.b左下 > MCF.A1' },
  { n: 9, text: 'TH-RY/b → TR/7 → (MCF) → (MCR) → (MCS) → (MCD) → ⊘6 → Y → R',
    chain: 'THRY_TB.2 > TR.7 > MCF.A2 > MCR.A2 > MCS.A2 > MCD.A2 > ⊘6 > Y_TB.3 > R_TB.3' },
  { n: 10, text: 'MCR/a左 → MCF/b左 → ⊘7 → REV/a', chain: 'MCR.a左下 > MCF.b左上 > ⊘7 > REV_TB.4' },
  { n: 11, text: 'MCF/b左 → (MCR 線圈)', chain: 'MCF.b左下 > MCR.A1' },
  { n: 12, text: 'MCF/a右 → MCR/a右 → TR/2 → TR/8', chain: 'MCF.a右下 > MCR.a右下 > TR.2 > TR.8' },
  { n: 13, text: 'TR/5 → MCD/b', chain: 'TR.5 > MCD.b左上' },
  { n: 14, text: 'MCD/b → (MCS 線圈) → ⊘8 → Y', chain: 'MCD.b左下 > MCS.A1 > ⊘8 > Y_TB.1' },
  { n: 15, text: 'TR/6 → MCS/b', chain: 'TR.6 > MCS.b左上' },
  { n: 16, text: 'MCS/b → (MCD 線圈) → ⊘9 → R', chain: 'MCS.b左下 > MCD.A1 > ⊘9 > R_TB.1' },
  { n: 17, text: 'MCF/b右 → MCR/b右', chain: 'MCF.b右下 > MCR.b右上' },
  { n: 18, text: 'MCR/b右 → ⊘10 → G', chain: 'MCR.b右下 > ⊘10 > G_TB.1' },
];

const OPERATOR_DEVICES = new Set(['FWD', 'REV', 'OFF', 'R', 'Y', 'G', 'BZ', 'TB4', 'FWD_TB', 'REV_TB', 'OFF_TB', 'R_TB', 'Y_TB', 'G_TB', 'BZ_TB']);
export const panelOfTerminal = (tid: string) =>
  OPERATOR_DEVICES.has(tid.split('.')[0]) ? 'operator' : 'device';

/** 把鏈式字串展開成導線清單；⊘n 依前後端子所在面板換成 TB3.n / TB4.n。 */
export function expandChain(chain: string, stepNo = 0): Wire[] {
  const raw = chain.split('>').map(s => s.trim()).filter(Boolean);
  const wires: Wire[] = [];
  let k = 0;
  for (let i = 0; i < raw.length - 1; i++) {
    let a = raw[i], b = raw[i + 1];
    if (a.startsWith('⊘') && b.startsWith('⊘')) continue;
    if (a.startsWith('⊘')) a = (panelOfTerminal(b) === 'operator' ? 'TB4.' : 'TB3.') + a.slice(1);
    if (b.startsWith('⊘')) b = (panelOfTerminal(a) === 'operator' ? 'TB4.' : 'TB3.') + b.slice(1);
    const panel = panelOfTerminal(a);
    if (panel !== panelOfTerminal(b)) throw new Error(`chain crosses panels: ${a} > ${b}`);
    wires.push({ id: `t${stepNo}-${k++}`, a, b, panel });
  }
  return wires;
}

export function teacherWires(steps: TeacherStep[] = teacherSteps): Wire[] {
  return steps.flatMap(s => expandChain(s.chain, s.n));
}

export const Q2_1: QuestionDef = {
  id: 'q2-1',
  title: '第二站第一題：電動機正反轉兼 Y-Δ 啟動控制電路',
  minutes: 90,
  panels: {
    device: { name: '器具板', w: 500, h: 700 },
    operator: { name: '操作面板（開門・背面）', w: 500, h: 700, mirror: true, note: '門板打開後由內側配線，左右與正視圖相反' },
  },
  devices: [
    // 器具板
    place('TB1', 'TB1', 'device', 30, 33),
    place('NFB', 'NFB', 'device', 30, 105),
    place('DF', 'DF1', 'device', 161, 115, { label: 'D-F', desc: 'R 相控制電源保險絲' }),
    place('DF', 'DF2', 'device', 228, 115, { label: 'D-F', desc: 'T 相控制電源保險絲' }),
    place('MC', 'MCF', 'device', 40, 268, { desc: '正轉用（與 MCR 為可逆式機械互鎖組）' }),
    place('MC', 'MCR', 'device', 156, 268, { desc: '逆轉用（與 MCF 為可逆式機械互鎖組）' }),
    place('TR', 'TR', 'device', 279, 270, { desc: 'Y→Δ 切換計時' }),
    place('THRY', 'THRY', 'device', 28, 458, { label: 'TH-RY' }),
    place('TBM3', 'THRY_TB', 'device', 66, 518, { label: 'TH-RY 引接TB' }),
    place('MC', 'MCD', 'device', 128, 440, { desc: 'Δ 運轉用' }),
    place('MC', 'MCS', 'device', 244, 440, { desc: 'Y 啟動用' }),
    place('TB16', 'TB3', 'device', 438, 126),
    place('TB2', 'TB2', 'device', 30, 630, { display: true }),
    place('GBAR', 'G_BAR', 'device', 400, 612, { label: 'G', display: true }),
    // 操作面板
    place('PL', 'G', 'operator', 104, 221, { color: '#2ecc71' }),
    place('PL', 'R', 'operator', 168, 221, { color: '#e74c3c' }),
    place('PL', 'Y', 'operator', 232, 221, { color: '#f1c40f' }),
    place('BZ', 'BZ', 'operator', 297, 221, { color: '#95a5a6' }),
    place('PB', 'FWD', 'operator', 104, 378, { color: '#2ecc71' }),
    place('PB', 'REV', 'operator', 202, 378, { color: '#2ecc71' }),
    place('PB', 'OFF', 'operator', 297, 378, { color: '#e74c3c' }),
    place('TB16', 'TB4', 'operator', 431, 153),
    // 考場引接小 TB（無編號）
    place('TBM3', 'G_TB', 'operator', 109, 277, { label: 'G 引接TB' }),
    place('TBM3', 'R_TB', 'operator', 173, 277, { label: 'R 引接TB' }),
    place('TBM3', 'Y_TB', 'operator', 237, 277, { label: 'Y 引接TB' }),
    place('TBM3', 'BZ_TB', 'operator', 302, 277, { label: 'BZ 引接TB' }),
    place('TBM4', 'FWD_TB', 'operator', 104, 437, { label: 'FWD 引接TB' }),
    place('TBM4', 'REV_TB', 'operator', 202, 437, { label: 'REV 引接TB' }),
    place('TBM4', 'OFF_TB', 'operator', 297, 437, { label: 'OFF 引接TB' }),
  ],
  ducts: [
    { panel: 'device', x: 192, y: 23, w: 205, h: 34 },
    { panel: 'device', x: 356, y: 23, w: 41, h: 569 },
    { panel: 'device', x: 30, y: 211, w: 326, h: 38 },
    { panel: 'device', x: 30, y: 383, w: 326, h: 37 },
    { panel: 'device', x: 30, y: 553, w: 367, h: 39 },
    { panel: 'operator', x: 89, y: 301, w: 311, h: 30 },
    { panel: 'operator', x: 89, y: 465, w: 311, h: 44 },
    { panel: 'operator', x: 363, y: 153, w: 37, h: 356 },
  ],
  passThrough,
  timerDefaultSec: 5,
  teacherSteps,
  images: { circuit: circuitImg, layout: layoutImg },
  scenarios: [
    {
      name: '投入 NFB：僅 G 亮',
      steps: [
        { do: 'nfb', on: true }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '投入電源後只有 G 燈亮', state: { G: true, R: false, Y: false, BZ: false, MCF: false, MCR: false, MCS: false, MCD: false, TR: false } },
      ],
    },
    {
      name: '正轉 Y 啟動 → Δ 運轉 → OFF',
      steps: [
        { do: 'nfb', on: true }, { do: 'wait', ms: 300 },
        { do: 'press', device: 'FWD', ms: 300 }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '按 FWD 後 MCF、TR、MCS 動作，Y 亮，G 滅', state: { MCF: true, MCR: false, TR: true, MCS: true, MCD: false, Y: true, R: false, G: false, BZ: false } },
        { do: 'wait', ms: 6000 },
        { do: 'expect', note: 'TR 計時到，切換 Δ：MCS/Y 滅，MCD/R 亮', state: { MCF: true, MCS: false, MCD: true, Y: false, R: true, G: false } },
        { do: 'press', device: 'REV', ms: 300 }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '運轉中按 REV 應無作用（互鎖）', state: { MCF: true, MCR: false, MCD: true } },
        { do: 'press', device: 'OFF', ms: 300 }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '按 OFF 全部復歸，G 亮', state: { MCF: false, MCR: false, TR: false, MCS: false, MCD: false, Y: false, R: false, G: true } },
      ],
    },
    {
      name: '反轉 Y 啟動 → Δ 運轉 → OFF',
      steps: [
        { do: 'nfb', on: true }, { do: 'wait', ms: 300 },
        { do: 'press', device: 'REV', ms: 300 }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '按 REV 後 MCR、TR、MCS 動作，Y 亮', state: { MCR: true, MCF: false, TR: true, MCS: true, MCD: false, Y: true, G: false } },
        { do: 'wait', ms: 6000 },
        { do: 'expect', note: 'TR 計時到切換 Δ', state: { MCR: true, MCS: false, MCD: true, Y: false, R: true } },
        { do: 'press', device: 'FWD', ms: 300 }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '運轉中按 FWD 應無作用（互鎖）', state: { MCR: true, MCF: false } },
        { do: 'press', device: 'OFF', ms: 300 }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '按 OFF 全部復歸', state: { MCF: false, MCR: false, MCS: false, MCD: false, G: true } },
      ],
    },
    {
      name: '過載跳脫：BZ 響、全部停',
      steps: [
        { do: 'nfb', on: true }, { do: 'wait', ms: 300 },
        { do: 'press', device: 'FWD', ms: 300 }, { do: 'wait', ms: 6500 },
        { do: 'trip', device: 'THRY', on: true }, { do: 'wait', ms: 500 },
        { do: 'expect', note: 'TH-RY 跳脫：所有 MC 與 R/Y 滅，BZ 響，G 亮', state: { MCF: false, MCR: false, MCS: false, MCD: false, TR: false, R: false, Y: false, G: true, BZ: true } },
        { do: 'trip', device: 'THRY', on: false }, { do: 'wait', ms: 500 },
        { do: 'expect', note: 'TH-RY 復歸後 BZ 停、G 亮，不得自行再啟動', state: { BZ: false, G: true, MCF: false, MCR: false } },
      ],
    },
  ],
};
