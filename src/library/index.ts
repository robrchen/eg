/**
 * 器具庫：每種器具一個檔案（端子幾何、內部元件、資訊卡示意座標）。
 * 題目檔用 place() 把器具「叫出來」放到圖紙座標上；所有題目共用同一套器具定義，
 * 考場實物不同時只改這裡。
 */
import type { DeviceDef, DeviceInstance, DeviceKind, PanelId, TerminalDef } from '../model/types';
import { MC } from './mc';
import { TR_YD, TR_OFF } from './timer';
import { KR } from './keepRelay';
import { THRY, THRY2 } from './thry';
import { PB, PL, BZ, COS } from './operator';
import { DF, NFB } from './power';
import { TB1, TB2, TB16, TBM4, TBM3, GBAR, EBAR, TB8, TB4M, TB12 } from './terminalBlocks';
import { RY, MR } from './relay8';
import { LC, ELEC, FS, LC2, BS } from './levelCtrl';

export const LIBRARY: Record<DeviceKind, DeviceDef> = { MC, TR: TR_YD, TRF: TR_OFF, KR, THRY, PB, PL, BZ, DF, NFB, TB1, TB2, TB16, TBM4, TBM3, GBAR, EBAR, RY, MR, LC, ELEC, FS, COS, THRY2, TB8, TB4M, LC2, BS, TB12 };

/** 相容舊名稱 */
export const DEVICE_DEFS = LIBRARY;
export function defOf(kind: DeviceKind): DeviceDef { return LIBRARY[kind]; }

export const KIND_NAME: Record<DeviceKind, string> = {
  MC: '電磁接觸器 2a2b', TR: 'Y-Δ 限時電驛（8-pin 底座）', TRF: '斷電延遲限時電驛 1c（8-pin 底座）', KR: '保持電驛 2c（11-pin 底座）', THRY: '積熱電驛 1c', PB: '按鈕開關 1a1b', PL: '指示燈',
  BZ: '蜂鳴器', DF: '栓型保險絲', NFB: '無熔線開關', TB1: '電源端子台 3P', TB2: '端子台 8P（主電路）',
  TB16: '端子台 16P', TBM4: '引接端子台 4P（無編號）', TBM3: '引接端子台 3P（無編號）', GBAR: '接地線端子板 G', EBAR: '接地極端子板 E',
  RY: '輔助電驛 2c（8-pin 底座）', MR: '棘輪電驛 2c（8-pin 底座）', LC: '液面控制器 61F-G', ELEC: '電極棒（屋頂水塔）', FS: '浮球開關 1a1b（給水源）',
  COS: '切換開關 二段式 1a1b', THRY2: '積熱電驛 1c（電磁開關附、二加熱子）', TB8: '引接端子台 8P（無編號）', TB4M: '端子台 4P（主電路）',
  LC2: '液面控制器 61F-G2（雙用型）', BS: '水銀浮球開關 1a（污水池）', TB12: '引接端子台 12P（無編號）',
};

/** 材料表規格（第二站各題相同的預設；MC 容量、EMS 等在題目檔用 spec 覆寫） */
export const KIND_SPEC: Partial<Record<DeviceKind, string>> = {
  NFB: '3P, 220V, 100AF, 75AT, IC 10kA', DF: '500V, 2A, 含腳座',
  MC: 'AC 220V, coil 220V, 3P, 輔助接點 2a2b', THRY: '24A, 可調型, 三加熱子',
  TR: 'AC 220V, Y-Δ 專用, 0–30 sec, 限時接點 1c, 附底座', TRF: 'AC 220V, 0–10 sec, OFF Delay, 限時接點 1c, 附底座',
  KR: 'AC 220V, 5A, 2c, 附底座', PB: '30mmφ, 600V, 1a1b', PL: 'AC 220V/15V, 燈泡 18V, 30mmφ', BZ: 'AC 220V, 30mmφ, 埋入式',
  TB1: '3P, 600V, 50A', TB2: '8P, 600V, 30A', TB16: '16P, 600V, 20A', GBAR: '銅質, 5P，固定於控制箱', EBAR: '銅質, 4P，固定於檢定崗位',
  RY: 'AC 220V, 5A, 2c, 附底座', MR: 'AC 220V, 5A, 2c, 附底座', LC: 'AC 220V, 單用型, 附電極棒', ELEC: '電極棒 3 支（附於 61F-G）', FS: '110–220V 1HP, 1a1b, 雙球式',
  COS: '30mmφ, 1a1b, 600V, 非復歸型, 二段式', THRY2: '15A 可調型, 二加熱子（電磁開關附）', TB8: '8P, 600V, 20A', TB4M: '4P, 600V, 30A',
  LC2: 'AC 220V, 雙用型, 附電極棒', BS: '600V, 1a, 仰角式（污排水專用）', TB12: '12P, 600V, 20A',
};
/**
 * 接地端子（G、E、61F-G 的 E3、電極棒 E3）：只能與接地端子相接，導線自動畫成綠色接地線。
 * 引接端子台（TB8）上引接自接地端子的那一格也算；要判斷這一點需要題目的 passThrough，所以可傳整個題目。
 */
export type GroundCtx = DeviceInstance[] | { devices: DeviceInstance[]; passThrough: { a: string; b: string }[] };
export function isGroundTerm(ctx: GroundCtx, tid: string): boolean {
  const devices = Array.isArray(ctx) ? ctx : ctx.devices;
  const roleOf = (t: string): TerminalDef['role'] | null => {
    const d = devices.find(x => x.id === t.slice(0, t.lastIndexOf('.')));
    return d ? LIBRARY[d.kind].terminals.find(x => x.id === t.slice(t.lastIndexOf('.') + 1))?.role ?? null : null;
  };
  if (roleOf(tid) === 'ground') return true;
  if (Array.isArray(ctx)) return false;
  const d = devices.find(x => x.id === tid.slice(0, tid.lastIndexOf('.')));
  if (!d || !PRE_TB.has(d.kind)) return false;
  const link = ctx.passThrough.find(p => (p.a === tid || p.b === tid) && !p.a.startsWith('TB3.'));
  return !!link && roleOf(link.a === tid ? link.b : link.a) === 'ground';
}
/** 考場引接用的端子台（一側引接自器具本體、另一側給考生） */
const PRE_TB = new Set<DeviceKind>(['TB8', 'TB12', 'TBM3', 'TBM4']);
export const isGroundWire = (ctx: GroundCtx, w: { a: string; b: string }): boolean => isGroundTerm(ctx, w.a) && isGroundTerm(ctx, w.b);
/**
 * 水銀浮球開關的引線（本體端子，或引接自它的端子台格子）：代替電極棒，一條接共用電極 E3（接地端子）、一條接 E1／E4，
 * 兩條不分極性，所以它是唯一可以同時和接地端子、控制端子相接的端子。
 */
export function isFloatLead(ctx: GroundCtx, tid: string): boolean {
  const devices = Array.isArray(ctx) ? ctx : ctx.devices;
  const kindOf = (t: string) => devices.find(x => x.id === t.slice(0, t.lastIndexOf('.')))?.kind;
  if (kindOf(tid) === 'BS') return true;
  if (Array.isArray(ctx) || !PRE_TB.has(kindOf(tid) as DeviceKind)) return false;
  const link = ctx.passThrough.find(p => (p.a === tid || p.b === tid) && !p.a.startsWith('TB3.'));
  return !!link && kindOf(link.a === tid ? link.b : link.a) === 'BS';
}
/** 這兩個端子可不可以相接（接地規則）：接地只接接地、控制只接控制；浮球引線兩邊都可以 */
export const groundOk = (ctx: GroundCtx, a: string, b: string): boolean =>
  isGroundTerm(ctx, a) === isGroundTerm(ctx, b) || isFloatLead(ctx, a) || isFloatLead(ctx, b);

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
  GBAR: '控制箱的接地線端子板。TB2 的 G（電動機外殼）已由考場接到第 1 顆；考生要從任一顆接 8mm² 綠線到 E。',
  EBAR: '檢定崗位的接地極端子板（控制箱外）。控制箱的 G 必須接到這裡，視為已接至接地極。',
  RY: '8 腳底座（同限時電驛）：2-7 線圈；接點一 1 共用／4 a／3 b，接點二 8 共用／5 a／6 b。腳位為 MK2P 系列的常見排列，考場以現場標示為準。',
  MR: '棘輪電驛（例 OMRON G4Q）：線圈每得電一次接點翻轉一次並機械保持，斷電不變。腳位同輔助電驛：2-7 線圈；1 共用／4 a（翻轉後）／3 b（初始），8 共用／5 a／6 b。第三題用它讓兩台泵交替。',
  LC: 'OMRON 61F-G：S0-S2 電源；Tc 共用，Ta 於水位到 E1 時閉合、降到 E2 以下才打開（E2 自保持）；E3 共用電極需接地。本體引線已配至 TB7，考生只在 TB7 接線。',
  ELEC: '三支電極棒：E1 最短（高水位）、E2（低水位）、E3 最長（共用）。水碰到電極即與 E3 導通。引線已配至 TB6。',
  FS: '浮球開關（給水源）：有水時 a 閉合、b 打開。引線已配至 TB6；通電測試可切換有水／無水。',
  THRY2: '電磁開關附的積熱電驛：主端子上 1 3 5／下 2 4 6（已配妥）；95(c)／96(b)／98(a) 為本體螺絲端子，直接接線。',
  TB8: '8P 引接端子台，無編號：一側已由器具引接（灰色虛線），另一側給考生。滑鼠停在端子上可看到它引接自哪個端子。',
  TB4M: '4P 主電路端子台：U V W 引出到電動機、G 為電動機外殼接地（已由考場接到 G 端子板）。',
  LC2: 'OMRON 61F-G2（雙用型）：S0-S2 電源；U1（Tc1 共用、Ta1、Tb1）在 E1 與 E3 相通時動作，U2（Tc2、Ta2）在 E4 與 E3 相通（異常水位）時動作；E3 共用電極需接地。本體引線已配至 TB5，考生只在 TB5 接線。',
  BS: '污排水專用水銀浮球開關（仰角式 1a）：浮球被水抬到向上仰角時接點閉合，退到向下仰角才打開。兩條引線不分極性，已配至 TB7。通電測試可點浮球手動抬起／放下。',
  COS: '二段式切換開關（講義實物）：M 接點（b）與 A 接點（a）各自兩端引接到 4P 小 TB（M M A A），共用點要自己跨接。',
  TB12: '12P 引接端子台，無編號：上排已由 61F-G2 引接，下排給考生。滑鼠停在端子上可看到它引接自哪個端子。',
};

/** 電工法規三相色：R 紅、S 白、T 黑 */
export const PHASE_COLOR: Record<'R' | 'S' | 'T', string> = { R: '#d62828', S: '#f4f4f2', T: '#1d1d1d' };
/** 模擬器內部相別 A/B/C 對應 R/S/T */
export const PHASE_NAME: Record<string, 'R' | 'S' | 'T'> = { A: 'R', B: 'S', C: 'T' };
export const ROLE_COLOR: Record<TerminalDef['role'], string> = {
  coil: '#e05a7a', a: '#3aa0ff', b: '#ff9f2e', common: '#b47cff', power: '#e05a7a',
  load: '#42c48a', fuse: '#c9b458', source: '#ff5c5c', tb: '#9aa5b1', main: '#6b7078', ground: '#2f9e44',
};

export const ROLE_NAME: Record<TerminalDef['role'], string> = {
  coil: '線圈', a: 'a 接點（常開）', b: 'b 接點（常閉）', common: '共用點', power: '電驛電源',
  load: '負載', fuse: '保險絲', source: '電源', tb: '端子台', main: '主電路（已配妥）', ground: '接地（8mm² 綠線）',
};

export interface PlaceOpts { label?: string; desc?: string; color?: string; display?: boolean; w?: number; h?: number; latch?: boolean; timerSec?: number; spec?: string; levelOn?: number; levelOff?: number }

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
