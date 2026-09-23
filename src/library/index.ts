/**
 * 器具庫：每種器具一個檔案（端子幾何、內部元件、資訊卡示意座標）。
 * 題目檔用 place() 把器具「叫出來」放到圖紙座標上；所有題目共用同一套器具定義，
 * 考場實物不同時只改這裡。
 */
import type { DeviceDef, DeviceInstance, DeviceKind, PanelId, TerminalDef } from '../model/types';
import { MC } from './mc';
import { TR_YD, TR_OFF } from './timer';
import { KR } from './keepRelay';
import { THRY } from './thry';
import { PB, PL, BZ } from './operator';
import { DF, NFB } from './power';
import { TB1, TB2, TB16, TBM4, TBM3, GBAR } from './terminalBlocks';

export const LIBRARY: Record<DeviceKind, DeviceDef> = { MC, TR: TR_YD, TRF: TR_OFF, KR, THRY, PB, PL, BZ, DF, NFB, TB1, TB2, TB16, TBM4, TBM3, GBAR };

/** 相容舊名稱 */
export const DEVICE_DEFS = LIBRARY;
export function defOf(kind: DeviceKind): DeviceDef { return LIBRARY[kind]; }

export const KIND_NAME: Record<DeviceKind, string> = {
  MC: '電磁接觸器 2a2b', TR: 'Y-Δ 限時電驛（8-pin 底座）', TRF: '斷電延遲限時電驛 1c（8-pin 底座）', KR: '保持電驛 2c（11-pin 底座）', THRY: '積熱電驛 1c', PB: '按鈕開關 1a1b', PL: '指示燈',
  BZ: '蜂鳴器', DF: '栓型保險絲', NFB: '無熔線開關', TB1: '電源端子台 3P', TB2: '端子台 8P（主電路）',
  TB16: '端子台 16P', TBM4: '引接端子台 4P（無編號）', TBM3: '引接端子台 3P（無編號）', GBAR: '接地端子板',
};

/** 材料表規格（第二站各題相同的預設；MC 容量、EMS 等在題目檔用 spec 覆寫） */
export const KIND_SPEC: Partial<Record<DeviceKind, string>> = {
  NFB: '3P, 220V, 100AF, 75AT, IC 10kA', DF: '500V, 2A, 含腳座',
  MC: 'AC 220V, coil 220V, 3P, 輔助接點 2a2b', THRY: '24A, 可調型, 三加熱子',
  TR: 'AC 220V, Y-Δ 專用, 0–30 sec, 限時接點 1c, 附底座', TRF: 'AC 220V, 0–10 sec, OFF Delay, 限時接點 1c, 附底座',
  KR: 'AC 220V, 5A, 2c, 附底座', PB: '30mmφ, 600V, 1a1b', PL: 'AC 220V/15V, 燈泡 18V, 30mmφ', BZ: 'AC 220V, 30mmφ, 埋入式',
  TB1: '3P, 600V, 50A', TB2: '8P, 600V, 30A', TB16: '16P, 600V, 20A', GBAR: '銅質, 5P，固定於控制箱',
};
export const specOf = (d: DeviceInstance): string | undefined => d.spec ?? KIND_SPEC[d.kind];

/** 器具庫瀏覽用的說明（實物依據） */
export const KIND_NOTE: Partial<Record<DeviceKind, string>> = {
  MC: 'OMRON J7KN：主接點上 1 3 5 / 下 2 4 6；線圈 A1 在右上（a右上之上）、A2 在左下（a左下之下）。左右側掛 1a1b 接點塊，每塊由上到下 a、b、b、a（a 接點在外側、b 在中間）。',
  TR: 'OMRON H3CR-G8L 於 P2CF-08 / PF083A 底座；前視上排 6 5 4 3、下排 7 8 1 2。2-7 電源、8-5 Y、8-6 Δ。',
  TRF: 'OFF-delay（例 OMRON H3CR-H8L）：2-7 電源、8 共用、8-5 延時 b、8-6 延時 a。得電立即動作，斷電後延遲才復歸。腳位為假設。',
  KR: 'Keep Relay：SC 2-10 設定、RC 5-7 復歸，斷電保持。接點一 1 共用／4 a／3 b，接點二 11 共用／8 a／9 b。腳位為假設。',
  THRY: '1c 型：c(95) 共用、b(96) 常閉、a(98) 常開。',
  PB: 'OMRON A22：背面接點座左 NC 1-2、右 NO 3-4；本體端子由考場引接至小 TB。',
  PL: 'X1 X2，由考場引接至 2P 小 TB。',
  BZ: '1 2，由考場引接至 2P 小 TB。',
  DF: '栓型保險絲座，上下各一端子；模擬短路時燒斷。',
  NFB: '控制電源必須取自負載側 A B C。',
  TB1: '電源側端子台，控制線接到這裡會判「未受 NFB 控制」。',
  TB16: '雙排端子台：每腳位兩顆螺絲同一金屬片，靠門那顆為已配妥過門線（TB3 ↔ TB4 同號相通），考生接另一顆。',
  TBM4: '無編號；滑鼠停在端子上會顯示引接來源（等同量通路）。',
  TBM3: '無編號；滑鼠停在端子上會顯示引接來源。',
};

/** 電工法規三相色：R 紅、S 白、T 黑 */
export const PHASE_COLOR: Record<'R' | 'S' | 'T', string> = { R: '#d62828', S: '#f4f4f2', T: '#1d1d1d' };
/** 模擬器內部相別 A/B/C 對應 R/S/T */
export const PHASE_NAME: Record<string, 'R' | 'S' | 'T'> = { A: 'R', B: 'S', C: 'T' };
export const ROLE_COLOR: Record<TerminalDef['role'], string> = {
  coil: '#e05a7a', a: '#3aa0ff', b: '#ff9f2e', common: '#b47cff', power: '#e05a7a',
  load: '#42c48a', fuse: '#c9b458', source: '#ff5c5c', tb: '#9aa5b1', main: '#6b7078',
};

export const ROLE_NAME: Record<TerminalDef['role'], string> = {
  coil: '線圈', a: 'a 接點（常開）', b: 'b 接點（常閉）', common: '共用點', power: '電驛電源',
  load: '負載', fuse: '保險絲', source: '電源', tb: '端子台', main: '主電路（已配妥）',
};

export interface PlaceOpts { label?: string; desc?: string; color?: string; display?: boolean; w?: number; h?: number; latch?: boolean; timerSec?: number; spec?: string }

/** 把器具庫中的器具放到圖紙上（座標 mm，左上角） */
export function place(kind: DeviceKind, id: string, panel: PanelId, x: number, y: number, opts: PlaceOpts = {}): DeviceInstance {
  if (!LIBRARY[kind]) throw new Error(`器具庫沒有 ${kind}`);
  return { id, kind, panel, x, y, ...opts };
}

/** 檢查題目器具是否重疊（開發輔助） */
export function overlaps(devices: DeviceInstance[]): [string, string][] {
  const out: [string, string][] = [];
  const box = (d: DeviceInstance) => { const def = LIBRARY[d.kind]; return { x: d.x, y: d.y, w: d.w ?? def.w, h: d.h ?? def.h }; };
  for (let i = 0; i < devices.length; i++) for (let j = i + 1; j < devices.length; j++) {
    const a = devices[i], b = devices[j];
    if (a.panel !== b.panel) continue;
    const A = box(a), B = box(b);
    if (A.x < B.x + B.w && B.x < A.x + A.w && A.y < B.y + B.h && B.y < A.y + A.h) out.push([a.id, b.id]);
  }
  return out;
}
