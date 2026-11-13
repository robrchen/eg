import type { DeviceInstance, PassThrough, QuestionDef, TeacherStep, Wire } from '../types';

/** 過門線 TB3.n ↔ TB4.n（已配妥） */
export const doorLinks: PassThrough[] = Array.from({ length: 16 }, (_, i) => ({ a: `TB3.${i + 1}`, b: `TB4.${i + 1}` }));

/**
 * 按鈕本體 → 4P 小 TB：TB.1-2 為 b 接點、TB.3-4 為 a 接點（操作面板是鏡射的背面，畫出來由左到右即講義的 a a b b）
 */
export const PB_MAP = ['b上', 'b下', 'a上', 'a下'];
export const pbPreWired = (ids: string[]): PassThrough[] => ids.flatMap(id => PB_MAP.map((t, i) => ({ a: `${id}.${t}`, b: `${id}_TB.${i + 1}` })));
/** 燈 → 3P 小 TB，只用兩側 TB.1、TB.3 */
export const lampPreWired = (ids: string[]): PassThrough[] => ids.flatMap(id => [{ a: `${id}.X1`, b: `${id}_TB.1` }, { a: `${id}.X2`, b: `${id}_TB.3` }]);
/** 蜂鳴器 → 3P 小 TB，只用兩側 */
export const bzPreWired = (ids: string[]): PassThrough[] => ids.flatMap(id => [{ a: `${id}.1`, b: `${id}_TB.1` }, { a: `${id}.2`, b: `${id}_TB.3` }]);
/**
 * 切換開關：M、A 兩個接點各自兩端 → 4P 小 TB。操作面板是鏡射的背面，TB.1-2 放 A、TB.3-4 放 M，畫出來由左到右就是講義的 M M A A
 */
export const cosPreWired = (ids: string[]): PassThrough[] => ids.flatMap(id => [{ a: `${id}.A1`, b: `${id}_TB.1` }, { a: `${id}.A2`, b: `${id}_TB.2` }, { a: `${id}.M1`, b: `${id}_TB.3` }, { a: `${id}.M2`, b: `${id}_TB.4` }]);
/** TH-RY 輔助接點 c b a → 本體下方 3P 小 TB */
export const thryPreWired: PassThrough[] = [{ a: 'THRY.c', b: 'THRY_TB.1' }, { a: 'THRY.b', b: 'THRY_TB.2' }, { a: 'THRY.a', b: 'THRY_TB.3' }];

/** 依題目器具的面板判斷端子在哪一塊板 */
export function panelOf(devices: DeviceInstance[], tid: string) {
  const id = tid.slice(0, tid.indexOf('.'));
  if (id === 'TB3') return 'device';
  if (id === 'TB4') return 'operator';
  return devices.find(d => d.id === id)?.panel ?? 'device';
}

/** 把接線鏈展開成導線；⊘n 依前後端子所在面板換成 TB3.n / TB4.n */
export function expandChainOf(devices: DeviceInstance[], chain: string, stepNo = 0): Wire[] {
  const raw = chain.split('>').map(s => s.trim()).filter(Boolean);
  const wires: Wire[] = [];
  let k = 0;
  for (let i = 0; i < raw.length - 1; i++) {
    let a = raw[i], b = raw[i + 1];
    if (a.startsWith('⊘') && b.startsWith('⊘')) continue;
    if (a.startsWith('⊘')) a = (panelOf(devices, b) === 'operator' ? 'TB4.' : 'TB3.') + a.slice(1);
    if (b.startsWith('⊘')) b = (panelOf(devices, a) === 'operator' ? 'TB4.' : 'TB3.') + b.slice(1);
    const panel = panelOf(devices, a);
    if (panel !== panelOf(devices, b)) throw new Error(`chain crosses panels: ${a} > ${b}`);
    wires.push({ id: `t${stepNo}-${k++}`, a, b, panel });
  }
  return wires;
}

/** 題目的參考接線（步驟鏈全部展開） */
export function teacherWiresOf(q: Pick<QuestionDef, 'devices' | 'teacherSteps'>, steps: TeacherStep[] = q.teacherSteps): Wire[] {
  return steps.flatMap(s => expandChainOf(q.devices, s.chain, s.n));
}
