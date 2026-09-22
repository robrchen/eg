import type { DeviceDef } from '../model/types';
import { F } from './_helpers';

/** 按鈕開關 1a1b（OMRON A22 背面接點座：左 NC 1-2、右 NO 3-4）。本體端子由考場引接到小 TB。 */
export const PB: DeviceDef = {
  kind: 'PB', w: 50, h: 50, shape: 'circle',
  terminals: [
    F('b上', 'b', 14, 16, '1'), F('b下', 'b', 14, 34, '2'),
    F('a上', 'a', 36, 16, '3'), F('a下', 'a', 36, 34, '4'),
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
