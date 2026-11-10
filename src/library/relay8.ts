import type { DeviceDef } from '../model/types';
import { T } from './_helpers';

/**
 * 8 腳前接線底座（P2CF-08 / PF083A，與限時電驛相同）上的電驛：
 * 底座前視上排 6 5 4 3、下排 7 8 1 2；2-7 線圈。
 * 接點一：1 共用、4 a、3 b；接點二：8 共用、5 a、6 b（MK2P 系列的排列）。
 * ※ 腳位為常見配置的假設，考場實物若不同只改這裡。
 */
const TERMS = (a1: string, b1: string, a2: string, b2: string) => [
  T('6', 'b', 11, 13, b2), T('5', 'a', 25, 13, a2), T('4', 'a', 39, 13, a1), T('3', 'b', 53, 13, b1),
  T('7', 'power', 11, 55, '線圈'), T('8', 'common', 25, 55, '接點二 共用'), T('1', 'common', 39, 55, '接點一 共用'), T('2', 'power', 53, 55, '線圈'),
];
const CARD = {
  w: 100, h: 100, keepAspect: true,
  pos: { '6': [14, 24], '5': [38, 24], '4': [62, 24], '3': [86, 24], '7': [14, 76], '8': [38, 76], '1': [62, 76], '2': [86, 76] } as Record<string, [number, number]>,
};

/** 輔助電驛 X（2c，AC 220V）：線圈得電接點切換、失電復歸 */
export const RY: DeviceDef = {
  kind: 'RY', w: 68, h: 68,
  terminals: TERMS('接點一 a', '接點一 b', '接點二 a', '接點二 b'),
  elements: [
    { kind: 'coil', t: ['2', '7'] },
    { kind: 'contact', t: ['1', '4'], type: 'a', driver: 'coil', name: '接點一 a (1-4)' },
    { kind: 'contact', t: ['1', '3'], type: 'b', driver: 'coil', name: '接點一 b (1-3)' },
    { kind: 'contact', t: ['8', '5'], type: 'a', driver: 'coil', name: '接點二 a (8-5)' },
    { kind: 'contact', t: ['8', '6'], type: 'b', driver: 'coil', name: '接點二 b (8-6)' },
  ],
  card: CARD,
};

/**
 * 棘輪電驛 MR（Ratchet relay，2c，例 OMRON G4Q-212S）：線圈每得電一次（脈衝），接點就翻轉一次並機械保持，
 * 斷電不改變。第三題用它讓兩台泵交替：水滿一次翻一次，下次換另一台。
 * 接點標示：b 側＝初始（第 1 台）、a 側＝翻轉後（第 2 台）。
 */
export const MR: DeviceDef = {
  kind: 'MR', w: 68, h: 68,
  terminals: TERMS('接點一 a（翻轉後）', '接點一 b（初始）', '接點二 a（翻轉後）', '接點二 b（初始）'),
  elements: [
    { kind: 'coil', t: ['2', '7'] },
    { kind: 'contact', t: ['1', '4'], type: 'a', driver: 'latch', name: '接點一 a (1-4)' },
    { kind: 'contact', t: ['1', '3'], type: 'b', driver: 'latch', name: '接點一 b (1-3)' },
    { kind: 'contact', t: ['8', '5'], type: 'a', driver: 'latch', name: '接點二 a (8-5)' },
    { kind: 'contact', t: ['8', '6'], type: 'b', driver: 'latch', name: '接點二 b (8-6)' },
  ],
  card: CARD,
};
