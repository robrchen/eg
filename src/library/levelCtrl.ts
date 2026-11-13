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

/**
 * 液面控制器 61F-G2（OMRON，AC 220V 雙用型：自動排水＋異常增水警報）：
 * S0-S2 電源；U1（Tc1／Ta1／Tb1）：E1 與 E3 相通就動作，之後 E2 仍與 E3 相通就自保持；
 * U2（Tc2／Ta2）：E4 與 E3 相通（異常水位）就動作。E3 共用電極需接地。
 * 第四題用水銀浮球開關代替電極棒：BS1 接 E1-E3、BS2 接 E4-E3，E2 不用（浮球本身上下仰角就有遲滯）。
 * 考場：本體引線已配至 TB5，考生只在 TB5 接線；本體端子不可接。
 */
export const LC2: DeviceDef = {
  kind: 'LC2', w: 118, h: 62,
  terminals: [
    F('S0', 'power', 9, 8, '電源'), F('S2', 'power', 19, 8, '電源'),
    F('Tc1', 'common', 29, 8, 'U1 共用'), F('Tc2', 'common', 39, 8, 'U2 共用'),
    F('Ta1', 'a', 49, 8, 'U1（高水位動作時閉）'), F('Tb1', 'b', 59, 8, 'U1（復歸時閉）'), F('Ta2', 'a', 69, 8, 'U2（異常水位動作時閉）'),
    F('E1', 'common', 79, 8, '電極 高水位'), F('E2', 'common', 89, 8, '電極 低水位（本題不用）'),
    F('E3', 'ground', 99, 8, '電極 共用（接地）'), F('E4', 'common', 109, 8, '電極 異常水位'),
  ],
  elements: [
    { kind: 'coil', t: ['S2', 'S0'] },
    { kind: 'contact', t: ['Tc1', 'Ta1'], type: 'a', driver: 'level', name: 'Tc1-Ta1' },
    { kind: 'contact', t: ['Tc1', 'Tb1'], type: 'b', driver: 'level', name: 'Tc1-Tb1' },
    { kind: 'contact', t: ['Tc2', 'Ta2'], type: 'a', driver: 'level2', name: 'Tc2-Ta2' },
  ],
  card: { w: 124, h: 44, pos: Object.fromEntries(['S0', 'S2', 'Tc1', 'Tc2', 'Ta1', 'Tb1', 'Ta2', 'E1', 'E2', 'E3', 'E4'].map((n, i) => [n, [8 + i * 10.8, 22]])) as Record<string, [number, number]> },
};

/**
 * 水銀浮球開關 BS（污排水專用，1a，仰角式）：浮球被水抬到向上仰角時水銀接點閉合，水退到向下仰角才打開。
 * 兩條引線不分極性，已配至 TB7。通電測試：水位升到 levelOn 浮起、降到 levelOff 落下；也可點浮球手動抬起／放下（考場就是用手抬浮球測試）。
 */
export const BS: DeviceDef = {
  kind: 'BS', w: 44, h: 60,
  terminals: [F('1', 'a', 16, 6, '浮起時閉'), F('2', 'a', 28, 6, '浮起時閉')],
  elements: [{ kind: 'contact', t: ['1', '2'], type: 'a', driver: 'bs', name: 'a' }],
  card: { w: 80, h: 44, pos: { '1': [24, 22], '2': [56, 22] } },
};
