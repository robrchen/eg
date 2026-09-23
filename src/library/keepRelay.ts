import type { DeviceDef } from '../model/types';
import { T } from './_helpers';

/**
 * 保持電驛 KR（Keep Relay，2c，11-pin 底座）：SC 設定線圈得電 → 接點切到「設定」並機械保持；
 * RC 復歸線圈得電 → 回到「復歸」。停電不會改變狀態（記住上一次的正／反轉）。
 * 底座前視依講義器具位置圖：上排 2 1 10 11、左 3 4、右 9、下排 5 6 7 8。
 * ※ 腳位為常見配置的假設（SC 2-10、RC 5-7；接點一 1 共用／4 a／3 b；接點二 11 共用／8 a／9 b；6 空），
 *   考場實物若不同只改這裡。
 */
export const KR: DeviceDef = {
  kind: 'KR', w: 64, h: 72,
  terminals: [
    T('2', 'coil', 10, 11, 'SC'), T('1', 'common', 24, 11, '接點一 共用'), T('10', 'coil', 40, 11, 'SC'), T('11', 'common', 54, 11, '接點二 共用'),
    T('3', 'b', 10, 30, '接點一 b'), T('4', 'a', 10, 46, '接點一 a'), T('9', 'b', 54, 38, '接點二 b'),
    T('5', 'coil', 10, 61, 'RC'), T('6', 'common', 24, 61, '空'), T('7', 'coil', 40, 61, 'RC'), T('8', 'a', 54, 61, '接點二 a'),
  ],
  elements: [
    { kind: 'coil', t: ['2', '10'], name: 'SC' },
    { kind: 'coil', t: ['5', '7'], name: 'RC' },
    { kind: 'contact', t: ['1', '4'], type: 'a', driver: 'latch', name: '接點一 a (1-4)' },
    { kind: 'contact', t: ['1', '3'], type: 'b', driver: 'latch', name: '接點一 b (1-3)' },
    { kind: 'contact', t: ['11', '8'], type: 'a', driver: 'latch', name: '接點二 a (11-8)' },
    { kind: 'contact', t: ['11', '9'], type: 'b', driver: 'latch', name: '接點二 b (11-9)' },
  ],
  card: {
    w: 100, h: 110, keepAspect: true,
    pos: { '2': [14, 16], '1': [38, 16], '10': [62, 16], '11': [86, 16], '3': [14, 44], '4': [14, 68], '9': [86, 56], '5': [14, 94], '6': [38, 94], '7': [62, 94], '8': [86, 94] },
  },
};
