/* Graphics Atlas card icon: the site's own mark, ported from graphics-art.ttzein6.workers.dev/js/mark.js.
   A pen plotter draws landmark shapes from computer graphics history in turn, holds each one while it moves,
   then lifts it off and starts the next. Every shape is a set of polylines in -1..1, so the pen can trace any of them. */
(() => {
  const canvas = document.querySelector('[data-atlas-mark]');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const INK = '#D0AB62'; // the Atlas's brass

  const rotate = ([x, y, z], ay, ax) => {
    const c = Math.cos(ay), s = Math.sin(ay);
    [x, z] = [x * c + z * s, -x * s + z * c];
    const c2 = Math.cos(ax), s2 = Math.sin(ax);
    return [x, y * c2 - z * s2, y * s2 + z * c2];
  };
  const project = ([x, y, z]) => { const k = 2.6 / (3.2 - z); return [x * k, y * k]; };

  // A fixed-seed random generator, so the plotter pieces come out the same every time.
  const seeded = (seed) => () => { seed = (seed + 0x6d2b79f5) | 0; let r = Math.imul(seed ^ (seed >>> 15), 1 | seed); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };

  // Lorenz's weather model, integrated once; the mark only rotates it.
  const lorenz = [];
  for (let i = 0, x = .1, y = 0, z = 0; i < 3200; i++) {
    const dt = .008;
    [x, y, z] = [x + 10 * (y - x) * dt, y + (x * (28 - z) - y) * dt, z + (x * y - 8 / 3 * z) * dt];
    if (i > 60) lorenz.push([x / 24, (z - 24) / 24, y / 24]);
  }

  const SHAPES = [
    {
      // Lorenz attractor, after Edward Lorenz, 1963
      weight: .55,
      lines(t) { return [{ pts: lorenz.map((p) => project(rotate(p, t * .35, .25))) }]; }
    },
    {
      // Hypercube, after A. Michael Noll, Bell Labs, 1960s
      weight: .8,
      lines(t) {
        const a = t * .5, b = t * .31, v = [];
        for (let i = 0; i < 16; i++) {
          let [x, y, z, w] = [0, 1, 2, 3].map((k) => (i >> k & 1 ? .5 : -.5));
          [x, w] = [x * Math.cos(a) - w * Math.sin(a), x * Math.sin(a) + w * Math.cos(a)];
          [y, z] = [y * Math.cos(b) - z * Math.sin(b), y * Math.sin(b) + z * Math.cos(b)];
          const k = 1.4 / (2 - w);
          v.push(project(rotate([x * k, y * k, z * k], .6 + t * .12, .4)));
        }
        const lines = [];
        for (let i = 0; i < 16; i++) for (let k = 0; k < 4; k++) if (!(i >> k & 1)) lines.push({ pts: [v[i], v[i | 1 << k]] });
        return lines;
      }
    },
    {
      // Schotter, after Georg Nees, 1968
      weight: .7,
      lines(t) {
        const rand = seeded(7), lines = [], cols = 7, rows = 10, s = 1.5 / rows, breathe = .85 + .15 * Math.sin(t * .8);
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const k = r / (rows - 1) * breathe, ang = (rand() - .5) * k * 1.6, dx = (rand() - .5) * k * s * .7, dy = (rand() - .5) * k * s * .7;
          const cx = (c - (cols - 1) / 2) * s + dx, cy = ((rows - 1) / 2 - r) * s + dy, h = s * .46;
          const corner = (q) => [cx + q[0] * Math.cos(ang) - q[1] * Math.sin(ang), cy + q[0] * Math.sin(ang) + q[1] * Math.cos(ang)];
          lines.push({ pts: [[-h, -h], [h, -h], [h, h], [-h, h], [-h, -h]].map(corner) });
        }
        return lines;
      }
    },
    {
      // Oscillon, after Ben Laposky, 1952
      weight: .5,
      lines(t) {
        const pts = [], ph = t * .25;
        for (let i = 0; i <= 2400; i++) {
          const u = i / 40, d = Math.exp(-u * .045);
          pts.push([.86 * d * (Math.sin(2.01 * u + ph) * .7 + Math.sin(5 * u) * .3), .86 * d * (Math.sin(3 * u) * .7 + Math.cos(4.02 * u + ph * .5) * .3)]);
        }
        return [{ pts }];
      }
    },
    {
      // (Des)Ordres, after Vera Molnár, 1974
      weight: .6,
      lines(t) {
        const rand = seeded(11), lines = [], n = 5, cell = 1.7 / n, wob = .5 + .5 * Math.sin(t * .6);
        for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
          const cx = (c - (n - 1) / 2) * cell, cy = (r - (n - 1) / 2) * cell;
          for (let ring = 1; ring <= 5; ring++) {
            const jit = [0, 1, 2, 3].map(() => [(rand() - .5) * cell * .12, (rand() - .5) * cell * .12]);
            if (rand() < .18) continue;
            const h = cell * .46 * ring / 5;
            const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map((q, i) => [cx + q[0] * h + jit[i][0] * wob, cy + q[1] * h + jit[i][1] * wob]);
            lines.push({ pts: [...pts, pts[0]] });
          }
        }
        return lines;
      }
    }
  ];

  const DRAW = 2.4, HOLD = 3.4, LIFT = 1, CYCLE = DRAW + HOLD + LIFT;
  let size = 0, raf = 0, onScreen = false;
  const start = performance.now();

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2), w = canvas.clientWidth;
    if (!w) return;
    size = w;
    canvas.width = canvas.height = Math.round(w * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Draws the part of the polylines between fractions a and b of their total length, as one path, with the pen at the moving end.
  function trace(lines, a, b, penAt, weight = 1) {
    const half = size / 2, scale = half * .82, X = (p) => half + p[0] * scale, Y = (p) => half - p[1] * scale;
    let total = 0;
    for (const l of lines) for (let i = 1; i < l.pts.length; i++) total += Math.hypot(l.pts[i][0] - l.pts[i - 1][0], l.pts[i][1] - l.pts[i - 1][1]);
    const from = a * total, to = b * total;
    let at = 0, pen = null;
    ctx.beginPath();
    for (const l of lines) {
      let open = false;
      for (let i = 1; i < l.pts.length; i++) {
        const p = l.pts[i - 1], q = l.pts[i], len = Math.hypot(q[0] - p[0], q[1] - p[1]);
        const s0 = Math.max(from, at), s1 = Math.min(to, at + len);
        if (s1 > s0) {
          const lerp = (d) => { const k = len ? (d - at) / len : 0; return [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k]; };
          const u = lerp(s0), v = lerp(s1);
          if (!open) { ctx.moveTo(X(u), Y(u)); open = true; if (penAt === 'start' && !pen) pen = u; }
          ctx.lineTo(X(v), Y(v));
          if (penAt === 'end') pen = v;
        } else open = false;
        at += len;
      }
    }
    ctx.lineCap = ctx.lineJoin = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(.75, size / 70 * weight);
    ctx.stroke();
    if (pen) { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(X(pen), Y(pen), size / 28, 0, Math.PI * 2); ctx.fill(); }
  }

  function frame(now) {
    raf = onScreen ? requestAnimationFrame(frame) : 0;
    if (!size) return;
    const t = (now - start) / 1000, n = Math.floor(t / CYCLE), local = t - n * CYCLE, shape = SHAPES[n % SHAPES.length];
    const ease = (x) => x < .5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2;
    ctx.clearRect(0, 0, size, size);
    const lines = shape.lines(t);
    if (local < DRAW) trace(lines, 0, ease(local / DRAW), 'end', shape.weight);
    else if (local < DRAW + HOLD) trace(lines, 0, 1, null, shape.weight);
    else trace(lines, ease((local - DRAW - HOLD) / LIFT), 1, 'start', shape.weight);
  }

  // With reduced motion the mark is a single still drawing: the Lorenz attractor, held.
  function still() {
    if (!size) return;
    ctx.clearRect(0, 0, size, size);
    trace(SHAPES[0].lines(1.2), 0, 1, null, SHAPES[0].weight);
  }

  new ResizeObserver(() => { resize(); if (reduced) still(); }).observe(canvas);
  resize();
  if (reduced) { still(); return; }

  // Only plot while the card is on screen
  new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    if (onScreen && !raf) raf = requestAnimationFrame(frame);
  }).observe(canvas);
})();
