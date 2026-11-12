// One scene per project in data/portfolio.json, keyed by project id.
import { scene, col, emit } from './iso.mjs';

const S = {};
const Cs = Math.cos(Math.PI / 6);

// helpers ------------------------------------------------------------
// plate whose top sits at z = h
const plate = (s, x, y, w, d, h = 0.4) => { s.shadow(x, y, w, d, 0.5, 0); s.box(x, y, 0, w, d, h); s.ground = h; return h; };
// plate sunk below z = 0, for scenes authored on the ground
const base = (s, x, y, w, d, t = 0.4) => {
  s.poly([[x + 0.5, y + 0.5, -t], [x + w + 0.5, y + 0.5, -t], [x + w + 0.5, y + d + 0.5, -t], [x + 0.5, y + d + 0.5, -t]], col.shadow, { stroke: 'none' });
  s.box(x, y, -t, w, d, t);
};
// text lines on an onX face, ragged on the right as read on screen (screen-left = +y)
const textLinesX = (s, x, y, z, d, n, gap = 0.45, o = {}) => {
  for (let i = 0; i < n; i++) s.line([[x, y + d, z - i * gap], [x, y + d - d * (i === n - 1 ? 0.6 : 1), z - i * gap]], o);
};
const textLinesTop = (s, x, y, z, w, n, gap = 0.45) => { for (let i = 0; i < n; i++) s.line([[x + i * gap, y, z], [x + i * gap, y + w * (i === n - 1 ? 0.6 : 1), z]]); };
// a screen-upright check mark decal on a horizontal plane
const checkTop = (s, cx, cy, z, k = 1, o = {}) => {
  const pl = (u, v) => { const a = u / Cs, b = 2 * v; return [cx + (a + b) / 2, cy + (b - a) / 2, z]; };
  s.line([pl(-0.45 * k, 0), pl(-0.12 * k, 0.32 * k), pl(0.55 * k, -0.4 * k)], { sw: 3, ...o });
};

// 1. JobSwitch: two employers, benefit docs compared, a reviewed hand-off ---
S.jobswitch = s => {
  const h = plate(s, 0, 0, 12, 7);
  s.dots([[3, 4.4, h], [4.6, 5.5, h], [8.2, 5.5, h], [9.8, 4.4, h]]);
  s.box(1, 0.8, h, 3, 3, 4.6);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) s.onX(4, 1.3 + c * 1.2, h + 0.7 + r * 1, 0.7, 0.55, col.left);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) s.onY(3.8, 1.5 + c * 1.2, h + 0.7 + r * 1, 0.7, 0.55, col.right);
  // two benefit handbooks standing side by side
  for (const [x, dot] of [[4.7, false], [6.6, true]]) {
    s.box(x, 1.6, h, 1.6, 0.18, 2.2);
    const y = 1.78;
    for (let k = 0; k < 3; k++) s.line([[x + 0.3, y, h + 1.7 - k * 0.45], [x + (k === 2 ? 0.9 : 1.3), y, h + 1.7 - k * 0.45]]);
    if (dot) s.disc([x + 1.2, y, h + 0.45], 'y', 0.2, col.orange);
  }
  s.box(5.6, 4.7, h, 1.9, 1.5, 0.22);
  checkTop(s, 6.55, 5.45, h + 0.22, 0.9);
  s.box(8.6, 0.8, h, 3, 3, 3.4, { top: col.tealL });
  for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) s.onX(11.6, 1.3 + c * 1.2, h + 0.6 + r * 0.95, 0.7, 0.55, col.left);
  s.onY(3.8, 9.6, h, 1, 1.6, col.teal);
};

// 2. Folio: subscription cards on file, usage ring, renewal calendar --------
S.folio = s => {
  const h = plate(s, 0, 0, 12, 8);
  s.box(1, 1.2, h, 4.2, 5, 0.9);
  const fills = [col.teal, col.orangeL, col.top];
  for (let i = 0; i < 3; i++) {
    const x = 1.6 + i * 1.2, z = h + 0.4, H = 3.4 - i * 0.4;
    s.box(x, 1.6, z, 0.18, 4.2, H, { right: fills[i] });
    s.disc([x + 0.18, 5.0, z + H - 0.9], 'x', 0.45, i === 0 ? col.tealL : col.teal);
    textLinesX(s, x + 0.18, 2.0, z + H - 0.6, 2.2, 2, 0.5, { stroke: i === 0 ? col.top : col.ink });
  }
  s.disc([8.7, 2.8, h], 'z', 1.9, col.shadow, { stroke: 'none' });
  s.cyl([8.5, 2.6, h], 'z', 1.7, 0.35, { cap: col.tealL });
  const z = h + 0.35, arc = [[8.5, 2.6, z]];
  for (let i = 0; i <= 24; i++) { const a = -Math.PI / 2 + (i / 24) * Math.PI * 1.25; arc.push([8.5 + Math.cos(a) * 1.7, 2.6 + Math.sin(a) * 1.7, z]); }
  s.poly(arc, col.teal);
  s.disc([8.5, 2.6, z], 'z', 0.8, col.top);
  s.box(7, 5, h, 3.2, 2.4, 0.5);
  s.flat(7, 5, h + 0.5, 0.6, 2.4, col.teal);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) s.flat(7.85 + r * 0.75, 5.25 + c * 0.55, h + 0.5, 0.45, 0.35, r === 2 && c === 1 ? col.orange : col.shadow, { stroke: 'none' });
  s.dots([[5.4, 3, h], [6.6, 3, h]]);
  s.dots([[5.4, 5.8, h], [6.8, 5.8, h]]);
};

// 3. Akashic Computer: an atlas of model families by size --------------------
S.akashic = s => {
  const h = plate(s, 0, 0, 11, 9.4);
  const H = [[0.6, 1.2, 2.2, 3.4], [0.8, 1.6, 2.6, 3.9], [0.5, 1, 1.8, 2.6]];
  const tops = [col.tealL, col.top, col.tealL];
  const cells = [];
  for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) cells.push([i, j]);
  cells.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
  for (const [i, j] of cells) {
    const x = 1 + i * 2.4, y = 1 + j * 2.8, hh = H[j][3 - i];
    s.shadow(x, y, 1.5, 1.5, 0.35);
    const hot = i === 2 && j === 1;
    s.box(x, y, h, 1.5, 1.5, hh, { top: hot ? col.orange : tops[j] });
    if (hot) for (let k = 1; k * 0.55 < hh - 0.2; k++) s.line([[x + 1.5, y + 0.3, h + k * 0.55], [x + 1.5, y + 1.2, h + k * 0.55]]);
  }
};

// 4. Poincaré Lean: a loop contracting on a sphere, proof steps leading up ---
S.poincare = s => {
  const h = plate(s, 0, 0, 11, 7.6);
  s.box(1, 5.0, h, 2.2, 2.2, 0.6, { top: col.tealL });
  s.box(1, 2.7, h, 2.2, 2.2, 1.2, { top: col.tealL });
  s.box(1, 0.4, h, 2.2, 2.2, 1.8, { top: col.teal });
  for (const [y, z] of [[5.0, 0.6], [2.7, 1.2], [0.4, 1.8]]) s.line([[1.6, y + 0.5, h + z], [1.6, y + 1.7, h + z]], { stroke: z === 1.8 ? col.top : col.ink });
  const c = [7, 3.8, h + 2.6], r = 2.4;
  s.disc([c[0], c[1], h], 'z', 2.1, col.shadow, { stroke: 'none' });
  s.sphere(c, r, col.top);
  const loop = (zOff, o) => {
    const rr = Math.sqrt(r * r - zOff * zOff), pts = s.circlePts([c[0], c[1], c[2] + zOff], 'z', rr, 96);
    const vis = pts.map(p => (p[0] - c[0]) + (p[1] - c[1]) + (p[2] - c[2]) > 0);
    const start = vis.findIndex((v, i) => !v && vis[(i + 1) % vis.length]);
    const seg = [];
    for (let k = 1; k <= pts.length; k++) { const i = (start + k) % pts.length; if (!vis[i]) break; seg.push(pts[i]); }
    s.line(seg, o);
  };
  loop(0, { stroke: col.faint });
  loop(0.9, { stroke: col.orange, sw: 3 });
  loop(1.7, { stroke: col.orange, dash: '6 6' });
  s.sphere([c[0], c[1], c[2] + r], 0.17, col.orange);
};

// 5. Personal AI Lab: two DGX units, storage, observability panel ----------
S.ailab = s => {
  const h = plate(s, 0, 0, 13, 9);
  s.line([[4.5, 2.4, h], [8.2, 2.4, h]], { stroke: col.teal, sw: 3 });
  s.line([[4.5, 5.6, h], [6.4, 5.6, h], [6.4, 2.4, h]], { stroke: col.teal, sw: 3 });
  s.line([[8.6, 3.6, h], [8.6, 5.6, h]], { stroke: col.orange, sw: 3 });
  for (const y of [1, 4.2]) {
    s.shadow(1.2, y, 3.3, 2.8, 0.35);
    s.box(1.2, y, h, 3.3, 2.8, 2.4);
    for (let k = 0; k < 5; k++) s.line([[4.5, y + 0.4, h + 0.4 + k * 0.38], [4.5, y + 2.4, h + 0.4 + k * 0.38]]);
    s.onX(4.5, y + 0.4, h + 2.05, 0.35, 0.18, col.teal, { stroke: 'none' });
    s.flat(1.6, y + 0.4, h + 2.4, 2.5, 0.5, col.tealL);
  }
  let z = h;
  for (let i = 0; i < 3; i++) { s.cyl([9.6, 2.4, z + 0.12], 'z', 1.2, 0.7, { cap: i === 2 ? col.orangeL : col.top }); z += 0.82; }
  s.box(8.8, 5.4, h, 1.2, 1.6, 0.25);
  s.box(9.2, 6, h + 0.25, 0.3, 0.4, 1);
  s.box(9.3, 4.6, h + 1.2, 0.25, 3.4, 2.4);
  s.onX(9.55, 4.85, h + 1.45, 2.9, 1.9, col.top);
  const g = [[0, 0.3], [0.5, 0.9], [1, 0.6], [1.5, 1.3], [2, 1.0], [2.6, 1.6]];
  s.line(g.map(([y, zz]) => [9.55, 7.6 - y, h + 1.45 + zz]), { stroke: col.orange, sw: 2.6 });
};

// 6. Soma: local health context — DNA on a locked local device, sourced report
S.soma = s => {
  const h = plate(s, 0, 0, 11, 7.6);
  s.shadow(1.2, 1.4, 4, 4, 0.4);
  s.box(1.2, 1.4, h, 4, 4, 2.4);
  const p = [[0, 1.1], [0.9, 1.1], [1.2, 1.8], [1.5, 0.4], [1.85, 1.5], [2.1, 1.1], [3.4, 1.1]];
  s.line(p.map(([y, z]) => [5.2, 5.1 - y, h + z]), { stroke: col.orange, sw: 3 });
  // lock (local-first)
  s.onY(5.4, 1.8, h + 0.5, 1.4, 1.1, col.teal);
  s.line([[2.0, 5.4, h + 1.6], [2.0, 5.4, h + 2.05], [3.0, 5.4, h + 2.05], [3.0, 5.4, h + 1.6]], { sw: 2.6 });
  // DNA double helix
  {
    const cx = 3.2, cy = 3.4, z0 = h + 2.4, b = z0 + 0.3, R = 0.75, turns = 1.25, H = 2.5, N = 140;
    s.cyl([cx, cy, z0], 'z', 1.05, 0.3, { cap: col.tealL });
    const pt = (t, ph) => { const a = t * turns * Math.PI * 2 + ph; return [cx + Math.cos(a) * R, cy + Math.sin(a) * R, b + 0.3 + t * H]; };
    const front = (t, ph) => { const a = t * turns * Math.PI * 2 + ph; return Math.cos(a) + Math.sin(a) > 0; };
    const strands = [[0, col.teal], [Math.PI, col.tealM]];
    const runs = (ph, want) => { const out = []; let cur = null;
      for (let k = 0; k <= N; k++) { const t = k / N, f = front(t, ph);
        if (f === want) { if (!cur) { cur = []; if (k) cur.push(pt((k - 1) / N, ph)); } cur.push(pt(t, ph)); }
        else if (cur) { cur.push(pt(t, ph)); out.push(cur); cur = null; } }
      if (cur) out.push(cur); return out; };
    for (const [ph, c] of strands) for (const r of runs(ph, false)) s.line(r, { stroke: c, sw: 3, opacity: 0.45 });
    for (let k = 0; k < 9; k++) { const t = (k + 0.5) / 9; s.line([pt(t, 0), pt(t, Math.PI)], { stroke: col.ink, sw: 2 }); }
    for (const [ph, c] of strands) for (const r of runs(ph, true)) { s.line(r, { stroke: col.paper, sw: 7 }); s.line(r, { stroke: c, sw: 3.6 }); }
  }
  // sourced report
  s.shadow(6.8, 2.6, 3.6, 4.4, 0.35);
  s.box(6.8, 2.6, h, 3.6, 4.4, 0.35);
  const z = h + 0.35;
  s.line([[7.3, 3.0, z], [7.3, 6.6, z]]);
  s.line([[7.9, 3.0, z], [7.9, 5.2, z]]);
  [1.0, 1.9, 1.4, 2.6].forEach((H, k) => s.box(8.2 + k * 0.6, 4.4, z, 0.48, 1.0, H, { top: k === 3 ? col.orange : col.tealL }));
};

// 7. Precortex: one big task broken into smaller steps -------------------
S.precortex = s => {
  const h = plate(s, 0, 0, 15, 5.5);
  const steps = [[1, 3.6, 3, col.orangeL], [5, 2.3, 2.2, col.top], [8.2, 1.4, 2.2, col.top], [11.4, 0.7, 2.2, col.tealL]];
  steps.forEach(([x, H, w, top], i) => {
    s.box(x, 1, h, w, 3.4, H, { top });
    const z = h + H;
    if (i === 0) {
      const c = [x + 1.5, 2.7], st = [];
      for (let k = 0; k < 8; k++) { const r = k % 2 ? 0.35 : 1.15, a = (k / 8) * Math.PI * 2; st.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, z]); }
      s.poly(st, col.orange);
    } else if (i < 3) {
      s.flat(x + 0.5, 1.4, z, 0.7, 0.7, col.top);
      s.line([[x + 0.6, 2.5, z], [x + 0.6, 3.9, z]]);
      s.line([[x + 1.1, 2.5, z], [x + 1.1, 3.4, z]]);
    } else {
      s.flat(x + 0.6, 1.9, z, 1.1, 1.1, col.teal);
      checkTop(s, x + 1.15, 2.45, z, 0.7, { stroke: col.top, sw: 2.6 });
    }
  });
  s.dots([[4.4, 4.9, h], [12.8, 4.9, h]]);
};

// 8. Prism: ideas in, structured specs out ------------------------------
S.prism = s => {
  base(s, 1, -0.6, 10.6, 11.4);
  const ins = [[2.4, 6.8, col.top], [3.6, 7.8, col.orangeL], [2.0, 8.9, col.top]];
  for (const [x, y, f] of ins) { s.box(x, y, 0, 2, 1.6, 0.12, { top: f }); s.line([[x + 0.5, y + 0.3, 0.12], [x + 0.5, y + 1.3, 0.12]]); s.line([[x + 1.1, y + 0.3, 0.12], [x + 1.1, y + 0.9, 0.12]]); }
  const x0 = 4.8, x1 = 7.6, ya = 2.8, yb = 5.6, yc = 4.2, H = 3.2;
  s.poly([[x0, ya, 0], [x1, ya, 0], [x1, yc, H], [x0, yc, H]], col.top);
  s.poly([[x0, yb, 0], [x1, yb, 0], [x1, yc, H], [x0, yc, H]], col.left);
  s.poly([[x1, ya, 0], [x1, yb, 0], [x1, yc, H]], col.tealL);
  for (const [x, y] of [[4.4, 7.6], [4.6, 8.6], [4.0, 9.7]]) s.line([[x, y, 0.15], [x0 + 1.4, 4.9, 1.6]], { stroke: col.ink, sw: 2.2 });
  const outs = [[10, 0, col.teal], [10, 2.9, col.orange], [10, 5.8, col.ink]];
  for (const [x, y, c] of outs) s.line([[x1, yc, 1.05], [x - 0.3, y + 1.2, 1.0]], { stroke: c, sw: 2.6 });
  for (const [x, y, c] of outs) {
    s.box(x, y, 0, 0.25, 2.4, 2);
    s.onX(x + 0.25, y + 1.6, 1.2, 0.55, 0.55, c);
    s.line([[x + 0.25, y + 1.35, 1.6], [x + 0.25, y + 0.3, 1.6]]);
    s.line([[x + 0.25, y + 1.35, 1.2], [x + 0.25, y + 0.6, 1.2]]);
    s.line([[x + 0.25, y + 2.15, 0.6], [x + 0.25, y + 0.3, 0.6]]);
  }
};

// 9. Caption With Intent: vertical video + word-level caption timeline ------
S.cwi = s => {
  base(s, 0, -0.4, 8.2, 8.8);
  s.shadow(1, 1, 0.6, 3.4, 0.6);
  s.box(1, 1, 0, 0.5, 3.4, 6.2);
  s.onX(1.5, 1.25, 0.35, 2.9, 5.5, col.tealL);
  s.disc([1.5, 2.7, 3.9], 'x', 0.9, col.top);
  s.poly([[1.5, 2.95, 4.25], [1.5, 2.95, 3.55], [1.5, 2.4, 3.9]], col.teal);
  // words with intent: varying size, one emphasised
  s.onX(1.5, 3.35, 1.4, 0.6, 0.38, col.top);
  s.onX(1.5, 2.25, 1.3, 0.95, 0.62, col.orange);
  s.onX(1.5, 1.45, 1.4, 0.65, 0.38, col.top);
  s.onX(1.5, 2.6, 0.75, 1.3, 0.3, col.top);
  s.shadow(4, 0, 3.4, 8, 0.4);
  s.box(4, 0, 0, 3.4, 8, 0.3);
  const t = (x, segs, f) => segs.forEach(([y, l]) => s.box(x, y, 0.3, 0.9, l, 0.35, { top: f }));
  t(4.4, [[0.4, 2.6], [3.2, 1.8], [5.2, 2.4]], col.tealL);
  t(5.8, [[0.6, 1.4], [2.3, 2.2], [4.9, 1.2], [6.4, 1.2]], col.orangeL);
  s.flat(4.05, 4.35, 0.68, 3.3, 0.16, col.orange);
  s.poly([[4.05, 4.1, 0.68], [4.7, 4.43, 0.68], [4.05, 4.76, 0.68]], col.orange);
  s.dots([[2.4, 4.6, 0], [3.8, 4.6, 0]]);
};

// 10. Reader: a focused library and a highlighted article ------------------
S.reader = s => {
  const h = plate(s, 0, 0, 10.4, 8.6, 0.3);
  const books = [[3.6, col.top], [4.2, col.teal], [3.2, col.top], [3.9, col.orangeL], [4.4, col.top], [3.4, col.tealL]];
  books.forEach(([H, f], i) => {
    const x = 0.6 + i * 1.05;
    s.box(x, 0.5, h, 0.85, 2.5, H, { left: f });
    s.line([[x + 0.2, 3, h + H - 0.6], [x + 0.65, 3, h + H - 0.6]], { stroke: f === col.teal ? col.top : col.ink });
  });
  s.shadow(5.2, 4.4, 4.6, 3.6, 0.3);
  s.box(5.2, 4.4, h, 4.6, 3.6, 0.16);
  const z = h + 0.16;
  s.flat(5.9, 4.8, z, 0.5, 2.6, col.teal, { stroke: 'none' });
  textLinesTop(s, 6.9, 4.8, z, 2.8, 1);
  s.flat(7.45, 4.75, z, 0.5, 2.4, col.orangeL, { stroke: 'none' });
  s.line([[7.7, 4.8, z], [7.7, 7.1, z]]);
  textLinesTop(s, 8.4, 4.8, z, 2.8, 3, 0.5);
  s.poly([[5.5, 7.1, z], [5.5, 7.7, z], [4.6, 7.7, z], [4.9, 7.4, z], [4.6, 7.1, z]], col.orange);
};

// 11. Agent Newsletter: a daily review queue feeding an agent --------------
S.newsletter = s => {
  base(s, 0, -0.2, 15.6, 5.6);
  // envelope (source)
  s.box(0.8, 0.8, 0, 4, 3.4, 0.5);
  const z = 0.5;
  s.line([[0.8, 0.8, z], [2.8, 2.6, z], [4.8, 0.8, z]]);
  s.line([[0.8, 4.2, z], [2.4, 2.9, z]]);
  s.line([[4.8, 4.2, z], [3.2, 2.9, z]]);
  // queue of scored items
  s.dots([[5.0, 2.5, 0], [11.6, 2.5, 0]]);
  const items = [[5.6, 0.55, col.tealL], [7.6, 0.9, col.orange], [9.6, 0.35, col.tealL]];
  for (const [x, sc, f] of items) {
    s.shadow(x, 1.4, 1.5, 2.2, 0.25);
    s.box(x, 1.4, 0, 1.5, 2.2, 0.25);
    s.flat(x + 0.35, 1.7, 0.25, 0.3, 1.6 * sc + 0.2, f, { stroke: 'none' });
    s.line([[x + 0.95, 1.7, 0.25], [x + 0.95, 3.3, 0.25]]);
  }
  // agent
  s.shadow(12, 1, 2.6, 3, 0.4);
  s.box(12, 1, 0, 2.6, 3, 2.6, { top: col.tealL });
  s.onY(4, 12.6, 1.3, 0.4, 0.5, col.ink); s.onY(4, 13.6, 1.3, 0.4, 0.5, col.ink);
  s.onX(14.6, 1.6, 0.5, 1.8, 0.4, col.teal);
  s.line([[13.3, 2.5, 2.6], [13.3, 2.5, 3.6]]);
  s.sphere([13.3, 2.5, 3.8], 0.22, col.orange);
};

// 12. Resume OS: a profile that answers back ----------------------------
S.resume = s => {
  const h = plate(s, 0, 0, 8, 6.4);
  s.box(1.2, 0.9, h, 0.35, 4.6, 5.8);
  const x = 1.55;
  s.onX(x, 1.3, h + 3.6, 3.8, 1.9, col.tealL);
  s.disc([x, 4.1, h + 4.55], 'x', 0.6, col.orangeL);
  s.line([[x, 3.1, h + 4.9], [x, 1.7, h + 4.9]]); s.line([[x, 3.1, h + 4.3], [x, 2.1, h + 4.3]]);
  for (let k = 0; k < 4; k++) s.line([[x, 5.1, h + 2.9 - k * 0.6], [x, k === 3 ? 3.2 : 1.6, h + 2.9 - k * 0.6]]);
  // question
  s.box(4.4, 0.4, h + 4.4, 0.25, 2.6, 1.3);
  s.poly([[4.65, 2.4, h + 4.4], [4.65, 2.9, h + 4.4], [4.65, 3.2, h + 3.9]], col.top);
  s.line([[4.65, 2.6, h + 5.1], [4.65, 0.8, h + 5.1]]); s.line([[4.65, 2.6, h + 4.75], [4.65, 1.5, h + 4.75]]);
  // answer, grounded with a shadow
  s.flat(6.3, 1.9, h, 0.5, 3.6, col.shadow, { stroke: 'none' });
  s.box(6.4, 1.6, h + 1.5, 0.25, 4, 2.1, { right: col.teal });
  s.poly([[6.65, 4.9, h + 1.5], [6.65, 5.4, h + 1.5], [6.65, 5.7, h + 0.9]], col.teal);
  for (let k = 0; k < 3; k++) s.line([[6.65, 5.1, h + 3.1 - k * 0.5], [6.65, k === 2 ? 3.4 : 2.0, h + 3.1 - k * 0.5]], { stroke: col.top });
};

// 13. Conditioned: barbell, box, and ten-domain balance with gaps -----------
S.conditioned = s => {
  const h = plate(s, 0, 0, 13, 8);
  s.shadow(8.4, 0.8, 2.8, 2.6, 0.4);
  s.box(8.4, 0.8, h, 2.8, 2.6, 2.2);
  const bx = 4.5, bz = h + 1.25;
  s.disc([bx, 1.6, h], 'z', 0.9, col.shadow, { stroke: 'none' });
  s.cyl([bx, 1.2, bz], 'y', 1.25, 0.5, { side: col.teal, cap: col.tealL });
  s.cyl([bx, 1.7, bz], 'y', 0.12, 4.6, {});
  s.disc([bx, 6.9, h], 'z', 0.9, col.shadow, { stroke: 'none' });
  s.cyl([bx, 6.3, bz], 'y', 1.25, 0.5, { side: col.teal, cap: col.tealL });
  s.cyl([bx, 6.8, bz], 'y', 0.18, 0.8, {});
  // ten domains: 5 x 2, gaps in front
  const rows = [[1.6, 1.4, 1.8, 1.2, 1.5], [1.3, 0.35, 1.5, 0.45, 1.1]];
  rows.forEach((row, j) => row.forEach((H, i) => {
    const gap = H < 0.5;
    s.box(7.9 + i * 0.95, 4.3 + j * 1.05, h, 0.7, 0.7, H, { top: gap ? col.orange : col.tealL });
  }));
};

// 14. Reflect: voice journal with sentiment ----------------------------
S.reflect = s => {
  base(s, -0.2, -0.6, 9.4, 8.4);
  // phone lying flat
  s.shadow(0.8, 0.6, 3.6, 6.4, 0.3);
  s.box(0.8, 0.6, 0, 3.6, 6.4, 0.4);
  const z = 0.4;
  s.flat(1.05, 0.85, z, 3.1, 5.9, col.top);
  const c = [2.6, 2.6];
  s.disc([c[0], c[1], z], 'z', 1.2, col.orangeL);
  const sm = []; for (let i = 0; i <= 14; i++) { const a = Math.PI / 4 - 0.9 + (i / 14) * 1.8; sm.push([c[0] + Math.cos(a) * 0.65, c[1] + Math.sin(a) * 0.65, z]); }
  s.line(sm, { sw: 2.6 });
  for (const a of [Math.PI / 4 + Math.PI - 0.5, Math.PI / 4 + Math.PI + 0.5]) s.disc([c[0] + Math.cos(a) * 0.5, c[1] + Math.sin(a) * 0.5, z], 'z', 0.1, col.ink);
  [0.3, 0.7, 1.0, 0.5, 1.2, 0.8, 0.4, 0.7, 0.3].forEach((H, k) => s.line([[2.6 - H, 4.4 + k * 0.25, z], [2.6 + H, 4.4 + k * 0.25, z]], { stroke: col.teal, sw: 2.4 }));
  // waveform rising
  const W = [0.6, 1.2, 2.1, 1.5, 3.0, 2.2, 1.4, 2.6, 1.1, 0.7];
  W.forEach((H, i) => s.box(6.2, -0.2 + i * 0.75, 0, 0.9, 0.5, H * 0.9, { top: i === 4 ? col.orange : col.tealL }));
};

// 15. 자격루: stepped vessels feeding a self-striking clock -----------------
S.jagyeokru = s => {
  base(s, -0.6, -3, 17, 6.8);
  const steps = [[0, 4.2], [3.2, 2.9], [6.4, 1.6]];
  for (const [x, H] of steps) {
    s.shadow(x, 0, 2.8, 2.8, 0.4);
    s.box(x, 0, 0, 2.8, 2.8, H);
    s.cyl([x + 1.4, 1.4, H], 'z', 1.05, 1.3, { cap: col.tealL });
    s.disc([x + 1.4, 1.4, H + 1.3], 'z', 0.75, col.teal, { stroke: 'none' });
  }
  // receiving vessel + float rod
  s.disc([10.8, 1.6, 0], 'z', 1.3, col.shadow, { stroke: 'none' });
  s.cyl([10.6, 1.4, 0], 'z', 1.1, 1.9, { cap: col.tealL });
  s.disc([10.6, 1.4, 1.9], 'z', 0.8, col.teal, { stroke: 'none' });
  s.box(10.45, 1.25, 1.9, 0.3, 0.3, 2.2, { top: col.orange });
  // spouts, drawn after all vessels
  steps.forEach(([x, H], i) => {
    const end = i < 2 ? x + 4.0 : 10.2, rim = i < 2 ? steps[i + 1][1] + 1.3 : 1.9;
    s.line([[x + 2.4, 1.4, H + 0.9], [end, 1.4, H + 0.9]], { sw: 3 });
    s.dots([[end, 1.4, H + 0.6], [end, 1.4, rim + 0.1]], { stroke: col.teal });
  });
  // striking pavilion with a bell
  s.shadow(13.2, -2.2, 2.4, 2.4, 0.4);
  s.box(13.2, -2.2, 0, 2.4, 2.4, 3.2);
  const rz = 3.2, o = 0.4;
  s.poly([[13.2 - o, 0.2 + o, rz], [15.6 + o, 0.2 + o, rz], [14.4, -1.0, rz + 1.6]], col.left);
  s.poly([[15.6 + o, -2.2 - o, rz], [15.6 + o, 0.2 + o, rz], [14.4, -1.0, rz + 1.6]], col.teal);
  const bell = []; for (let i = 0; i <= 16; i++) { const a = Math.PI * (i / 16); bell.push([15.6, -1.0 + Math.cos(a) * 0.5, 1.9 + Math.sin(a) * 0.55]); }
  s.poly([[15.6, -0.25, 1.2], ...bell.map(([x, y, z]) => [x, y + (y > -1 ? 0.25 : -0.25) * 0, z]), [15.6, -1.75, 1.2]], col.orange);
  s.line([[10.6, 1.4, 4.1], [12.4, 0.3, 4.1], [13.2, -0.4, 2.6]], { dash: '0 7', sw: 2.6 });
};

// 16. Three Body: three masses chasing each other on a figure-eight ---------
S.threebody = s => {
  const h = plate(s, 0, 0, 9, 9, 0.3);
  for (let k = 1; k < 9; k++) { s.line([[k, 0.1, h], [k, 8.9, h]], { stroke: col.shadow, sw: 1.4 }); s.line([[0.1, k, h], [8.9, k, h]], { stroke: col.shadow, sw: 1.4 }); }
  const cx = 4.5, cy = 4.5, a = 3.9;
  const at = t => { const u = a * Math.sin(t), v = a * 0.9 * Math.sin(t) * Math.cos(t); return [cx + (u + v) / Math.SQRT2, cy + (v - u) / Math.SQRT2, h]; };
  const orbit = []; for (let i = 0; i <= 160; i++) orbit.push(at((i / 160) * Math.PI * 2));
  s.line(orbit, { stroke: col.ink, dash: '2 7', sw: 2.4 });
  const bodies = [[Math.PI / 2, col.teal], [Math.PI / 2 + (2 * Math.PI) / 3, col.orange], [Math.PI / 2 + (4 * Math.PI) / 3, col.top]].map(([t, f]) => {
    const p = at(t); for (let k = 1; k <= 4; k++) s.line([at(t - k * 0.09), at(t - (k - 1) * 0.09)], { stroke: f === col.top ? col.ink : f, sw: 3.4 - k * 0.6, opacity: 1 - k * 0.2 });
    return [p, f];
  });
  bodies.sort((p, q) => p[0][0] + p[0][1] - q[0][0] - q[0][1]).forEach(([p, f]) => { s.disc([p[0] + 0.15, p[1] + 0.15, h], 'z', 0.5, col.shadow, { stroke: 'none' }); s.sphere([p[0], p[1], h + 0.65], 0.6, f); });
};

// 17. Block Fighter: two balls repainting a territory board ----------------
S.blockfighter = s => {
  const h = plate(s, 0, 0, 10.4, 10);
  const jag = [0, 1, 1, 0, -1, -1, 0, 1];
  const cells = []; for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) cells.push([i, j]);
  cells.sort((a, b) => a[0] + a[1] - b[0] - b[1]);
  const flip = new Set(['4,2', '3,5']);
  for (const [i, j] of cells) {
    const teal = i + jag[j] < 4, x = 1.2 + i * 1.0, y = 1 + j * 1.0;
    if (flip.has(`${i},${j}`)) s.box(x + 0.05, y + 0.05, h + 0.7, 0.85, 0.85, 0.2, { top: teal ? col.orange : col.teal });
    else s.box(x + 0.05, y + 0.05, h, 0.9, 0.9, 0.2, { top: teal ? col.tealL : col.orangeL });
  }
  // paddles
  s.box(0.35, 3.2, h, 0.4, 2.6, 0.6, { top: col.teal });
  s.box(9.6, 4.2, h, 0.4, 2.6, 0.6, { top: col.orange });
  // balls with trails, each inside enemy territory
  const ball = (x, y, f, tr) => { s.dots([[x + tr[0], y + tr[1], h + 0.65], [x, y, h + 0.65]], { stroke: f }); s.disc([x, y, h + 0.2], 'z', 0.4, col.shadow, { stroke: 'none' }); s.sphere([x, y, h + 0.65], 0.42, f); };
  ball(2.2, 6.2, col.orange, [-1.0, -1.8]);
  ball(7.8, 3.0, col.teal, [-1.6, 1.4]);
};

// 18. Rent Calculator: a home, one deposit vs. many months of rent ----------
S.rent = s => {
  const h = plate(s, 0, 0, 13.4, 7.4);
  const x = 1, y = 1.4, w = 4, d = 3.8, H = 2.4, R = 1.9;
  s.shadow(x, y, w, d, 0.4);
  s.poly([[x, y + d, h], [x + w, y + d, h], [x + w, y + d, h + H], [x, y + d, h + H]], col.left);
  s.poly([[x + w, y, h], [x + w, y + d, h], [x + w, y + d, h + H], [x + w, y + d / 2, h + H + R], [x + w, y, h + H]], col.right);
  s.poly([[x - 0.2, y + d / 2, h + H + R], [x + w + 0.2, y + d / 2, h + H + R], [x + w + 0.2, y + d + 0.3, h + H - 0.25], [x - 0.2, y + d + 0.3, h + H - 0.25]], col.teal);
  s.onX(x + w, y + 1.4, h, 1, 1.5, col.orangeL);
  s.onY(y + d, x + 0.8, h + 0.9, 0.9, 0.8, col.top); s.onY(y + d, x + 2.3, h + 0.9, 0.9, 0.8, col.top);
  const stack = (cx, cy, n, r, cap) => { s.disc([cx + 0.2, cy + 0.2, h], 'z', r + 0.1, col.shadow, { stroke: 'none' }); let z = h; for (let i = 0; i < n; i++) { s.cyl([cx, cy, z], 'z', r, 0.3, { cap: i === n - 1 ? cap : col.top }); z += 0.3; } };
  stack(9.6, 1.6, 9, 0.95, col.orangeL);
  // arrow between deposit and rent
  s.line([[9.6, 3.2, h], [9.6, 4.6, h]], { sw: 2.6 });
  s.line([[9.2, 3.6, h], [9.6, 3.2, h], [10.0, 3.6, h]], { sw: 2.6 });
  s.line([[9.2, 4.2, h], [9.6, 4.6, h], [10.0, 4.2, h]], { sw: 2.6 });
  for (let k = 0; k < 4; k++) stack(7.3 + k * 1.4, 5.8, 2, 0.5, col.tealL);
};

// 19. Retirement Projector: savings compounding over time ------------------
S.retirement = s => {
  const h = plate(s, 0, 0, 12.5, 6);
  let z = h; for (let i = 0; i < 4; i++) { s.cyl([2, 4.4, z], 'z', 0.8, 0.3, { cap: i === 3 ? col.orangeL : col.top }); z += 0.3; }
  const H = [0.6, 0.9, 1.4, 2.0, 2.8, 3.8, 5.0];
  H.forEach((hh, i) => { const x = 0.8 + i * 1.6; s.shadow(x, 1.2, 1.1, 1.1, 0.3); s.box(x, 1.2, h, 1.1, 1.1, hh, { top: i === H.length - 1 ? col.orange : col.tealL }); });
  s.line([[4.2, 4.4, h], [11, 4.4, h]], { sw: 2.4 });
  s.line([[10.5, 4.0, h], [11, 4.4, h], [10.5, 4.8, h]], { sw: 2.4 });
};

const MAP = {
  jobswitch: 'jobswitch', folio: 'folio', akashic: 'akashic-computer', poincare: 'poincare-lean', ailab: 'personal-ai-lab',
  soma: 'soma', precortex: 'precortex', prism: 'prism', cwi: 'caption-with-intent', reader: 'reader',
  newsletter: 'agent-newsletter', resume: 'resume-os', conditioned: 'conditioned', reflect: 'reflect-ios', jagyeokru: 'jagyeokru',
  threebody: 'three-body-simulator', blockfighter: 'block-fighter', rent: 'rent-calculator', retirement: 'retirement-calculator',
};
// Returns [{ id, svg }] for every scene, or only the given project ids.
export function renderSvgs(only = []) {
  return Object.entries(S)
    .filter(([key]) => !only.length || only.includes(MAP[key]))
    .map(([key, fn]) => { const s = scene(); fn(s); return { id: MAP[key], svg: emit(s.els) }; });
}
