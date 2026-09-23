import type { QuestionDef, TeacherStep, PassThrough } from '../types';
import { place } from '../../library';
import circuitImg from '../../assets/q2-2-circuit.png';
import layoutImg from '../../assets/q2-2-layout.png';
import { doorLinks, pbPreWired, lampPreWired, thryPreWired } from './common';
import { Q2_2_SCHEMATIC } from './q2-2.schematic';

/**
 * 第二站第二題：電動機正反轉兼 Y-Δ 啟動附瞬時停電保護控制電路
 * 器具座標由官方器具位置圖（500×700mm）換算；與第一題相同的器具沿用相同位置。
 *
 * 動作要點（依控制電路圖）：
 * - EMS（蕈狀、非自復）串在 R 相最前面，按下全部斷電（含 G）。
 * - 按 FWD：MCF 與 KR 的 SC（設定線圈）同時得電，KR 記住「正轉」；按 REV：MCR 與 RC（復歸線圈），KR 記住「反轉」。
 * - Y-Δ：MCF a ∥ MCR a → TR1；TR1 b → MCD b → MCS（Y）；TR1 a → MCS b → MCD（Δ）。
 * - Δ 運轉時 MCD a 經 OFF b 使 TR2（斷電延遲 5 秒）得電：TR2 b 打開（按鈕失效）、TR2 a 閉合 → KR a／b 依記憶接到正／反轉回路。
 *   瞬時停電（5 秒內復電）→ TR2 a 還閉合 → 依 KR 記住的方向自動再起動。
 * - 按 OFF：OFF b 使 TR2 斷電、OFF a 使 TR3（斷電延遲 10 秒）得電 → TR3 b 打開切斷全部；
 *   TR3 保持 10 秒比 TR2 的 5 秒久，所以按 OFF 停機不會被當成停電而自動再起動。
 * - 燈：MCD a → KR a → R1（正轉 Δ）、KR b → R3（反轉 Δ）；MCD b → R2（Y 啟動中）；MCF b → MCR b → G（停止）。
 * - TH-RY b 串在線圈共同線上，G 燈直接接 T 相（不經 TH-RY）。
 */

const preWired: PassThrough[] = [
  ...pbPreWired(['EMS', 'FWD', 'REV', 'OFF']),
  ...lampPreWired(['R1', 'R2', 'R3', 'G']),
  ...thryPreWired,
];
const passThrough: PassThrough[] = [...doorLinks, ...preWired];

/**
 * 參考接線（依控制電路圖編排；⊘n = 過門線 TB3.n ↔ TB4.n）。
 * 過門線分配：1 R相(保險絲後) 2 EMS後母線 3 按鈕共同 4 正轉節點 5 反轉節點 6 OFF a→TR3 7 OFF b→MCD a
 *            8 R1 9 R3 10 R2 11 G 12 線圈共同線（R 燈回線）13 T 相（G 回線）
 */
const teacherSteps: TeacherStep[] = [
  { n: 1, text: 'NFB/R → D-F', chain: 'NFB.A > DF1.上' },
  { n: 2, text: 'NFB/T → D-F', chain: 'NFB.C > DF2.上' },
  { n: 3, text: 'D-F(R) → ⊘1 → EMS/b', chain: 'DF1.下 > ⊘1 > EMS_TB.1' },
  { n: 4, text: 'EMS/b → ⊘2 → TR3/8 → MCF/b右 → MCF/a右 → MCR/a右', chain: 'EMS_TB.2 > ⊘2 > TR3.8 > MCF.b右上 > MCF.a右上 > MCR.a右上' },
  { n: 5, text: 'EMS/b → OFF/b → OFF/a', chain: 'EMS_TB.2 > OFF_TB.1 > OFF_TB.3' },
  { n: 6, text: 'TR3/5 → TR2/8 → MCF/a左 → MCR/a左', chain: 'TR3.5 > TR2.8 > MCF.a左上 > MCR.a左上' },
  { n: 7, text: 'TR2/5 → ⊘3 → FWD/a → REV/a', chain: 'TR2.5 > ⊘3 > FWD_TB.3 > REV_TB.3' },
  { n: 8, text: 'FWD/a → ⊘4 → MCF/a左 → (MCF) → KR/2(SC) → KR/4', chain: 'FWD_TB.4 > ⊘4 > MCF.a左下 > MCF.A1 > KR.2 > KR.4' },
  { n: 9, text: 'REV/a → ⊘5 → MCR/a左 → (MCR) → KR/5(RC) → KR/3', chain: 'REV_TB.4 > ⊘5 > MCR.a左下 > MCR.A1 > KR.5 > KR.3' },
  { n: 10, text: 'TR2/6 → KR/1', chain: 'TR2.6 > KR.1' },
  { n: 11, text: '(MCF) → KR/10(SC) → MCR/b左', chain: 'MCF.A2 > KR.10 > MCR.b左上' },
  { n: 12, text: '(MCR) → KR/7(RC) → MCF/b左', chain: 'MCR.A2 > KR.7 > MCF.b左上' },
  { n: 13, text: 'MCF/a右 → MCR/a右 → TR1/2 → TR1/8 → MCD/a左 → MCD/b右', chain: 'MCF.a右下 > MCR.a右下 > TR1.2 > TR1.8 > MCD.a左上 > MCD.b右上' },
  { n: 14, text: 'TR1/5 → MCD/b左', chain: 'TR1.5 > MCD.b左上' },
  { n: 15, text: 'MCD/b左 → (MCS)', chain: 'MCD.b左下 > MCS.A1' },
  { n: 16, text: 'TR1/6 → MCS/b左', chain: 'TR1.6 > MCS.b左上' },
  { n: 17, text: 'MCS/b左 → (MCD)', chain: 'MCS.b左下 > MCD.A1' },
  { n: 18, text: 'MCD/a左 → KR/11', chain: 'MCD.a左下 > KR.11' },
  { n: 19, text: 'KR/8 → ⊘8 → R1', chain: 'KR.8 > ⊘8 > R1_TB.1' },
  { n: 20, text: 'KR/9 → ⊘9 → R3', chain: 'KR.9 > ⊘9 > R3_TB.1' },
  { n: 21, text: 'MCD/b右 → ⊘10 → R2', chain: 'MCD.b右下 > ⊘10 > R2_TB.1' },
  { n: 22, text: 'MCF/b右 → MCR/b右', chain: 'MCF.b右下 > MCR.b右上' },
  { n: 23, text: 'MCR/b右 → ⊘11 → G', chain: 'MCR.b右下 > ⊘11 > G_TB.1' },
  { n: 24, text: 'OFF/a → ⊘6 → TR3/2', chain: 'OFF_TB.4 > ⊘6 > TR3.2' },
  { n: 25, text: 'OFF/b → ⊘7 → MCD/a右', chain: 'OFF_TB.2 > ⊘7 > MCD.a右上' },
  { n: 26, text: 'MCD/a右 → TR2/2', chain: 'MCD.a右下 > TR2.2' },
  { n: 27, text: 'TH-RY/b → TR1/7 → TR2/7 → TR3/7 → (MCS) → (MCD) → MCF/b左 → MCR/b左 → ⊘12 → R1 → R2 → R3',
    chain: 'THRY_TB.2 > TR1.7 > TR2.7 > TR3.7 > MCS.A2 > MCD.A2 > MCF.b左下 > MCR.b左下 > ⊘12 > R1_TB.3 > R2_TB.3 > R3_TB.3' },
  { n: 28, text: 'D-F(T) → TH-RY/c → ⊘13 → G', chain: 'DF2.下 > THRY_TB.1 > ⊘13 > G_TB.3' },
  { n: 29, text: '設備接地：G 端子板 → E（8mm² 綠線）', chain: 'G_BAR.G2 > E.E1' },
];

const on = (st: Record<string, boolean>) => st;

export const Q2_2: QuestionDef = {
  id: 'q2-2',
  title: '第二站第二題：電動機正反轉兼 Y-Δ 啟動附瞬時停電保護控制電路',
  minutes: 90,
  panels: {
    device: { name: '器具板', w: 500, h: 700 },
    operator: { name: '操作面板（開門・背面）', w: 500, h: 700, mirror: true, note: '門板打開後由內側配線，左右與正視圖相反' },
  },
  devices: [
    // 器具板（第一排：TB1、NFB、D-F×2、TR1、TR2）
    place('TB1', 'TB1', 'device', 30, 33),
    place('NFB', 'NFB', 'device', 30, 105),
    place('DF', 'DF1', 'device', 128, 115, { label: 'D-F', desc: 'R 相控制電源保險絲' }),
    place('DF', 'DF2', 'device', 174, 115, { label: 'D-F', desc: 'T 相控制電源保險絲' }),
    place('TR', 'TR1', 'device', 222, 110, { desc: 'Y→Δ 切換計時（時間用通電測試的滑桿）' }),
    place('TRF', 'TR2', 'device', 300, 110, { desc: '瞬時停電保護：斷電延遲 5 秒', timerSec: 5 }),
    // 第二排：MCF、MCR、KR、TR3
    place('MC', 'MCF', 'device', 22, 268, { desc: '正轉用（與 MCR 為可逆式機械互鎖組）', spec: 'AC 220V 11kW (15HP), coil 220V, 3P, 輔助接點 2a2b；與 MCR 2 只一組，可逆式、機械互鎖' }),
    place('MC', 'MCR', 'device', 134, 268, { desc: '逆轉用（與 MCF 為可逆式機械互鎖組）', spec: 'AC 220V 11kW (15HP), coil 220V, 3P, 輔助接點 2a2b；與 MCF 2 只一組，可逆式、機械互鎖' }),
    place('KR', 'KR', 'device', 250, 280, { desc: '記住最後的運轉方向（SC 正轉／RC 反轉）' }),
    place('TRF', 'TR3', 'device', 320, 282, { desc: 'OFF 停機鎖定：斷電延遲 10 秒', timerSec: 10 }),
    // 第三排：TH-RY、MCD、MCS
    place('THRY', 'THRY', 'device', 26, 458, { label: 'TH-RY' }),
    place('TBM3', 'THRY_TB', 'device', 64, 518, { label: 'TH-RY 引接TB' }),
    place('MC', 'MCD', 'device', 142, 440, { desc: 'Δ 運轉用', spec: 'AC 220V 7.5kW (10HP), coil 220V, 3P, 輔助接點 2a2b' }),
    place('MC', 'MCS', 'device', 272, 440, { desc: 'Y 啟動用', spec: 'AC 220V 5.5kW (7.5HP), coil 220V, 3P, 輔助接點 2a2b' }),
    place('TB16', 'TB3', 'device', 438, 126),
    place('TB2', 'TB2', 'device', 30, 630, { display: true }),
    place('GBAR', 'G_BAR', 'device', 400, 612, { label: 'G' }),
    // 接地極端子板 E：檢定崗位備妥、在控制箱外（器具板下緣之外）
    place('EBAR', 'E', 'device', 410, 724, { label: 'E', desc: '檢定崗位接地極（控制箱外）' }),
    // 操作面板（正視圖座標）
    place('PL', 'R1', 'operator', 100, 221, { color: '#e74c3c', desc: '正轉 Δ 運轉' }),
    place('PL', 'R2', 'operator', 174, 221, { color: '#e74c3c', desc: 'Y 啟動中' }),
    place('PL', 'R3', 'operator', 248, 221, { color: '#e74c3c', desc: '反轉 Δ 運轉' }),
    place('PL', 'G', 'operator', 322, 221, { color: '#2ecc71', desc: '停止' }),
    place('PB', 'EMS', 'operator', 100, 378, { color: '#e74c3c', latch: true, spec: '30mmφ, 600V, 1a1b, 押扣式, 紅色, 非復歸式', desc: '緊急停止（蕈狀、非自復：按一下鎖住、再按一下解除）' }),
    place('PB', 'FWD', 'operator', 174, 378, { color: '#2ecc71' }),
    place('PB', 'REV', 'operator', 248, 378, { color: '#2ecc71' }),
    place('PB', 'OFF', 'operator', 322, 378, { color: '#e74c3c', desc: '1a1b 都用：a 啟動 TR3、b 切斷 TR2' }),
    place('TB16', 'TB4', 'operator', 431, 153),
    // 考場引接小 TB（無編號）
    place('TBM3', 'R1_TB', 'operator', 105, 277, { label: 'R1 引接TB' }),
    place('TBM3', 'R2_TB', 'operator', 179, 277, { label: 'R2 引接TB' }),
    place('TBM3', 'R3_TB', 'operator', 253, 277, { label: 'R3 引接TB' }),
    place('TBM3', 'G_TB', 'operator', 327, 277, { label: 'G 引接TB' }),
    place('TBM4', 'EMS_TB', 'operator', 100, 437, { label: 'EMS 引接TB' }),
    place('TBM4', 'FWD_TB', 'operator', 174, 437, { label: 'FWD 引接TB' }),
    place('TBM4', 'REV_TB', 'operator', 248, 437, { label: 'REV 引接TB' }),
    place('TBM4', 'OFF_TB', 'operator', 322, 437, { label: 'OFF 引接TB' }),
  ],
  ducts: [
    { panel: 'device', x: 192, y: 23, w: 241, h: 34 },
    { panel: 'device', x: 392, y: 23, w: 41, h: 569 },
    { panel: 'device', x: 30, y: 211, w: 362, h: 38 },
    { panel: 'device', x: 30, y: 383, w: 362, h: 37 },
    { panel: 'device', x: 30, y: 553, w: 403, h: 39 },
    { panel: 'operator', x: 89, y: 301, w: 338, h: 30 },
    { panel: 'operator', x: 89, y: 465, w: 338, h: 44 },
    { panel: 'operator', x: 390, y: 153, w: 37, h: 356 },
  ],
  passThrough,
  timerDefaultSec: 5,
  teacherSteps,
  images: { circuit: circuitImg, layout: layoutImg },
  schematic: Q2_2_SCHEMATIC,
  scenarios: [
    {
      name: '投入 NFB：僅 G 亮',
      steps: [
        { do: 'nfb', on: true }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '投入電源後只有 G 燈亮', state: on({ G: true, R1: false, R2: false, R3: false, MCF: false, MCR: false, MCS: false, MCD: false, TR1: false, TR2: false, TR3: false }) },
      ],
    },
    {
      name: '正轉 Y 啟動 → Δ 運轉 → OFF 停機不再起動',
      steps: [
        { do: 'nfb', on: true }, { do: 'wait', ms: 300 },
        { do: 'press', device: 'FWD', ms: 300 }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '按 FWD：MCF、TR1、MCS 動作，KR 設定（記住正轉），R2 亮、G 滅', state: { MCF: true, MCR: false, TR1: true, MCS: true, MCD: false, KR: true, R2: true, R1: false, R3: false, G: false } },
        { do: 'wait', ms: 6000 },
        { do: 'expect', note: 'TR1 計時到切換 Δ：MCS 放開、MCD 動作，R1 亮、R2 滅，TR2 得電', state: { MCF: true, MCS: false, MCD: true, R1: true, R2: false, R3: false, TR2: true } },
        { do: 'press', device: 'REV', ms: 300 }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '運轉中按 REV 無作用', state: { MCF: true, MCR: false, MCD: true } },
        { do: 'press', device: 'OFF', ms: 300 }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '按 OFF：全部停止，TR3 動作鎖住，G 亮', state: { MCF: false, MCR: false, MCS: false, MCD: false, TR1: false, TR3: true, R1: false, G: true } },
        { do: 'wait', ms: 11000 },
        { do: 'expect', note: 'TR2、TR3 延時結束後也不會自動再起動', state: { MCF: false, MCR: false, TR2: false, TR3: false, G: true } },
      ],
    },
    {
      name: '反轉 Y 啟動 → Δ 運轉（R3 亮）',
      steps: [
        { do: 'nfb', on: true }, { do: 'wait', ms: 300 },
        { do: 'press', device: 'REV', ms: 300 }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '按 REV：MCR、TR1、MCS 動作，KR 復歸（記住反轉），R2 亮', state: { MCR: true, MCF: false, TR1: true, MCS: true, KR: false, R2: true, G: false } },
        { do: 'wait', ms: 6000 },
        { do: 'expect', note: 'Δ 運轉：MCD 動作，R3 亮（R1 不亮）', state: { MCR: true, MCD: true, MCS: false, R3: true, R1: false, R2: false } },
        { do: 'press', device: 'FWD', ms: 300 }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '運轉中按 FWD 無作用', state: { MCR: true, MCF: false } },
      ],
    },
    {
      name: '正轉中瞬時停電 1 秒 → 自動以正轉再起動',
      steps: [
        { do: 'nfb', on: true }, { do: 'wait', ms: 300 },
        { do: 'press', device: 'FWD', ms: 300 }, { do: 'wait', ms: 6500 },
        { do: 'nfb', on: false }, { do: 'wait', ms: 1000 },
        { do: 'expect', note: '停電中全部失磁，TR2 仍在延時、KR 保持正轉', state: { MCF: false, MCD: false, TR2: true, KR: true } },
        { do: 'nfb', on: true }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '5 秒內復電：MCF 自動再起動（Y 啟動）', state: { MCF: true, MCR: false, MCS: true, TR1: true } },
        { do: 'wait', ms: 6000 },
        { do: 'expect', note: '再切換到 Δ 運轉', state: { MCF: true, MCD: true, R1: true } },
      ],
    },
    {
      name: '反轉中瞬時停電 1 秒 → 自動以反轉再起動',
      steps: [
        { do: 'nfb', on: true }, { do: 'wait', ms: 300 },
        { do: 'press', device: 'REV', ms: 300 }, { do: 'wait', ms: 6500 },
        { do: 'nfb', on: false }, { do: 'wait', ms: 1000 },
        { do: 'nfb', on: true }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '依 KR 記住的方向，MCR 自動再起動', state: { MCR: true, MCF: false, MCS: true } },
      ],
    },
    {
      name: '長時間停電（超過 5 秒）→ 不再起動',
      steps: [
        { do: 'nfb', on: true }, { do: 'wait', ms: 300 },
        { do: 'press', device: 'FWD', ms: 300 }, { do: 'wait', ms: 6500 },
        { do: 'nfb', on: false }, { do: 'wait', ms: 6000 },
        { do: 'nfb', on: true }, { do: 'wait', ms: 500 },
        { do: 'expect', note: 'TR2 已復歸：復電後不自動起動，G 亮', state: { MCF: false, MCR: false, TR2: false, G: true } },
      ],
    },
    {
      name: 'EMS 緊急停止（自鎖）',
      steps: [
        { do: 'nfb', on: true }, { do: 'wait', ms: 300 },
        { do: 'press', device: 'FWD', ms: 300 }, { do: 'wait', ms: 6500 },
        { do: 'press', device: 'EMS', ms: 300 }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '按下 EMS：全部斷電（連 G 都不亮）', state: { MCF: false, MCD: false, R1: false, G: false } },
        { do: 'wait', ms: 6000 },
        { do: 'press', device: 'EMS', ms: 300 }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '解除 EMS（超過 5 秒）：G 亮、不再起動', state: { MCF: false, MCR: false, G: true } },
      ],
    },
    {
      name: '過載跳脫：全部停止、G 亮',
      steps: [
        { do: 'nfb', on: true }, { do: 'wait', ms: 300 },
        { do: 'press', device: 'FWD', ms: 300 }, { do: 'wait', ms: 6500 },
        { do: 'trip', device: 'THRY', on: true }, { do: 'wait', ms: 500 },
        { do: 'expect', note: 'TH-RY 跳脫：MC 全部放開、R 燈滅，G 亮', state: { MCF: false, MCR: false, MCS: false, MCD: false, TR1: false, R1: false, R2: false, G: true } },
        { do: 'wait', ms: 6000 },
        { do: 'trip', device: 'THRY', on: false }, { do: 'wait', ms: 500 },
        { do: 'expect', note: 'TH-RY 復歸（超過 5 秒）：不自行再起動', state: { MCF: false, MCR: false, G: true } },
      ],
    },
  ],
};
