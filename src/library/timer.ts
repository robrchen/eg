import type { DeviceDef } from '../model/types';
import { T } from './_helpers';

/**
 * Y-Δ 限時電驛（OMRON H3CR-G8L）插在 8-pin 前接線底座（P2CF-08 / PF083A-E）
 * 底座前視：上排 6 5 4 3、下排 7 8 1 2（OMRON 型錄 Terminal Arrangement）。
 * 2-7 電源；8 共用；8-5 Y 輸出（通電即閉、計時到打開）；8-6 Δ 輸出（計時到閉合）。
 */
export const TR_YD: DeviceDef = {
  // 底座近似正方形（實物 P2CF-08 即為方形底座，8 支腳分上下兩排）
  kind: 'TR', w: 68, h: 68,
  terminals: [
    T('6', 'a', 11, 13, 'Δ 輸出'), T('5', 'b', 25, 13, 'Y 輸出'), T('4', 'common', 39, 13, '空'), T('3', 'common', 53, 13, '空'),
    T('7', 'power', 11, 55, '電源'), T('8', 'common', 25, 55, '共用'), T('1', 'common', 39, 55, '空'), T('2', 'power', 53, 55, '電源'),
  ],
  elements: [
    { kind: 'coil', t: ['2', '7'] },
    { kind: 'contact', t: ['8', '5'], type: 'b', driver: 'timer', name: 'Y (8-5)' },
    { kind: 'contact', t: ['8', '6'], type: 'a', driver: 'timer', name: 'Δ (8-6)' },
  ],
  // 示意圖比照方形底座：上排 6 5 4 3、下排 7 8 1 2
  card: {
    w: 100, h: 100, keepAspect: true,
    pos: { '6': [14, 24], '5': [38, 24], '4': [62, 24], '3': [86, 24], '7': [14, 76], '8': [38, 76], '1': [62, 76], '2': [86, 76] },
  },
};

/**
 * 斷電延遲限時電驛（OFF-delay，例 OMRON H3CR-H8L）插在 8-pin 前接線底座，外觀與 Y-Δ 用的相同。
 * 2-7 電源；8 共用；8-5 延時 b、8-6 延時 a。
 * 動作：線圈得電 → 接點立即切換；線圈斷電 → 延遲設定秒數後才復歸（斷電期間照常計時）。
 * ※ 腳位沿用 8-pin 限時電驛常見排列，考場實物若不同只改這裡。
 */
export const TR_OFF: DeviceDef = {
  kind: 'TRF', w: 68, h: 68,
  terminals: [
    T('6', 'a', 11, 13, '延時 a'), T('5', 'b', 25, 13, '延時 b'), T('4', 'common', 39, 13, '空'), T('3', 'common', 53, 13, '空'),
    T('7', 'power', 11, 55, '電源'), T('8', 'common', 25, 55, '共用'), T('1', 'common', 39, 55, '空'), T('2', 'power', 53, 55, '電源'),
  ],
  elements: [
    { kind: 'coil', t: ['2', '7'] },
    { kind: 'contact', t: ['8', '5'], type: 'b', driver: 'offdelay', name: '延時b (8-5)' },
    { kind: 'contact', t: ['8', '6'], type: 'a', driver: 'offdelay', name: '延時a (8-6)' },
  ],
  card: TR_YD.card,
};
