import type { QuestionDef, TeacherStep, PassThrough } from '../types';
import { place } from '../../library';
import circuitImg from '../../assets/q2-3-circuit.png';
import layoutImg from '../../assets/q2-3-layout.png';
import { doorLinks, pbPreWired, lampPreWired, bzPreWired, cosPreWired } from './common';
import { Q2_3_SCHEMATIC } from './q2-3.schematic';

/**
 * 第二站第三題：兩台抽水泵手動、自動交替控制電路
 * 器具座標由官方器具位置圖（500×700mm）換算；MS1／MS2 為電磁開關（MC＋附帶的積熱電驛，上下相疊）。
 *
 * 動作要點（依控制電路圖）：
 * - 61F-G（液面控制器）：S0-S2 接 R、T 相電源；Tc 接 R 相，水位到 E1 時 Tc-Ta 閉合 → X、MR、G1 得電；
 *   水降到 E2 以下才復歸（E2 自保持）。E1 E2 E3 由 TB7 接到 TB6（電極棒），E3 另接地。
 * - X（輔助電驛）b 接點串在 FS 之前：水塔滿水 → 切斷兩台泵的控制電源（手動、自動都停）。
 * - FS（給水源浮球）：給水源無水 → a 接點打開 → 泵不得運轉。
 * - COS：M（手動）→ OFF1／ON1、OFF2／ON2 各自起停，MC1／MC2 的 b 接點互鎖，一次只能一台；
 *        A（自動）→ 經 MR 的 c 接點直接接到自保節點（越過 OFF／ON），由水位起停。
 * - MR（棘輪電驛）線圈與 X 並聯：每次滿水翻轉一次 → 下次低水位換另一台泵運轉（交替）。
 * - 燈：R1／R2 與 MC1／MC2 線圈並聯（運轉中）；G1 與 X 並聯（滿水）；G2 經 MC1 b → MC2 b（兩台都停）。
 * - TH-RY1／TH-RY2：b 接點各串自己那台的線圈回路，a 接點並聯接 BZ（任一台過載 BZ 響）。
 */

const preWired: PassThrough[] = [
  ...pbPreWired(['ON1', 'OFF1', 'ON2', 'OFF2']),
  ...lampPreWired(['G1', 'R1', 'G2', 'R2']),
  ...bzPreWired(['BZ']),
  ...cosPreWired(['COS']),
  // 61F-G 本體 → TB7（S0 S2 Tc Ta Tb E3 E2 E1）
  { a: 'LC.S0', b: 'TB7.1' }, { a: 'LC.S2', b: 'TB7.2' }, { a: 'LC.Tc', b: 'TB7.3' }, { a: 'LC.Ta', b: 'TB7.4' },
  { a: 'LC.Tb', b: 'TB7.5' }, { a: 'LC.E3', b: 'TB7.6' }, { a: 'LC.E2', b: 'TB7.7' }, { a: 'LC.E1', b: 'TB7.8' },
  // 電極棒 E3 E2 E1 與浮球開關 a a b b → TB6（第 4 格空）
  { a: 'ELEC.E3', b: 'TB6.1' }, { a: 'ELEC.E2', b: 'TB6.2' }, { a: 'ELEC.E1', b: 'TB6.3' },
  { a: 'FS.a上', b: 'TB6.5' }, { a: 'FS.a下', b: 'TB6.6' }, { a: 'FS.b上', b: 'TB6.7' }, { a: 'FS.b下', b: 'TB6.8' },
];
const passThrough: PassThrough[] = [...doorLinks, ...preWired];

/**
 * 參考接線（依控制電路圖編排；⊘n = 過門線 TB3.n ↔ TB4.n）。
 * 過門線分配：1 R相母線→BZ 2 T相母線→G1 G2 3 Ta→G1 4 FS→COS/c 5 COS/A→MR/c 6 ON1上 7 ON1下 8 R1 9 R1回線
 *            10 ON2上 11 ON2下 12 R2 13 R2回線 14 BZ→TH-RY a 15 G2
 */
const teacherSteps: TeacherStep[] = [
  { n: 1, text: 'NFB/R → D-F', chain: 'NFB.A > DF1.上' },
  { n: 2, text: 'NFB/T → D-F', chain: 'NFB.C > DF2.上' },
  { n: 3, text: 'D-F(R) → TB7/S2 → TB7/Tc → X/1 → MC1/b右 → ⊘1 → BZ', chain: 'DF1.下 > TB7.2 > TB7.3 > X.1 > MC1.b右上 > ⊘1 > BZ_TB.1' },
  { n: 4, text: 'D-F(T) → TB7/S0 → X/7 → MR/7 → TH-RY1/c → TH-RY2/c → ⊘2 → G1 → G2', chain: 'DF2.下 > TB7.1 > X.7 > MR.7 > THRY1.c > THRY2.c > ⊘2 > G1_TB.3 > G2_TB.3' },
  { n: 5, text: 'TB7/Ta → X/2 → MR/2 → ⊘3 → G1', chain: 'TB7.4 > X.2 > MR.2 > ⊘3 > G1_TB.1' },
  { n: 6, text: 'X/3(b) → TB6/FS', chain: 'X.3 > TB6.5' },
  { n: 7, text: 'TB6/FS → ⊘4 → COS/c', chain: 'TB6.6 > ⊘4 > COS_TB.1' },
  { n: 8, text: 'COS/M → OFF1/b → OFF2/b', chain: 'COS_TB.2 > OFF1_TB.1 > OFF2_TB.1' },
  { n: 9, text: 'COS/A → ⊘5 → MR/1(c)', chain: 'COS_TB.3 > ⊘5 > MR.1' },
  { n: 10, text: 'OFF1/b → ON1/a → ⊘6 → MC1/a左（自保）', chain: 'OFF1_TB.2 > ON1_TB.3 > ⊘6 > MC1.a左上' },
  { n: 11, text: 'ON1/a → ⊘7 → MC1/a左 → MR/3 → MC2/b左（互鎖）', chain: 'ON1_TB.4 > ⊘7 > MC1.a左下 > MR.3 > MC2.b左上' },
  { n: 12, text: 'MC2/b左 → (MC1) → ⊘8 → R1', chain: 'MC2.b左下 > MC1.A1 > ⊘8 > R1_TB.1' },
  { n: 13, text: '(MC1) → TH-RY1/b → ⊘9 → R1', chain: 'MC1.A2 > THRY1.b > ⊘9 > R1_TB.3' },
  { n: 14, text: 'OFF2/b → ON2/a → ⊘10 → MC2/a左（自保）', chain: 'OFF2_TB.2 > ON2_TB.3 > ⊘10 > MC2.a左上' },
  { n: 15, text: 'ON2/a → ⊘11 → MC2/a左 → MR/4 → MC1/b左（互鎖）', chain: 'ON2_TB.4 > ⊘11 > MC2.a左下 > MR.4 > MC1.b左上' },
  { n: 16, text: 'MC1/b左 → (MC2) → ⊘12 → R2', chain: 'MC1.b左下 > MC2.A1 > ⊘12 > R2_TB.1' },
  { n: 17, text: '(MC2) → TH-RY2/b → ⊘13 → R2', chain: 'MC2.A2 > THRY2.b > ⊘13 > R2_TB.3' },
  { n: 18, text: 'BZ → ⊘14 → TH-RY1/a → TH-RY2/a', chain: 'BZ_TB.3 > ⊘14 > THRY1.a > THRY2.a' },
  { n: 19, text: 'MC1/b右 → MC2/b右', chain: 'MC1.b右下 > MC2.b右上' },
  { n: 20, text: 'MC2/b右 → ⊘15 → G2', chain: 'MC2.b右下 > ⊘15 > G2_TB.1' },
  { n: 21, text: '電極棒 E1：TB7/E1 → TB6/E1', chain: 'TB7.8 > TB6.3' },
  { n: 22, text: '電極棒 E2：TB7/E2 → TB6/E2', chain: 'TB7.7 > TB6.2' },
  { n: 23, text: '電極棒 E3：TB7/E3 → TB6/E3', chain: 'TB7.6 > TB6.1' },
  { n: 24, text: 'E3 接地：TB7/E3 → G 端子板（2mm² 綠線）', chain: 'TB7.6 > G_BAR.G3' },
  { n: 25, text: '設備接地：G 端子板 → E（3.5mm² 綠線）', chain: 'G_BAR.G2 > E.E1' },
];

const MS_SPEC = 'AC 220V 3.7kW (5HP), coil 220V, 3P, 輔助接點 2a2b；附 15A 可調型二加熱子積熱電驛';

export const Q2_3: QuestionDef = {
  id: 'q2-3',
  title: '第二站第三題：兩台抽水泵手動、自動交替控制電路',
  minutes: 90,
  panels: {
    device: { name: '器具板', w: 500, h: 700 },
    operator: { name: '操作面板（開門・背面）', w: 500, h: 700, mirror: true, note: '門板打開後由內側配線，左右與正視圖相反' },
  },
  devices: [
    // 器具板 第一排：TB1、NFB、D-F×2、MR、X
    place('TB1', 'TB1', 'device', 30, 33),
    place('NFB', 'NFB', 'device', 30, 105, { spec: '3P, 220V, 50AF, 30AT, IC 10kA' }),
    place('DF', 'DF1', 'device', 138, 115, { label: 'D-F', desc: 'R 相控制電源保險絲' }),
    place('DF', 'DF2', 'device', 190, 115, { label: 'D-F', desc: 'T 相控制電源保險絲' }),
    place('MR', 'MR', 'device', 232, 102, { desc: '交替：每次滿水翻轉，決定下次由哪台泵運轉' }),
    place('RY', 'X', 'device', 302, 102, { desc: '滿水時動作，b 接點切斷泵的控制電源' }),
    // 第二排：MS1、MS2（MC 在上、積熱電驛在下）、61F-G、TB7
    place('MC', 'MC1', 'device', 22, 300, { desc: '第 1 台抽水泵（MS1）', spec: MS_SPEC }),
    place('THRY2', 'THRY1', 'device', 28, 400, { label: 'TH-RY1', desc: 'MS1 附帶，過載時停 M1、BZ 響' }),
    place('MC', 'MC2', 'device', 142, 300, { desc: '第 2 台抽水泵（MS2）', spec: MS_SPEC }),
    place('THRY2', 'THRY2', 'device', 148, 400, { label: 'TH-RY2', desc: 'MS2 附帶，過載時停 M2、BZ 響' }),
    place('LC', 'LC', 'device', 266, 320, { label: '61F-G', desc: '液面控制器：水到 E1 動作、降到 E2 以下復歸' }),
    place('TB8', 'TB7', 'device', 255, 440, { label: 'TB7（61F-G 引接）' }),
    place('TB16', 'TB3', 'device', 438, 160),
    // 底排：TB2、TB5（主電路，僅顯示）、TB6、G
    place('TB4M', 'TB2', 'device', 27, 630, { display: true, desc: 'M1' }),
    place('TB4M', 'TB5', 'device', 135, 630, { display: true, desc: 'M2' }),
    place('TB8', 'TB6', 'device', 250, 630, { label: 'TB6（電極棒／FS 引接）' }),
    place('GBAR', 'G_BAR', 'device', 400, 612, { label: 'G' }),
    // 控制箱外：接地極 E、給水源浮球開關 FS、屋頂水塔電極棒
    place('EBAR', 'E', 'device', 410, 724, { label: 'E', desc: '檢定崗位接地極（控制箱外）' }),
    place('FS', 'FS', 'device', 60, 712, { desc: '給水源浮球（箱外）：有水時 a 閉合' }),
    place('ELEC', 'ELEC', 'device', 150, 712, { label: '電極棒', desc: '屋頂水塔（箱外）：E1 高水位、E2 低水位、E3 共用' }),
    // 操作面板（正視圖座標）
    place('PL', 'G1', 'operator', 109, 160, { color: '#2ecc71', desc: '水塔滿水' }),
    place('PL', 'R1', 'operator', 173, 160, { color: '#e74c3c', desc: 'M1 運轉中' }),
    place('PL', 'G2', 'operator', 237, 160, { color: '#2ecc71', desc: '兩台泵都停止' }),
    place('PL', 'R2', 'operator', 300, 160, { color: '#e74c3c', desc: 'M2 運轉中' }),
    place('COS', 'COS', 'operator', 109, 318, { color: '#2c3e50', desc: 'M 手動／A 自動（以檢定場標示為準）' }),
    place('BZ', 'BZ', 'operator', 300, 318, { color: '#95a5a6', desc: '任一台過載時鳴響' }),
    place('PB', 'ON1', 'operator', 109, 477, { color: '#2ecc71', desc: '手動起動 M1' }),
    place('PB', 'OFF1', 'operator', 173, 477, { color: '#e74c3c', desc: '手動停止 M1' }),
    place('PB', 'ON2', 'operator', 237, 477, { color: '#2ecc71', desc: '手動起動 M2' }),
    place('PB', 'OFF2', 'operator', 300, 477, { color: '#e74c3c', desc: '手動停止 M2' }),
    place('TB16', 'TB4', 'operator', 431, 125),
    // 考場引接小 TB（無編號）
    place('TBM3', 'G1_TB', 'operator', 114, 216, { label: 'G1 引接TB' }),
    place('TBM3', 'R1_TB', 'operator', 178, 216, { label: 'R1 引接TB' }),
    place('TBM3', 'G2_TB', 'operator', 242, 216, { label: 'G2 引接TB' }),
    place('TBM3', 'R2_TB', 'operator', 305, 216, { label: 'R2 引接TB' }),
    place('TBM3', 'COS_TB', 'operator', 114, 374, { label: 'COS 引接TB' }),
    place('TBM3', 'BZ_TB', 'operator', 305, 374, { label: 'BZ 引接TB' }),
    place('TBM4', 'ON1_TB', 'operator', 109, 533, { label: 'ON1 引接TB' }),
    place('TBM4', 'OFF1_TB', 'operator', 173, 533, { label: 'OFF1 引接TB' }),
    place('TBM4', 'ON2_TB', 'operator', 237, 533, { label: 'ON2 引接TB' }),
    place('TBM4', 'OFF2_TB', 'operator', 300, 533, { label: 'OFF2 引接TB' }),
  ],
  ducts: [
    { panel: 'device', x: 188, y: 26, w: 245, h: 36 },
    { panel: 'device', x: 392, y: 26, w: 41, h: 568 },
    { panel: 'device', x: 27, y: 207, w: 365, h: 37 },
    { panel: 'device', x: 27, y: 555, w: 406, h: 39 },
    { panel: 'operator', x: 94, y: 246, w: 291, h: 36 },
    { panel: 'operator', x: 94, y: 409, w: 291, h: 36 },
    { panel: 'operator', x: 368, y: 110, w: 34, h: 458 },
  ],
  passThrough,
  timerDefaultSec: 5,
  teacherSteps,
  images: { circuit: circuitImg, layout: layoutImg },
  schematic: Q2_3_SCHEMATIC,
  scene: { kind: 'pump', pumps: ['MC1', 'MC2'], thry: ['THRY1', 'THRY2'], fs: 'FS', elec: 'ELEC', lc: 'LC', mr: 'MR', cos: 'COS', x: 'X' },
  scenarios: [
    {
      name: '投入 NFB：僅 G2 亮（兩台泵都停）',
      steps: [
        { do: 'nfb', on: true }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '投入電源後只有 G2 亮', state: { G2: true, G1: false, R1: false, R2: false, MC1: false, MC2: false, X: false, LC: false, BZ: false } },
      ],
    },
    {
      name: '手動 M：ON1 起動 M1、ON2 被互鎖、OFF1 停止',
      steps: [
        { do: 'nfb', on: true }, { do: 'wait', ms: 300 },
        { do: 'press', device: 'ON1', ms: 300 }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '按 ON1：MC1 動作、R1 亮、G2 滅', state: { MC1: true, MC2: false, R1: true, R2: false, G2: false } },
        { do: 'press', device: 'ON2', ms: 300 }, { do: 'wait', ms: 500 },
        { do: 'expect', note: 'M1 運轉中按 ON2 無作用（MC1 b 互鎖）', state: { MC1: true, MC2: false } },
        { do: 'press', device: 'OFF1', ms: 300 }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '按 OFF1：MC1 復歸、R1 滅、G2 亮', state: { MC1: false, R1: false, G2: true } },
      ],
    },
    {
      name: '手動 M：ON2 起動 M2、OFF2 停止',
      steps: [
        { do: 'nfb', on: true }, { do: 'wait', ms: 300 },
        { do: 'press', device: 'ON2', ms: 300 }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '按 ON2：MC2 動作、R2 亮', state: { MC2: true, MC1: false, R2: true, G2: false } },
        { do: 'press', device: 'ON1', ms: 300 }, { do: 'wait', ms: 500 },
        { do: 'expect', note: 'M2 運轉中按 ON1 無作用', state: { MC2: true, MC1: false } },
        { do: 'press', device: 'OFF2', ms: 300 }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '按 OFF2：MC2 復歸、G2 亮', state: { MC2: false, R2: false, G2: true } },
      ],
    },
    {
      name: '水塔滿水（E1）→ 61F-G 動作、X 切斷、G1 亮、泵停；降到 E2 以下才復歸',
      steps: [
        { do: 'nfb', on: true }, { do: 'wait', ms: 300 },
        { do: 'press', device: 'ON1', ms: 300 }, { do: 'wait', ms: 500 },
        { do: 'level', value: 1 }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '水到 E1：61F-G 動作、X 動作、G1 亮，MC1 被 X b 切斷', state: { LC: true, X: true, G1: true, MC1: false, R1: false, G2: true } },
        { do: 'level', value: .6 }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '水在 E1 與 E2 之間：61F-G 經 E2 自保持，仍動作', state: { LC: true, X: true, G1: true } },
        { do: 'level', value: .2 }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '水降到 E2 以下：61F-G 復歸、X 復歸、G1 滅（手動要再按 ON1 才會起動）', state: { LC: false, X: false, G1: false, MC1: false } },
      ],
    },
    {
      name: '自動 A：低水位 M1 運轉 → 滿水停、MR 翻轉 → 再低水位換 M2（交替）',
      steps: [
        { do: 'nfb', on: true }, { do: 'wait', ms: 300 },
        { do: 'set', device: 'COS', on: true }, { do: 'level', value: 0 }, { do: 'wait', ms: 500 },
        { do: 'expect', note: 'COS 切 A、水位低：MR 指向第 1 台，MC1 自動運轉、R1 亮', state: { MC1: true, MC2: false, R1: true, MR: false, G2: false } },
        { do: 'level', value: 1 }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '滿水：MC1 停、G1 亮、MR 翻到第 2 台', state: { MC1: false, MC2: false, LC: true, X: true, G1: true, MR: true, G2: true } },
        { do: 'level', value: .2 }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '降到 E2 以下：換 MC2 運轉、R2 亮', state: { MC2: true, MC1: false, R2: true, LC: false, G1: false } },
        { do: 'level', value: 1 }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '再滿水：MC2 停、MR 翻回第 1 台', state: { MC2: false, MR: false, G1: true } },
        { do: 'level', value: .2 }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '再低水位：又換 MC1 運轉', state: { MC1: true, MC2: false } },
      ],
    },
    {
      name: '給水源無水（FS 落下）→ 泵不運轉；恢復有水再起動',
      steps: [
        { do: 'nfb', on: true }, { do: 'wait', ms: 300 },
        { do: 'set', device: 'COS', on: true }, { do: 'level', value: 0 }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '自動、低水位：MC1 運轉', state: { MC1: true } },
        { do: 'set', device: 'FS', on: false }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '給水源無水：FS 打開，兩台泵都停、G2 亮', state: { MC1: false, MC2: false, G2: true } },
        { do: 'set', device: 'FS', on: true }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '恢復有水：MC1 再起動', state: { MC1: true } },
      ],
    },
    {
      name: '自動 A 時 ON／OFF 按鈕無作用（由水位控制）',
      steps: [
        { do: 'nfb', on: true }, { do: 'wait', ms: 300 },
        { do: 'set', device: 'COS', on: true }, { do: 'level', value: 1 }, { do: 'wait', ms: 500 },
        { do: 'press', device: 'ON1', ms: 300 }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '滿水時按 ON1 也不會起動', state: { MC1: false, MC2: false, LC: true } },
        { do: 'level', value: .2 }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '低水位：MR 已翻到第 2 台，MC2 自動運轉', state: { MC2: true, MC1: false } },
        { do: 'press', device: 'OFF2', ms: 300 }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '自動中按 OFF2 無作用（OFF／ON 被 MR 接點越過）', state: { MC2: true } },
      ],
    },
    {
      name: 'TH-RY1 過載跳脫：M1 停、BZ 響、G2 亮；復歸後 BZ 停',
      steps: [
        { do: 'nfb', on: true }, { do: 'wait', ms: 300 },
        { do: 'press', device: 'ON1', ms: 300 }, { do: 'wait', ms: 500 },
        { do: 'trip', device: 'THRY1', on: true }, { do: 'wait', ms: 500 },
        { do: 'expect', note: 'TH-RY1 跳脫：MC1 復歸、R1 滅、BZ 響、G2 亮', state: { MC1: false, R1: false, BZ: true, G2: true } },
        { do: 'trip', device: 'THRY1', on: false }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '復歸：BZ 停，不自行再起動', state: { BZ: false, MC1: false } },
      ],
    },
    {
      name: 'TH-RY2 過載跳脫：M2 停、BZ 響',
      steps: [
        { do: 'nfb', on: true }, { do: 'wait', ms: 300 },
        { do: 'press', device: 'ON2', ms: 300 }, { do: 'wait', ms: 500 },
        { do: 'trip', device: 'THRY2', on: true }, { do: 'wait', ms: 500 },
        { do: 'expect', note: 'TH-RY2 跳脫：MC2 復歸、R2 滅、BZ 響', state: { MC2: false, R2: false, BZ: true, G2: true } },
        { do: 'trip', device: 'THRY2', on: false }, { do: 'wait', ms: 500 },
        { do: 'expect', note: '復歸：BZ 停', state: { BZ: false } },
      ],
    },
  ],
};
