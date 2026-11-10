import type { DeviceKind } from '../../model/types';
import type { ArtFn } from './types';
import { drawMC } from './mc';

export type { ArtCtx, ArtFn } from './types';
export { buildDefs } from './defs';

/**
 * 器具外觀（照片級）註冊表：每種器具一個繪製函式。
 * 尚未改版的器具回傳 undefined，由 panel.ts 的舊繪法接手。
 */
const ART: Partial<Record<DeviceKind, ArtFn>> = {
  MC: drawMC,
};

export const artOf = (kind: DeviceKind): ArtFn | undefined => ART[kind];
