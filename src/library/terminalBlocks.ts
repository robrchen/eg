import type { DeviceDef } from '../model/types';
import { M, T } from './_helpers';

/** TB1 3P 電源端子台：上方引入電源、下方引到 NFB 電源側（都已配妥）；控制電路接到這裡會被評審扣 */
export const TB1: DeviceDef = {
  kind: 'TB1', w: 92, h: 48,
  terminals: [
    { ...T('A', 'source', 22, 22, '電源', 'R'), phase: 'R' },
    { ...T('B', 'source', 46, 22, '電源', 'S'), phase: 'S' },
    { ...T('C', 'source', 70, 22, '電源', 'T'), phase: 'T' },
  ],
  elements: [],
  card: { w: 100, h: 40, pos: { A: [22, 20], B: [50, 20], C: [78, 20] } },
};

/**
 * TB2 8P 雙排（主電路，僅顯示）：上排接盤內主電路，下排引出到電動機 U V W X Y Z（Y-Δ 六條），
 * 第 7 格空、第 8 格為接地 G。端子座標取上排，下排由 panel 繪製。
 */
export const TB2: DeviceDef = {
  kind: 'TB2', w: 216, h: 40,
  terminals: ['U', 'V', 'W', 'X', 'Y', 'Z', '7', '8'].map((n, i) => ({ ...M(n, 14 + i * 27, 10), label: n === '8' ? 'G' : n })),
  elements: [],
};

/** 16P 雙排端子台（TB3 器具板 / TB4 操作面板）：每腳位兩顆螺絲，考生接線側 x=10、過門線側 x=30（已配妥，由 panel 繪製） */
export const TB16: DeviceDef = {
  kind: 'TB16', w: 40, h: 408,
  terminals: Array.from({ length: 16 }, (_, i) => T(String(i + 1), 'tb', 10, 14 + i * 25)),
  elements: [],
};

/**
 * 操作面板小端子台 4P（無編號，考場已把按鈕本體引接至此）。
 * 雙排：上排螺絲壓考場的引接線（已配妥、僅顯示），下排留給考生，由 panel 繪製。
 * 端子座標取下排；TB.1-2 為 b 接點、TB.3-4 為 a 接點，鏡射後的背面圖由左到右即講義的 a a b b。
 */
export const TBM4: DeviceDef = {
  kind: 'TBM4', w: 50, h: 22,
  terminals: [1, 2, 3, 4].map((n, i) => T(String(n), 'tb', 7 + i * 12, 16, undefined, '')),
  elements: [],
  card: { w: 100, h: 40, pos: { '1': [14, 20], '2': [38, 20], '3': [62, 20], '4': [86, 20] } },
};

/** 小端子台 3P 雙排（無編號；燈／蜂鳴器只引接兩側 1、3，中間一格為空位不顯示；TH-RY 引接 c b a） */
export const TBM3: DeviceDef = {
  kind: 'TBM3', w: 40, h: 22,
  terminals: [1, 2, 3].map((n, i) => T(String(n), 'tb', 8 + i * 12, 16, undefined, '')),
  elements: [],
  card: { w: 100, h: 40, pos: { '1': [20, 20], '2': [50, 20], '3': [80, 20] } },
};

/** 接地線端子板 G（銅排 5P，固定於控制箱）：TB2 的 G 已由考場以綠黃線接到第 1 顆；考生從這裡接 8mm² 綠線到 E */
export const GBAR: DeviceDef = {
  kind: 'GBAR', w: 54, h: 18,
  terminals: Array.from({ length: 5 }, (_, i) => T('G' + (i + 1), 'ground', 7 + i * 10, 9, undefined, 'G')),
  elements: [],
  card: { w: 100, h: 40, pos: Object.fromEntries(Array.from({ length: 5 }, (_, i) => ['G' + (i + 1), [12 + i * 19, 20]])) },
};

/** 接地極端子板 E（銅質 4P，固定於檢定崗位、控制箱外）：控制箱的 G 必須接到這裡 */
export const EBAR: DeviceDef = {
  kind: 'EBAR', w: 44, h: 18,
  terminals: Array.from({ length: 4 }, (_, i) => T('E' + (i + 1), 'ground', 7 + i * 10, 9, undefined, 'E')),
  elements: [],
  card: { w: 100, h: 40, pos: Object.fromEntries(Array.from({ length: 4 }, (_, i) => ['E' + (i + 1), [14 + i * 24, 20]])) },
};

/**
 * 8P 引接端子台（TB6：浮球開關與電極棒；TB7：液面控制器）：一側考場引接（已配妥、僅顯示），另一側考生接線。
 * 無編號，每格引接自哪個端子由引接線決定，滑鼠停留可看到（同 TBM）。
 */
export const TB8: DeviceDef = {
  kind: 'TB8', w: 98, h: 22,
  terminals: Array.from({ length: 8 }, (_, i) => T(String(i + 1), 'tb', 7 + i * 12, 16, undefined, '')),
  elements: [],
  card: { w: 100, h: 40, pos: Object.fromEntries(Array.from({ length: 8 }, (_, i) => [String(i + 1), [8 + i * 12, 20]])) },
};

/** 4P 主電路端子台（TB2／TB5：U V W 引出到電動機、G 接地），僅顯示 */
export const TB4M: DeviceDef = {
  kind: 'TB4M', w: 100, h: 40,
  terminals: ['U', 'V', 'W', 'G'].map((n, i) => ({ ...M(n, 14 + i * 24, 10), ...(n === 'G' ? { role: 'ground' as const } : {}) })),
  elements: [],
};
