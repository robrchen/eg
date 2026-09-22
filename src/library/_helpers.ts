import type { TerminalDef } from '../model/types';

/** 可接線端子 */
export const T = (id: string, role: TerminalDef['role'], x: number, y: number, sub?: string, label = id): TerminalDef =>
  ({ id, label, sub, role, x, y });
/** 器具本體端子（考場已引接到小 TB，考生不直接接） */
export const F = (id: string, role: TerminalDef['role'], x: number, y: number, sub?: string): TerminalDef =>
  ({ id, label: id, sub, role, x, y, wireable: false });
/** 主電路端子（已配妥，僅顯示） */
export const M = (id: string, x: number, y: number, sub?: string): TerminalDef =>
  ({ id, label: id, sub, role: 'main', x, y, wireable: false });
