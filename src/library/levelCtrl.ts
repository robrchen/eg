import type { DeviceDef } from '../model/types';
import { F } from './_helpers';

/**
 * 液面控制器 61F-G（OMRON，AC 220V 單用型）：
 * S0-S2 電源（220V）；Tc 共用、Ta／Tb 輸出接點；E1（高水位）E2（低水位）E3（共用，需接地）電極棒端子。
 * 動作：電源有電且 E1 碰水 → 內部電驛動作，Tc-Ta 閉合（Tc-Tb 打開）；之後只要 E2 仍碰水就自保持；
 *       水降到 E2 以下 → 復歸。給水控制時用 Ta 經輔助電驛反相（水滿停泵），排水控制直接用 Ta。
 * 考場：本體引線已配至 TB7，考生只在 TB7 接線；本體端子不可接。
 */
export const LC: DeviceDef = {
  kind: 'LC', w: 76, h: 60,
  terminals: [
    F('S0', 'power', 9, 8, '電源'), F('S2', 'power', 19, 8, '電源'),
    F('Tc', 'common', 31, 8, '輸出 共用'), F('Ta', 'a', 41, 8, '輸出（動作時閉）'), F('Tb', 'b', 51, 8, '輸出（復歸時閉）'),
    F('E3', 'ground', 61, 8, '電極 共用（接地）'), F('E2', 'common', 69, 8, '電極 低水位'), F('E1', 'common', 75, 8, '電極 高水位'),
  ],
  elements: [
    { kind: 'coil', t: ['S2', 'S0'] },
    { kind: 'contact', t: ['Tc', 'Ta'], type: 'a', driver: 'level', name: 'Tc-Ta' },
    { kind: 'contact', t: ['Tc', 'Tb'], type: 'b', driver: 'level', name: 'Tc-Tb' },
  ],
  card: { w: 100, h: 44, pos: { S0: [10, 22], S2: [22, 22], Tc: [36, 22], Ta: [48, 22], Tb: [60, 22], E3: [74, 22], E2: [84, 22], E1: [94, 22] } },
};

/**
 * 電極棒（置於屋頂水塔）：E1 最短（高水位）、E2 居中（低水位）、E3 最長（共用）。
 * 水碰到電極就經水導通到 E3；引線已配至 TB6。
 */
export const ELEC: DeviceDef = {
  kind: 'ELEC', w: 44, h: 60,
  terminals: [F('E3', 'ground', 10, 6, '共用（最長）'), F('E2', 'common', 22, 6, '低水位'), F('E1', 'common', 34, 6, '高水位（最短）')],
  elements: [
    { kind: 'contact', t: ['E1', 'E3'], type: 'a', driver: 'water1', name: 'E1 碰水' },
    { kind: 'contact', t: ['E2', 'E3'], type: 'a', driver: 'water2', name: 'E2 碰水' },
  ],
  card: { w: 100, h: 44, pos: { E3: [20, 22], E2: [50, 22], E1: [80, 22] } },
};

/**
 * 浮球開關 FS（給水源，1a1b 雙球式）：給水源有水時浮球浮起、a 接點閉合，無水時打開（泵不得空轉）。
 * 引線已配至 TB6；通電測試可切換有水／無水。
 */
export const FS: DeviceDef = {
  kind: 'FS', w: 44, h: 60,
  terminals: [
    { ...F('a上', 'a', 12, 6, '有水時閉'), short: 'a' }, { ...F('a下', 'a', 22, 6, '有水時閉'), short: 'a' },
    { ...F('b上', 'b', 32, 6, '有水時開'), short: 'b' }, { ...F('b下', 'b', 42, 6, '有水時開'), short: 'b' },
  ],
  elements: [
    { kind: 'contact', t: ['a上', 'a下'], type: 'a', driver: 'float', name: 'a' },
    { kind: 'contact', t: ['b上', 'b下'], type: 'b', driver: 'float', name: 'b' },
  ],
  card: { w: 80, h: 44, pos: { 'a上': [14, 22], 'a下': [34, 22], 'b上': [54, 22], 'b下': [74, 22] } },
};
