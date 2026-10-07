// Animated isometric model of the 1434 Jagyeokru water clock, after the
// Veritable Records of King Sejong (year 16, 7th month, 1st day).
// Everything runs off one simulated clock. Water levels, the float rods and
// which balls are still loaded are pure functions of it, so scrubbing never
// replays events. Ball chains only start when playback crosses an event.
(() => {
    "use strict";

    const svg = document.getElementById("jgr-svg");
    if (!svg) return;

    const NS = "http://www.w3.org/2000/svg";
    const K = 1.5;
    const COS30 = Math.cos(Math.PI / 6);
    // Semi-axes of a horizontal unit circle seen in isometric projection.
    const ER = [Math.SQRT2 * COS30 * K, Math.SQRT2 * 0.5 * K];
    const iso = (x, y, z = 0) => [(x - y) * COS30 * K, ((x + y) * 0.5 - z) * K];

    const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
    const span = (f, a, b) => clamp((f - a) / (b - a));
    // 0 → 1 → 0 over [a, c], peaking at b.
    const bump = (f, a, b, c) => (f <= a || f >= c ? 0 : f < b ? ease((f - a) / (b - a)) : 1 - ease((f - b) / (c - b)));

    const r1 = (n) => String(Math.round(n * 10) / 10);
    const xy = (p) => `${r1(p[0])} ${r1(p[1])}`;
    const poly = (pts) => `M${pts.map(xy).join("L")}Z`;
    const polyline = (pts) => `M${pts.map(xy).join("L")}`;
    const wpath = (pts3) => polyline(pts3.map((p) => iso(...p)));

    const make = (tag, attrs = {}, parent = null, text = null) => {
        const node = document.createElementNS(NS, tag);
        for (const [key, value] of Object.entries(attrs)) {
            if (value != null) node.setAttribute(key, typeof value === "number" ? r1(value) : value);
        }
        if (text != null) node.textContent = text;
        if (parent) parent.append(node);
        return node;
    };
    const set = (node, attrs) => {
        for (const [key, value] of Object.entries(attrs)) {
            node.setAttribute(key, typeof value === "number" ? r1(value) : value);
        }
    };

    // ---------------------------------------------------------------- time

    // The 12 double-hours (時), named for the earthly branches, from 23:00,
    // and the night's five watches (更) of five points (點), written the way
    // the Records write them. The English goes to screen readers.
    const HOURS = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
    const HOURS_EN = ["Rat", "Ox", "Tiger", "Rabbit", "Dragon", "Snake", "Horse", "Sheep", "Monkey", "Rooster", "Dog", "Pig"];
    const ORDINALS = ["初", "二", "三", "四", "五"];
    const ORDINALS_EN = ["first", "second", "third", "fourth", "fifth"];
    // t counts hours from 05:00 on the first day. A receiver fills from 05:00
    // to 05:00; the sources only say the two receivers alternate.
    const RUN_START = 5;
    // Simplification, stated on the page: five equal two-hour watches from
    // 19:00, each split into five points. The real watches followed the season.
    const NIGHT_START = 19 - RUN_START;
    const POINT_HOURS = 0.4;
    const DRAIN_HOURS = 2.5;
    const SWING_HOURS = 0.25;

    const SI_EVENTS = Array.from({ length: 12 }, (_, i) => 2 * i);
    const NIGHT_EVENTS = Array.from({ length: 25 }, (_, k) => NIGHT_START + POINT_HOURS * k);
    const isWatch = (k) => k % 5 === 0;
    const laneOfNight = (k) => (isWatch(k) ? 1 : 2);

    const clockOf = (t) => (((RUN_START + t) % 24) + 24) % 24;
    const hourIndexOf = (clock) => Math.floor(((clock + 1) % 24) / 2);
    const runOf = (t) => Math.floor(t / 24);
    const offsetOf = (t) => t - 24 * runOf(t);

    // ------------------------------------------------------------ layout

    // World units, z up. Water runs left to right, then into the tower.
    const SUPPLY = [
        { c: [40, 40], z: 313, r: 34, h: 50, level: 0.82, ped: [[0, 0], [80, 80]] },
        { c: [114, 40], z: 263, r: 26, h: 38, level: 0.74, ped: [[86, 12], [56, 56]] },
        { c: [170, 40], z: 220, r: 21, h: 31, level: 0.7, ped: [[148, 19], [44, 42]] },
        { c: [215, 40], z: 182, r: 15, h: 26, level: 0.66, ped: [[198, 25], [34, 30]] },
    ];
    const RECEIVER = { r: 16, h: 130, z: 28 };
    const RECEIVERS = [
        { name: "A", c: [262, 40] },
        { name: "B", c: [316, 40] },
    ];
    const ROD_LENGTH = 142;
    const rodTipZ = (level) => RECEIVER.z + level * RECEIVER.h + ROD_LENGTH;
    const COLUMN = { x: 282, y: 33, w: 14, d: 14 };
    COLUMN.h = rodTipZ(1) + 16;
    const PLATE_U = [3.6, 10.4];
    const PIVOT = [238, 8, 186];
    const troughEnd = (i) => [RECEIVERS[i].c[0] - 2, RECEIVERS[i].c[1] - 6, 170];

    // The east bay seat, as a cutaway. The machinery sits on one vertical
    // plane (y = PY) so each part has its own height and nothing hides.
    const T = { x: 384, y: -170, w: 294, d: 96 };
    const PY = T.y + 70;
    const FLOOR_MID = 166;
    const FLOOR_TOP = 232;
    const T_TOP = 338;
    const TUBES = [{ z0: 146, end: 146 }, { z0: 104, end: 188 }];
    const LANES = [{ z0: 128, exit: 150 }, { z0: 80, exit: 205 }, { z0: 46, exit: 260 }];
    const tubeZ = (tube, u) => TUBES[tube].z0 - 0.06 * u;
    const laneZ = (lane, u) => LANES[lane].z0 - 0.05 * u;
    const spoonZ = (lane) => laneZ(lane, LANES[lane].exit) - 14;
    const rodU = (lane) => LANES[lane].exit + 18;
    const siU = (i) => 14 + 11 * i;
    const nightU = (k) => 12 + 7 * k;
    const ballU = (lane, index) => (lane === 0 ? siU(index) : nightU(index));
    const SHELF_DY = -8;
    const P = (u, z, dy = 0) => [T.x + u, PY + dy, z];
    const WHEEL = { c: [T.x + 68, T.y + 36], r: 36, z: 150, rise: 30 };
    const FRONT = Math.PI / 4;
    const wheelFront = [WHEEL.c[0] + Math.cos(FRONT) * WHEEL.r, WHEEL.c[1] + Math.sin(FRONT) * WHEEL.r];
    const BEAM = { north: P(162, 14, -14), south: [wheelFront[0], wheelFront[1], 14] };

    // ---------------------------------------------------------- drawing

    const flows = [];
    const layers = {};
    for (const name of ["back", "scene", "tower", "mech", "balls", "front", "labels"]) {
        layers[name] = make("g", { class: `layer-${name}` }, svg);
    }

    function box(parent, [x, y, z], [w, d, h], cls = "face", hidden = false) {
        const g = make("g", {}, parent);
        const A = (dx, dy, dz) => iso(x + dx, y + dy, z + dz);
        if (hidden) {
            make("path", { class: "edge-hidden", d: polyline([A(w, 0, 0), A(0, 0, 0), A(0, d, 0)]) + polyline([A(0, 0, 0), A(0, 0, h)]) }, g);
        }
        make("path", { class: cls, d: poly([A(0, d, 0), A(w, d, 0), A(w, d, h), A(0, d, h)]) }, g);
        make("path", { class: cls, d: poly([A(w, 0, 0), A(w, d, 0), A(w, d, h), A(w, 0, h)]) }, g);
        make("path", { class: cls, d: poly([A(0, 0, h), A(w, 0, h), A(w, d, h), A(0, d, h)]) }, g);
        return g;
    }

    function vessel(parent, { c: [x, y], z, r, h }) {
        const g = make("g", { class: "vessel" }, parent);
        const [rx, ry] = [r * ER[0], r * ER[1]];
        const at = (zz) => iso(x, y, zz);
        const [bx, by] = at(z);
        const [tx, ty] = at(z + h);
        const A = `A${r1(rx)} ${r1(ry)} 0 0`;
        make("path", { class: "edge-hidden", d: `M${xy([bx - rx, by])}${A} 1 ${xy([bx + rx, by])}` }, g);
        const water = make("path", { class: "water" }, g);
        const hatch = make("path", { class: "water-hatch" }, g);
        const surface = make("ellipse", { class: "water-edge", cx: bx, cy: by, rx, ry }, g);
        const inner = make("g", {}, g);
        make("path", { class: "wall", d: `M${xy([tx - rx, ty])}L${xy([bx - rx, by])}${A} 0 ${xy([bx + rx, by])}L${xy([tx + rx, ty])}` }, g);
        make("ellipse", { class: "wall", cx: tx, cy: ty, rx, ry }, g);
        let last = -1;
        return {
            inner,
            set(level) {
                level = clamp(level);
                if (Math.abs(level - last) < 1e-4) return;
                last = level;
                if (level < 0.004) {
                    water.setAttribute("d", "");
                    hatch.setAttribute("d", "");
                    surface.setAttribute("visibility", "hidden");
                    return;
                }
                const [lx, ly] = at(z + h * level);
                const side = `M${xy([lx - rx, ly])}L${xy([bx - rx, by])}${A} 0 ${xy([bx + rx, by])}L${xy([lx + rx, ly])}`;
                water.setAttribute("d", `${side}${A} 0 ${xy([lx - rx, ly])}Z`);
                hatch.setAttribute("d", `${side}${A} 1 ${xy([lx - rx, ly])}Z`);
                set(surface, { cy: ly });
                surface.removeAttribute("visibility");
            },
        };
    }

    function pipe(parent, pts3) {
        const d = wpath(pts3);
        const g = make("g", { class: "pipe" }, parent);
        const paths = ["pipe-outer", "pipe-inner", "pipe-water", "pipe-flow"].map((cls) => make("path", { class: cls, d }, g));
        flows.push(paths[3]);
        return paths;
    }

    function stream(parent, from, to) {
        const node = make("path", { class: "stream", d: from ? wpath([from, to]) : "" }, parent);
        flows.push(node);
        return node;
    }

    // A group lying in the world plane y = y0: local (u, v) is (x - x0, -z),
    // so marks drawn in it are foreshortened like the faces of the boxes.
    function plane(parent, x0, y0) {
        const [ox, oy] = iso(x0, y0, 0);
        return make("g", { class: "plane", transform: `matrix(${r1(COS30 * K)} ${r1(0.5 * K)} 0 ${K} ${r1(ox)} ${r1(oy)})` }, parent);
    }

    const scene = layers.scene;

    // ---- supply vessels on stepped stands
    for (const s of SUPPLY) {
        box(scene, [s.ped[0][0], s.ped[0][1], 0], [s.ped[1][0], s.ped[1][1], s.z]);
        vessel(scene, s).set(s.level);
    }
    for (let i = 0; i < SUPPLY.length - 1; i += 1) {
        const a = SUPPLY[i];
        const b = SUPPLY[i + 1];
        const zSpout = a.z + 6;
        const xEnd = b.c[0] - b.r * 0.35;
        pipe(scene, [[a.c[0] + a.r - 3, a.c[1], zSpout], [xEnd, a.c[1], zSpout], [xEnd, a.c[1], zSpout - 6]]);
        stream(scene, [xEnd, a.c[1], zSpout - 8], [xEnd, b.c[1], b.z + b.h * b.level]);
    }
    const lastSupply = SUPPLY[SUPPLY.length - 1];
    pipe(scene, [[lastSupply.c[0] + lastSupply.r - 3, lastSupply.c[1], lastSupply.z + 6], [PIVOT[0], lastSupply.c[1], PIVOT[2]], PIVOT]);

    // ---- receivers, the swinging spout, float rods and the plate column
    // Paint order follows depth: A, spout, column, B.
    for (const rcv of RECEIVERS) box(scene, [rcv.c[0] - 18, rcv.c[1] - 18, 0], [36, 36, RECEIVER.z]);
    const makeReceiver = (rcv) => {
        const v = vessel(scene, { c: rcv.c, z: RECEIVER.z, r: RECEIVER.r, h: RECEIVER.h });
        const rod = make("path", { class: "rod" }, v.inner);
        const float = make("ellipse", { class: "float", rx: 9 * ER[0], ry: 9 * ER[1] }, v.inner);
        const ticks = make("path", { class: "rod-ticks" }, v.inner);
        return { v, rod, float, ticks, rcv };
    };
    const receiverA = makeReceiver(RECEIVERS[0]);
    const streamA = stream(scene);
    const trough = pipe(scene, [PIVOT, troughEnd(0)]);
    const columnG = make("g", { class: "column" }, scene);
    const receiverB = makeReceiver(RECEIVERS[1]);
    const streamB = stream(scene);
    const receiverParts = [receiverA, receiverB];

    box(columnG, [COLUMN.x, COLUMN.y, 0], [COLUMN.w, COLUMN.d, COLUMN.h]);
    const plateG = plane(columnG, COLUMN.x, COLUMN.y + COLUMN.d);
    for (const u of PLATE_U) {
        make("rect", { class: "plate", x: u - 2.6, y: -rodTipZ(1) - 6, width: 5.2, height: rodTipZ(1) - rodTipZ(0) + 12 }, plateG);
    }
    const plateBalls = {
        si: SI_EVENTS.map((off) => make("circle", { class: "plate-ball", cx: PLATE_U[0], cy: -rodTipZ(off / 24), r: 1.9 }, plateG)),
        night: NIGHT_EVENTS.map((off, k) => make("circle", { class: "plate-ball", cx: PLATE_U[1], cy: -rodTipZ(off / 24), r: isWatch(k) ? 1.6 : 1.1 }, plateG)),
    };
    const pointerLine = make("path", { class: "pointer" }, layers.front);
    const pointerBar = make("path", { class: "pointer" }, layers.front);
    const pointerTip = make("circle", { class: "pointer-tip", r: 4.5 }, layers.front);

    // ---- chute from the column to the tower (the slanted board)
    const CHUTE = [[COLUMN.x + 7, COLUMN.y, 158], [COLUMN.x + 14, 10, 155], [T.x - 6, PY, 150]];
    const chuteD = wpath(CHUTE);
    make("path", { class: "chute-outer", d: chuteD }, layers.back);
    make("path", { class: "chute-inner", d: chuteD }, layers.back);

    // ---- tower
    const tower = layers.tower;
    const TA = (dx, dy, z) => iso(T.x + dx, T.y + dy, z);
    make("path", { class: "edge-hidden", d: polyline([TA(0, 0, 0), TA(0, 0, T_TOP)]) + polyline([TA(T.w, 0, 0), TA(0, 0, 0), TA(0, T.d, 0)]) }, layers.back);
    make("path", { class: "glass", d: polyline([TA(0, T.d, T_TOP), TA(0, 0, T_TOP), TA(T.w, 0, T_TOP)]) }, layers.back);
    box(tower, [T.x, T.y, 0], [T.w, T.d, 6]);

    // The wheel of twelve hour figures, hidden under the middle floor.
    const wheelG = make("g", { class: "wheel" }, tower);
    {
        const [cx, cy] = iso(WHEEL.c[0], WHEEL.c[1], WHEEL.z);
        make("ellipse", { class: "wheel-ring", cx, cy, rx: WHEEL.r * ER[0], ry: WHEEL.r * ER[1] }, wheelG);
        make("ellipse", { class: "wheel-hub", cx, cy, rx: 7 * ER[0], ry: 7 * ER[1] }, wheelG);
    }
    const wheelGods = HOURS.map(() => {
        const g = make("g", { class: "wheel-god" }, wheelG);
        return { g, stem: make("path", { class: "wheel-stem" }, g), head: make("circle", { class: "wheel-head", r: 3.2 }, g) };
    });

    // Machinery on the cutaway plane: copper tubes, iron-ball lanes, spoons.
    const mech = layers.mech;
    const mp = plane(mech, T.x, PY);
    const shelf = plane(mech, T.x, PY + SHELF_DY);
    const tubeHoles = [[], []];
    TUBES.forEach((tube, ti) => {
        make("path", { class: "tube", d: `M-6 ${r1(-tubeZ(ti, -6) - 3)}L${tube.end} ${r1(-tubeZ(ti, tube.end) - 3)}M-6 ${r1(-tubeZ(ti, -6) + 3)}L${tube.end} ${r1(-tubeZ(ti, tube.end) + 3)}M${tube.end} ${r1(-tubeZ(ti, tube.end) - 3)}v6` }, mp);
        const count = ti === 0 ? 12 : 25;
        for (let i = 0; i < count; i += 1) {
            const u = ti === 0 ? siU(i) : nightU(i);
            tubeHoles[ti].push(make("path", { class: "hole", d: `M${r1(u - 2)} ${r1(-tubeZ(ti, u) + 3)}h4` }, mp));
        }
    });
    LANES.forEach((lane, li) => {
        const u0 = ballU(li, 0) - 9;
        make("path", { class: "lane", d: `M${r1(u0)} ${r1(-laneZ(li, u0) - 6)}V${r1(-laneZ(li, u0))}L${lane.exit + 5} ${r1(-laneZ(li, lane.exit + 5))}` }, mp);
        make("path", { class: "lane-back", d: `M${r1(u0)} ${r1(-laneZ(li, u0))}L${lane.exit - 4} ${r1(-laneZ(li, lane.exit - 4))}` }, shelf);
        // short tube under the exit, down to the spoon
        make("path", { class: "tube", d: `M${lane.exit - 3} ${r1(-laneZ(li, lane.exit))}V${r1(-spoonZ(li) - 5)}M${lane.exit + 7} ${r1(-laneZ(li, lane.exit + 7))}V${r1(-spoonZ(li) - 5)}` }, mp);
    });
    // Iron balls wait on a shelf just behind their lane.
    const laneBalls = [[], [], []];
    for (let i = 0; i < 12; i += 1) {
        const [x, y] = iso(...P(siU(i), laneZ(0, siU(i)) + 4, SHELF_DY));
        laneBalls[0][i] = make("circle", { class: "ball-big", cx: x, cy: y, r: 3.6 * K }, mech);
    }
    for (let k = 0; k < 25; k += 1) {
        const lane = laneOfNight(k);
        const [x, y] = iso(...P(nightU(k), laneZ(lane, nightU(k)) + 3.4, SHELF_DY));
        laneBalls[lane][k] = make("circle", { class: "ball-big", cx: x, cy: y, r: (lane === 1 ? 3.6 : 3) * K }, mech);
    }
    // What each lane counts, written at its upper end.
    [["時", "×12"], ["更", "×5"], ["點", "×20"]].forEach(([unit, count], lane) => {
        const u = ballU(lane, lane === 2 ? 1 : 0) - 12;
        const [x, y] = iso(...P(u, laneZ(lane, u) + 2, SHELF_DY));
        const tag = make("text", { class: "tag", x, y: y + 4, "text-anchor": "end" }, mech);
        make("tspan", { class: "han", lang: "ko" }, tag, unit);
        tag.append(` ${count}`);
    });
    const spoons = LANES.map((lane, li) => {
        const pivot = iso(...P(lane.exit + 8, spoonZ(li)));
        const arm = make("path", { class: "spoon" }, mech);
        const cup = make("circle", { class: "spoon-cup", r: 3.4 }, mech);
        make("circle", { class: "pivot", cx: pivot[0], cy: pivot[1], r: 2.6 }, mech);
        const push = make("path", { class: "push-rod" }, mech);
        return { arm, cup, push };
    });

    // The beam that lifts the hour's figure off the wheel.
    const beam = make("path", { class: "beam" }, mech);
    const beamPost = make("path", { class: "push-rod" }, mech);
    {
        const mid = BEAM.north.map((v, i) => (v + BEAM.south[i]) / 2);
        make("path", { class: "pivot-post", d: wpath([mid, [mid[0], mid[1], 6]]) }, mech);
    }

    // Floors. The hour's figure stands on the middle floor with its plaque.
    // It is drawn after the top floor so the plaque stays readable through it.
    box(tower, [T.x, T.y, FLOOR_MID], [T.w, T.d, 6], "floor");
    box(tower, [T.x, T.y, FLOOR_TOP], [T.w, T.d, 6], "floor");
    const hourGod = make("g", { class: "hour-god" }, tower);
    {
        const g = make("g", { transform: "scale(1.25)" }, hourGod);
        make("path", { class: "figure", d: "M-6 0 L-4.5 -17 L4.5 -17 L6 0 Z" }, g);
        make("path", { class: "figure-line", d: "M-4.6 -8.5 H4.6" }, g);
        make("circle", { class: "figure", cx: 0, cy: -21.5, r: 4.4 }, g);
        make("path", { class: "figure-cap", d: "M-4.8 -25 h9.6 v-3.4 h-9.6 Z" }, g);
        make("path", { class: "figure-line", d: "M3.5 -12 L9 -17" }, g);
        make("rect", { class: "plaque", x: 5, y: -40, width: 14, height: 14, rx: 1.5 }, g);
    }
    const plaqueText = make("text", { class: "plaque-text", x: 15, y: -41.2, "text-anchor": "middle", "dominant-baseline": "central", lang: "ko" }, hourGod, HOURS[0]);

    // The three wooden figures: bell for the hour, drum for the watch, gong for the point.
    const figures = LANES.map((_, k) => {
        const base = iso(...P(rodU(k) + 4, FLOOR_TOP + 6));
        const g = make("g", { class: "god", transform: `translate(${xy(base)}) scale(1.4)` }, layers.front);
        const ix = -27;
        const inst = make("g", { class: "instrument" }, g);
        if (k === 0) {
            make("path", { class: "frame", d: `M${ix - 14} 0 V-52 H${ix + 14} V0 M${ix} -52 V-47` }, inst);
            make("path", { class: "bell-body", d: `M${ix - 7} -46 Q${ix - 8} -38 ${ix - 9} -28 L${ix - 10.5} -23 H${ix + 10.5} L${ix + 9} -28 Q${ix + 8} -38 ${ix + 7} -46 Q${ix} -50 ${ix - 7} -46 Z` }, inst);
            make("path", { class: "frame", d: `M${ix - 9} -30 H${ix + 9}` }, inst);
        } else if (k === 1) {
            make("path", { class: "frame", d: `M${ix - 12} 0 L${ix - 6} -18 M${ix + 12} 0 L${ix + 6} -18` }, inst);
            make("ellipse", { class: "drum-body", cx: ix, cy: -29, rx: 12, ry: 13 }, inst);
            make("ellipse", { class: "drum-face", cx: ix + 5, cy: -29, rx: 6.5, ry: 12 }, inst);
        } else {
            make("path", { class: "frame", d: `M${ix - 14} 0 V-54 H${ix + 14} V0 M${ix - 5} -54 L${ix - 3} -46 M${ix + 5} -54 L${ix + 3} -46` }, inst);
            make("ellipse", { class: "gong-body", cx: ix, cy: -33, rx: 10.5, ry: 12 }, inst);
            make("ellipse", { class: "gong-boss", cx: ix, cy: -33, rx: 3.6, ry: 4.2 }, inst);
        }
        make("text", { class: "tag", x: ix, y: 11, "text-anchor": "middle" }, inst, ["bell", "drum", "gong"][k]);
        const waves = make("g", { class: "waves", transform: `translate(${ix} -33)`, opacity: 0 }, inst);
        for (const radius of [17, 24, 31]) {
            make("path", { class: "wave", d: `M${r1(-radius * 0.5)} ${r1(-radius * 0.86)}A${radius} ${radius} 0 0 0 ${r1(-radius * 0.5)} ${r1(radius * 0.86)}` }, waves);
        }
        // robe, belt, head and cap; the arm holds a mallet
        make("path", { class: "figure", d: "M-9 0 L-6.5 -26 L6.5 -26 L9 0 Z" }, g);
        make("path", { class: "figure-line", d: "M-7.6 -13 H7.6" }, g);
        make("circle", { class: "figure", cx: 0, cy: -31.5, r: 5.6 }, g);
        make("path", { class: "figure-cap", d: "M-6 -36 h12 v-4.5 h-12 Z M-9.5 -38 h3.5 M6 -38 h3.5" }, g);
        const arm = make("g", { class: "arm", transform: "translate(-5 -23)" }, g);
        make("path", { class: "figure-line", d: "M0 0 L-9 5 L-14 -2" }, arm);
        make("circle", { class: "mallet", cx: -15, cy: -4, r: 2.8 }, arm);
        return { g, arm, waves };
    });

    // Front posts last, so the cutaway reads as an open frame.
    make("path", { class: "post", d: polyline([TA(0, T.d, 0), TA(0, T.d, T_TOP), TA(T.w, T.d, T_TOP), TA(T.w, 0, T_TOP), TA(T.w, 0, 0)]) }, layers.front);
    make("path", { class: "post", d: polyline([TA(T.w, T.d, 0), TA(T.w, T.d, T_TOP)]) }, layers.front);
    // A plain hip roof, so the frame reads as the Borugak pavilion.
    {
        const e = 14;
        const ridgeZ = T_TOP + 46;
        const eave = (dx, dy) => TA(dx, dy, T_TOP);
        const ridge = [TA(54, T.d / 2, ridgeZ), TA(T.w - 54, T.d / 2, ridgeZ)];
        const front = poly([eave(-e, T.d + e), eave(T.w + e, T.d + e), ridge[1], ridge[0]]);
        const side = poly([eave(T.w + e, -e), eave(T.w + e, T.d + e), ridge[1]]);
        make("path", { class: "edge-hidden", d: polyline([eave(-e, T.d + e), eave(-e, -e), eave(T.w + e, -e)]) + polyline([eave(-e, -e), ridge[0]]) }, layers.front);
        make("path", { class: "roof", d: front }, layers.front);
        make("path", { class: "roof", d: side }, layers.front);
        make("path", { class: "roof-line", d: polyline([eave(-e, T.d + e), ridge[0]]) }, layers.front);
    }

    // ---------------------------------------------------- labels

    const CALLOUTS = [
        { at: [40, 40, 368], dx: -20, dy: -40, text: "Supply vessels ×4" },
        { at: [262, 40, 110], dx: -86, dy: 112, text: "Receivers A · B" },
        { at: [COLUMN.x + 7, COLUMN.y + COLUMN.d, COLUMN.h - 8], dx: 66, dy: -210, text: "Float rod · copper plates" },
        { at: [...P(80, tubeZ(1, 80))], dx: -133, dy: 206, text: "Copper tubes · iron balls 12 · 5 · 20" },
        { at: [...P(LANES[2].exit + 8, spoonZ(2))], dx: 34, dy: 64, text: "Spoon levers" },
        { at: [...P(rodU(1), FLOOR_TOP + 60)], dx: 82, dy: -242, text: "Bell · drum · gong figures" },
        { at: [WHEEL.c[0] - WHEEL.r * 0.7, WHEEL.c[1] + WHEEL.r * 0.7, WHEEL.z], dx: -40, dy: -150, text: "Wheel of 12 hour figures" },
        { at: [PIVOT[0] + 20, PIVOT[1] + 8, PIVOT[2] - 8], dx: 126, dy: 211, text: "A ↔ B switch" },
    ];
    const calloutNodes = CALLOUTS.map((c, i) => {
        const [ax, ay] = iso(...c.at);
        const lx = ax + c.dx;
        const ly = ay + c.dy;
        const g = make("g", { class: "callout" }, layers.labels);
        make("path", { class: "leader", d: `M${xy([ax, ay])}L${xy([lx, ly])}` }, g);
        make("circle", { class: "leader-dot", cx: ax, cy: ay, r: 2.5 }, g);
        make("circle", { class: "badge", cx: lx, cy: ly, r: 12 }, g);
        make("text", { class: "badge-text", x: lx, y: ly + 4.5, "text-anchor": "middle" }, g, String(i + 1));
        const right = c.dx >= 0;
        make("text", { class: "callout-text", x: lx + (right ? 18 : -18), y: ly + 4.5, "text-anchor": right ? "start" : "end" }, g, c.text);
        return g;
    });

    // ------------------------------------------------- ball routes

    class Route {
        constructor(pts3) {
            this.pts = pts3.map((p) => iso(...p));
            this.len = [0];
            for (let i = 1; i < this.pts.length; i += 1) {
                const [a, b] = [this.pts[i - 1], this.pts[i]];
                this.len.push(this.len[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
            }
        }
        at(f) {
            const target = clamp(f) * this.len[this.len.length - 1];
            let i = 1;
            while (i < this.len.length - 1 && this.len[i] < target) i += 1;
            const seg = this.len[i] - this.len[i - 1] || 1;
            const t = (target - this.len[i - 1]) / seg;
            return [lerp(this.pts[i - 1][0], this.pts[i][0], t), lerp(this.pts[i - 1][1], this.pts[i][1], t)];
        }
    }

    const faceY = COLUMN.y + COLUMN.d;
    const smallRoute = (plateU, zHole, tube, u, lane) => new Route([
        [COLUMN.x + plateU, faceY, zHole],
        [COLUMN.x + plateU, faceY, 162],
        ...CHUTE,
        P(-4, tubeZ(tube, -4) + 2),
        P(u, tubeZ(tube, u) + 2),
        P(u, laneZ(lane, u) + 12, SHELF_DY / 2),
    ]);
    const bigRoute = (lane, u) => new Route([
        P(u, laneZ(lane, u) + 4, SHELF_DY),
        P(u + 5, laneZ(lane, u + 5) + 4),
        P(LANES[lane].exit + 2, laneZ(lane, LANES[lane].exit + 2) + 4),
        P(LANES[lane].exit + 2, spoonZ(lane) + 4),
    ]);
    const spoonCup = (lane) => P(LANES[lane].exit + 1, spoonZ(lane) + 4);
    const ONWARD = [
        // hour ball: down behind the lanes onto the north end of the beam
        new Route([spoonCup(0), P(LANES[0].exit + 4, spoonZ(0) - 4, -12), [BEAM.north[0], BEAM.north[1], BEAM.north[2] + 5]]),
        // watch ball: on into the point tube, onto the first-point spoon
        new Route([spoonCup(1), P(LANES[1].exit + 12, spoonZ(1) - 8), spoonCup(2)]),
        // point ball: into the lotus-leaf tube, where it stops
        new Route([spoonCup(2), P(LANES[2].exit + 6, 8, -6)]),
    ];

    // ----------------------------------------------------- chains

    // Fractions of one chain's duration. The captions follow these.
    const STAGE = { small: [0, 0.38], latch: 0.4, big: [0.42, 0.6], spoon: [0.6, 0.72], strike: [0.63, 0.84], onward: [0.72, 0.84], wheel: [0.8, 1] };
    const stepOf = (f, type) => {
        if (f < 0.1) return 3;
        if (f < STAGE.big[0]) return 4;
        if (f < STAGE.spoon[0]) return 5;
        if (type === "si" && f >= STAGE.wheel[0]) return 7;
        return 6;
    };
    let chains = [];

    function spawn(type, run, index, start, dur) {
        const lane = type === "si" ? 0 : laneOfNight(index);
        const tube = type === "si" ? 0 : 1;
        const zHole = rodTipZ((type === "si" ? SI_EVENTS : NIGHT_EVENTS)[index] / 24);
        const u = ballU(lane, index);
        chains.push({
            type, run, index, lane, start, dur,
            small: smallRoute(PLATE_U[tube], zHole, tube, u, lane),
            big: bigRoute(lane, u),
            smallNode: make("circle", { class: "ball-small is-live", r: 2.6 * K, opacity: 0 }, layers.balls),
            bigNode: make("circle", { class: "ball-big is-live", r: 3.6 * K, opacity: 0 }, layers.balls),
        });
        if (chains.length > 40) retire(chains[0]);
    }
    function retire(chain) {
        chain.smallNode.remove();
        chain.bigNode.remove();
        chains = chains.filter((c) => c !== chain);
    }

    // ------------------------------------------------------- state

    const $ = (id) => document.getElementById(id);
    const ui = {
        play: $("jgr-play"),
        speeds: [...document.querySelectorAll("[data-jgr-speed]")],
        views: [...document.querySelectorAll("[data-jgr-view]")],
        scrub: $("jgr-scrub"),
        hour: $("jgr-hour"),
        hourName: $("jgr-hour-name"),
        watch: $("jgr-watch"),
        reading: $("jgr-reading"),
        clock: $("jgr-clock"),
        vessel: $("jgr-vessel"),
        steps: [...document.querySelectorAll("[data-jgr-step]")],
        figure: svg.closest("figure"),
    };

    const HOURS_PER_SECOND = 1 / 6; // at 1×, one double-hour every 12 s
    const state = {
        t: 17.88, // 22:53 on the first night, just before the 3rd watch and the Rat
        anim: 0,
        speed: 1,
        playing: false,
        visible: true,
        swapAt: -Infinity,
    };
    const chainSeconds = () => 4.4 / clamp(state.speed, 0.5, 3);

    function crossEvents(t0, t1) {
        if (t1 <= t0 || t1 - t0 > 12) return;
        for (let run = runOf(t0); run <= runOf(t1); run += 1) {
            const base = 24 * run;
            SI_EVENTS.forEach((off, i) => {
                if (base + off > t0 && base + off <= t1) {
                    spawn("si", run, i, state.anim, chainSeconds());
                    if (i === 0) state.swapAt = state.anim;
                }
            });
            NIGHT_EVENTS.forEach((off, k) => {
                if (base + off > t0 && base + off <= t1) spawn(isWatch(k) ? "watch" : "point", run, k, state.anim, chainSeconds());
            });
        }
    }

    // ------------------------------------------------------ render

    function render() {
        const t = state.t;
        const run = runOf(t);
        const off = offsetOf(t);
        const p = off / 24;
        const active = run % 2;
        const clock = clockOf(t);

        // receivers and rods; the full one drains after the switch
        const levels = [0, 0];
        levels[active] = p;
        levels[1 - active] = run > 0 && off < DRAIN_HOURS ? 1 - ease(off / DRAIN_HOURS) : 0;
        receiverParts.forEach((part, i) => {
            part.v.set(levels[i]);
            const [x, y] = part.rcv.c;
            const floatZ = RECEIVER.z + levels[i] * RECEIVER.h + 2;
            const tip = rodTipZ(levels[i]);
            set(part.rod, { d: wpath([[x, y, floatZ], [x, y, tip]]) });
            const [fx, fy] = iso(x, y, floatZ);
            set(part.float, { cx: fx, cy: fy });
            let ticks = "";
            for (let j = 1; j < 12; j += 1) {
                const [tx, ty] = iso(x, y, tip - (j / 12) * ROD_LENGTH * 0.92);
                ticks += `M${xy([tx - (j % 2 ? 2.5 : 4.5), ty])}h${j % 2 ? 5 : 9}`;
            }
            set(part.ticks, { d: ticks });
        });

        // the rod's crossbar against the plates
        const rcv = RECEIVERS[active].c;
        const tipZ = rodTipZ(p);
        const tipPt = iso(rcv[0], rcv[1], tipZ);
        const barA = iso(COLUMN.x, faceY, tipZ);
        const barB = iso(COLUMN.x + COLUMN.w, faceY, tipZ);
        const edge = active === 0 ? [COLUMN.x, rcv[1] + 4, tipZ] : [COLUMN.x + COLUMN.w, rcv[1] + 4, tipZ];
        set(pointerLine, { d: polyline([tipPt, iso(...edge), active === 0 ? barA : barB]) });
        set(pointerBar, { d: polyline([barA, barB]) });
        set(pointerTip, { cx: tipPt[0], cy: tipPt[1] });

        // the spout swings to the receiver in use
        const swing = run > 0 && off < SWING_HOURS ? ease(off / SWING_HOURS) : 1;
        const from = troughEnd(1 - active);
        const to = troughEnd(active);
        const end = [lerp(from[0], to[0], swing), lerp(from[1], to[1], swing), to[2]];
        const troughD = wpath([PIVOT, end]);
        for (const node of trough) node.setAttribute("d", troughD);
        const pour = swing > 0.98 ? wpath([[end[0], end[1], end[2] - 4], [end[0], end[1], RECEIVER.z + RECEIVER.h * p + 1]]) : "";
        streamA.setAttribute("d", active === 0 ? pour : "");
        streamB.setAttribute("d", active === 1 ? pour : "");

        // plate balls and tube holes are used up as their events pass
        SI_EVENTS.forEach((e, i) => {
            plateBalls.si[i].classList.toggle("is-gone", e <= off);
            tubeHoles[0][i].classList.toggle("is-closed", e <= off);
        });
        NIGHT_EVENTS.forEach((e, k) => {
            plateBalls.night[k].classList.toggle("is-gone", e <= off);
            tubeHoles[1][k].classList.toggle("is-closed", e <= off);
        });

        // chains in flight
        const spoonTilt = [0, 0, 0];
        const strike = [0, 0, 0];
        const waiting = new Set();
        let beamPress = 0;
        let wheelChain = null;
        let latest = null;
        for (const chain of [...chains]) {
            const f = (state.anim - chain.start) / chain.dur;
            if (f >= 1) {
                retire(chain);
                continue;
            }
            latest = chain;
            const sp = chain.small.at(ease(span(f, ...STAGE.small)));
            set(chain.smallNode, { cx: sp[0], cy: sp[1], opacity: f < STAGE.latch ? 1 : 0 });
            if (f < STAGE.big[0]) {
                if (chain.run === run) waiting.add(`${chain.lane}:${chain.index}`);
                set(chain.bigNode, { opacity: 0 });
            } else {
                const onward = f >= STAGE.onward[0];
                const bp = onward ? ONWARD[chain.lane].at(ease(span(f, ...STAGE.onward))) : chain.big.at(span(f, ...STAGE.big) ** 1.6);
                set(chain.bigNode, { cx: bp[0], cy: bp[1], opacity: f > 0.96 ? 0 : 1 });
            }
            spoonTilt[chain.lane] = Math.max(spoonTilt[chain.lane], bump(f, STAGE.spoon[0], STAGE.spoon[0] + 0.03, STAGE.spoon[1]));
            strike[chain.lane] = Math.max(strike[chain.lane], bump(f, STAGE.strike[0], STAGE.strike[0] + 0.05, STAGE.strike[1]));
            if (chain.type === "watch") {
                // the watch ball goes on to strike the gong for the first point
                spoonTilt[2] = Math.max(spoonTilt[2], bump(f, 0.84, 0.87, 0.95));
                strike[2] = Math.max(strike[2], bump(f, 0.86, 0.9, 0.99));
            }
            if (chain.type === "si") {
                beamPress = Math.max(beamPress, bump(f, STAGE.onward[1], STAGE.onward[1] + 0.04, 1));
                wheelChain = { hour: hourIndexOf(clockOf(24 * chain.run + SI_EVENTS[chain.index])), u: span(f, ...STAGE.wheel) };
            }
        }

        // iron balls still on the shelf
        SI_EVENTS.forEach((e, i) => laneBalls[0][i].classList.toggle("is-gone", !(e > off || waiting.has(`0:${i}`))));
        NIGHT_EVENTS.forEach((e, k) => {
            const lane = laneOfNight(k);
            laneBalls[lane][k].classList.toggle("is-gone", !(e > off || waiting.has(`${lane}:${k}`)));
        });

        // spoons tip, push rods rise, figures strike
        spoons.forEach((s, lane) => {
            const tilt = spoonTilt[lane] * 7;
            const exit = LANES[lane].exit;
            const a = iso(...P(exit - 1, spoonZ(lane) - tilt));
            const b = iso(...P(rodU(lane), spoonZ(lane) + tilt));
            set(s.arm, { d: polyline([a, b]) });
            set(s.cup, { cx: a[0], cy: a[1] });
            set(s.push, { d: polyline([b, iso(...P(rodU(lane), FLOOR_TOP + 14 + strike[lane] * 8))]) });
        });
        figures.forEach((fig, k) => {
            fig.arm.setAttribute("transform", `translate(-5 -23) rotate(${r1(-40 * strike[k])})`);
            fig.waves.setAttribute("opacity", r1(Math.min(1, strike[k] * 1.6)));
            fig.g.classList.toggle("is-striking", strike[k] > 0.05);
        });

        // beam: the hour ball presses its north end, the south end lifts
        const lift = beamPress * 8;
        const south = [BEAM.south[0], BEAM.south[1], BEAM.south[2] + lift];
        set(beam, { d: wpath([[BEAM.north[0], BEAM.north[1], BEAM.north[2] - lift], south]) });
        set(beamPost, { d: wpath([south, [south[0], south[1], WHEEL.z - 2 + lift]]) });

        // wheel: lower the old hour, turn one place, raise the new hour
        let base = hourIndexOf(clock);
        let turn = 0;
        let rise = 1;
        let raised = base;
        if (wheelChain && wheelChain.u < 1) {
            const u = wheelChain.u;
            base = (wheelChain.hour + 11) % 12;
            turn = ease(span(u, 0.3, 0.65));
            rise = u < 0.3 ? 1 - ease(u / 0.3) : u < 0.65 ? 0 : ease(span(u, 0.65, 1));
            raised = u < 0.3 ? base : wheelChain.hour;
        }
        wheelGods.forEach((god, j) => {
            const angle = FRONT - ((((j - base - turn) % 12) + 12) % 12) * (Math.PI / 6);
            const wx = WHEEL.c[0] + Math.cos(angle) * WHEEL.r;
            const wy = WHEEL.c[1] + Math.sin(angle) * WHEEL.r;
            const up = j === raised ? rise * WHEEL.rise : 0;
            const foot = iso(wx, wy, WHEEL.z);
            const head = iso(wx, wy, WHEEL.z + 12 + up);
            set(god.stem, { d: polyline([foot, head]) });
            set(god.head, { cx: head[0], cy: head[1] - 3 });
            if (j === raised) {
                const stand = iso(wx, wy, FLOOR_MID + 6 - (1 - rise) * 18);
                hourGod.setAttribute("transform", `translate(${xy(stand)})`);
                hourGod.setAttribute("opacity", r1(clamp((rise - 0.4) / 0.6)));
                plaqueText.textContent = HOURS[j];
            }
        });

        // water in the pipes
        const dash = -((state.anim * 26) % 32);
        for (const node of flows) node.style.strokeDashoffset = r1(dash);

        // readout
        const hi = hourIndexOf(clock);
        const firstHalf = Math.floor((clock + 1) % 2) === 0;
        ui.hour.textContent = HOURS[hi];
        ui.hourName.textContent = HOURS[hi] + (firstHalf ? "初" : "正");
        let reading = `Hour of the ${HOURS_EN[hi]}, ${firstHalf ? "first" : "second"} half`;
        const night = off >= NIGHT_START;
        if (night) {
            const k = Math.floor((off - NIGHT_START) / POINT_HOURS + 1e-9);
            const w = Math.floor(k / 5);
            ui.watch.textContent = `${ORDINALS[w]}更 ${ORDINALS[k % 5]}點`;
            reading += `; ${ORDINALS_EN[w]} watch, ${ORDINALS_EN[k % 5]} point`;
        } else {
            ui.watch.textContent = "Daytime";
        }
        if (ui.watch.classList.contains("han") !== night) {
            ui.watch.classList.toggle("han", night);
            ui.watch.lang = night ? "ko" : "en";
        }
        ui.reading.textContent = reading;
        const minutes = Math.floor(clock * 60) % 1440;
        ui.clock.textContent = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
        ui.vessel.textContent = `Receiver ${RECEIVERS[active].name} ${Math.floor(p * 100)}% · ${RECEIVERS[1 - active].name} ${levels[1 - active] > 0.01 ? "draining" : "standby"}`;
        if (document.activeElement !== ui.scrub) ui.scrub.value = String(Math.round(p * 1000));

        // captions and callouts follow the newest chain
        const swapping = state.anim - state.swapAt < 3.5 && off < 1;
        const step = swapping ? 8 : latest ? stepOf((state.anim - latest.start) / latest.dur, latest.type) : 0;
        ui.figure.dataset.step = String(step);
        ui.steps.forEach((li) => {
            const n = Number(li.dataset.jgrStep);
            li.classList.toggle("is-active", step === 0 ? n <= 2 : n === step);
        });
        calloutNodes.forEach((g, i) => g.classList.toggle("is-active", step === 0 ? i < 2 : i + 1 === step));
    }

    // ------------------------------------------------------- loop

    let lastFrame = 0;
    let rafId = 0;
    function frame(now) {
        rafId = 0;
        const dt = lastFrame ? Math.min(0.1, (now - lastFrame) / 1000) : 0;
        lastFrame = now;
        if (state.playing) {
            const t0 = state.t;
            state.anim += dt;
            state.t += dt * HOURS_PER_SECOND * state.speed;
            crossEvents(t0, state.t);
        }
        render();
        schedule();
    }
    function schedule() {
        if (rafId || !state.visible || !state.playing) {
            if (!state.playing) lastFrame = 0;
            return;
        }
        rafId = requestAnimationFrame(frame);
    }

    function setPlaying(on) {
        state.playing = on;
        lastFrame = 0;
        ui.play.setAttribute("aria-pressed", String(on));
        ui.play.querySelector("[data-label]").textContent = on ? "Pause" : "Play";
        schedule();
    }

    ui.play.addEventListener("click", () => setPlaying(!state.playing));
    ui.speeds.forEach((button) => {
        button.addEventListener("click", () => {
            state.speed = Number(button.dataset.jgrSpeed) || 1;
            ui.speeds.forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
        });
    });
    ui.scrub.addEventListener("input", () => {
        state.t = 24 * runOf(state.t) + (Number(ui.scrub.value) / 1000) * 24 * 0.9999;
        for (const chain of [...chains]) retire(chain);
        render();
    });

    // Whole clock, or a closer look at the plates and the tower.
    const views = {};
    let viewAnim = 0;
    function setView(name) {
        const target = views[name];
        ui.views.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.jgrView === name)));
        ui.figure.dataset.view = name;
        const vb = svg.viewBox.baseVal;
        const start = [vb.x, vb.y, vb.width, vb.height];
        cancelAnimationFrame(viewAnim);
        const duration = parseFloat(getComputedStyle(svg).getPropertyValue("--motion-page")) || 0;
        if (!duration) {
            svg.setAttribute("viewBox", target.map(r1).join(" "));
            return;
        }
        const t0 = performance.now();
        const step = (now) => {
            const u = ease(clamp((now - t0) / duration));
            svg.setAttribute("viewBox", start.map((v, i) => r1(lerp(v, target[i], u))).join(" "));
            if (u < 1) viewAnim = requestAnimationFrame(step);
        };
        viewAnim = requestAnimationFrame(step);
    }
    ui.views.forEach((button) => button.addEventListener("click", () => setView(button.dataset.jgrView)));

    // Fit the viewBox to the drawing, with room for the callouts.
    render();
    {
        const bb = svg.getBBox();
        const pad = 20;
        views.whole = [bb.x - pad, bb.y - pad, bb.width + pad * 2, bb.height + pad * 2];
        // Plates through to the tower, widened to the same aspect ratio.
        // The top keeps clear space for the readout that sits over the corner.
        const [x0] = iso(COLUMN.x - 30, COLUMN.y + 40, 0);
        const [x1] = iso(T.x + T.w + 30, T.y - 20, 0);
        const [, y0] = iso(T.x + 54, T.y + T.d / 2, T_TOP + 46);
        const [, y1] = iso(T.x + T.w, T.y + T.d, -16);
        const aspect = views.whole[2] / views.whole[3];
        let width = x1 - x0;
        let height = (y1 - y0) * 1.12;
        if (width / height < aspect) width = height * aspect;
        else height = width / aspect;
        views.mechanism = [(x0 + x1 - width) / 2, y1 - height, width, height];
        svg.setAttribute("viewBox", views.whole.map(r1).join(" "));
        svg.style.aspectRatio = `${r1(views.whole[2])} / ${r1(views.whole[3])}`;
        svg.classList.add("is-ready");
    }

    // Stop drawing while the figure is off screen.
    if ("IntersectionObserver" in window) {
        new IntersectionObserver((entries) => {
            state.visible = entries.some((e) => e.isIntersecting);
            lastFrame = 0;
            schedule();
        }).observe(svg);
    }

    // With reduced motion the clock holds a still frame until Play is pressed.
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
    setPlaying(!reduceMotion.matches);
    reduceMotion.addEventListener("change", (e) => {
        if (e.matches) setPlaying(false);
    });
})();
