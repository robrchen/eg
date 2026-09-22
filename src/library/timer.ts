import type { DeviceDef } from '../model/types';
import { T } from './_helpers';

/**
 * Y-Δ 限時電驛（OMRON H3CR-G8L）插在 8-pin 前接線底座（P2CF-08 / PF083A-E）
 * 底座前視：上排 6 5 4 3、下排 7 8 1 2（OMRON 型錄 Terminal Arrangement）。
 * 2-7 電源；8 共用；8-5 Y 輸出（通電即閉、計時到打開）；8-6 Δ 輸出（計時到閉合）。
 */
export const TR_YD: DeviceDef = {
  kind: 'TR', w: 60, h: 80,
  terminals: [
    T('6', 'a', 9, 12, 'Δ 輸出'), T('5', 'b', 23, 12, 'Y 輸出'), T('4', 'common', 37, 12, '空'), T('3', 'common', 51, 12, '空'),
    T('7', 'power', 9, 68, '電源'), T('8', 'common', 23, 68, '共用'), T('1', 'common', 37, 68, '空'), T('2', 'power', 51, 68, '電源'),
  ],
  elements: [
    { kind: 'coil', t: ['2', '7'] },
    { kind: 'contact', t: ['8', '5'], type: 'b', driver: 'timer', name: 'Y (8-5)' },
    { kind: 'contact', t: ['8', '6'], type: 'a', driver: 'timer', name: 'Δ (8-6)' },
  ],
  card: { w: 100, h: 70, pos: { '6': [14, 18], '5': [38, 18], '4': [62, 18], '3': [86, 18], '7': [14, 54], '8': [38, 54], '1': [62, 54], '2': [86, 54] } },
};
