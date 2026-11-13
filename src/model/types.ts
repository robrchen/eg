import type { SchDiagram } from './schematic';
/** 面板：器具板 / 操作面板 */
export type PanelId = 'device' | 'operator';

/** 端子角色（決定顏色與提示） */
export type TerminalRole =
  | 'coil'    // 線圈 A1/A2
  | 'a'       // a 接點
  | 'b'       // b 接點
  | 'common'  // 共用點 (TR 8, TH-RY c)
  | 'power'   // 電驛電源 (TR 2/7)
  | 'load'    // 燈 / 蜂鳴器
  | 'fuse'    // 栓型保險絲
  | 'source'  // 電源 (NFB 負載側、TB1)
  | 'tb'      // 端子台
  | 'ground'  // 設備接地（G 端子板、E 接地極）：只能與接地端子相接，導線自動變 8mm² 綠線
  | 'main';   // 主電路端子（僅顯示，不可接）

export interface TerminalDef {
  id: string;        // 器具內唯一 id，例如 'a左上'、'A1'
  label: string;     // 主標示
  /** 圖面上的簡寫（純顯示）。有位置可辨識左右上下的地方用它，例如 MC 輔助接點只寫 a / b */
  short?: string;
  sub?: string;      // 副標示（IEC 編號等）
  role: TerminalRole;
  x: number;         // 相對器具左上角 (mm)
  y: number;
  wireable?: boolean; // 預設 true
  /** 電源相別（電工法規色：R 紅、S 白、T 黑），端子點用相色填 */
  phase?: 'R' | 'S' | 'T';
}

/** 接點驅動來源：同一器具內部的狀態 */
export type ContactDriver = 'coil' | 'timer' | 'trip' | 'press'
  | 'offdelay'   // 斷電延遲計時器：線圈得電立即動作，斷電後延遲 T 秒才復歸
  | 'latch'      // 保持電驛：SC 線圈得電設定、RC 線圈得電復歸，斷電仍保持；棘輪電驛：線圈每得電一次翻轉一次
  | 'level'      // 液面控制器 61F-G 內部電驛：電源有電且 E1 碰水（或已動作且 E2 仍碰水）時動作
  | 'water1'     // 電極棒 E1（高水位）碰到水 → E1-E3 經水導通
  | 'water2'     // 電極棒 E2（低水位）碰到水 → E2-E3 經水導通
  | 'float'      // 浮球開關：給水源有水時 a 接點閉合（通電測試中可切換）
  | 'level2'     // 液面控制器 61F-G2 第二組電驛（U2）：電源有電且 E4 經浮球／水與 E3 相通（異常水位）時動作
  | 'bs';        // 水銀浮球開關（污水池）：仰角向上時閉合；水位升到設定點浮起、降到低水位落下，也可點一下手動抬起

export type ElementDef =
  | { kind: 'coil'; t: [string, string]; name?: string }   // 多線圈器具（KR 的 SC／RC）以 name 區分
  | { kind: 'lamp'; t: [string, string] }
  | { kind: 'buzzer'; t: [string, string] }
  | { kind: 'link'; t: [string, string]; fuse?: boolean }
  | { kind: 'contact'; t: [string, string]; type: 'a' | 'b'; driver: ContactDriver; name: string };

export type DeviceKind =
  | 'MC' | 'TR' | 'TRF' | 'KR' | 'THRY' | 'PB' | 'PL' | 'BZ' | 'DF' | 'NFB' | 'TB1' | 'TB2' | 'TB16' | 'TBM4' | 'TBM3' | 'GBAR' | 'EBAR'
  // 第三題起新增
  | 'RY'      // 輔助電驛 2c（8 腳底座）
  | 'MR'      // 棘輪電驛 2c（8 腳底座，線圈每得電一次接點翻轉一次）
  | 'LC'      // 液面控制器 61F-G（引線已配至 TB7）
  | 'ELEC'    // 電極棒 E1 E2 E3（屋頂水塔，引線已配至 TB6）
  | 'FS'      // 浮球開關 1a1b（給水源，引線已配至 TB6）
  | 'COS'     // 切換開關 二段式 1a1b：M、A 兩個接點各自兩端引接到 4P 小 TB（M M A A），共用點由考生自己跨接
  | 'THRY2'   // 電磁開關附的積熱電驛（二加熱子，95 96 98 直接接線）
  | 'TB8'     // 8P 端子台（TB6／TB7：一側考場引接、一側考生接線）
  | 'TB4M'    // 4P 主電路端子台（U V W G，引出到電動機，僅顯示）
  // 第四題起新增
  | 'LC2'     // 液面控制器 61F-G2（雙用型：U1 起停、U2 異常水位；引線已配至 TB5）
  | 'BS'      // 水銀浮球開關 1a（污水池，引線已配至 TB7）
  | 'TB12';   // 12P 引接端子台（TB5：61F-G2 的引線）

export interface DeviceDef {
  kind: DeviceKind;
  w: number;           // 標準尺寸 (mm)
  h: number;
  shape?: 'rect' | 'circle';
  terminals: TerminalDef[];
  elements: ElementDef[];
  /** 端子最多可接導線數（預設 2） */
  capacity?: number;
  /** 資訊卡示意圖專用座標（拉開間距，方便大字顯示）；未提供則用實物座標 */
  card?: {
    w: number; h: number;
    /** 示意圖固定照這個長寬比畫（例：限時電驛的方形底座），不因緊湊模式被壓扁 */
    keepAspect?: boolean;
    pos: Record<string, [number, number]>;
  };
}

/** 題目中放置的器具實例 */
export interface DeviceInstance {
  id: string;          // MCF, MCR, TR, FWD, ...
  kind: DeviceKind;
  panel: PanelId;
  x: number;           // 左上角 (mm)
  y: number;
  w?: number;          // 覆寫尺寸
  h?: number;
  label?: string;      // 顯示名稱（預設 id）
  desc?: string;       // 用途說明（例：逆轉用），同一種器具在不同題目扮演不同角色
  color?: string;      // PB/PL 顏色
  /** 只顯示不可接（例如 TB2、G） */
  display?: boolean;
  /** 按鈕按下自鎖（非自復型，例如 EMS 緊急停止）：按一下鎖住、再按一下解除 */
  latch?: boolean;
  /** 計時器設定秒數（未設定則用通電測試的滑桿值） */
  timerSec?: number;
  spec?: string;       // 材料表規格（覆寫器具庫預設，例：MC 各顆容量不同）
  /** 水銀浮球開關：水位升到 levelOn 浮起（閉合）、降到 levelOff 落下（打開），水位為 0～1 */
  levelOn?: number;
  levelOff?: number;
}

export interface DuctRect { panel: PanelId; x: number; y: number; w: number; h: number }

/** 使用者導線：兩端子的全域 id  `MCF.a左上` */
export interface Wire {
  id: string;
  a: string;
  b: string;
  panel: PanelId;
}

/** 過門線：TB3.n <-> TB4.n */
export interface PassThrough { a: string; b: string }

export type SimAction =
  | { do: 'nfb'; on: boolean }
  | { do: 'press'; device: string; ms: number }
  | { do: 'wait'; ms: number }
  | { do: 'trip'; device: string; on: boolean }
  /** 直接設定切換式器具（COS 手動／自動、FS 有水／無水）的狀態 */
  | { do: 'set'; device: string; on: boolean }
  /** 水位 0（空）～1（滿）。第三題水塔：E2 在 0.35、E1 在 0.85；第四題污水池：各浮球的 levelOn／levelOff */
  | { do: 'level'; value: number }
  | { do: 'expect'; state: Record<string, boolean>; note: string };

export interface Scenario { name: string; steps: SimAction[] }

export interface TeacherStep {
  n: number;
  text: string;              // 原文
  chain: string;             // 'DF1.下 > MCF.b右上 > ⊘1 > BZ.1 > OFF.b上'
}

/** 電動機場景（正反轉／Y-Δ） */
export interface MotorScene { kind?: 'motor'; fwd?: string; rev?: string; star?: string; delta?: string; timer?: string; thry?: string; ems?: string }
/**
 * 抽水泵場景（兩台泵、給水源浮球、屋頂水塔電極棒）：
 * 模擬器依 pumps 的接觸器吸合推算水位變化（自動水位開啟時）；fs／elec／lc／mr／cos／thry 給場景顯示用。
 */
export interface PumpScene {
  kind: 'pump';
  pumps: string[];          // 各台泵的接觸器 id（MC1、MC2）
  thry: string[];           // 對應的積熱電驛 id
  fs: string;               // 浮球開關
  elec: string;             // 電極棒
  lc: string;               // 液面控制器
  mr?: string;              // 棘輪電驛（交替）
  cos?: string;             // 切換開關
  x?: string;               // 輔助電驛（滿水）
}

/**
 * 污排水泵場景（第四題）：污水持續流入污水池，兩台泵往外排；BS1（高水位）起動、BS2（異常水位）兩台並列。
 * 模擬器依 pumps 的接觸器吸合推算水位變化（自動水位開啟時）。
 */
export interface SumpScene {
  kind: 'sump';
  pumps: string[];          // 各台泵的接觸器 id（MC1、MC2）
  thry: string[];           // 對應的積熱電驛 id
  bs: string[];             // 浮球開關（BS1 高水位、BS2 異常水位）
  lc: string;               // 液面控制器 61F-G2
  apn?: string;             // 交互電驛
  cos?: string;             // 切換開關
  x?: string;               // 輔助電驛（異常水位）
}

export interface QuestionDef {
  id: string;
  /** 存檔版本（預設 2）：題目的端子／引接改到舊存檔對不上時加 1，舊的接線進度就不再載入 */
  rev?: number;
  title: string;
  minutes: number;
  panels: Record<PanelId, { name: string; w: number; h: number; mirror?: boolean; note?: string }>;
  devices: DeviceInstance[];
  ducts: DuctRect[];
  passThrough: PassThrough[];
  timerDefaultSec: number;
  teacherSteps: TeacherStep[];
  scenarios: Scenario[];
  images: { circuit: string; layout: string };
  /** 單線圖（重繪，符號腳位綁實體端子；見 model/schematic.ts） */
  schematic?: SchDiagram;
  /** 場景動畫：電動機（預設；器具 id 省略則依 MCF／MCR／MCS／MCD、TR｜TR1、THRY、EMS 猜）或抽水泵（第三題） */
  scene?: MotorScene | PumpScene | SumpScene;
  /** TB1 位在主開關（NFB）的負載側（第四題：電源 → NFB3 → TB1 → NFB1／NFB2），NFB 沒投入時 TB1 沒電 */
  tb1AfterNfb?: boolean;
}
