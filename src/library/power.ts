import type { DeviceDef } from '../model/types';
import { M, T } from './_helpers';

/** 栓型保險絲 D-F 500V 2A（座上下各一端子；短路時燒斷） */
export const DF: DeviceDef = {
  kind: 'DF', w: 40, h: 50, shape: 'circle',
  terminals: [T('上', 'fuse', 20, 8), T('下', 'fuse', 20, 42)],
  elements: [{ kind: 'link', t: ['上', '下'], fuse: true }],
  card: { w: 60, h: 70, pos: { '上': [30, 14], '下': [30, 56] } },
};

/** 無熔線開關 3P：上方電源側（已配妥），下方負載側 A B C 為控制電源取用點 */
export const NFB: DeviceDef = {
  kind: 'NFB', w: 92, h: 76,
  terminals: [
    M('電源A', 22, 9), M('電源B', 46, 9), M('電源C', 70, 9),
    T('A', 'source', 22, 67, '負載側'), T('B', 'source', 46, 67, '負載側'), T('C', 'source', 70, 67, '負載側'),
  ],
  elements: [],
  card: { w: 100, h: 60, pos: { '電源A': [22, 10], '電源B': [50, 10], '電源C': [78, 10], A: [22, 48], B: [50, 48], C: [78, 48] } },
};
