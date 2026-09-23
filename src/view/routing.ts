import type { DuctRect } from '../model/types';

export interface Pt { x: number; y: number }

const cx = (d: DuctRect) => d.x + d.w / 2;
const cy = (d: DuctRect) => d.y + d.h / 2;
const isVertical = (d: DuctRect) => d.h > d.w;

/** 字串雜湊 → [-1,1]，用來讓同一線槽內的導線錯開 */
function jitter(seed: string): number {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) | 0;
  // h 是帶號 32 位元，JS 的 % 會保留負號；一定要先正規化到 [0,1000)，否則 j 會落到 (-3,1]，導線被推到線槽外
  return ((((h % 1000) + 1000) % 1000) / 1000) * 2 - 1;
}

function nearestDuct(p: Pt, ducts: DuctRect[]): DuctRect {
  let best = ducts[0], bd = Infinity;
  for (const d of ducts) {
    const dx = Math.max(d.x - p.x, 0, p.x - (d.x + d.w));
    const dy = Math.max(d.y - p.y, 0, p.y - (d.y + d.h));
    const dist = Math.hypot(dx, dy);
    if (dist < bd) { bd = dist; best = d; }
  }
  return best;
}

/**
 * 導線自動走線：端子 → 最近線槽 → （經垂直主槽）→ 目標線槽 → 端子。
 * 純視覺用途。
 */
export function routeWire(a: Pt, b: Pt, ducts: DuctRect[], seed: string): Pt[] {
  if (!ducts.length) return [a, b];
  const j = jitter(seed);
  const da = nearestDuct(a, ducts), db = nearestDuct(b, ducts);
  const off = (d: DuctRect) => (isVertical(d) ? d.w : d.h) * 0.36 * j;
  const pts: Pt[] = [a];

  const enter = (p: Pt, d: DuctRect): Pt => isVertical(d) ? { x: cx(d) + off(d), y: p.y } : { x: p.x, y: cy(d) + off(d) };

  const pa = enter(a, da);
  pts.push(pa);
  if (da !== db) {
    const trunk = ducts.find(isVertical) ?? da;
    // 從 da 走到主槽，再沿主槽到 db 的高度
    if (da !== trunk) {
      const x = cx(trunk) + off(trunk);
      pts.push({ x, y: pa.y });
      if (db !== trunk) pts.push({ x, y: cy(db) + off(db) });
    }
    if (db !== trunk) {
      const pb = enter(b, db);
      if (da === trunk) pts.push({ x: pa.x, y: pb.y });
      pts.push(pb);
    } else {
      pts.push(enter(b, trunk));
    }
  } else {
    const pb = enter(b, db);
    pts.push(pb);
  }
  pts.push(b);
  // 去除連續重複點
  return pts.filter((p, i) => i === 0 || Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) > 0.01);
}
