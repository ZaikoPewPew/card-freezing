/* Frost that grows, like a window freezing on a time-lapse: first a fog creeps in from the rim,
   then feathery ice shoots out of the edges and corners, throwing side shoots at 60° as it goes,
   and a fine rime grain settles last. Drawn at the screen's own resolution, never pixelated.

   The whole growth is planned up front (every segment knows the moment it appears), then each
   frame only draws what has appeared since the last one, so a frame stays cheap. */

export const FREEZE_TIME = 2.8;   // seconds until the frost has fully set

const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

type Seg = { x0: number; y0: number; x1: number; y1: number; w: number; a: number; t: number };
type Dot = { x: number; y: number; r: number; a: number; t: number };
type Fog = { x: number; y: number; r: number; t: number };

function plan(w: number, h: number, seed: number) {
  const r = rng(seed), rand = (a: number, b: number) => a + r() * (b - a);
  const m = Math.min(w, h), u = m / 300;
  const edge = (x: number, y: number) => Math.min(x, w - x, y, h - y) / m;
  const segs: Seg[] = [], dots: Dot[] = [], fog: Fog[] = [];

  // fog: soft blobs hugging the rim, the corners first
  for (let n = 0; n < 260; n++) {
    const x = rand(0, w), y = rand(0, h), e = edge(x, y);
    if (r() > Math.exp(-e / .1)) continue;
    fog.push({ x, y, r: rand(18, 46) * u, t: e * 3.2 + rand(0, .9) });
  }

  // ice ferns: a stem wanders inward and slows as it goes; shoots leave it at ±60°
  const fern = (x: number, y: number, ang: number, len: number, depth: number, width: number, alpha: number, t: number, speed: number) => {
    const steps = Math.max(3, Math.round(len / (3.5 * u))), seg = len / steps;
    for (let i = 1; i <= steps; i++) {
      ang += rand(-.07, .07);
      const nx = x + Math.cos(ang) * seg, ny = y + Math.sin(ang) * seg;
      t += seg / (speed * u) * (1 + .9 * i / steps);
      segs.push({ x0: x, y0: y, x1: nx, y1: ny, w: width * (1 - .35 * i / steps), a: alpha, t });
      x = nx; y = ny;
      if (depth > 0 && i < steps - 1 && r() < .55 && edge(x, y) < .32) {
        const k = 1 - i / steps;
        fern(x, y, ang + (r() < .5 ? -1 : 1) * Math.PI / 3 + rand(-.12, .12), len * rand(.22, .42) * (.4 + k), depth - 1, width * .7, alpha * .85, t + rand(.02, .12), speed * .8);
      }
    }
  };
  const perim = 2 * (w + h);
  for (let n = 0; n < 70; n++) {
    let p = r();
    const corner = Math.round(p * 4) / 4; p = corner + (p - corner) * (r() < .6 ? .45 : 1);
    const nearCorner = Math.abs(p - corner) * 4;   // 0 at a corner, up to 1 mid-edge
    let d = ((p % 1) + 1) % 1 * perim, x: number, y: number, inward: number;
    if (d < w) { x = d; y = 0; inward = Math.PI / 2; }
    else if ((d -= w) < h) { x = w; y = d; inward = Math.PI; }
    else if ((d -= h) < w) { x = w - d; y = h; inward = -Math.PI / 2; }
    else { d -= w; x = 0; y = h - d; inward = 0; }
    const big = r() < .35;
    fern(x, y, inward + rand(-.75, .75), (big ? rand(70, 120) : rand(25, 60)) * u, big ? 3 : 2, (big ? 1.3 : .9) * u, big ? .6 : .42,
      .15 + nearCorner * .7 + rand(0, .5), rand(70, 120));
  }

  for (let n = 0; n < 2600; n++) {
    const x = rand(0, w), y = rand(0, h), e = edge(x, y);
    if (r() > Math.exp(-e / .05)) continue;   // rime grain: fine and right against the rim
    dots.push({ x, y, r: rand(.2, .5) * u, a: rand(.12, .4), t: e * 6 + rand(.2, 1.6) });
  }

  const byT = <T extends { t: number }>(a: T[]) => a.sort((p, q) => p.t - q.t);
  return { segs: byT(segs), dots: byT(dots), fog: byT(fog), u };
}

/* a frost that grows on one canvas: start() wipes it and plays the growth again */
export class FrostGrowth {
  private ctx: CanvasRenderingContext2D | null;
  private p: ReturnType<typeof plan> | null = null;
  private i = { segs: 0, dots: 0, fog: 0 };
  private t0 = 0;
  private raf = 0;

  constructor(private cv: HTMLCanvasElement) { this.ctx = cv.getContext("2d"); }

  start(instant = false) {
    cancelAnimationFrame(this.raf);
    const { cv, ctx } = this;
    if (!ctx || !cv.width) return;
    this.p = plan(cv.width, cv.height, (Math.random() * 2 ** 31) | 0);
    this.i = { segs: 0, dots: 0, fog: 0 };
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (instant) return this.draw(Infinity);
    this.t0 = performance.now();
    const tick = (now: number) => {
      const t = (now - this.t0) / 1000;
      this.draw(t);
      if (t < FREEZE_TIME + .2) this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  clear() { cancelAnimationFrame(this.raf); this.ctx?.clearRect(0, 0, this.cv.width, this.cv.height); this.p = null; }
  stop() { cancelAnimationFrame(this.raf); }

  private draw(t: number) {
    const { ctx, p, i } = this;
    if (!ctx || !p) return;
    for (; i.fog < p.fog.length && p.fog[i.fog].t <= t; i.fog++) {
      const f = p.fog[i.fog], g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
      g.addColorStop(0, "rgba(240,248,255,.09)"); g.addColorStop(1, "rgba(240,248,255,0)");
      ctx.fillStyle = g; ctx.fillRect(f.x - f.r, f.y - f.r, f.r * 2, f.r * 2);
    }
    ctx.lineCap = "round"; ctx.shadowColor = "rgba(255,255,255,.7)"; ctx.shadowBlur = 2.5 * p.u;
    for (; i.segs < p.segs.length && p.segs[i.segs].t <= t; i.segs++) {
      const s = p.segs[i.segs];
      ctx.lineWidth = s.w; ctx.strokeStyle = `rgba(255,255,255,${s.a})`;
      ctx.beginPath(); ctx.moveTo(s.x0, s.y0); ctx.lineTo(s.x1, s.y1); ctx.stroke();
    }
    ctx.shadowBlur = 0;
    for (; i.dots < p.dots.length && p.dots[i.dots].t <= t; i.dots++) {
      const d = p.dots[i.dots];
      ctx.fillStyle = `rgba(255,255,255,${d.a})`; ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 7); ctx.fill();
    }
  }
}
