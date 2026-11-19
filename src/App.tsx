import { useEffect, useRef, useState } from "react";
import { drawFrost } from "./frost";
import { sfx, wake } from "./sound";
import { DistortionWave } from "distortion-waves";

/* ---------- springs: SwiftUI-style (response, bounce), same as the envelope in convert-card ---------- */
class Spring {
  x: number; to: number; v = 0; k = 0; c = 0;
  constructor(x: number, response = .5, bounce = 0) { this.x = this.to = x; this.set(response, bounce); }
  set(response: number, bounce = 0) { this.k = (2 * Math.PI / response) ** 2; this.c = 4 * Math.PI * (1 - bounce) / response; return this; }
  step(h: number) { this.v += (this.k * (this.to - this.x) - this.c * this.v) * h; this.x += this.v * h; }
}
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const rand = (a: number, b: number) => a + Math.random() * (b - a);

/* both views hold a copy of the card; one loop moves them together, so the wave never shows a jump */
function useCardMotion(frozen: boolean) {
  const api = useRef({ kick: () => {}, press: (_on: boolean) => {}, frozen });
  api.current.frozen = frozen;

  useEffect(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches, motion = reduce ? 0 : 1;
    const P = { x: new Spring(0, .7, .28), y: new Spring(0, .7, .28), rx: new Spring(0, .7, .28), ry: new Spring(0, .7, .28), rz: new Spring(0, .7, .28) };
    const squeeze = new Spring(0, .3, .45);
    const pointer = { x: innerWidth / 2, y: innerHeight / 2, in: false };
    let t = 0, last = performance.now(), nudgeAt = 5, shiver = 0, held = false, wasFrozen = api.current.frozen, raf = 0;
    if (!reduce) { P.x.x = innerWidth * .62; P.y.x = -50; P.ry.x = -200; P.rz.x = 16; }   // flies in from the right, spinning round to its front
    addEventListener("pointerdown", wake, true); addEventListener("keydown", wake, true);

    api.current.kick = () => { if (!motion) return; squeeze.v -= 6; P.rz.v += (Math.random() < .5 ? -1 : 1) * 60; P.y.v -= 180; };
    api.current.press = on => { if (on === held) return; held = on; if (on) sfx.grab(); else { sfx.boing(); if (motion) P.rz.v += (Math.random() < .5 ? -1 : 1) * 40; } };

    const track = (e: PointerEvent) => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.in = true; };
    const leave = () => { pointer.in = false; };
    const up = () => { if (held) api.current.press(false); };
    addEventListener("pointermove", track); addEventListener("pointerdown", track); addEventListener("pointerup", up); addEventListener("blur", leave);
    document.documentElement.addEventListener("pointerleave", leave);

    const frame = (now: number) => {
      const dt = Math.min(.05, (now - last) / 1000); last = now; t += dt;
      const cold = api.current.frozen;
      if (cold && !wasFrozen) shiver = t + .6;   // frozen solid: a short shiver, then it barely moves
      if (cold !== wasFrozen) for (const s of Object.values(P)) s.set(cold ? .9 : .7, cold ? .1 : .28);
      wasFrozen = cold;

      const nx = pointer.in ? clamp(pointer.x / innerWidth * 2 - 1, -1, 1) : 0, ny = pointer.in ? clamp(pointer.y / innerHeight * 2 - 1, -1, 1) : 0;
      const tilt = (cold ? .35 : 1) * (reduce ? .5 : 1);
      squeeze.to = held ? motion : 0;
      P.x.to = 0;
      P.y.to = Math.sin(t * 1.4) * (cold ? 2 : 7) * motion;
      P.ry.to = nx * 22 * tilt; P.rx.to = -ny * 16 * tilt - squeeze.x * 6;
      P.rz.to = Math.sin(t * .9) * (cold ? .3 : 1.6) * motion + (t < shiver ? Math.sin(t * 70) * 1.4 * (shiver - t) / .6 : 0);
      if (!cold && !held && motion && t > nudgeAt) { P.rz.v += (Math.random() < .5 ? -1 : 1) * 70; nudgeAt = t + rand(4, 7); }   // left alone it wiggles

      const n = Math.ceil(dt * 240), h = dt / n;
      for (let i = 0; i < n; i++) { for (const s of Object.values(P)) s.step(h); squeeze.step(h); }

      const s = squeeze.x, tr = `translate3d(${P.x.x}px,${P.y.x}px,0) rotateX(${P.rx.x}deg) rotateY(${P.ry.x}deg) rotateZ(${P.rz.x}deg) scale3d(${1 + .03 * s},${1 - .06 * s},1)`;
      const lx = clamp(P.ry.x / 24, -1, 1), ly = clamp(P.rx.x / 24, -1, 1);
      for (const el of document.querySelectorAll<HTMLElement>("[data-card]")) {
        el.style.transform = tr;
        el.style.setProperty("--px", (50 + lx * 50).toFixed(1)); el.style.setProperty("--py", (50 - ly * 50).toFixed(1));
        el.style.setProperty("--hyp", Math.min(1, Math.hypot(lx, ly)).toFixed(3));
        el.style.setProperty("--gm", clamp(50 + P.ry.x * 1.2, 20, 80).toFixed(1));
        el.classList.toggle("held", held);
      }
      for (const el of document.querySelectorAll<HTMLElement>("[data-ground]")) {
        el.style.transform = `translate3d(${P.x.x}px,0,0) scale(${1 - P.y.x / 300})`;
        el.style.opacity = clamp(1 - Math.abs(P.x.x) / 300, 0, 1).toFixed(3);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("pointerdown", wake, true); removeEventListener("keydown", wake, true);
      removeEventListener("pointermove", track); removeEventListener("pointerdown", track); removeEventListener("pointerup", up); removeEventListener("blur", leave);
      document.documentElement.removeEventListener("pointerleave", leave);
    };
  }, []);

  return api;
}

/* the frost canvas, redrawn whenever the card changes size so it stays sharp */
function Frost() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    const ro = new ResizeObserver(() => {
      const d = Math.min(3, devicePixelRatio || 1), w = Math.round(cv.clientWidth * d), h = Math.round(cv.clientHeight * d);
      if (!w || (cv.width === w && cv.height === h)) return;
      cv.width = w; cv.height = h; drawFrost(cv);
    });
    ro.observe(cv);
    return () => ro.disconnect();
  }, []);
  return <canvas ref={ref} className="frost" aria-hidden="true" />;
}

function Card({ frozen, onPress }: { frozen?: boolean; onPress: (on: boolean) => void }) {
  return (
    <div className="scene">
      <i className="ground" data-ground />
      <div className={`card${frozen ? " frozen" : ""}`} data-card onPointerDown={e => { if (!e.button) onPress(true); }}>
        <i className="side l" /><i className="side r" /><i className="side t" /><i className="side b" />
        <div className="skin back" />
        <div className="skin front">
          <img src="/card.webp" alt="" draggable={false} />
          {frozen && <><i className="chill" /><Frost /></>}
          <i className="holo" /><i className="glare" /><i className="sheen" />
        </div>
      </div>
    </div>
  );
}

export function App() {
  const [frozen, setFrozen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const motion = useCardMotion(frozen);
  const press = (on: boolean) => motion.current.press(on);

  return (
    <DistortionWave
      className="stage"
      revealed={frozen}
      source={button}
      type="vertical"
      palette="ocean"
      waveStyle={{ particleCount: 46 }}
      revealedContent={
        <section className="view cold">
          <Card frozen onPress={press} />
        </section>
      }
      overlay={
        <button
          ref={button}
          type="button"
          className="action"
          onClick={() => { motion.current.kick(); sfx[frozen ? "thaw" : "freeze"](); setFrozen(f => !f); }}
          aria-pressed={frozen}
        >
          {frozen ? "Разморозить карту" : "Заморозить карту"}
        </button>
      }
    >
      <section className="view warm">
        <Card onPress={press} />
      </section>
    </DistortionWave>
  );
}
