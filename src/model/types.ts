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
export type ContactDriver = 'coil' | 'timer' | 'trip' | 'press';

export type ElementDef =
  | { kind: 'coil'; t: [string, string] }
  | { kind: 'lamp'; t: [string, string] }
  | { kind: 'buzzer'; t: [string, string] }
  | { kind: 'link'; t: [string, string]; fuse?: boolean }
  | { kind: 'contact'; t: [string, string]; type: 'a' | 'b'; driver: ContactDriver; name: string };

export type DeviceKind =
  | 'MC' | 'TR' | 'THRY' | 'PB' | 'PL' | 'BZ' | 'DF' | 'NFB' | 'TB1' | 'TB2' | 'TB16' | 'TBM4' | 'TBM3' | 'GBAR';

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
  | { do: 'expect'; state: Record<string, boolean>; note: string };

export interface Scenario { name: string; steps: SimAction[] }

export interface TeacherStep {
  n: number;
  text: string;              // 原文
  chain: string;             // 'DF1.下 > MCF.b右上 > ⊘1 > BZ.1 > OFF.b上'
}

export interface QuestionDef {
  id: string;
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
}
