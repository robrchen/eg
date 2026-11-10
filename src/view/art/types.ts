import type { DeviceDef, DeviceInstance, QuestionDef, TerminalDef } from '../../model/types';

/** 畫器具外觀時可用的環境 */
export interface ArtCtx {
  q: QuestionDef;
  def: DeviceDef;
  w: number;
  h: number;
  /** 端子的 x（操作面板鏡射後） */
  tx(t: TerminalDef): number;
  mirror: boolean;
  label: string;
  /** 本體 class：'body' 或 'body display'（只顯示不可接） */
  bodyCls: string;
  /** 小端子台上沒有引接到器具的空位（不畫） */
  spares: Set<string>;
  /** 登記「考場引接線」要接到的點（器具內座標），例如小 TB 上排螺絲 */
  anchor(tid: string, x: number, y: number): void;
}

/** 器具外觀繪製函式：把形狀加進 g（器具的 .mag 群組，原點在器具左上角 mm） */
export type ArtFn = (g: SVGGElement, d: DeviceInstance, c: ArtCtx) => void;
