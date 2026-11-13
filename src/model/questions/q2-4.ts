import type { QuestionDef, TeacherStep, PassThrough } from '../types';
import { place } from '../../library';
import circuitImg from '../../assets/q2-4-circuit.png';
import layoutImg from '../../assets/q2-4-layout.png';
import { doorLinks, pbPreWired, lampPreWired, bzPreWired } from './common';
import { Q2_4_SCHEMATIC } from './q2-4.schematic';

/**
 * 第二站第四題：污排水泵手動、自動交互兼異常水位並列運轉控制電路
 * 器具座標依官方器具位置圖（500×700mm）的相對位置排列，器具大小照實物，所以線槽位置略有調整；
 * 引接方式（TH-RY 的 c b a 小 TB、COS 的 M M A A、61F-G2 的 11 條引線到 TB5、浮球 4 條引線到 TB7）依補習班講義實物圖。
 *
 * 動作要點（依控制電路圖）：
 * - 主電路：電源 → NFB3（主開關）→ TB1 → NFB1 → MC1 → TH-RY1 → TB2 → M1；NFB2 → MC2 → TH-RY2 → TB6 → M2（都已配妥）。
 *   控制電源取自 NFB3 負載側的 R、T 相，各經一只 D-F。
 * - COS 切 M（手動）：OFF1／ON1、OFF2／ON2 各自起停自己那台，兩台互不連鎖。
 * - COS 切 A（自動）：61F-G2 才有電源（S2、Tc1 接在 COS 的 A 之後）。
 *   BS1（高水位）浮起 → E1-E3 相通 → U1 動作：Tc1-Ta1 閉合，經 61F-APN2 第二組接點起動其中一台；
 *   水退到低水位 BS1 落下 → U1 復歸：泵停、Tc1-Tb1 閉合讓 61F-APN2 線圈得電一次 → 接點翻轉，下次換另一台（交互）。
 *   BS2（異常水位）也浮起 → E4-E3 相通 → U2 動作：Tc2-Ta2 閉合（Tc2 與 Ta1 相接）→ X、Y 得電；
 *   X 的 a 接點從電源直接經 61F-APN2 第一組接點送到「另一台」→ 兩台並列運轉，Y 燈亮。
 * - 61F-APN2（交互電驛，得以棘輪電驛替代）：線圈每得電一次接點翻轉一次。第一組（1-3／1-4）給 X、第二組（8-6／8-5）給 U1，
 *   兩組一定指向不同台，所以異常水位時剛好補上沒在運轉的那一台。
 * - 燈：R1／R2 與 MC1／MC2 線圈並聯（運轉中）；G1／G2 經各自 MC 的 b 接點（停止中）；Y 與 X 並聯（異常水位）。
 * - TH-RY1／TH-RY2：b 接點各串自己那台的線圈回路，a 接點並聯接 BZ（任一台過載 BZ 響）。
 * - 水位偵測：水銀浮球開關代替電極棒，BS1 接 E1-E3、BS2 接 E4-E3（E2 不用），E3 需接地。
 */

const preWired: PassThrough[] = [
  ...pbPreWired(['ON1', 'OFF1', 'ON2', 'OFF2']),
  ...lampPreWired(['G1', 'G2', 'R1', 'R2', 'Y']),
  ...bzPreWired(['BZ']),
  // COS 兩個接點各自兩端 → 4P 小 TB；操作面板是鏡射的背面，TB.1-2 放 A、TB.3-4 放 M，畫出來由左到右就是講義的 M M A A
  { a: 'COS.A1', b: 'COS_TB.1' }, { a: 'COS.A2', b: 'COS_TB.2' }, { a: 'COS.M1', b: 'COS_TB.3' }, { a: 'COS.M2', b: 'COS_TB.4' },
  // TH-RY 輔助接點 c b a → 本體下方 3P 小 TB
  ...['THRY1', 'THRY2'].flatMap(id => [{ a: `${id}.c`, b: `${id}_TB.1` }, { a: `${id}.b`, b: `${id}_TB.2` }, { a: `${id}.a`, b: `${id}_TB.3` }]),
  // 61F-G2 本體 → TB5（S0 S2 Tc1 Tc2 Ta1 Tb1 Ta2 E1 E2 E3 E4，第 12 格空）
  ...['S0', 'S2', 'Tc1', 'Tc2', 'Ta1', 'Tb1', 'Ta2', 'E1', 'E2', 'E3', 'E4'].map((t, i) => ({ a: `LC.${t}`, b: `TB5.${i + 1}` })),
  // 水銀浮球開關各兩條引線 → TB7（BS1 BS1 BS2 BS2）
  { a: 'BS1.1', b: 'TB7.1' }, { a: 'BS1.2', b: 'TB7.2' }, { a: 'BS2.1', b: 'TB7.3' }, { a: 'BS2.2', b: 'TB7.4' },
];
const passThrough: PassThrough[] = [...doorLinks, ...preWired];

/**
 * 參考接線（依控制電路圖編排；⊘n = 過門線 TB3.n ↔ TB4.n）。
 * TB5 格位：1 S0　2 S2　3 Tc1　4 Tc2　5 Ta1　6 Tb1　7 Ta2　8 E1　9 E2　10 E3　11 E4
 * 過門線分配：1 R相母線→BZ、COS　2 T相母線→Y、G1、G2　3 COS/A→S2、Tc1　4 ON1上　5 ON1下、R1　6 R1回線
 *            7 ON2上　8 ON2下、R2　9 R2回線　10 BZ→TH-RY a　11 Ta2→Y　12 G1　13 G2
 */
const teacherSteps: TeacherStep[] = [
  { n: 1, text: 'NFB3/R → D-F', chain: 'NFB.A > DF1.上' },
  { n: 2, text: 'NFB3/T → D-F', chain: 'NFB.C > DF2.上' },
  { n: 3, text: 'D-F(R) → X/1 → MC1/b右 → MC2/b右 → ⊘1 → BZ → COS/M → COS/A（共用點跨接）', chain: 'DF1.下 > X.1 > MC1.b右上 > MC2.b右上 > ⊘1 > BZ_TB.1 > COS_TB.3 > COS_TB.1' },
  { n: 4, text: 'D-F(T) → TH-RY1/c → TH-RY2/c → APN/7 → X/7 → TB5/S0 → ⊘2 → Y → G1 → G2', chain: 'DF2.下 > THRY1_TB.1 > THRY2_TB.1 > APN.7 > X.7 > TB5.1 > ⊘2 > Y_TB.3 > G1_TB.3 > G2_TB.3' },
  { n: 5, text: 'COS/A → ⊘3 → TB5/S2 → TB5/Tc1', chain: 'COS_TB.2 > ⊘3 > TB5.2 > TB5.3' },
  { n: 6, text: 'COS/M → OFF1/b → OFF2/b', chain: 'COS_TB.4 > OFF1_TB.1 > OFF2_TB.1' },
  { n: 7, text: 'OFF1/b → ON1/a → ⊘4 → MC1/a左（自保）', chain: 'OFF1_TB.2 > ON1_TB.3 > ⊘4 > MC1.a左上' },
  { n: 8, text: 'ON1/a → R1 → ⊘5 → MC1/a左 → (MC1) → APN/4 → APN/6', chain: 'ON1_TB.4 > R1_TB.1 > ⊘5 > MC1.a左下 > MC1.A1 > APN.4 > APN.6' },
  { n: 9, text: '(MC1) → TH-RY1/b → ⊘6 → R1', chain: 'MC1.A2 > THRY1_TB.2 > ⊘6 > R1_TB.3' },
  { n: 10, text: 'OFF2/b → ON2/a → ⊘7 → MC2/a左（自保）', chain: 'OFF2_TB.2 > ON2_TB.3 > ⊘7 > MC2.a左上' },
  { n: 11, text: 'ON2/a → R2 → ⊘8 → MC2/a左 → (MC2) → APN/3 → APN/5', chain: 'ON2_TB.4 > R2_TB.1 > ⊘8 > MC2.a左下 > MC2.A1 > APN.3 > APN.5' },
  { n: 12, text: '(MC2) → TH-RY2/b → ⊘9 → R2', chain: 'MC2.A2 > THRY2_TB.2 > ⊘9 > R2_TB.3' },
  { n: 13, text: 'BZ → ⊘10 → TH-RY1/a → TH-RY2/a', chain: 'BZ_TB.3 > ⊘10 > THRY1_TB.3 > THRY2_TB.3' },
  { n: 14, text: 'X/4(a) → APN/1（第一組共用）', chain: 'X.4 > APN.1' },
  { n: 15, text: 'TB5/Ta1 → TB5/Tc2 → APN/8（第二組共用）', chain: 'TB5.5 > TB5.4 > APN.8' },
  { n: 16, text: 'TB5/Tb1 → (APN 線圈)', chain: 'TB5.6 > APN.2' },
  { n: 17, text: 'TB5/Ta2 → (X 線圈) → ⊘11 → Y', chain: 'TB5.7 > X.2 > ⊘11 > Y_TB.1' },
  { n: 18, text: 'MC1/b右 → ⊘12 → G1', chain: 'MC1.b右下 > ⊘12 > G1_TB.1' },
  { n: 19, text: 'MC2/b右 → ⊘13 → G2', chain: 'MC2.b右下 > ⊘13 > G2_TB.1' },
  { n: 20, text: '浮球共用線：TB5/E3 → TB7/BS1 → TB7/BS2', chain: 'TB5.10 > TB7.1 > TB7.3' },
  { n: 21, text: 'BS1（高水位）：TB7/BS1 → TB5/E1', chain: 'TB7.2 > TB5.8' },
  { n: 22, text: 'BS2（異常水位）：TB7/BS2 → TB5/E4', chain: 'TB7.4 > TB5.11' },
  { n: 23, text: 'E3 接地：TB5/E3 → G 端子板（2mm² 綠線）', chain: 'TB5.10 > G_BAR.G3' },
  { n: 24, text: '設備接地：G 端子板 → E（5.5mm² 綠線）', chain: 'G_BAR.G4 > E.E1' },
];

const NFB_BRANCH = '3P, 220V, 50AF, 30AT, IC 5kA';
const MC_SPEC = 'AC 220V 3.7kW (5HP), coil 220V, 3P, 輔助接點 2a2b';
const THRY_SPEC = '15A, 可調型, 二加熱子';

export const Q2_4: QuestionDef = {
  id: 'q2-4',
  title: '第二站第四題：污排水泵手動、自動交互兼異常水位並列運轉控制電路',
  minutes: 90,
  panels: {
    device: { name: '器具板', w: 500, h: 700 },
    operator: { name: '操作面板（開門・背面）', w: 500, h: 700, mirror: true, note: '門板打開後由內側配線，左右與正視圖相反' },
  },
  devices: [
    // 器具板 第一排：NFB3（主開關，控制電源由它的負載側取）、TB1（在 NFB3 之後，分到 NFB1／NFB2）、D-F×2
    place('NFB', 'NFB', 'device', 27, 30, { label: 'NFB3', desc: '主開關：控制電源取自它的負載側 R、T', spec: '3P, 220V, 50AF, 40AT, IC 5kA' }),
    place('TB1', 'TB1', 'device', 27, 126, { display: true, desc: 'NFB3 負載側分路（→ NFB1、NFB2，已配妥）', spec: '3P, 600V, 30A' }),
    place('DF', 'DF1', 'device', 215, 100, { label: 'D-F', desc: 'R 相控制電源保險絲' }),
    place('DF', 'DF2', 'device', 300, 100, { label: 'D-F', desc: 'T 相控制電源保險絲' }),
    // 第二排：NFB1、NFB2（各泵分路開關，主電路已配妥）、61F-APN2、X
    place('NFB', 'NFB1', 'device', 27, 236, { display: true, desc: 'M1 分路開關（主電路已配妥，隨 NFB3 一起投入）', spec: NFB_BRANCH }),
    place('NFB', 'NFB2', 'device', 125, 236, { display: true, desc: 'M2 分路開關（主電路已配妥，隨 NFB3 一起投入）', spec: NFB_BRANCH }),
    place('MR', 'APN', 'device', 223, 242, { label: '61F-APN2', desc: '交互電驛：線圈每得電一次翻轉，決定下次由哪台泵運轉', spec: 'AC 220V, 2c（得以棘輪電驛替代）' }),
    place('RY', 'X', 'device', 297, 242, { desc: '異常水位時動作，a 接點起動另一台（並列運轉）' }),
    // 第三排：MC1、MC2（下方各自的 TH-RY 與引接小 TB）、61F-G2 與 TB5
    place('MC', 'MC1', 'device', 27, 364, { desc: '第 1 台污排水泵', spec: MC_SPEC }),
    place('THRY', 'THRY1', 'device', 33, 464, { label: 'TH-RY1', desc: 'M1 過載時停 M1、BZ 響', spec: THRY_SPEC }),
    place('TBM3', 'THRY1_TB', 'device', 71, 532, { label: 'TH-RY1 引接TB' }),
    place('MC', 'MC2', 'device', 141, 364, { desc: '第 2 台污排水泵', spec: MC_SPEC }),
    place('THRY', 'THRY2', 'device', 147, 464, { label: 'TH-RY2', desc: 'M2 過載時停 M2、BZ 響', spec: THRY_SPEC }),
    place('TBM3', 'THRY2_TB', 'device', 185, 532, { label: 'TH-RY2 引接TB' }),
    place('LC2', 'LC', 'device', 258, 368, { label: '61F-G2', desc: '液面控制器：U1 高水位起動、U2 異常水位並列' }),
    place('TB12', 'TB5', 'device', 255, 470, { label: 'TB5（61F-G2 引接）' }),
    place('TB16', 'TB3', 'device', 437, 145),
    // 底排：TB2、TB6（主電路，僅顯示）、TB7、G
    place('TB4M', 'TB2', 'device', 27, 630, { display: true, desc: 'M1' }),
    place('TB4M', 'TB6', 'device', 197, 630, { display: true, desc: 'M2' }),
    place('TBM4', 'TB7', 'device', 368, 636, { label: 'TB7（浮球開關引接）' }),
    place('GBAR', 'G_BAR', 'device', 430, 640, { label: 'G' }),
    // 控制箱外：接地極 E、污水池的水銀浮球開關
    place('EBAR', 'E', 'device', 440, 728, { label: 'E', desc: '檢定崗位接地極（控制箱外）' }),
    place('BS', 'BS1', 'device', 322, 716, { desc: '高水位：浮起時起動一台泵', levelOn: .6, levelOff: .2 }),
    place('BS', 'BS2', 'device', 376, 716, { desc: '異常水位：浮起時兩台並列運轉', levelOn: .9, levelOff: .2 }),
    // 操作面板（正視圖座標）
    place('PL', 'G1', 'operator', 53, 160, { color: '#2ecc71', desc: 'M1 停止中' }),
    place('PL', 'G2', 'operator', 117, 160, { color: '#2ecc71', desc: 'M2 停止中' }),
    place('PL', 'R1', 'operator', 181, 160, { color: '#e74c3c', desc: 'M1 運轉中' }),
    place('PL', 'R2', 'operator', 245, 160, { color: '#e74c3c', desc: 'M2 運轉中' }),
    place('PL', 'Y', 'operator', 309, 160, { color: '#f1c40f', desc: '異常水位' }),
    place('PB', 'ON1', 'operator', 86, 318, { color: '#2ecc71', desc: '手動起動 M1' }),
    place('PB', 'OFF1', 'operator', 150, 318, { color: '#e74c3c', desc: '手動停止 M1' }),
    place('PB', 'ON2', 'operator', 215, 318, { color: '#2ecc71', desc: '手動起動 M2' }),
    place('PB', 'OFF2', 'operator', 279, 318, { color: '#e74c3c', desc: '手動停止 M2' }),
    place('COS2', 'COS', 'operator', 150, 477, { color: '#2c3e50', desc: 'M 手動／A 自動（以檢定場標示為準）' }),
    place('BZ', 'BZ', 'operator', 215, 477, { color: '#95a5a6', desc: '任一台過載時鳴響' }),
    place('TB16', 'TB4', 'operator', 431, 125),
    // 考場引接小 TB（無編號）
    place('TBM3', 'G1_TB', 'operator', 58, 216, { label: 'G1 引接TB' }),
    place('TBM3', 'G2_TB', 'operator', 122, 216, { label: 'G2 引接TB' }),
    place('TBM3', 'R1_TB', 'operator', 186, 216, { label: 'R1 引接TB' }),
    place('TBM3', 'R2_TB', 'operator', 250, 216, { label: 'R2 引接TB' }),
    place('TBM3', 'Y_TB', 'operator', 314, 216, { label: 'Y 引接TB' }),
    place('TBM4', 'ON1_TB', 'operator', 86, 374, { label: 'ON1 引接TB' }),
    place('TBM4', 'OFF1_TB', 'operator', 150, 374, { label: 'OFF1 引接TB' }),
    place('TBM4', 'ON2_TB', 'operator', 215, 374, { label: 'ON2 引接TB' }),
    place('TBM4', 'OFF2_TB', 'operator', 279, 374, { label: 'OFF2 引接TB' }),
    place('TBM4', 'COS_TB', 'operator', 150, 533, { label: 'COS 引接TB' }),
    place('TBM3', 'BZ_TB', 'operator', 220, 533, { label: 'BZ 引接TB' }),
  ],
  ducts: [
    { panel: 'device', x: 188, y: 26, w: 232, h: 36 },
    { panel: 'device', x: 384, y: 26, w: 36, h: 574 },
    { panel: 'device', x: 27, y: 190, w: 357, h: 34 },
    { panel: 'device', x: 27, y: 322, w: 357, h: 34 },
    { panel: 'device', x: 27, y: 566, w: 393, h: 34 },
    { panel: 'operator', x: 40, y: 246, w: 345, h: 36 },
    { panel: 'operator', x: 40, y: 409, w: 345, h: 36 },
    { panel: 'operator', x: 368, y: 110, w: 34, h: 458 },
  ],
  passThrough,
  timerDefaultSec: 5,
  teacherSteps,
  images: { circuit: circuitImg, layout: layoutImg },
  schematic: Q2_4_SCHEMATIC,
  scene: { kind: 'sump', pumps: ['MC1', 'MC2'], thry: ['THRY1', 'THRY2'], bs: ['BS1', 'BS2'], lc: 'LC', apn: 'APN', cos: 'COS', x: 'X' },
  tb1AfterNfb: true,
  scenarios: [
    {
      name: '投入 NFB：G1、G2 亮（兩台泵都停）',
      steps: [
        { do: 'nfb', on: true }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '投入電源後 G1、G2 亮，其餘不動作（COS 在 M，61F-G2 沒有電源）', state: { G1: true, G2: true, R1: false, R2: false, Y: false, MC1: false, MC2: false, X: false, LC: false, BZ: false } },
      ],
    },
    {
      name: '手動 M：ON1／OFF1 起停 M1，ON2／OFF2 起停 M2，兩台各自獨立',
      steps: [
        { do: 'nfb', on: true }, { do: 'wait', ms: 300 },
        { do: 'press', device: 'ON1', ms: 300 }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '按 ON1：MC1 動作並自保、R1 亮、G1 滅', state: { MC1: true, MC2: false, R1: true, G1: false, G2: true, R2: false } },
        { do: 'press', device: 'ON2', ms: 300 }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '再按 ON2：MC2 也動作、R2 亮、G2 滅（手動時兩台互不連鎖）', state: { MC1: true, MC2: true, R1: true, R2: true, G1: false, G2: false, Y: false } },
        { do: 'press', device: 'OFF1', ms: 300 }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '按 OFF1：只停 MC1', state: { MC1: false, MC2: true, R1: false, G1: true } },
        { do: 'press', device: 'OFF2', ms: 300 }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '按 OFF2：MC2 停、G2 亮', state: { MC2: false, R2: false, G2: true } },
      ],
    },
    {
      name: '自動 A：高水位一台運轉、低水位停止，下一次換另一台（交互）',
      steps: [
        { do: 'nfb', on: true }, { do: 'wait', ms: 300 },
        { do: 'set', device: 'COS', on: true }, { do: 'wait', ms: 500 },
        { do: 'expect', note: 'COS 切 A、水位低：61F-G2 有電但不動作，兩台都停', state: { LC: false, MC1: false, MC2: false, G1: true, G2: true, X: false, Y: false } },
        { do: 'level', value: .7 }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '水位到 BS1（高水位）：U1 動作，交互電驛指定的那一台運轉', state: { LC: true, MC2: true, MC1: false, R2: true, G2: false, G1: true, Y: false, X: false } },
        { do: 'level', value: .1 }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '水退到低水位：U1 復歸、泵停，交互電驛翻轉', state: { LC: false, MC1: false, MC2: false, G1: true, G2: true } },
        { do: 'level', value: .7 }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '再到高水位：換另一台運轉', state: { LC: true, MC1: true, MC2: false, R1: true, G1: false, G2: true } },
        { do: 'level', value: .1 }, { do: 'wait', ms: 500 },
        { do: 'level', value: .7 }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '第三次高水位：又換回來', state: { MC2: true, MC1: false } },
      ],
    },
    {
      name: '自動 A：異常水位 → 兩台並列運轉、Y 亮；退到低水位全停',
      steps: [
        { do: 'nfb', on: true }, { do: 'wait', ms: 300 },
        { do: 'set', device: 'COS', on: true }, { do: 'wait', ms: 300 },
        { do: 'level', value: .7 }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '高水位：先一台運轉', state: { MC2: true, MC1: false, X: false, Y: false } },
        { do: 'level', value: .95 }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '水位到 BS2（異常水位）：U2 動作 → X 動作、Y 亮，另一台也起動（並列運轉）', state: { 'LC.U2': true, X: true, Y: true, MC1: true, MC2: true, R1: true, R2: true, G1: false, G2: false } },
        { do: 'level', value: .5 }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '水位下降但浮球還沒落到低水位：維持並列運轉', state: { X: true, Y: true, MC1: true, MC2: true } },
        { do: 'level', value: .1 }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '退到低水位：兩顆浮球都落下，全部停止、Y 滅', state: { LC: false, 'LC.U2': false, X: false, Y: false, MC1: false, MC2: false, G1: true, G2: true } },
      ],
    },
    {
      name: '自動 A 時 ON／OFF 按鈕無作用；切回 M 泵停止',
      steps: [
        { do: 'nfb', on: true }, { do: 'wait', ms: 300 },
        { do: 'set', device: 'COS', on: true }, { do: 'wait', ms: 300 },
        { do: 'press', device: 'ON1', ms: 300 }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '自動、水位低時按 ON1 不會起動（手動回路沒有電源）', state: { MC1: false, MC2: false } },
        { do: 'level', value: .7 }, { do: 'wait', ms: 500 },
        { do: 'press', device: 'OFF2', ms: 300 }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '自動運轉中按 OFF2 無作用（OFF 只串在手動回路）', state: { MC2: true } },
        { do: 'set', device: 'COS', on: false }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '切回 M：61F-G2 斷電、泵停止（要再按 ON 才會起動）', state: { MC1: false, MC2: false, LC: false, G1: true, G2: true } },
      ],
    },
    {
      name: 'TH-RY1 過載跳脫：M1 停、BZ 響、G1 亮；復歸後 BZ 停',
      steps: [
        { do: 'nfb', on: true }, { do: 'wait', ms: 300 },
        { do: 'press', device: 'ON1', ms: 300 }, { do: 'press', device: 'ON2', ms: 300 }, { do: 'wait', ms: 500 },
        { do: 'trip', device: 'THRY1', on: true }, { do: 'wait', ms: 500 },
        { do: 'expect', note: 'TH-RY1 跳脫：MC1 復歸、R1 滅、BZ 響、G1 亮；M2 不受影響', state: { MC1: false, R1: false, BZ: true, G1: true, MC2: true, R2: true } },
        { do: 'trip', device: 'THRY1', on: false }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '復歸：BZ 停，M1 不自行再起動', state: { BZ: false, MC1: false, MC2: true } },
      ],
    },
    {
      name: 'TH-RY2 過載跳脫：M2 停、BZ 響',
      steps: [
        { do: 'nfb', on: true }, { do: 'wait', ms: 300 },
        { do: 'press', device: 'ON2', ms: 300 }, { do: 'wait', ms: 500 },
        { do: 'trip', device: 'THRY2', on: true }, { do: 'wait', ms: 500 },
        { do: 'expect', note: 'TH-RY2 跳脫：MC2 復歸、R2 滅、BZ 響、G2 亮', state: { MC2: false, R2: false, BZ: true, G2: true } },
        { do: 'trip', device: 'THRY2', on: false }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '復歸：BZ 停', state: { BZ: false } },
      ],
    },
  ],
};
