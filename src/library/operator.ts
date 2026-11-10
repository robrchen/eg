import type { DeviceDef } from '../model/types';
import { F } from './_helpers';

/**
 * 按鈕開關 1a1b（OMRON A22）。本體端子由考場引接到小 TB。
 * 座標以「正視圖」為準（操作面板會再鏡射成開門背面）：
 * 背面接點座左 NC 1-2、右 NO 3-4，所以正視時 a（NO）在左、b（NC）在右；
 * 畫到背面圖上就是 b 左 a 右，引接線交叉落到小 TB，與講義一致。
 */
export const PB: DeviceDef = {
  kind: 'PB', w: 50, h: 50, shape: 'circle',
  // 圖面上只寫 a / b：同一個接點的兩端互換不影響電路，看位置即可
  terminals: [
    { ...F('a上', 'a', 14, 16, '3'), short: 'a' }, { ...F('a下', 'a', 14, 34, '4'), short: 'a' },
    { ...F('b上', 'b', 36, 16, '1'), short: 'b' }, { ...F('b下', 'b', 36, 34, '2'), short: 'b' },
  ],
  elements: [
    { kind: 'contact', t: ['a上', 'a下'], type: 'a', driver: 'press', name: 'a' },
    { kind: 'contact', t: ['b上', 'b下'], type: 'b', driver: 'press', name: 'b' },
  ],
  card: { w: 80, h: 60, pos: { 'b上': [20, 16], 'b下': [20, 44], 'a上': [60, 16], 'a下': [60, 44] } },
};

/** 指示燈 AC220V/15V（X1 X2） */
export const PL: DeviceDef = {
  kind: 'PL', w: 50, h: 50, shape: 'circle',
  terminals: [F('X1', 'load', 15, 25), F('X2', 'load', 35, 25)],
  elements: [{ kind: 'lamp', t: ['X1', 'X2'] }],
  card: { w: 80, h: 44, pos: { X1: [22, 22], X2: [58, 22] } },
};

/** 蜂鳴器 AC220V 埋入式 */
export const BZ: DeviceDef = {
  kind: 'BZ', w: 50, h: 50, shape: 'circle',
  terminals: [F('1', 'load', 15, 25), F('2', 'load', 35, 25)],
  elements: [{ kind: 'buzzer', t: ['1', '2'] }],
  card: { w: 80, h: 44, pos: { '1': [22, 22], '2': [58, 22] } },
};

/**
 * 切換開關 COS（30mmφ 二段式、非復歸、1a1b）：考場把兩個接點塊的一端併成共用點 c，連同 M（b，手動側）、A（a，自動側）
 * 引接到 3P 小 TB。旋到 M：c-M 通；旋到 A：c-A 通。通電測試點旋鈕切換。
 */
export const COS: DeviceDef = {
  kind: 'COS', w: 50, h: 50, shape: 'circle',
  terminals: [F('c', 'common', 25, 36, '共用'), F('M', 'b', 14, 16, '手動（b）'), F('A', 'a', 36, 16, '自動（a）')],
  elements: [
    { kind: 'contact', t: ['c', 'M'], type: 'b', driver: 'press', name: 'M' },
    { kind: 'contact', t: ['c', 'A'], type: 'a', driver: 'press', name: 'A' },
  ],
  card: { w: 80, h: 60, pos: { M: [20, 16], A: [60, 16], c: [40, 44] } },
};
