import type { DeviceDef } from '../model/types';
import { M, F } from './_helpers';

/**
 * 積熱電驛 1c（考場規格：24A 可調、三加熱子、1c 接點）
 * 主端子上 1 3 5 / 下 2 4 6（已配妥）；右側輔助接點 c(95 共用) / b(96 常閉) / a(98 常開)，考場已引接到本體下方 3P 小 TB（順序 c b a），考生從小 TB 接線。
 */
/*
 * 外觀依講義：上排 1 3 5、下排 2 4 6 ＋ 95(c)，其下 96(b) 98(a) 兩顆一組；
 * 右側是操作區（電流刻度盤、跳脫指示、過載 TEST 鈕、復歸 RESET 鈕），和端子分開。
 */
export const THRY: DeviceDef = {
  kind: 'THRY', w: 96, h: 54,
  terminals: [
    M('L1', 12, 9, '1'), M('L2', 28, 9, '3'), M('L3', 44, 9, '5'),
    M('T1', 12, 25, '2'), M('T2', 28, 25, '4'), M('T3', 44, 25, '6'),
    F('c', 'common', 62, 25, '95 共用'), F('b', 'b', 44, 42, '96'), F('a', 'a', 62, 42, '98'),
  ],
  elements: [
    { kind: 'contact', t: ['c', 'b'], type: 'b', driver: 'trip', name: 'c-b' },
    { kind: 'contact', t: ['c', 'a'], type: 'a', driver: 'trip', name: 'c-a' },
  ],
  card: { w: 100, h: 64, pos: { L1: [14, 12], L2: [32, 12], L3: [50, 12], T1: [14, 32], T2: [32, 32], T3: [50, 32], c: [70, 32], b: [50, 52], a: [70, 52] } },
};
