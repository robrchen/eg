import type { DeviceDef } from '../model/types';
import { M, T } from './_helpers';

/** TB1 3P 電源端子台（電源側；控制電路接到這裡會被評審扣） */
export const TB1: DeviceDef = {
  kind: 'TB1', w: 92, h: 48,
  terminals: [T('A', 'source', 22, 24), T('B', 'source', 46, 24), T('C', 'source', 70, 24)],
  elements: [],
  card: { w: 100, h: 40, pos: { A: [22, 20], B: [50, 20], C: [78, 20] } },
};

/** TB2 8P（主電路，僅顯示） */
export const TB2: DeviceDef = {
  kind: 'TB2', w: 216, h: 36,
  terminals: ['U', 'V', 'W', 'X', 'Y', 'Z', '7', '8'].map((n, i) => M(n, 14 + i * 27, 18)),
  elements: [],
};

/** 16P 雙排端子台（TB3 器具板 / TB4 操作面板）：每腳位兩顆螺絲，考生接線側 x=10、過門線側 x=30（已配妥，由 panel 繪製） */
export const TB16: DeviceDef = {
  kind: 'TB16', w: 40, h: 408,
  terminals: Array.from({ length: 16 }, (_, i) => T(String(i + 1), 'tb', 10, 14 + i * 25)),
  elements: [],
};

/** 操作面板小端子台 4P（無編號，考場已把按鈕本體引接至此；講義標示由左到右 a a b b） */
export const TBM4: DeviceDef = {
  kind: 'TBM4', w: 50, h: 18,
  terminals: [1, 2, 3, 4].map((n, i) => T(String(n), 'tb', 7 + i * 12, 9, undefined, '')),
  elements: [],
  card: { w: 100, h: 40, pos: { '1': [14, 20], '2': [38, 20], '3': [62, 20], '4': [86, 20] } },
};

/** 小端子台 3P（無編號；燈／蜂鳴器引接只用兩側 1、3，TH-RY 引接 c b a） */
export const TBM3: DeviceDef = {
  kind: 'TBM3', w: 40, h: 18,
  terminals: [1, 2, 3].map((n, i) => T(String(n), 'tb', 8 + i * 12, 9, undefined, '')),
  elements: [],
  card: { w: 100, h: 40, pos: { '1': [20, 20], '2': [50, 20], '3': [80, 20] } },
};

/** 接地線端子板 G（銅質 5P，本題範圍外，僅顯示） */
export const GBAR: DeviceDef = {
  kind: 'GBAR', w: 54, h: 18,
  terminals: Array.from({ length: 5 }, (_, i) => M('G' + (i + 1), 7 + i * 10, 9)),
  elements: [],
};
