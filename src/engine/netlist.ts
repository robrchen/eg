/** 簡單 union-find，key 為全域端子 id（`MCF.a左上`） */
export class UnionFind {
  private parent = new Map<string, string>();

  find(x: string): string {
    let p = this.parent.get(x);
    if (p === undefined) { this.parent.set(x, x); return x; }
    if (p === x) return x;
    const root = this.find(p);
    this.parent.set(x, root);
    return root;
  }

  union(a: string, b: string): void {
    const ra = this.find(a), rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }

  same(a: string, b: string): boolean { return this.find(a) === this.find(b); }

  /** 依 root 分群 */
  groups(): Map<string, string[]> {
    const g = new Map<string, string[]>();
    for (const k of this.parent.keys()) {
      const r = this.find(k);
      const arr = g.get(r) ?? [];
      arr.push(k);
      g.set(r, arr);
    }
    return g;
  }
}

export function buildNets(edges: Iterable<[string, string]>): UnionFind {
  const uf = new UnionFind();
  for (const [a, b] of edges) uf.union(a, b);
  return uf;
}
