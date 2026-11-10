import type { DeviceDef, DeviceInstance, TerminalDef } from '../../model/types';

/** 畫器具外觀時可用的環境 */
export interface ArtCtx {
  def: DeviceDef;
  w: number;
  h: number;
  /** 端子的 x（操作面板鏡射後） */
  tx(t: TerminalDef): number;
  mirror: boolean;
  label: string;
  /** 本體 class：'body' 或 'body display'（只顯示不可接） */
  bodyCls: string;
}

/** 器具外觀繪製函式：把形狀加進 g（器具的 .mag 群組，原點在器具左上角 mm） */
export type ArtFn = (g: SVGGElement, d: DeviceInstance, c: ArtCtx) => void;
