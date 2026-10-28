// 第三站第一題：桿上變壓器 V-V 接線解說圖：node figures/pole-transformer/build.mjs [--dark]
// 以 anatomy kit 繪製（figures/anatomy-kit，MIT）。電桿上兩具 11.4kV/110-220V（雙套管）變壓器做 V-V 接線，
// 一次側 3φ4W 11.4kV（A、B、C 三相各經熔絲鏈開關，並各接一具避雷器），二次側 3φ3W 220V（V 共用點接地）。
// 按「投入熔絲鏈開關」：三支熔絲管依序合上，變壓器受電，二次側低壓線帶電。
// 世界座標（公分）：x 沿橫擔（左 C、右 A，面向電源由右至左 A B C），y 沿線路（+y 朝觀看者），z 往上。
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../anatomy-kit/iso-kit.mjs";
import * as G from "../anatomy-kit/lathe.mjs";
import { tubePieces, tubeSvg } from "../anatomy-kit/tube.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--dark") ? "dark" : "light";
const kitScript = () => readFileSync(join(HERE, "../anatomy-kit/iso-kit.mjs"), "utf8").replace(/^export /gm, "");

const WIDTH = 680;
const HEIGHT = 980;

// ── 尺寸（依第三站場地佈置說明，單位換成公分） ──
const POLE_Z0 = 92, POLE_TOP = 484;
const poleR = (z) => 16.5 - (z - POLE_Z0) * 0.008;
const ARM1_Z = 436, ARM2_Z = 362, ARM_H = 9, ARM_D = 9;
const armY = (z) => poleR(z + ARM_H / 2) + 0.2; // 橫擔背面貼著電桿
const ARM1_Y = armY(ARM1_Z), ARM2_Y = armY(ARM2_Z);
const ARM_FRONT2 = ARM2_Y + ARM_D;

// 高壓線：C 左、B 偏右、A 右（場地圖：中心到 C 810、到 B 300、到 A 810）
const PHASE = { C: -81, B: 30, A: 81 };
const INS_Y = ARM1_Y + ARM_D / 2;
const ARM1_TOP = ARM1_Z + ARM_H;
const LINE_R = 0.6;
const LINE_Z = ARM1_TOP + 3 + 14 + LINE_R; // 礙子腳 3 + 礙子 14
const LINE_LEN = 96, LINE_FADE = 56;

// 接線環（100×70mm）與活線線夾
const LOOP_Y0 = INS_Y + 17, LOOP_Y1 = LOOP_Y0 + 10, LOOP_YC = (LOOP_Y0 + LOOP_Y1) / 2;
const LOOP_TOP = LINE_Z - 1.4, LOOP_BOT = LINE_Z - 7.4, LOOP_R = 0.4;
const CLAMP_Z = LOOP_BOT - 0.6;

// 第二層橫擔：熔絲鏈開關（COS）與避雷器（LA）
const COS_Y = ARM_FRONT2 + 6.5;
const COS_Z0 = 354, COS_Z1 = 388;
// 每具避雷器裝在自己熔絲鏈開關的右邊
const COS = { C: -80, B: 8, A: 54 };
const LA = { C: -58, B: 30, A: 76 };
const TERM_SIDE = Object.fromEntries(Object.keys(COS).map((p) => [p, Math.sign(LA[p] - COS[p])]));
const cosTop = (p) => [COS[p] + TERM_SIDE[p] * 4.6, COS_Y, COS_Z1 + 1.5];
const cosBottom = (p) => [COS[p] + TERM_SIDE[p] * 4.6, COS_Y, COS_Z0 - 1.5];
const HINGE_Y = COS_Y + 8, HINGE_Z = COS_Z0 + 1, FUSE_L = 31, FUSE_R = 1.5;
const LA_Z0 = 356, LA_Z1 = 384;
const laTop = (p) => [LA[p], COS_Y, LA_Z1 + 4.5];
const laBottom = (p) => [LA[p], COS_Y, 348.5];

// 變壓器：T1（右）接 B-A，T2（左）接 C-B；減極性，H1 與 X1 同在左邊
const TANK_R = 16, TANK_Y = 42, TANK_Z0 = 232, TANK_Z1 = 292;
const TANKS = [
  { id: "T1", x: 28, h: { H1: "B", H2: "A" } },
  { id: "T2", x: -28, h: { H1: "C", H2: "B" } },
];
const bushingH = (t, name) => [t.x + (name === "H1" ? -10 : 10), TANK_Y, 308.5];
const LV_Z = 272;
const LV_ANGLE = { X1: -40, X3: -14, X2: 14, X4: 40 }; // 自 +y 往 +x 量的角度：由左而右 X1 X3 X2 X4
const lvBase = (t, name) => {
  const a = (LV_ANGLE[name] * Math.PI) / 180;
  return { o: [t.x + TANK_R * Math.sin(a), TANK_Y + TANK_R * Math.cos(a), LV_Z], d: [Math.sin(a), Math.cos(a), 0] };
};
const lvTerm = (t, name) => {
  const { o, d } = lvBase(t, name);
  return G.add3(o, G.mul3(d, 8));
};

// 低壓架與軸型礙子：場地固定架 4 條低壓線（間隔 30 公分）；試題一用上面三條：被接地、力、力，第 4 條不接
const SPOOL_X = 25;
const SPOOLS = [
  { id: "N", z: 200, name: "被接地", lead: 33, run: 226 },
  { id: "P1", z: 170, name: "力", lead: 39, run: 220 },
  { id: "P2", z: 140, name: "力", lead: 45, run: 214 },
  { id: "S", z: 110, name: "不使用", spare: true },
];
const LV_R = 0.7, LV_LEN = 74, LV_FADE = 42;
const SLEEVE_Y = -27;

const P = k.fitProjection(
  [
    [-90, 0, POLE_TOP], [90, 0, POLE_TOP], [-90, LINE_FADE + 8, LINE_Z], [90, LINE_FADE + 8, LINE_Z],
    [-90, -LINE_FADE, LINE_Z], [90, -LINE_FADE, LINE_Z], [0, 0, POLE_Z0 + 6], [SPOOL_X, -LV_FADE - 10, 110], [-45, 70, 214],
  ],
  WIDTH,
  HEIGHT,
  { pad: 14, azimuth: 58, elevation: 22 },
);

const at = (point) => k.iso(point, P);
// 圓形零件（礙子、避雷器、變壓器）不畫稜線，立體感只靠色塊明暗
const SMOOTH = new Set(["porcelain", "polymer", "tank"]);
const S = (paths, style = {}) => k.solidSvg(paths, SMOOTH.has(style.className) ? { crease: "none", ...style } : style);
const L = (d, style) => k.lineSvg(d, style);
const depth = (p) => k.depthOf(p, P);
const up = (x, y, z) => G.frameOf([x, y, z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const along = (o, a) => G.frameAlong(o, G.unit3(a));
const slab = (plan, z, h, style = {}, steps = 3, bevel = 0.3) => S(k.slabOf(plan, z, h, P, steps, bevel), { tone: "mid", ...style });
const turned = (x, y, z, profile, style = {}) => S(G.solidOf(profile, up(x, y, z), P), { tone: "mid", ...style });

// 畫面上的每一件東西：{ depth, svg }，最後依深度由遠而近畫
const ITEMS = [];
const BACK = []; // 電桿後方（-y）的線段，先於電桿畫
const put = (sys, key, svg, bias = 0) => ITEMS.push({ depth: depth(key) + bias, svg: `<g data-sys="${sys}">${svg}</g>` });

// ── 淡出遮罩：沿某個方向的漸層 ──
const MASKS = [];
function fadeMask(id, from, to, stops) {
  const a = at(from), b = at(to);
  const st = stops.map(([o, v]) => `<stop offset="${o.toFixed(3)}" stop-color="#fff" stop-opacity="${v}"/>`).join("");
  MASKS.push(`<linearGradient id="${id}-g" gradientUnits="userSpaceOnUse" x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}">${st}</linearGradient><mask id="${id}" maskUnits="userSpaceOnUse" x="-80" y="-80" width="${WIDTH + 160}" height="${HEIGHT + 160}"><rect x="-80" y="-80" width="${WIDTH + 160}" height="${HEIGHT + 160}" fill="url(#${id}-g)"/></mask>`);
  return id;
}
const lineFade = (x, z) => {
  const t = (y) => (y + LINE_LEN) / (LINE_LEN * 2);
  return fadeMask(`f-hv-${String(x).replace("-", "m")}`, [x, -LINE_LEN, z], [x, LINE_LEN, z], [[0, 0], [t(-LINE_FADE), 1], [t(LINE_FADE), 1], [1, 0]]);
};
const lvFade = (z) => {
  const t = (y) => (y + LV_LEN) / LV_LEN;
  return fadeMask(`f-lv-${z}`, [SPOOL_X, -LV_LEN, z], [SPOOL_X, 0, z], [[0, 0], [t(-LV_FADE), 1], [1, 1]]);
};
const groundFade = fadeMask("f-ground", [0, 0, POLE_Z0 + 34], [0, 0, POLE_Z0 + 4], [[0, 1], [1, 0]]);

// ── 電線（立體絕緣線）：每段依深度排序 ──
const PATHS = {}; // 帶電顯示用：[x, y, z] 依電流方向排列
const PATH_MASK = {};
// 軟線自然垂落：以 centripetal Catmull-Rom 穿過錨點，較長、較水平的段再往下垂 sag 公分
function hang(points, sag) {
  const n = points.length, out = [points[0]];
  const pt = (i) => points[Math.max(0, Math.min(n - 1, i))];
  const knot = (a, b) => Math.max(1e-3, Math.sqrt(G.len3(G.sub3(b, a))));
  for (let i = 0; i < n - 1; i++) {
    const p0 = i === 0 ? G.sub3(G.mul3(pt(0), 2), pt(1)) : pt(i - 1), p1 = pt(i), p2 = pt(i + 1);
    const p3 = i === n - 2 ? G.sub3(G.mul3(pt(n - 1), 2), pt(n - 2)) : pt(i + 2);
    const t1 = knot(p0, p1), t2 = t1 + knot(p1, p2), t3 = t2 + knot(p2, p3);
    const len = G.len3(G.sub3(p2, p1)), flat = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / Math.max(len, 1e-6);
    const drop = sag * Math.min(1, len / 40) * flat;
    const steps = Math.max(2, Math.ceil(len / 2.5));
    for (let k2 = 1; k2 <= steps; k2++) {
      const t = t1 + ((t2 - t1) * k2) / steps;
      const L = (a, b, ta, tb) => G.add3(G.mul3(a, (tb - t) / (tb - ta)), G.mul3(b, (t - ta) / (tb - ta)));
      const a1 = L(p0, p1, 0, t1), a2 = L(p1, p2, t1, t2), a3 = L(p2, p3, t2, t3);
      const b1 = L(a1, a2, 0, t2), b2 = L(a2, a3, t1, t3);
      const c = L(b1, b2, t1, t2);
      c[2] -= drop * Math.sin((Math.PI * k2) / steps);
      out.push(c);
    }
  }
  return out;
}

function wire(sys, ins, points, r, { bend = 2.4, max = 6, mask, back, caps = true, path, reverse = false, sag } = {}) {
  const route = sag != null ? hang(points, sag) : bend ? G.fillet(points, bend, 6) : points;
  for (const pc of tubePieces(route, r, P, { maxLength: max, caps })) {
    const svg = `<g class="w" data-ins="${ins}"${mask ? ` mask="url(#${mask})"` : ""}>${tubeSvg(pc, { tone: "lo" })}</g>`;
    if (back && back(pc.mid)) BACK.push({ depth: depth(pc.mid), svg: `<g data-sys="${sys}">${svg}</g>` });
    else put(sys, pc.mid, svg);
  }
  if (path) {
    PATHS[path] = reverse ? route.slice().reverse() : route;
    if (mask) PATH_MASK[path] = mask;
  }
  return route;
}

// ── 軟線垂落模擬：一條有長度、有一點剛性的電纜，兩端依端子方向固定，受重力下垂，碰到障礙物被擋開 ──
// init：大致的走線（第一、最後一點是端子，第二、倒數第二點決定出線方向）；slack：線長＝走線長 × slack
const OBSTACLES = []; // { cyl: [x, y, r, z0, z1] } 或 { box: [x0, x1, y0, y1, z0, z1] } 或 { pole: true }
const CABLE_SEGS = []; // 已模擬好的電纜線段，後模擬的線會避開
function cable(init, { slack = 1, n = 40, stiff = 0.35, r = 0.75, iters = 600 } = {}) {
  const polyLen = (pts) => pts.slice(1).reduce((s2, q, i) => s2 + G.len3(G.sub3(q, pts[i])), 0);
  const L = polyLen(init) * slack, seg = L / (n - 1);
  // 依弧長重新取樣成 n 點
  const cum = [0];
  for (let i = 1; i < init.length; i++) cum.push(cum[i - 1] + G.len3(G.sub3(init[i], init[i - 1])));
  const total = cum[cum.length - 1];
  const pts = [];
  for (let i = 0; i < n; i++) {
    const d = (total * i) / (n - 1);
    let j = 1;
    while (j < init.length - 1 && cum[j] < d) j++;
    const f = (d - cum[j - 1]) / Math.max(cum[j] - cum[j - 1], 1e-6);
    pts.push(G.lerp3(init[j - 1], init[j], Math.min(1, Math.max(0, f))));
  }
  const a = init[0], da = G.unit3(G.sub3(init[1], init[0]));
  const b = init[init.length - 1], db = G.unit3(G.sub3(init[init.length - 2], b));
  const fixed = (i) => i < 2 || i > n - 3;
  const pin = () => {
    pts[0] = a; pts[1] = G.add3(a, G.mul3(da, seg));
    pts[n - 1] = b; pts[n - 2] = G.add3(b, G.mul3(db, seg));
  };
  pin();
  const prev = pts.map((q) => q.slice());
  // 只檢查走線範圍附近的電纜線段
  const pad = L / 2 + 4;
  const lo = [0, 1, 2].map((c) => Math.min(...init.map((q) => q[c])) - pad), hi = [0, 1, 2].map((c) => Math.max(...init.map((q) => q[c])) + pad);
  const near = CABLE_SEGS.filter(([u, v]) => [0, 1, 2].every((c) => Math.max(u[c], v[c]) > lo[c] && Math.min(u[c], v[c]) < hi[c]));
  const push = (q, cr) => {
    for (const o of OBSTACLES) {
      if (o.pole) {
        const R = poleR(q[2]) + cr, h = Math.hypot(q[0], q[1]);
        if (h < R && q[2] > POLE_Z0) { q[0] *= R / h; q[1] *= R / h; }
      } else if (o.cyl) {
        const [x, y, R0, z0, z1] = o.cyl, R = R0 + cr;
        const dx = q[0] - x, dy = q[1] - y, h = Math.hypot(dx, dy);
        if (h < R && q[2] > z0 - cr && q[2] < z1 + cr) {
          const side = R - h, below = q[2] - (z0 - cr), above = z1 + cr - q[2];
          if (below < side && below < above) q[2] = z0 - cr;
          else if (above < side) q[2] = z1 + cr;
          else { q[0] = x + (dx / h) * R; q[1] = y + (dy / h) * R; }
        }
      } else {
        const [x0, x1, y0, y1, z0, z1] = o.box;
        if (q[0] > x0 - cr && q[0] < x1 + cr && q[1] > y0 - cr && q[1] < y1 + cr && q[2] > z0 - cr && q[2] < z1 + cr) {
          const m = [[q[0] - (x0 - cr), 0, x0 - cr], [x1 + cr - q[0], 0, x1 + cr], [q[1] - (y0 - cr), 1, y0 - cr], [y1 + cr - q[1], 1, y1 + cr], [q[2] - (z0 - cr), 2, z0 - cr], [z1 + cr - q[2], 2, z1 + cr]];
          m.sort((u, v) => u[0] - v[0]);
          q[m[0][1]] = m[0][2];
        }
      }
    }
    for (const [u, v] of near) {
      const w = G.sub3(v, u), t = Math.max(0, Math.min(1, G.dot3(G.sub3(q, u), w) / Math.max(G.dot3(w, w), 1e-9)));
      const c = G.add3(u, G.mul3(w, t)), d = G.sub3(q, c), h = G.len3(d), R = cr + 0.75 + 0.4;
      if (h < R && h > 1e-6) { const nq = G.add3(c, G.mul3(d, R / h)); q[0] = nq[0]; q[1] = nq[1]; q[2] = nq[2]; }
    }
  };
  for (let it = 0; it < iters; it++) {
    for (let i = 2; i < n - 2; i++) {
      const v = G.mul3(G.sub3(pts[i], prev[i]), 0.9);
      prev[i] = pts[i].slice();
      pts[i] = G.add3(G.add3(pts[i], v), [0, 0, -0.05]);
    }
    for (let k2 = 0; k2 < 12; k2++) {
      for (let i = 0; i < n - 1; i++) {
        const d = G.sub3(pts[i + 1], pts[i]), h = G.len3(d) || 1e-6, e = G.mul3(d, (h - seg) / h);
        const fa = fixed(i), fb = fixed(i + 1);
        if (fa && fb) continue;
        const wa = fa ? 0 : fb ? 1 : 0.5, wb = fb ? 0 : fa ? 1 : 0.5;
        pts[i] = G.add3(pts[i], G.mul3(e, wa));
        pts[i + 1] = G.sub3(pts[i + 1], G.mul3(e, wb));
      }
      // 剛性：每點往兩鄰點中點拉
      for (let i = 2; i < n - 2; i++) {
        const mid = G.lerp3(pts[i - 1], pts[i + 1], 0.5);
        pts[i] = G.lerp3(pts[i], mid, stiff);
      }
      if (k2 % 4 === 3) for (let i = 2; i < n - 2; i++) push(pts[i], r + 0.3);
      pin();
    }
  }
  for (let i = 0; i < n - 1; i++) CABLE_SEGS.push([pts[i], pts[i + 1]]);
  return pts;
}

// ── 電桿（混凝土桿，上細下粗）＋桿頂蓋 ──
function pole() {
  const F = up(0, 0, POLE_Z0);
  const h = POLE_TOP - POLE_Z0;
  const body = S(G.lathe([[0, 0], [0, poleR(POLE_Z0)], [h, poleR(POLE_TOP)], [h, 0]], F, P, { rims: "last", smooth: true }), { tone: "lo", className: "concrete", crease: "none" });
  const cap = S(G.solidOf([[0, poleR(POLE_TOP) + 0.6], [2, poleR(POLE_TOP) + 0.6], [3.2, 9, 1], [4.6, 0]], up(0, 0, POLE_TOP), P), { tone: "mid" });
  // 桿頂蓋
  return `<g mask="url(#${groundFade})">${body}</g>${cap}`;
}

// ── 橫擔：木質 90×90×1800，貫穿螺栓＋方墊片 ──
function crossarm(z, y) {
  const plan = { x: -90, y, w: 180, d: ARM_D, r: 0.6 };
  return S(k.slabOf(plan, z, ARM_H, P, 2, 0.5), { tone: "mid", className: "wood" });
}
function boltFront(x, y, z, r = 1.6) {
  const F = G.frameOf([x, y, z], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
  const washer = S(G.prismOf(F, [[-2.6, -2.6], [2.6, -2.6], [2.6, 2.6], [-2.6, 2.6]], 0, 0.5, P), { tone: "mid" });
  const nut = S(G.prismOf(F, [0, 1, 2, 3, 4, 5].map((i) => [r * 1.25 * Math.cos((i * Math.PI) / 3), r * 1.25 * Math.sin((i * Math.PI) / 3)]), 0.5, 1.9, P), { tone: "hi" });
  const end = S(G.disc(1.9, 2.8, r * 0.62, F, P), { tone: "hi" });
  return washer + nut + end;
}
// 斜撐（角鐵）：從橫擔下緣斜到電桿正面
function brace(from, to) {
  const a = G.sub3(to, from);
  const F = along(from, a);
  return S(G.prismOf(F, [[-2, -0.35], [2, -0.35], [2, 0.35], [-2, 0.35]], 0, G.len3(a), P), { tone: "lo", className: "steel" });
}

// ── 裝腳礙子（瓷）＋礙子腳 ──
const PIN_INS = [[0, 3.2], [1.2, 3.6], [1.8, 8, 1], [2.6, 8.2, 1], [3.2, 5], [4.6, 5.4], [5.4, 6.8, 1], [6.2, 6.8, 1], [6.8, 4.6], [10.6, 4.3], [11.2, 5.4, 1], [13.2, 5.4, 1], [13.6, 4.6], [14, 4.2]];
function pinInsulator(x) {
  const pin = turned(x, INS_Y, ARM1_TOP, [[0, 2.2], [0.8, 2.2], [0.8, 1.1], [3, 1.1]], { tone: "hi" });
  const body = S(G.solidOf(PIN_INS, up(x, INS_Y, ARM1_TOP + 3), P), { tone: "hi", className: "porcelain" });
  return pin + body;
}

// 紮線（鋁紮線）：導線兩側各一段密繞，再從頂溝跨過
function tieWrap(x, y0, y1, z, r, cls = "tie-al") {
  const F = G.frameOf([x, y0, z], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
  const len = y1 - y0;
  const turns = [];
  for (let s = 0.35; s < len - 0.2; s += 0.42) turns.push(G.arcOf(F, s, r, P, { trim: 0.2 }));
  return S(G.disc(0, len, r, F, P), { tone: "hi", className: cls, inner: L(turns.join(""), { tone: "lo" }) });
}

// ── 接線環＋H 型壓接套管＋活線線夾（O 環朝下） ──
function loopRoute(x) {
  const c = 1.6;
  return [[x, LOOP_Y0 + c, LOOP_TOP], [x, LOOP_Y1 - c, LOOP_TOP], [x, LOOP_Y1, LOOP_TOP - c], [x, LOOP_Y1, LOOP_BOT + c], [x, LOOP_Y1 - c, LOOP_BOT], [x, LOOP_Y0 + c, LOOP_BOT], [x, LOOP_Y0, LOOP_BOT + c], [x, LOOP_Y0, LOOP_TOP - c], [x, LOOP_Y0 + c, LOOP_TOP]];
}
function hotClamp(x) {
  const body = slab({ x: x - 1.3, y: LOOP_YC - 1.6, w: 2.6, d: 3.2, r: 0.5 }, CLAMP_Z - 3.6, 4.4, { tone: "hi" });
  const jaw = slab({ x: x - 1.6, y: LOOP_YC - 0.9, w: 3.2, d: 1.8, r: 0.4 }, LOOP_BOT + 0.2, 1.4, { tone: "hi" });
  return body + jaw;
}
function eye(x) {
  const c = [x, LOOP_YC, CLAMP_Z - 6];
  const ring = [];
  for (let i = 0; i <= 20; i++) {
    const t = (i / 20) * Math.PI * 2;
    ring.push([x, c[1] + 1.2 * Math.sin(t), c[2] + 1.2 * Math.cos(t)]);
  }
  return ring;
}

// ── 熔絲鏈開關：瓷礙子＋上下金具，熔絲管另由 JS 畫（會轉動） ──
const COS_INS = (() => {
  const p = [[0, 2.6], [2.4, 2.6]];
  for (let s = 3; s < 30; s += 4) p.push([s, 2.6], [s + 0.6, 5, 1], [s + 1.4, 5, 1], [s + 2, 2.6]);
  p.push([34, 2.6]);
  return p;
})();
function cutoutBody(p) {
  const x = COS[p], s = TERM_SIDE[p];
  const ins = S(G.lathe([[0, 0], ...COS_INS, [34, 0]], up(x, COS_Y, COS_Z0), P), { tone: "hi", className: "porcelain" });
  const capTop = turned(x, COS_Y, COS_Z1, [[0, 3], [2.4, 3]], { tone: "hi" });
  const capBot = turned(x, COS_Y, COS_Z0 - 2.4, [[0, 3], [2.4, 3]], { tone: "hi" });
  const armTop = slab({ x: x - 1.8, y: COS_Y - 1, w: 3.6, d: 11, r: 0.5 }, COS_Z1 + 0.6, 1.4, { tone: "hi" });
  const armBot = slab({ x: x - 1.8, y: COS_Y - 1, w: 3.6, d: 9.5, r: 0.5 }, COS_Z0 - 2, 1.4, { tone: "hi" });
  const hinge = S(G.disc(-2.4, 2.4, 1, G.frameOf([x, HINGE_Y, HINGE_Z], [1, 0, 0], [0, 1, 0], [0, 0, 1]), P), { tone: "hi" });
  const termT = slab({ x: s > 0 ? x + 2.6 : x - 5.6, y: COS_Y - 1.2, w: 3, d: 2.4, r: 0.4 }, COS_Z1 + 0.6, 1.8, { tone: "hi" });
  const termB = slab({ x: s > 0 ? x + 2.6 : x - 5.6, y: COS_Y - 1.2, w: 3, d: 2.4, r: 0.4 }, COS_Z0 - 2.4, 1.8, { tone: "hi" });
  return { ins, rest: capTop + capBot + armBot + hinge + termB, top: armTop + termT };
}
// 上接點罩：熔絲管合上時，管頂卡在罩內
const hood = (p) => slab({ x: COS[p] - 2.8, y: COS_Y + 5.5, w: 5.6, d: 5, r: 1 }, COS_Z1 - 1, 4.6, { tone: "hi" }, 3, 0.4);
// 安裝架：抱住礙子中段的金屬帶＋伸到橫擔正面的臂
function mount(x) {
  const band = turned(x, COS_Y, ARM2_Z + 3, [[0, 3.4], [3, 3.4]], { tone: "lo" });
  const arm = slab({ x: x - 1.2, y: ARM_FRONT2, w: 2.4, d: COS_Y - 3.2 - ARM_FRONT2, r: 0.3 }, ARM2_Z + 3.4, 2.2, { tone: "lo" });
  return arm + band;
}

// ── 避雷器（聚合物外殼，5 片傘裙） ──
const LA_PROFILE = (() => {
  const p = [[0, 2.8], [1.6, 2.8], [1.6, 2.2]];
  for (let s = 3; s < 26; s += 4.6) p.push([s, 2.2], [s + 0.5, 4.3, 1], [s + 1.2, 4.3, 1], [s + 1.8, 2.2]);
  p.push([LA_Z1 - LA_Z0 - 1.4, 2.2], [LA_Z1 - LA_Z0 - 1.4, 2.8], [LA_Z1 - LA_Z0, 2.8]);
  return p;
})();
function arrester(p) {
  const x = LA[p];
  const body = S(G.lathe([[0, 0], ...LA_PROFILE, [LA_Z1 - LA_Z0, 0]], up(x, COS_Y, LA_Z0), P), { tone: "hi", className: "polymer" });
  const stud = turned(x, COS_Y, LA_Z1, [[0, 0.7], [3.2, 0.7]], { tone: "hi" });
  const nut = turned(x, COS_Y, LA_Z1 + 2.2, [[0, 1.4], [1.4, 1.4]], { tone: "hi" });
  const disc = turned(x, COS_Y, 350.2, [[0, 1.7], [LA_Z0 - 350.2, 1.7]], { tone: "lo" });
  const stud2 = turned(x, COS_Y, 347.6, [[0, 0.7], [2.6, 0.7]], { tone: "hi" });
  return body + stud + nut + disc + stud2;
}

// ── 變壓器 ──
function tank(t) {
  const F = up(t.x, TANK_Y, TANK_Z0);
  const h = TANK_Z1 - TANK_Z0;
  const body = S(G.lathe([[0, 0], [0, TANK_R - 1.6], [0.6, TANK_R - 0.5, 1], [1.8, TANK_R], [h, TANK_R], [h, 0]], F, P, { smooth: true }), { tone: "mid", className: "tank", crease: "none" });
  const lid = S(G.lathe([[0, 0], [0, TANK_R + 0.9], [1.4, TANK_R + 0.9], [1.8, TANK_R - 0.6, 1], [3.6, 11, 1], [4.4, 0, 1]], up(t.x, TANK_Y, TANK_Z1), P), { tone: "mid", className: "tank", crease: "none" });
  // 吊耳（兩側）
  const lugs = [-1, 1].map((s) => slab({ x: t.x + s * (TANK_R + 0.2) - (s > 0 ? 0 : 2.2), y: TANK_Y - 2.2, w: 2.2, d: 4.4, r: 0.5 }, TANK_Z1 - 7, 5.5, { tone: "mid", className: "tank" })).join("");
  return body + lugs + lid;
}
const H_PROFILE = [[0, 2.4], [1, 2.4], [1.4, 3.6, 1], [2.4, 3.6, 1], [2.8, 2], [4.4, 2], [4.8, 3.3, 1], [5.8, 3.3, 1], [6.2, 1.8], [8, 1.8], [8.4, 3, 1], [9.4, 3, 1], [9.8, 1.6], [11, 1.6]];
function bushingHV(t, name) {
  const [x, y] = bushingH(t, name);
  const base = 295.6;
  const body = S(G.solidOf(H_PROFILE, up(x, y, base), P), { tone: "hi", className: "porcelain" });
  const stud = turned(x, y, base + 11, [[0, 0.6], [2.6, 0.6]], { tone: "hi" });
  const clampT = turned(x, y, base + 11.6, [[0, 1.3], [1.6, 1.3]], { tone: "hi" });
  return body + stud + clampT;
}
const X_PROFILE = [[0, 2.3], [0.8, 2.3], [1.2, 3, 1], [2.2, 3, 1], [2.6, 1.8], [4, 1.8], [4.4, 2.6, 1], [5.2, 2.6, 1], [5.6, 1.5], [6.4, 1.5]];
function bushingLV(t, name) {
  const { o, d } = lvBase(t, name);
  const F = along(G.add3(o, G.mul3(d, -1)), d);
  const body = S(G.solidOf(X_PROFILE.map(([s, r, f]) => [s + 1, r, f]), F, P), { tone: "hi", className: "porcelain" });
  const stud = S(G.disc(7.4, 9.6, 0.55, F, P), { tone: "hi" });
  const nut = S(G.disc(8.2, 9.2, 1.2, F, P), { tone: "hi" });
  return body + stud + nut;
}

// ── 低壓架（二次線架）與軸型礙子 ──
const SPOOL_PROFILE = [[0, 3.2], [1, 3.4], [2.4, 2.3, 1], [4, 1.9, 1], [5.6, 2.3, 1], [7, 3.4], [8, 3.2]];
function rack() {
  const z0 = SPOOLS[SPOOLS.length - 1].z - 9, z1 = SPOOLS[0].z + 9;
  const strap = slab({ x: poleR(170) + 0.1, y: -3, w: 1.6, d: 6, r: 0.3 }, z0, z1 - z0, { tone: "lo", className: "steel" });
  const bolts = [z0 + 3, z1 - 3].map((z) => {
    const F = G.frameOf([poleR(170) + 1.7, 0, z], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
    return S(G.disc(0, 1.2, 1.6, F, P), { tone: "mid" }) + S(G.disc(1.2, 2.2, 0.7, F, P), { tone: "mid" });
  }).join("");
  return strap + bolts;
}
function rackArm(z) {
  const x0 = poleR(170) + 1.6;
  return slab({ x: x0, y: -3.4, w: SPOOL_X + 3.6 - x0, d: 6.8, r: 2.4 }, z, 1, { tone: "lo", className: "steel" }, 4);
}
function spool(s) {
  const pin = turned(SPOOL_X, 0, s.z - 4.4, [[0, 0.55], [8.8, 0.55]], { tone: "mid" });
  return pin + S(G.lathe([[0, 0], ...SPOOL_PROFILE, [8, 0]], up(SPOOL_X, 0, s.z - 4), P), { tone: "hi", className: "porcelain" });
}
// 低壓線（22mm² PVC）：本線從 -y 來，繞過軸型礙子，尾端與本線並攏紮 30 匝，再翹起成跳線接 C 型套管
function lvConductor(s) {
  const z = s.z, rr = 1.9 + LV_R, gap = LV_R;
  const arc = [];
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI - (i / 10) * Math.PI;
    arc.push([SPOOL_X + rr * Math.cos(a), rr * Math.sin(a), z]);
  }
  const route = [
    [SPOOL_X - gap, -LV_LEN, z], [SPOOL_X - gap, -15, z], [SPOOL_X - rr, -5, z], ...arc, [SPOOL_X + rr, -5, z], [SPOOL_X + gap, -15, z],
    [SPOOL_X + gap, -22, z],
    ...(s.spare ? [[SPOOL_X + gap, -25, z]] : [[SPOOL_X + 2, -25.5, z + 1.5], [s.lead - 1, SLEEVE_Y, z + 6], [s.lead, SLEEVE_Y, z + 9]]),
  ];
  return route;
}

// ═════════ 組裝 ═════════
// 軟線模擬要避開的東西
const BAR_Y = poleR(282) + 0.2;
OBSTACLES.push(
  { pole: true },
  { box: [-90, 90, ARM1_Y, ARM1_Y + ARM_D, ARM1_Z, ARM1_Z + ARM_H] },
  { box: [-90, 90, ARM2_Y, ARM2_Y + ARM_D, ARM2_Z, ARM2_Z + ARM_H] },
  { box: [-50, 50, BAR_Y, BAR_Y + 4, 243, 249] },
  { box: [-50, 50, BAR_Y, BAR_Y + 4, 279, 285] },
  { box: [poleR(170), SPOOL_X + 4, -5, 5, SPOOLS[SPOOLS.length - 1].z - 9, SPOOLS[0].z + 9] },
  ...TANKS.map((t) => ({ cyl: [t.x, TANK_Y, TANK_R + 1, TANK_Z0, TANK_Z1 + 2] })),
  ...TANKS.flatMap((t) => ["H1", "H2"].map((h) => ({ cyl: [...bushingH(t, h).slice(0, 2), 3.6, TANK_Z1, 307] }))),
  ...Object.values(COS).map((x) => ({ cyl: [x, COS_Y, 5, COS_Z0, COS_Z1] })),
  ...Object.values(LA).map((x) => ({ cyl: [x, COS_Y, 4.5, LA_Z0 - 6, LA_Z1] })),
);
// 電桿與橫擔
const POLE_SVG = pole();
put("st", [0, ARM1_Y + 4, ARM1_Z], crossarm(ARM1_Z, ARM1_Y));
put("st", [0, ARM2_Y + 4, ARM2_Z], crossarm(ARM2_Z, ARM2_Y));
put("st", [0, ARM1_Y + ARM_D, ARM1_Z + 4.5], boltFront(0, ARM1_Y + ARM_D, ARM1_Z + 4.5), 2);
put("st", [0, ARM2_Y + ARM_D, ARM2_Z + 4.5], boltFront(0, ARM2_Y + ARM_D, ARM2_Z + 4.5), 2);
for (const s of [-1, 1]) {
  put("st", [s * 22, ARM1_Y + 3, 412], brace([s * 46, ARM1_Y + 2, ARM1_Z], [s * 2.5, poleR(392) + 0.4, 392]), -20);
  put("st", [s * 22, ARM2_Y + 3, 340], brace([s * 46, ARM2_Y + 2, ARM2_Z], [s * 2.5, poleR(320) + 0.4, 320]), -20);
  put("st", [s * 46, ARM1_Y, ARM1_Z - 1], boltFront(s * 46, ARM1_Y + ARM_D, ARM1_Z + 4.5, 1.1), 3);
  put("st", [s * 46, ARM2_Y, ARM2_Z - 1], boltFront(s * 46, ARM2_Y + ARM_D, ARM2_Z + 4.5, 1.1), 3);
}
put("st", [0, poleR(392) + 1, 392], boltFront(0, poleR(392) + 0.4, 392, 1.2), 1);
put("st", [0, poleR(320) + 1, 320], boltFront(0, poleR(320) + 0.4, 320, 1.2), 1);

// 高壓線、紮線、礙子、接線環、活線線夾
for (const [p, x] of Object.entries(PHASE)) {
  put("hv", [x, INS_Y, ARM1_TOP + 6], pinInsulator(x));
  const mask = lineFade(x, LINE_Z);
  wire("hv", "al", [[x, -LINE_LEN, LINE_Z], [x, LINE_LEN, LINE_Z]], LINE_R, { bend: 0, max: 8, mask, back: (m) => m[1] < -2, path: `line-${p}` });
  put("hv", [x, INS_Y - 9, LINE_Z], tieWrap(x, INS_Y - 13, INS_Y - 5.4, LINE_Z, LINE_R + 0.28), 0.5);
  put("hv", [x, INS_Y + 9, LINE_Z], tieWrap(x, INS_Y + 5.4, INS_Y + 13, LINE_Z, LINE_R + 0.28), 0.5);
  // 頂溝上的跨越紮線
  for (const dx of [-1.3, 1.3]) wire("hv", "al-tie", [[x + dx, INS_Y - 5.6, LINE_Z], [x + dx * 0.6, INS_Y - 2, LINE_Z + LINE_R + 0.15], [x - dx * 0.6, INS_Y + 2, LINE_Z + LINE_R + 0.15], [x - dx, INS_Y + 5.6, LINE_Z]], 0.2, { bend: 1.2, max: 3 });
  wire("hv", "al", loopRoute(x), LOOP_R, { bend: 0, max: 3, caps: false });
  put("hv", [x, LOOP_YC, LINE_Z], slab({ x: x - 1.1, y: LOOP_YC - 1.6, w: 2.2, d: 3.2, r: 0.4 }, LOOP_TOP - 0.7, LINE_Z + LINE_R + 0.5 - (LOOP_TOP - 0.7), { tone: "hi" }), 0.4);
  put("hv", [x, LOOP_YC, CLAMP_Z - 2], hotClamp(x), 0.3);
  wire("hv", "al", eye(x), 0.32, { bend: 0, max: 3, caps: false });
}
// 引接線（22mm² PVC）：活線線夾 → 熔絲鏈開關電源側 → 避雷器
for (const p of Object.keys(COS)) {
  const x = PHASE[p];
  const [tx, ty, tz] = cosTop(p);
  const start = [x, LOOP_YC - 1.7, CLAMP_Z - 2.4];
  wire("hv", "pvc", cable([start, [x, LOOP_YC - 2.2, CLAMP_Z - 6], [tx, ty, tz + 10], [tx, ty, tz + 0.8]], { slack: 1.03 }), 0.75, { bend: 0, path: `tap-${p}` });
  const [lx, ly, lz] = laTop(p);
  wire("hv", "pvc", cable([[tx, ty + 0.2, tz + 0.9], [tx + TERM_SIDE[p] * 3, ty + 0.2, tz + 4], [lx, ly, tz + 4], [lx, ly, lz - 0.5]], { slack: 1.04, n: 24, r: 0.6 }), 0.6, { bend: 0, path: `la-${p}` });
}
// 熔絲鏈開關、避雷器、安裝架
for (const p of Object.keys(COS)) {
  const c = cutoutBody(p);
  put("st", [COS[p], ARM_FRONT2 + 1, ARM2_Z + 3], mount(COS[p]));
  put("st", [LA[p], ARM_FRONT2 + 1, ARM2_Z + 3], mount(LA[p]));
  put("hv", [COS[p], COS_Y, 370], c.ins + c.rest);
  put("hv", [COS[p], COS_Y + 3, COS_Z1 + 1], c.top, 0.5);
  put("hv", [COS[p], HINGE_Y, 371], `<g data-layer="fuse-${p}"></g>`, 0.2);
  put("hv", [COS[p], COS_Y + 8, COS_Z1 + 2], hood(p), 0.6);
  put("hv", [LA[p], COS_Y, 370], arrester(p));
}
// 避雷器接地線（14mm²）：三具互相連接後，沿電桿左前方單獨接地
const LA_BUS_Y = ARM_FRONT2 + 2.2, LA_BUS_Z = 342;
wire("la", "gnd", [laBottom("A"), [LA.A, COS_Y, 345], [LA.A, LA_BUS_Y, LA_BUS_Z], [LA.C, LA_BUS_Y, LA_BUS_Z], [LA.C, COS_Y, 345], laBottom("C")], 0.55, { bend: 2 });
wire("la", "gnd", [laBottom("B"), [LA.B, COS_Y, 345.5], [LA.B, LA_BUS_Y, LA_BUS_Z + 0.9]], 0.55, { bend: 2, caps: [true, false] });
const laDownR = (z) => (poleR(z) + 1.1) / Math.SQRT2;
wire("la", "gnd", [[-30, LA_BUS_Y, LA_BUS_Z - 0.9], [-30, LA_BUS_Y, 336], [-laDownR(326), laDownR(326), 326], [-laDownR(POLE_Z0), laDownR(POLE_Z0), POLE_Z0]], 0.55, { bend: 3, max: 10, mask: groundFade, caps: [false, true] });
put("la", [LA.B, LA_BUS_Y, LA_BUS_Z], k.dotsSvg([at([LA.B, LA_BUS_Y, LA_BUS_Z]), at([-30, LA_BUS_Y, LA_BUS_Z])], { size: 1.3, tone: "hi" }), 1);

// 一次側引線（22mm²）：熔絲鏈開關負載側 → 變壓器 H 端子；B 相再由 T1 H1 跨到 T2 H2
const HV_LEAD = { A: ["T1", "H2"], B: ["T1", "H1"], C: ["T2", "H1"] };
for (const p of Object.keys(COS)) {
  const t = TANKS.find((tt) => tt.id === HV_LEAD[p][0]);
  const [bx, by, bz] = bushingH(t, HV_LEAD[p][1]);
  const [sx, sy, sz] = cosBottom(p);
  wire("hv", "pvc", cable([[sx, sy, sz - 0.8], [sx, sy, sz - 6], [bx, by, bz + 9], [bx, by, bz + 0.6]], { slack: 1.04 }), 0.75, { bend: 0, path: `lead-${p}` });
}
{
  const [ax, ay, az] = bushingH(TANKS[0], "H1"), [bx, by, bz] = bushingH(TANKS[1], "H2");
  wire("hv", "pvc", cable([[ax, ay + 0.3, az + 0.8], [ax, ay + 0.3, az + 4], [bx, by + 0.3, bz + 4], [bx, by + 0.3, bz + 0.8]], { slack: 1.1, n: 30 }), 0.75, { bend: 0, path: "lead-B2" });
}

// 變壓器、吊架、套管
for (const z of [279, 243]) {
  put("st", [0, BAR_Y + 2, z], slab({ x: -50, y: BAR_Y, w: 100, d: 4, r: 0.4 }, z, 6, { tone: "lo", className: "steel" }, 2, 0.4), -60);
  put("st", [0, BAR_Y + 4, z + 3], boltFront(0, BAR_Y + 4, z + 3, 1.2), -58);
}
for (const t of TANKS) {
  for (const z of [279, 243]) put("st", [t.x, BAR_Y + 5, z], slab({ x: t.x - 5, y: BAR_Y + 4, w: 10, d: TANK_Y - TANK_R - BAR_Y - 3.6, r: 0.4 }, z - 0.5, 7, { tone: "mid", className: "tank" }), -6);
  put("hv lv gnd", [t.x, TANK_Y, 262], tank(t));
  for (const name of ["H1", "H2"]) put("hv", [...bushingH(t, name).slice(0, 2), 300], bushingHV(t, name), 2);
  for (const name of ["X1", "X3", "X2", "X4"]) put("lv", lvBase(t, name).o, bushingLV(t, name), 4);
  // X2-X3 已短接（銅片）
  const a = lvTerm(t, "X3"), b = lvTerm(t, "X2");
  wire("lv", "cu", [a, G.add3(G.lerp3(a, b, 0.5), [0, 1.4, 1.2]), b], 0.4, { bend: 0, max: 3 });
  // 外殼接地端子
  const ga = ((t.x > 0 ? -110 : 110) * Math.PI) / 180;
  const g = [t.x + (TANK_R + 0.6) * Math.sin(ga), TANK_Y + (TANK_R + 0.6) * Math.cos(ga), 238];
  t.ground = g;
  put("gnd", g, turned(g[0], g[1], g[2] - 1.5, [[0, 1.4], [3, 1.4]], { tone: "hi" }), 1);
}

// 低壓架、軸型礙子、低壓線、紮線、C 型壓接套管
put("st", [poleR(170) + 1, 0, 170], rack(), -2);
for (const s of SPOOLS) {
  put("st", [SPOOL_X - 4, 0, s.z + 4.2], rackArm(s.z + 4.4), -0.5);
  put("st", [SPOOL_X - 4, 0, s.z - 5.4], rackArm(s.z - 5.4), -0.5);
  put("lv", [SPOOL_X, 0, s.z], spool(s));
  const mask = lvFade(s.z);
  const route = lvConductor(s);
  for (let i = 0; i < route.length - 1; i++) CABLE_SEGS.push([route[i], route[i + 1]]);
  // 本線遠端淡出：遮罩只套在 y < -20 的段上
  for (const pc of tubePieces(G.fillet(route, 1.6, 6), LV_R, P, { maxLength: 5 })) {
    const svg = `<g class="w" data-ins="pvc"${pc.mid[1] < -24 && pc.mid[0] < SPOOL_X ? ` mask="url(#${mask})"` : ""}>${tubeSvg(pc, { tone: "lo" })}</g>`;
    put("lv", pc.mid, svg);
  }
  if (s.spare) {
    put("lv", [SPOOL_X, -18, s.z], tieWrap(SPOOL_X, -22, -14, s.z, LV_R * 2 + 0.3, "tie-cu"), 1);
    continue;
  }
  PATHS[`lv-${s.id}`] = G.fillet(route, 1.6, 6).slice().reverse();
  PATH_MASK[`lv-${s.id}`] = mask;
  put("lv", [SPOOL_X, -18, s.z], tieWrap(SPOOL_X, -22, -14, s.z, LV_R * 2 + 0.3, "tie-cu"), 1);
  // C 型銅壓接套管
  const F = up(s.lead, SLEEVE_Y, s.z + 8.6);
  const crimps = [1.3, 2.7].map((q) => G.arcOf(F, q, 1.5, P)).join("");
  put("lv", [s.lead, SLEEVE_Y, s.z + 10.6], S(G.disc(0, 4, 1.5, F, P), { tone: "hi", className: "sleeve", inner: L(crimps, { tone: "lo" }) }), 1);
}

// 二次側引線（22mm²）
// via：模擬起始時大致經過的點（之後由重力決定實際形狀）
const LV_LEAD = {
  N: { t: "T1", x: "X1", via: [26, 22, 218] },
  P1: { t: "T2", x: "X1", via: [6, 44, 196] },
  P2: { t: "T1", x: "X4", via: [44, 24, 186] },
};
const LV_ROUTE = {};
for (const s of SPOOLS.filter((x) => !x.spare)) {
  const spec = LV_LEAD[s.id];
  const t = TANKS.find((tt) => tt.id === spec.t);
  const [tx, ty, tz] = lvTerm(t, spec.x);
  const z0 = s.z + 12.6;
  const pts = cable([[s.lead, SLEEVE_Y, z0], [s.lead, SLEEVE_Y, z0 + 7], spec.via, [tx, ty + 1.5, TANK_Z0 - 4], [tx, ty, tz - 7], [tx, ty, tz - 1.2]], { slack: 1.12, n: 64 });
  LV_ROUTE[s.id] = pts;
  wire("lv", "pvc", pts, 0.75, { bend: 0, max: 5, path: `xlead-${s.id}`, reverse: true });
}
// 共用點：T2 X4 跨接到 T1 X1
{
  const a = lvTerm(TANKS[1], "X4"), b = lvTerm(TANKS[0], "X1");
  wire("lv", "pvc", cable([[a[0], a[1] + 0.4, a[2] - 1], [a[0], a[1] + 1, a[2] - 7], [b[0], b[1] + 1, b[2] - 7], [b[0], b[1] + 0.4, b[2] - 1]], { slack: 1.08, n: 50 }), 0.75, { bend: 0, max: 5, path: "xjump" });
}

// 接地：被接地線以 C 型套管分接 → 接地端子板；兩具變壓器外殼各一條直接接到端子板 → 沿電桿正面往下接地
const GB = { x: -2.2, y: poleR(228) - 0.2, w: 4.4, d: 3, r: 0.4 };
put("gnd", [0, GB.y + 1.5, 228], slab(GB, 224, 7, { tone: "hi" }, 2, 0.3), 3);
{
  // 分接點：被接地線引線上最靠近接地端子板的地方，套管順著引線方向
  const nr = LV_ROUTE.N, gb = [0, GB.y + 1.5, 228];
  let ti = 8;
  for (let i = 8; i < nr.length - 8; i++) if (G.len3(G.sub3(nr[i], gb)) < G.len3(G.sub3(nr[ti], gb))) ti = i;
  const tap = nr[ti], ax = G.unit3(G.sub3(nr[ti + 1], nr[ti - 1]));
  const ux = G.unit3(Math.abs(ax[2]) > 0.9 ? G.cross3(ax, [1, 0, 0]) : G.cross3(ax, [0, 0, 1]));
  const F = G.frameOf(G.sub3(tap, G.mul3(ax, 2)), ax, ux, G.cross3(ax, ux));
  put("gnd", tap, S(G.disc(0, 4, 1.45, F, P), { tone: "hi", className: "sleeve", inner: L([1.3, 2.7].map((q) => G.arcOf(F, q, 1.45, P)).join(""), { tone: "lo" }) }), 2);
  wire("gnd", "gnd", cable([[tap[0], tap[1], tap[2] - 1.6], [tap[0], tap[1], tap[2] - 5], [5, GB.y + 1.5, 229.5], [2.2, GB.y + 1.5, 229.5]], { slack: 1.04, n: 30 }), 0.75, { bend: 0 });
  for (const t of TANKS) {
    const s = Math.sign(t.x);
    wire("gnd", "gnd", cable([[t.ground[0], t.ground[1], t.ground[2] - 1.5], [t.ground[0], t.ground[1], t.ground[2] - 5], [s * 5, GB.y + 1.5, 226], [s * 2.2, GB.y + 1.5, 226]], { slack: 1.04, n: 30 }), 0.75, { bend: 0 });
  }
  const downR = (z) => poleR(z) + 1.1;
  wire("gnd", "gnd", [[0, GB.y + 1.5, 224], [0, downR(214), 214], [0, downR(POLE_Z0), POLE_Z0]], 0.75, { bend: 2, max: 10, mask: groundFade, caps: [false, true] });
  for (const z of [180, 130]) put("gnd", [0, downR(z) + 1, z], slab({ x: -1.8, y: poleR(z) - 0.3, w: 3.6, d: 2.6, r: 0.6 }, z - 1, 2, { tone: "mid" }, 2), 2);
}

// ── 端子標籤（貼在零件上，可關閉） ──
const TAGS = [];
const tag = (p, text, cls = "") => {
  const [x, y] = at(p);
  TAGS.push(`<g class="tag ${cls}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><rect x="${-(text.length * 3.6 + 5)}" y="-7.5" width="${text.length * 7.2 + 10}" height="15" rx="4"/><text y="4">${text}</text></g>`);
};
for (const [p, x] of Object.entries(PHASE)) tag([x, INS_Y - 30, LINE_Z + 4], `${p} 相`, "t-hv");
for (const t of TANKS) {
  tag([t.x, TANK_Y + TANK_R, 241], t.id, "t-tank");
  for (const name of ["H1", "H2"]) tag(G.add3(bushingH(t, name), [0, 0, 6]), name, "t-hv");
  for (const name of ["X1", "X3", "X2", "X4"]) tag(G.add3(lvTerm(t, name), [0, 1, name === "X1" || name === "X4" ? 7.5 : -8]), name, "t-lv t-x");
}
for (const s of SPOOLS) tag([SPOOL_X, -LV_FADE + 6, s.z + 5], s.name, s.spare ? "t-off" : s.id === "N" ? "t-gnd" : "t-lv");
for (const p of Object.keys(COS)) {
  tag([COS[p], COS_Y + 4, COS_Z0 - 9], "COS", "t-dev");
  tag([LA[p], COS_Y + 4, LA_Z0 - 13], "LA", "t-dev");
}

// ═════════ 輸出 SVG ═════════
const sorted = (list) => [...list].sort((a, b) => a.depth - b.depth).map((item) => item.svg).join("");
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label: "電桿上兩具 11.4kV/110-220V 雙套管變壓器做 V-V 接線。最上面的橫擔有三支裝腳礙子，架著 A、B、C 三相高壓線，每相都有接線環與活線線夾。第二層橫擔裝三具熔絲鏈開關與三具避雷器。熔絲鏈開關負載側接到變壓器一次側：C 接 T2 的 H1，B 接 T1 的 H1 並跨到 T2 的 H2，A 接 T1 的 H2。減極性，H1 與 X1 在同一側。二次側 X2、X3 已短接；T2 的 X1 接力線，T1 的 X4 接另一條力線，T2 的 X4 與 T1 的 X1 連在一起成為共用點，接到被接地線並接地。場地架有 4 條低壓線，本題由上而下用被接地、力、力三條，最下面一條不接，都以軸型礙子終端紮線。",
  body: [
    `<defs>${MASKS.join("")}</defs>`,
    sorted(BACK),
    POLE_SVG,
    sorted(ITEMS),
    `<g data-layer="glow"></g>`,
    `<g class="tags">${TAGS.join("")}</g>`,
  ],
});

// 熔絲管（JS 畫）：鉸鏈點與長度
const FUSES = Object.keys(COS).map((p) => ({ p, hinge: [COS[p], HINGE_Y, HINGE_Z] }));

const CSS = `
.iso{--hv:#ff5a36;--hv-core:#fff1e8;--lv:#14b8d4;--lv-core:#eaffff;--gnd:#2f9e57;
  --pvc:#4a4a4a;--pvc-hi:#8c8c8c;--pvc-lo:#262626;--al:#c9ced4;--al-hi:#f4f6f8;--al-lo:#8d949c;--cu:#c87a3c;--cu-hi:#f0b27a;--cu-lo:#8a4a1c;
  --wood-top:#6b5640;--wood-side:#54432f;--porc-top:#8b6a52;--porc-side:#6a4e3a;--poly-top:#7d8692;--poly-side:#5b636e;--tank-top:#7c8794;--tank-side:#5d6773;
  --con-top:#8a8780;--con-side:#6c6a64;--steel-top:#6f7780;--steel-side:#535a62;--fuse:#3d2c22;--fuse-hi:#8a6a52;--brass:#c9a24a;--brass-lo:#8f6d22}
.iso[data-theme="light"]{--hv:#e8431f;--hv-core:#fff;--lv:#0891b2;--lv-core:#fff;--gnd:#1f8a47;
  --pvc:#2e2e2e;--pvc-hi:#6a6a6a;--pvc-lo:#151515;--al:#d5d9de;--al-hi:#fbfcfd;--al-lo:#9aa1a9;
  --wood-top:#d9c2a2;--wood-side:#bfa27c;--porc-top:#c79b7a;--porc-side:#a77a59;--poly-top:#b9c0c9;--poly-side:#97a0ab;--tank-top:#c9d0d8;--tank-side:#a8b1bb;
  --con-top:#d6d3cc;--con-side:#b9b5ac;--steel-top:#aeb5bd;--steel-side:#8e959e;--fuse:#5a4030;--fuse-hi:#a9876c}
.wood>.iso-fill,.wood>.iso-top{fill:var(--wood-top);stroke:var(--wood-top)}.wood>.iso-shade{fill:var(--wood-side);stroke:var(--wood-side)}
.porcelain>.iso-fill,.porcelain>.iso-top,.porcelain>.iso-shade[data-shade="0"]{fill:var(--porc-top);stroke:var(--porc-top)}.porcelain>.iso-shade{fill:var(--porc-side);stroke:var(--porc-side)}
.polymer>.iso-fill,.polymer>.iso-top,.polymer>.iso-shade[data-shade="0"]{fill:var(--poly-top);stroke:var(--poly-top)}.polymer>.iso-shade{fill:var(--poly-side);stroke:var(--poly-side)}
.tank>.iso-fill,.tank>.iso-top,.tank>.iso-shade[data-shade="0"]{fill:var(--tank-top);stroke:var(--tank-top)}.tank>.iso-shade{fill:var(--tank-side);stroke:var(--tank-side)}
.sleeve>.iso-fill,.sleeve>.iso-top,.sleeve>.iso-shade[data-shade="0"],.tie-cu>.iso-fill,.tie-cu>.iso-top,.tie-cu>.iso-shade[data-shade="0"]{fill:var(--cu-hi);stroke:var(--cu-hi)}.sleeve>.iso-shade,.tie-cu>.iso-shade{fill:var(--cu);stroke:var(--cu)}
.tie-al>.iso-fill,.tie-al>.iso-top,.tie-al>.iso-shade[data-shade="0"]{fill:var(--al-hi);stroke:var(--al-hi)}.tie-al>.iso-shade{fill:var(--al);stroke:var(--al)}
/* 平滑零件的色塊描邊跟色塊同色，不留淺色接縫 */
.iso-solid.wood[data-seamless]>.iso-shade[data-shade]{stroke:var(--wood-side)}.iso-solid.wood[data-seamless]>.iso-shade[data-shade="0"],.iso-solid.wood[data-seamless]>.iso-top{stroke:var(--wood-top)}
.iso-solid.porcelain[data-seamless]>.iso-shade[data-shade]{stroke:var(--porc-side)}.iso-solid.porcelain[data-seamless]>.iso-shade[data-shade="0"],.iso-solid.porcelain[data-seamless]>.iso-top{stroke:var(--porc-top)}
.iso-solid.polymer[data-seamless]>.iso-shade[data-shade]{stroke:var(--poly-side)}.iso-solid.polymer[data-seamless]>.iso-shade[data-shade="0"],.iso-solid.polymer[data-seamless]>.iso-top{stroke:var(--poly-top)}
.iso-solid.tank[data-seamless]>.iso-shade[data-shade]{stroke:var(--tank-side)}.iso-solid.tank[data-seamless]>.iso-shade[data-shade="0"],.iso-solid.tank[data-seamless]>.iso-top{stroke:var(--tank-top)}
.iso-solid.concrete[data-seamless]>.iso-shade[data-shade]{stroke:var(--con-side)}.iso-solid.concrete[data-seamless]>.iso-shade[data-shade="0"],.iso-solid.concrete[data-seamless]>.iso-top{stroke:var(--con-top)}
.iso-solid.steel[data-seamless]>.iso-shade[data-shade]{stroke:var(--steel-side)}.iso-solid.steel[data-seamless]>.iso-shade[data-shade="0"],.iso-solid.steel[data-seamless]>.iso-top{stroke:var(--steel-top)}
.w[data-ins="pvc"] .tb-body{fill:var(--pvc)}.w[data-ins="pvc"] .tb-shine{fill:var(--pvc-hi)}.w[data-ins="pvc"] .tb-shade{fill:var(--pvc-lo)}
.w[data-ins="al"] .tb-body,.w[data-ins="al-tie"] .tb-body{fill:var(--al)}.w[data-ins="al"] .tb-shine,.w[data-ins="al-tie"] .tb-shine{fill:var(--al-hi)}.w[data-ins="al"] .tb-shade,.w[data-ins="al-tie"] .tb-shade{fill:var(--al-lo)}
.w[data-ins="cu"] .tb-body{fill:var(--cu)}.w[data-ins="cu"] .tb-shine{fill:var(--cu-hi)}.w[data-ins="cu"] .tb-shade{fill:var(--cu-lo)}
.w[data-ins="gnd"] .tb-body{fill:var(--gnd)}.w[data-ins="gnd"] .tb-shine{fill:#6fd394}.w[data-ins="gnd"] .tb-shade{fill:#17603a}
.w .tb-edge{stroke:#00000075}
.fuse-body{fill:var(--fuse);stroke:var(--fuse)}.fuse-shine{fill:none;stroke:var(--fuse-hi);stroke-linecap:round}
.fuse-cap{fill:var(--brass);stroke:var(--brass-lo);stroke-width:.5}.fuse-ring{fill:none;stroke:var(--brass-lo);stroke-width:1.1}
.fuse-edge{fill:none;stroke:#00000090;stroke-width:.6;stroke-linejoin:round}
[data-sys]{transition:opacity .35s}
.iso-stage[data-focus="hv"] [data-sys]:not([data-sys~="hv"]),.iso-stage[data-focus="lv"] [data-sys]:not([data-sys~="lv"]),.iso-stage[data-focus="gnd"] [data-sys]:not([data-sys~="gnd"]):not([data-sys~="la"]){opacity:.16}
.iso-stage[data-focus] [data-sys="st"]{opacity:.32}
.tag{pointer-events:none;transition:opacity .3s}
.tag rect{fill:var(--anatomy-card);stroke:var(--anatomy-mid);stroke-width:.8;opacity:.92}
.tag text{font:700 9.5px/1 ui-sans-serif,system-ui,sans-serif;text-anchor:middle;fill:var(--anatomy-strong)}
.tag.t-hv rect{stroke:var(--hv)}.tag.t-hv text{fill:var(--hv);stroke:var(--hv)}
.tag.t-lv rect{stroke:var(--lv)}.tag.t-lv text{fill:var(--lv);stroke:var(--lv)}
.tag.t-gnd rect{stroke:var(--gnd)}.tag.t-gnd text{fill:var(--gnd);stroke:var(--gnd)}
.tag.t-off{opacity:.7}.tag.t-off rect{stroke-dasharray:3 2}
.tag.t-tank text{font-size:11px}
.tag.t-x text{font-size:8.5px}
.concrete>.iso-fill,.concrete>.iso-top,.concrete>.iso-shade[data-shade="0"]{fill:var(--con-top);stroke:var(--con-top)}.concrete>.iso-shade{fill:var(--con-side);stroke:var(--con-side)}
.steel>.iso-fill,.steel>.iso-top,.steel>.iso-shade[data-shade="0"]{fill:var(--steel-top);stroke:var(--steel-top)}.steel>.iso-shade{fill:var(--steel-side);stroke:var(--steel-side)}
.tag.t-dev text{font-weight:600;fill:var(--anatomy-muted)}
.iso-stage[data-notags] .tags{opacity:0}
.iso-stage[data-focus="lv"] .tag.t-hv,.iso-stage[data-focus="lv"] .tag.t-dev,.iso-stage[data-focus="gnd"] .tag.t-hv,.iso-stage[data-focus="gnd"] .tag.t-lv,.iso-stage[data-focus="hv"] .tag.t-lv,.iso-stage[data-focus="hv"] .tag.t-gnd{opacity:.15}
.glow path{fill:none;stroke-width:3.6;stroke-linecap:round;stroke-linejoin:round;filter:blur(.7px);animation:breathe 1.8s ease-in-out infinite}
.glow[data-k="hv"] path{stroke:var(--hv)}.glow[data-k="lv"] path{stroke:var(--lv)}
@keyframes breathe{0%,100%{opacity:.28}50%{opacity:.72}}
.streak path{fill:none;stroke-width:1.7;stroke-linecap:round}
.streak[data-k="hv"] path{stroke:var(--hv-core);filter:drop-shadow(0 0 2px var(--hv)) drop-shadow(0 0 4px var(--hv))}
.streak[data-k="lv"] path{stroke:var(--lv-core);filter:drop-shadow(0 0 2px var(--lv)) drop-shadow(0 0 4px var(--lv))}
@media (prefers-reduced-motion:reduce){.glow path{animation:none;opacity:.6}}
.pt-ctrl{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:12px}
.pt-power{font:inherit;font-weight:700;font-size:15px;padding:9px 18px;border-radius:9px;border:1.5px solid var(--anatomy-mid);background:var(--anatomy-card);color:var(--anatomy-strong);cursor:pointer}
.pt-power[aria-pressed="true"]{border-color:var(--lv);color:var(--lv);box-shadow:0 0 0 3px #14b8d422}
.pt-seg{display:inline-flex;border:1.5px solid var(--anatomy-faint);border-radius:9px;overflow:hidden}
.pt-seg button{font:inherit;font-size:14px;padding:8px 12px;border:0;background:var(--anatomy-card);color:var(--anatomy-text);cursor:pointer}
.pt-seg button+button{border-left:1px solid var(--anatomy-faint)}
.pt-seg button[aria-pressed="true"]{background:var(--anatomy-strong);color:var(--anatomy-card);font-weight:700}
.pt-check{display:flex;gap:6px;align-items:center;font-size:14px;cursor:pointer}
.pt-step{margin-top:10px;min-height:48px;font-size:16px;line-height:1.5;color:var(--anatomy-strong)}
.pt-table{margin-top:6px;display:grid;grid-template-columns:auto 1fr;gap:4px 14px;font-size:14px;line-height:1.5}
.pt-table h4{grid-column:1/-1;margin:8px 0 0;font-size:13px;letter-spacing:.06em;color:var(--anatomy-muted)}
.pt-table b{font-weight:700;color:var(--anatomy-strong);white-space:nowrap}
.pt-table .hv{color:var(--hv)}.pt-table .lv{color:var(--lv)}.pt-table .gnd{color:var(--gnd)}
.pt-volt{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px}
.pt-volt span{padding:3px 9px;border-radius:7px;background:var(--anatomy-faint);font-variant-numeric:tabular-nums;transition:background .3s,color .3s}
.pt-volt[data-on] span{background:var(--lv);color:#fff}
`;

const live = `
const P = ${JSON.stringify(P)};
const PATHS = ${JSON.stringify(PATHS)};
const PATH_MASK = ${JSON.stringify(PATH_MASK)};
const FUSES = ${JSON.stringify(FUSES)};
const FUSE_L = ${FUSE_L}, FUSE_R = ${FUSE_R}, OPEN = 2.62;
const NS = "http://www.w3.org/2000/svg";
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const glowLayer = svg.querySelector('[data-layer="glow"]');
const power = document.querySelector(".pt-power");
const readout = document.querySelector("[data-readout]");
const step = document.querySelector(".pt-step");
const volt = document.querySelector(".pt-volt");
const still = matchMedia("(prefers-reduced-motion: reduce)");
let on = false, flowS = 0, frame = 0, last = 0, visible = false, shown = "", tOn = 0;
// 每支熔絲管：角度 a（0 = 合上、OPEN = 垂下），依 C → B → A 順序延遲
const fuse = FUSES.map((f, i) => ({ ...f, a: OPEN, v: 0, delay: i * 0.55, layer: svg.querySelector('[data-layer="fuse-' + f.p + '"]') }));

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
function hull(pts) {
  pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const p of pts) { while (lo.length > 1 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of pts.reverse()) { while (hi.length > 1 && cross(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}
// 熔絲管軸在 y-z 平面內，繞 x 軸轉；u = x 軸，v 垂直於管軸
function cyl(a, b, r) {
  const ax = sub(b, a), len = Math.hypot(...ax), d = mul(ax, 1 / len);
  const v = [0, d[2], -d[1]], pts = [];
  for (let i = 0; i < 18; i++) {
    const t = (i / 18) * Math.PI * 2, off = add(mul([1, 0, 0], r * Math.cos(t)), mul(v, r * Math.sin(t)));
    pts.push(iso(add(a, off), P), iso(add(b, off), P));
  }
  return pathOf(hull(pts), true);
}
function drawFuse(f) {
  const d = [0, Math.sin(f.a), Math.cos(f.a)];
  const a = f.hinge, b = add(a, mul(d, FUSE_L));
  const p = (s) => add(a, mul(d, s));
  const v = [0, d[2], -d[1]];
  const sh0 = iso(add(p(3), add([FUSE_R * 0.45, 0, 0], mul(v, FUSE_R * 0.35))), P), sh1 = iso(add(p(FUSE_L - 3), add([FUSE_R * 0.45, 0, 0], mul(v, FUSE_R * 0.35))), P);
  const ring = [];
  for (let i = 0; i <= 16; i++) { const t = (i / 16) * Math.PI * 2; ring.push(iso(add(p(FUSE_L + 2.3), add(mul(d, 1.6 * Math.sin(t)), mul(v, 1.6 * Math.cos(t)))), P)); }
  const k = cameraOf(P).k;
  f.layer.innerHTML =
    '<path class="fuse-body" d="' + cyl(p(2.5), p(FUSE_L - 2.5), FUSE_R) + '"/>' +
    '<path class="fuse-shine" stroke-width="' + (FUSE_R * k * 0.45).toFixed(2) + '" d="' + pathOf([sh0, sh1]) + '"/>' +
    '<path class="fuse-edge" d="' + cyl(p(2.5), p(FUSE_L - 2.5), FUSE_R) + '"/>' +
    '<path class="fuse-cap" d="' + cyl(p(-0.8), p(2.8), FUSE_R + 0.5) + '"/>' +
    '<path class="fuse-cap" d="' + cyl(p(FUSE_L - 2.8), p(FUSE_L + 0.6), FUSE_R + 0.5) + '"/>' +
    '<path class="fuse-ring" d="' + pathOf(ring) + '"/>';
}

// 帶電光：整條路徑呼吸發光，再有光束沿電流方向流過
const STEP = 3, TAIL = 24, SPACING = 80, SPEED = 170;
function project(path) {
  const pts = path.map((q) => iso(q, P));
  const len = [0];
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, len, total: len[len.length - 1] };
}
function pointAt(pr, s) {
  let i = 1;
  while (i < pr.pts.length - 1 && pr.len[i] < s) i++;
  const span = pr.len[i] - pr.len[i - 1] || 1, t = Math.max(0, Math.min(1, (s - pr.len[i - 1]) / span));
  const a = pr.pts[i - 1], b = pr.pts[i];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
function piece(pr, from, to) {
  from = Math.max(0, from); to = Math.min(pr.total, to);
  if (to <= from) return "";
  let d = "";
  for (let s = from; s < to; s += STEP) { const p = pointAt(pr, s); d += (d ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1); }
  const p = pointAt(pr, to);
  return d + "L" + p[0].toFixed(1) + " " + p[1].toFixed(1);
}
const PROJ = Object.fromEntries(Object.entries(PATHS).map(([id, path]) => [id, project(path)]));
const cur = {};
function current(id, kind, live) {
  let c = cur[id];
  if (!c) {
    const g = document.createElementNS(NS, "g");
    if (PATH_MASK[id]) g.setAttribute("mask", "url(#" + PATH_MASK[id] + ")");
    g.dataset.sys = kind;
    const glow = document.createElementNS(NS, "g"); glow.setAttribute("class", "glow"); glow.dataset.k = kind;
    const path = document.createElementNS(NS, "path"); path.setAttribute("d", piece(PROJ[id], 0, PROJ[id].total)); glow.appendChild(path);
    const streak = document.createElementNS(NS, "g"); streak.setAttribute("class", "streak"); streak.dataset.k = kind;
    g.append(glow, streak);
    glowLayer.appendChild(g);
    c = cur[id] = { g, streak };
  }
  c.g.style.display = live ? "" : "none";
  if (!live) return;
  const pr = PROJ[id], parts = [];
  if (!still.matches) {
    const n = Math.max(1, Math.ceil((pr.total + TAIL) / SPACING));
    for (let i = 0; i < n; i++) {
      const head = ((flowS + i * SPACING) % (n * SPACING)) - TAIL / 2;
      for (const [f, t, w] of [[1, 0.55, 0.25], [0.55, 0.2, 0.6], [0.2, 0, 1]]) parts.push([piece(pr, head - TAIL * f, head - TAIL * t), w]);
    }
  }
  while (c.streak.childElementCount < parts.length) c.streak.appendChild(document.createElementNS(NS, "path"));
  [...c.streak.children].forEach((el, i) => { const [d, w] = parts[i] ?? ["", 0]; el.setAttribute("d", d); el.setAttribute("opacity", String(w)); });
}
function draw() {
  for (const f of fuse) drawFuse(f);
  const closed = Object.fromEntries(fuse.map((f) => [f.p, f.a < 0.02]));
  const all = closed.A && closed.B && closed.C;
  // 電源側（線路、引接線、熔絲鏈開關電源側、避雷器）一直帶電
  for (const p of ["A", "B", "C"]) { current("line-" + p, "hv", true); current("tap-" + p, "hv", true); current("la-" + p, "hv", true); current("lead-" + p, "hv", closed[p]); }
  current("lead-B2", "hv", closed.B);
  for (const id of ["xlead-N", "xlead-P1", "xlead-P2", "xjump", "lv-N", "lv-P1", "lv-P2"]) current(id, "lv", all);
  let text, ro;
  const n = fuse.filter((f) => f.a < 0.02).length;
  if (on) {
    if (!all) { text = "① 用操作棒依序把熔絲管推上去（C → B → A），管頂卡進上接點罩。已投入 " + n + " 相。"; ro = "投入中"; }
    else { text = "② 三相都投入：一次側 11.4 kV 加到 T1（B-A）與 T2（C-B），二次側出現 220 V，低壓線帶電。"; ro = "二次 220 V"; }
  } else if (n > 0) { text = "拉開熔絲管：變壓器一次側斷電，二次側低壓線不再帶電。"; ro = "拉開中"; }
  else { text = "熔絲管垂下（開路）：只有高壓線與熔絲鏈開關電源側、避雷器帶電，變壓器沒有電。按「投入熔絲鏈開關」。"; ro = "未投入"; }
  if (text !== shown) { step.textContent = text; shown = text; }
  if (readout.textContent !== ro) readout.textContent = ro;
  all ? volt.setAttribute("data-on", "") : volt.removeAttribute("data-on");
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  tOn += dt;
  let busy = false;
  for (const f of fuse) {
    const target = on ? (tOn > f.delay ? 0 : OPEN) : OPEN;
    if (still.matches) { f.a = target; f.v = 0; continue; }
    // 推上去用力穩、最後一下卡入；拉開後靠重力擺下來、晃一下
    const stiff = target === 0 ? 120 : 40, drag = target === 0 ? 18 : 5;
    for (let i = 0; i < 4; i++) { f.v += ((target - f.a) * stiff - f.v * drag) * dt / 4; f.a += f.v * dt / 4; }
    if (f.a < 0) { f.a = 0; f.v = 0; }
    if (Math.abs(target - f.a) > 0.002 || Math.abs(f.v) > 0.01) busy = true;
  }
  flowS += dt * SPEED;
  draw();
  frame = visible ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
power.addEventListener("click", () => {
  on = !on; tOn = 0;
  if (!on) fuse.forEach((f, i) => { f.delay = 0; });
  else fuse.forEach((f, i) => { f.delay = i * 0.55; });
  power.setAttribute("aria-pressed", String(on));
  power.textContent = on ? "拉開熔絲鏈開關" : "投入熔絲鏈開關";
  run();
});
for (const b of document.querySelectorAll(".pt-seg button")) b.addEventListener("click", () => {
  for (const o of document.querySelectorAll(".pt-seg button")) o.setAttribute("aria-pressed", String(o === b));
  b.dataset.focus ? stage.setAttribute("data-focus", b.dataset.focus) : stage.removeAttribute("data-focus");
});
document.querySelector(".pt-check input").addEventListener("change", (e) => e.target.checked ? stage.removeAttribute("data-notags") : stage.setAttribute("data-notags", ""));
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }).observe(stage);
draw();
`;

const TABLE = `<div class="pt-table">
<h4>一次側（11.4 kV，22mm² PVC 線）</h4>
<b class="hv">A 相</b><span>熔絲鏈開關 → T1 H2</span>
<b class="hv">B 相</b><span>熔絲鏈開關 → T1 H1，再跨接到 T2 H2（B 為兩具共用相）</span>
<b class="hv">C 相</b><span>熔絲鏈開關 → T2 H1</span>
<b class="hv">避雷器</b><span>由熔絲鏈開關電源側引接；三具接地線（14mm²）互相連接後單獨接地</span>
<h4>二次側（3φ3W 220V，X2-X3 已短接）</h4>
<b class="lv">力</b><span>T2 X1</span>
<b class="gnd">被接地</b><span>T2 X4 ＋ T1 X1（V 共用點）→ 接地</span>
<b class="lv">力</b><span>T1 X4</span>
<b class="gnd">外殼</b><span>兩具變壓器外殼直接接到接地線，與低壓系統共同接地</span>
</div><div class="pt-volt"><span>力–力 220 V</span><span>力–被接地 220 V</span><span>力–被接地 220 V</span></div>`;

const page = k.plateHtml({
  fig: "第三站",
  title: "試題一：V-V 接線，二次 3φ3W 220V",
  hint: "按「投入熔絲鏈開關」",
  readout: "未投入",
  keys: [
    { mark: "red", label: "紅光：高壓帶電（11.4 kV）" },
    { mark: "blue", label: "藍光：低壓帶電（220 V）" },
    { mark: "green", label: "綠線：接地線（考場實際用黑色 PVC 線，這裡為了好認畫成綠色）" },
  ],
  caption: "兩具 11.4kV/110-220V 雙套管變壓器（減極性）做 V-V 接線：T1 跨 B-A 相、T2 跨 C-B 相，H1 與 X1 在同一側。二次側各取 X1-X4 兩端 220V，T2 X4 與 T1 X1 接在一起成為 V 共用點並接地，所以三條低壓線之間都是 220V。場地架有 4 條低壓線，本題由上而下用被接地、力、力三條，第 4 條不接；都以軸型礙子終端紮線，跳線用 C 型銅壓接套管與變壓器二次引線連接。",
  body: `<div class="iso-stage">${svg}</div><div class="pt-ctrl"><button type="button" class="pt-power" aria-pressed="false">投入熔絲鏈開關</button><span class="pt-seg" role="group" aria-label="只看"><button type="button" aria-pressed="true">全部</button><button type="button" data-focus="hv" aria-pressed="false">一次側</button><button type="button" data-focus="lv" aria-pressed="false">二次側</button><button type="button" data-focus="gnd" aria-pressed="false">接地</button></span><label class="pt-check"><input type="checkbox" checked> 端子名稱</label></div><div class="pt-step"></div>${TABLE}`,
});

const name = `pole-transformer${theme === "dark" ? "-dark" : ""}.html`;
writeFileSync(join(HERE, name), k.pageHtml({ title: "第三站試題一：桿上變壓器 V-V 接線", theme, body: `<style>${CSS}</style>${page}`, script: kitScript() + live, width: 760 }).replace('<html lang="en">', '<html lang="zh-Hant">'));
console.log("wrote", name, "items", ITEMS.length + BACK.length);
