/* Frost drawn at the screen's own resolution, so it never pixelates: a soft rime at the
   edges, feathery ice that grows in from the rim with side shoots at 60° like real window
   frost, a few six-armed flakes and fine grain. Seeded, so it looks the same every time. */

const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export function drawFrost(cv: HTMLCanvasElement, seed = 11) {
  const ctx = cv.getContext("2d");
  if (!ctx) return;
  const w = cv.width, h = cv.height, m = Math.min(w, h), u = m / 300;   // u: one "point" on a 300-wide card
  const r = rng(seed), rand = (a: number, b: number) => a + r() * (b - a);
  const edge = (x: number, y: number) => Math.min(x, w - x, y, h - y) / m;   // 0 at the rim, ~.5 in the middle
  ctx.clearRect(0, 0, w, h);
  ctx.lineCap = "round";

  // 1. rime: a milky haze that is thick at the rim and clears toward the middle
  for (const [x, y, rx, ry, a] of [[w / 2, h / 2, w * .78, h * .7, .5], [0, 0, w * .7, w * .7, .35], [w, h, w * .8, w * .8, .4], [w, 0, w * .45, w * .45, .25], [0, h, w * .55, w * .55, .3]]) {
    ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    if (x === w / 2) { g.addColorStop(.45, "rgba(255,255,255,0)"); g.addColorStop(1, `rgba(240,247,255,${a})`); }
    else { g.addColorStop(0, `rgba(245,250,255,${a})`); g.addColorStop(1, "rgba(245,250,255,0)"); }
    ctx.fillStyle = g; ctx.fillRect(-rx * 1.5, -rx * 1.5, rx * 3, rx * 3); ctx.restore();
  }

  // 2. ice ferns: a stem that wanders inward, throwing shoots at ±60° that throw their own
  const fern = (x: number, y: number, ang: number, len: number, depth: number, width: number, alpha: number) => {
    const steps = Math.max(3, Math.round(len / (4 * u)));
    const seg = len / steps;
    let px = x, py = y;
    ctx.beginPath(); ctx.moveTo(px, py);
    const shoots: [number, number, number, number][] = [];
    for (let i = 1; i <= steps; i++) {
      ang += rand(-.07, .07);
      px += Math.cos(ang) * seg; py += Math.sin(ang) * seg;
      ctx.lineTo(px, py);
      if (depth > 0 && i < steps - 1 && r() < .55) {
        const k = 1 - i / steps;
        shoots.push([px, py, ang + (r() < .5 ? -1 : 1) * Math.PI / 3 + rand(-.12, .12), len * rand(.22, .42) * (.4 + k)]);
      }
    }
    ctx.lineWidth = width; ctx.strokeStyle = `rgba(255,255,255,${alpha})`; ctx.stroke();
    for (const [sx, sy, sa, sl] of shoots) {
      if (edge(sx, sy) > .32) continue;
      fern(sx, sy, sa, sl, depth - 1, width * .7, alpha * .85);
    }
  };
  ctx.shadowColor = "rgba(255,255,255,.7)"; ctx.shadowBlur = 2.5 * u;
  const perim = 2 * (w + h);
  for (let n = 0; n < 70; n++) {
    // seeds sit on the rim, crowded toward the corners
    let p = r();
    const corner = Math.round(p * 4) / 4; p = corner + (p - corner) * (r() < .6 ? .45 : 1);
    let d = ((p % 1) + 1) % 1 * perim, x: number, y: number, inward: number;
    if (d < w) { x = d; y = 0; inward = Math.PI / 2; }
    else if ((d -= w) < h) { x = w; y = d; inward = Math.PI; }
    else if ((d -= h) < w) { x = w - d; y = h; inward = -Math.PI / 2; }
    else { d -= w; x = 0; y = h - d; inward = 0; }
    const big = r() < .35;
    fern(x, y, inward + rand(-.75, .75), (big ? rand(70, 120) : rand(25, 60)) * u, big ? 3 : 2, (big ? 1.3 : .9) * u, big ? .55 : .4);
  }

  // 3. six-armed flakes caught near the rim
  for (let n = 0; n < 26; n++) {
    const x = rand(0, w), y = rand(0, h);
    if (edge(x, y) > rand(.05, .26)) continue;
    const s = rand(3, 8) * u, a0 = rand(0, Math.PI);
    ctx.lineWidth = .7 * u; ctx.strokeStyle = `rgba(255,255,255,${rand(.45, .8)})`; ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = a0 + k * Math.PI / 3, ex = x + Math.cos(a) * s, ey = y + Math.sin(a) * s;
      ctx.moveTo(x, y); ctx.lineTo(ex, ey);
      const bx = x + Math.cos(a) * s * .55, by = y + Math.sin(a) * s * .55;
      for (const side of [-1, 1]) { const b = a + side * Math.PI / 3; ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(b) * s * .35, by + Math.sin(b) * s * .35); }
    }
    ctx.stroke();
  }

  // 4. grain: tiny crystals, thick at the rim
  ctx.shadowBlur = 0;
  for (let n = 0; n < 2600; n++) {
    const x = rand(0, w), y = rand(0, h), e = edge(x, y);
    if (r() > Math.exp(-e / .09)) continue;
    ctx.fillStyle = `rgba(255,255,255,${rand(.15, .55)})`;
    ctx.beginPath(); ctx.arc(x, y, rand(.25, .9) * u, 0, 7); ctx.fill();
  }
}
