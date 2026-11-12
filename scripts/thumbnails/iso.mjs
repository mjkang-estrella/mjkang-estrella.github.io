// Tiny isometric SVG kit. Scenes push shapes in 3D; emit() fits them into a 16:10 frame.

const C = Math.cos(Math.PI / 6), S = 0.5;
export const col = {
  paper: '#f3f0e6', ink: '#1f1e1b',
  top: '#fdfbf6', left: '#f5f2e9', right: '#e9e5d8',
  teal: '#3e6d62', tealL: '#b9d0c8', tealM: '#7fa498',
  orange: '#c96a2c', orangeL: '#f0cba9',
  shadow: '#e3ded0', faint: '#cfc9b9',
};

export function scene() {
  const els = [];
  const P = (x, y, z = 0) => [(x - y) * C, (x + y) * S - z];
  const poly = (pts3, fill = col.top, o = {}) => els.push({ t: 'poly', pts: pts3.map(p => P(...p)), fill, ...o });
  const line = (pts3, o = {}) => els.push({ t: 'line', pts: pts3.map(p => P(...p)), ...o });
  const raw = (pts2, fill, o = {}) => els.push({ t: 'poly', pts: pts2, fill, ...o });

  const api = {
    P, poly, line, els,
    ground: 0,
    shadow(x, y, w, d, off = 0.45, z = api.ground) {
      poly([[x + off, y + off, z], [x + w + off, y + off, z], [x + w + off, y + d + off, z], [x + off, y + d + off, z]], col.shadow, { stroke: 'none' });
    },
    box(x, y, z, w, d, h, f = {}) {
      const top = f.top ?? col.top, l = f.left ?? col.left, r = f.right ?? col.right;
      poly([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]], l);
      poly([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]], r);
      poly([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]], top);
    },
    // flat rect lying on plane z
    flat(x, y, z, w, d, fill = col.top, o = {}) { poly([[x, y, z], [x + w, y, z], [x + w, y + d, z], [x, y + d, z]], fill, o); },
    // rect on a plane of constant x (screen-right facing), spans y..y+d, z..z+h
    onX(x, y, z, d, h, fill = col.top, o = {}) { poly([[x, y, z], [x, y + d, z], [x, y + d, z + h], [x, y, z + h]], fill, o); },
    // rect on a plane of constant y (screen-left facing)
    onY(y, x, z, w, h, fill = col.top, o = {}) { poly([[x, y, z], [x + w, y, z], [x + w, y, z + h], [x, y, z + h]], fill, o); },
    circlePts(c, axis, r, n = 72) {
      const out = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, u = Math.cos(a) * r, v = Math.sin(a) * r;
        out.push(axis === 'z' ? [c[0] + u, c[1] + v, c[2]] : axis === 'x' ? [c[0], c[1] + u, c[2] + v] : [c[0] + u, c[1], c[2] + v]);
      }
      return out;
    },
    disc(c, axis, r, fill = col.top, o = {}) { poly(api.circlePts(c, axis, r), fill, o); },
    ring(c, axis, r, o = {}) { line([...api.circlePts(c, axis, r), api.circlePts(c, axis, r)[0]], o); },
    // cylinder from c along +axis for len; side fill + visible end cap
    cyl(c, axis, r, len, f = {}) {
      const e = axis === 'z' ? [c[0], c[1], c[2] + len] : axis === 'x' ? [c[0] + len, c[1], c[2]] : [c[0], c[1] + len, c[2]];
      const pts = [...api.circlePts(c, axis, r), ...api.circlePts(e, axis, r)].map(p => P(...p));
      raw(hull(pts), f.side ?? col.right);
      api.disc(e, axis, r, f.cap ?? col.top);
      return e;
    },
    sphere(c, r, fill = col.top, o = {}) {
      const [sx, sy] = P(...c);
      els.push({ t: 'circle', c: [sx, sy], r: r * 1.2247, fill, ...o });
    },
    dots(pts3, o = {}) { line(pts3, { dash: '0 7', sw: 2.6, ...o }); },
  };
  return api;
}

function hull(pts) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length > 1 && cr(lo.at(-2), lo.at(-1), q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (up.length > 1 && cr(up.at(-2), up.at(-1), q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

export function emit(els, { W = 720, H = 450, maxW = 560, maxH = 320, sw = 2 } = {}) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const e of els) {
    const pts = e.t === 'circle' ? [[e.c[0] - e.r, e.c[1] - e.r], [e.c[0] + e.r, e.c[1] + e.r]] : e.pts;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  }
  const k = Math.min(maxW / (x1 - x0), maxH / (y1 - y0));
  const ox = W / 2 - ((x0 + x1) / 2) * k, oy = H / 2 - ((y0 + y1) / 2) * k + 4;
  const T = ([x, y]) => `${(x * k + ox).toFixed(2)} ${(y * k + oy).toFixed(2)}`;
  const body = els.map(e => {
    const stroke = e.stroke ?? col.ink, w = (e.sw ?? sw);
    const common = `stroke="${stroke}" stroke-width="${w}"${e.dash ? ` stroke-dasharray="${e.dash}"` : ''}${e.opacity ? ` opacity="${e.opacity}"` : ''}`;
    if (e.t === 'circle') return `<circle cx="${(e.c[0] * k + ox).toFixed(2)}" cy="${(e.c[1] * k + oy).toFixed(2)}" r="${(e.r * k).toFixed(2)}" fill="${e.fill}" ${common}/>`;
    const d = 'M' + e.pts.map(T).join('L') + (e.t === 'poly' ? 'Z' : '');
    return `<path d="${d}" fill="${e.t === 'poly' ? e.fill : 'none'}" ${common}/>`;
  }).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<defs><filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0.35  0 0 0 0 0.3  0 0 0 0 0.22  0 0 0 0.10 0"/></filter></defs>
<rect width="${W}" height="${H}" fill="${col.paper}"/>
<g stroke-linecap="round" stroke-linejoin="round">
${body}
</g>
<rect width="${W}" height="${H}" filter="url(#grain)"/>
</svg>`;
}
