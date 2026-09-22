import type { DeviceDef } from '../model/types';
import { M, F } from './_helpers';

/**
 * 積熱電驛 1c（考場規格：24A 可調、三加熱子、1c 接點）
 * 主端子上 1 3 5 / 下 2 4 6（已配妥）；右側輔助接點 c(95 共用) / b(96 常閉) / a(98 常開)，考場已引接到本體下方 3P 小 TB（順序 c b a），考生從小 TB 接線。
 */
export const THRY: DeviceDef = {
  kind: 'THRY', w: 92, h: 50,
  terminals: [
    M('L1', 22, 9, '1'), M('L2', 38, 9, '3'), M('L3', 54, 9, '5'),
    M('T1', 22, 41, '2'), M('T2', 38, 41, '4'), M('T3', 54, 41, '6'),
    F('c', 'common', 82, 11, '95 共用'), F('b', 'b', 82, 25, '96'), F('a', 'a', 82, 39, '98'),
  ],
  elements: [
    { kind: 'contact', t: ['c', 'b'], type: 'b', driver: 'trip', name: 'c-b' },
    { kind: 'contact', t: ['c', 'a'], type: 'a', driver: 'trip', name: 'c-a' },
  ],
  card: { w: 100, h: 70, pos: { L1: [20, 10], L2: [38, 10], L3: [56, 10], T1: [20, 60], T2: [38, 60], T3: [56, 60], c: [84, 14], b: [84, 35], a: [84, 56] } },
};
