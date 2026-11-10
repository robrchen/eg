import type { DeviceKind } from '../../model/types';
import type { ArtFn } from './types';
import { drawMC } from './mc';
import { drawTimer } from './timer';
import { drawKeepRelay } from './keepRelay';
import { drawThry } from './thry';
import { drawNfb } from './nfb';
import { drawFuse } from './fuse';
import { drawOperator } from './operator';
import { drawTB1, drawTB2, drawTB16, drawTBM, drawGroundBar } from './terminalBlocks';
import { rect, text } from './svg';

export type { ArtCtx, ArtFn } from './types';
export { buildDefs } from './defs';
export { TB_TOP, TB2_LOW } from './terminalBlocks';
export { dimLamp } from './operator';

/** 器具外觀（照片級）註冊表：每種器具一個繪製函式 */
const ART: Record<DeviceKind, ArtFn> = {
  MC: drawMC,
  TR: drawTimer, TRF: drawTimer,
  KR: drawKeepRelay,
  THRY: drawThry,
  NFB: drawNfb,
  DF: drawFuse,
  PB: drawOperator, PL: drawOperator, BZ: drawOperator,
  TB1: drawTB1, TB2: drawTB2, TB16: drawTB16, TBM3: drawTBM, TBM4: drawTBM,
  GBAR: drawGroundBar, EBAR: drawGroundBar,
};

/** 沒有專屬外觀的器具：一塊有名字的板子 */
const fallback: ArtFn = (g, _d, c) => {
  g.appendChild(rect(0, 0, c.w, c.h, 2, c.bodyCls));
  const size = Math.min(11, (c.w / Math.max(3, c.label.length)) * 1.4);
  g.appendChild(text(c.w / 2, c.h / 2 + size / 3, c.label, size, 'device-label'));
};

export const artOf = (kind: DeviceKind): ArtFn => ART[kind] ?? fallback;
