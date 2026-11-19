import { useEffect, useRef, useState } from "react";
import { FrostGrowth } from "./frost";
import { isMuted, setMuted, sfx, wake } from "./sound";
import { DistortionWave, type DistortionWaveHandle } from "distortion-waves";

/* ---------- springs: SwiftUI-style (response, bounce), same as the envelope in convert-card ---------- */
class Spring {
  x: number; to: number; v = 0; k = 0; c = 0;
  constructor(x: number, response = .5, bounce = 0) { this.x = this.to = x; this.set(response, bounce); }
  set(response: number, bounce = 0) { this.k = (2 * Math.PI / response) ** 2; this.c = 4 * Math.PI * (1 - bounce) / response; return this; }
  step(h: number) { this.v += (this.k * (this.to - this.x) - this.c * this.v) * h; this.x += this.v * h; }
}
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

const CARD = `${import.meta.env.BASE_URL}card.webp`;
const GATHER = .25;
const FREEZE_STYLE = { particleCount: 28, pull: 0, inhale: 0, anticipation: GATHER, travel: 1.7 };
/* running back, the colour that lingers on the edges after a freeze would come first and read as the
   edges thawing before the wave gets there: no rim or hairline on the way back */
/* Thaw is the freeze played backwards, but not with the wave's own reverse: a freeze reaches the top of the
   card by 0.7s and spends the rest of its run letting the lens settle, so played back the first ~0.4s barely
   moves. Instead the thaw scrubs the same run back by hand, starting with the front just above the card
   (THAW_FROM, read off the wave's own front: it re-enters the card at ~0.21) and ending in the button. No rim on the way back: the colour that
   lingers on the edges after a freeze would come first and read as the edges thawing ahead of the wave */
const THAW_STYLE = { ...FREEZE_STYLE, rimStrength: 0, hairlineOpacity: 0 };
const THAW_FROM = .26, THAW_MS = 1100;
const ease = (u: number) => 1 - (1 - u) ** 1.6;   // moving from the first frame, settling into the button

/* both views hold a copy of the card; one loop moves them together, so the wave never shows a jump */
function useCardMotion(frozen: boolean) {
  const api = useRef({ press: (_on: boolean) => {}, kick: (_freezing: boolean) => {}, frozen });
  api.current.frozen = frozen;

  useEffect(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches, motion = reduce ? 0 : 1;
    const P = { x: new Spring(0, .7, .28), y: new Spring(0, .7, .28), rx: new Spring(0, .7, .28), ry: new Spring(0, .7, .28), rz: new Spring(0, .7, .28) };
    const squeeze = new Spring(0, .3, .45);
    const pointer = { x: innerWidth / 2, y: innerHeight / 2, in: false };
    let t = 0, last = performance.now(), held = false, gather = 0, raf = 0;
    if (!reduce) { P.x.x = innerWidth * .62; P.y.x = -50; P.ry.x = -200; P.rz.x = 16; }   // flies in from the right, spinning round to its front
    addEventListener("pointerdown", wake, true); addEventListener("keydown", wake, true);

    api.current.press = on => { if (on === held) return; held = on; if (on) sfx.grab(); else { sfx.boing(); if (motion) P.rz.v += (Math.random() < .5 ? -1 : 1) * 40; } };

    // the card itself does not move with the wave: any squat or hop of it reads as the art jumping in size
    // under the lens. Only a dull thud marks the moment the wave launches
    api.current.kick = freezing => { gather = t + (freezing ? GATHER : .05); };

    const track = (e: PointerEvent) => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.in = true; };
    const leave = () => { pointer.in = false; };
    const up = () => { if (held) api.current.press(false); };
    addEventListener("pointermove", track); addEventListener("pointerdown", track); addEventListener("pointerup", up); addEventListener("blur", leave);
    document.documentElement.addEventListener("pointerleave", leave);

    const frame = (now: number) => {
      const dt = Math.min(.05, (now - last) / 1000); last = now; t += dt;
      const cold = api.current.frozen;

      const nx = pointer.in ? clamp(pointer.x / innerWidth * 2 - 1, -1, 1) : 0, ny = pointer.in ? clamp(pointer.y / innerHeight * 2 - 1, -1, 1) : 0;
      const tilt = reduce ? .5 : 1;   // the same in both states: changing it on freeze re-angled the card mid-wave
      if (gather && t >= gather) { gather = 0; sfx.thump(); }
      squeeze.to = held ? motion : 0;
      P.x.to = 0;
      P.y.to = Math.sin(t * 1.4) * 7 * motion;
      P.ry.to = nx * 22 * tilt; P.rx.to = -ny * 16 * tilt - squeeze.x * 6;
      P.rz.to = Math.sin(t * .9) * 1.6 * motion;

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

/* The card tilts in 3D, and the wave sizes its picture from getBoundingClientRect, which is the tilted
   card's footprint on screen: with the card leaning toward the button it is ~1.3% shorter than the card
   really is, so the picture came out squashed and the logo jumped when the real card took over at the
   end. Here the wave is given the card's true size, centred where the card shows on screen. */
function measureFlat(el: HTMLElement | null) {
  if (!el) return;
  const screen = Element.prototype.getBoundingClientRect;
  el.getBoundingClientRect = function () {
    const r = screen.call(this), w = this.offsetWidth, h = this.offsetHeight;
    return new DOMRect(r.left + r.width / 2 - w / 2, r.top + r.height / 2 - h / 2, w, h);
  };
}

/* the frost canvas: sized to the card at screen resolution, it grows each time the card freezes.
   data-dw-live lets the wave read it every frame, so the ice is already creeping in under the lens */
function Frost({ frozen }: { frozen: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null), growth = useRef<FrostGrowth>();
  const was = useRef(frozen);
  useEffect(() => {
    const cv = ref.current!, g = growth.current = new FrostGrowth(cv);
    measureFlat(cv);   // the wave reads this canvas every frame and lays it over its own measure of the card
    const ro = new ResizeObserver(() => {
      const d = Math.min(3, devicePixelRatio || 1), w = Math.round(cv.clientWidth * d), h = Math.round(cv.clientHeight * d);
      if (!w || (cv.width === w && cv.height === h)) return;
      cv.width = w; cv.height = h; if (was.current) g.start(true);
    });
    ro.observe(cv);
    return () => { ro.disconnect(); g.stop(); };
  }, []);
  useEffect(() => {
    if (frozen && !was.current) growth.current?.start();
    was.current = frozen;
  }, [frozen]);
  return <canvas ref={ref} className="frost" data-dw-live aria-hidden="true" />;
}

const Face = ({ cold, frozen = false}: { cold?: boolean; frozen?: boolean }) => (
  <div className={`face${cold ? " ice" : ""}`}>
    <img src={CARD} alt="" draggable={false} />
    {cold && <><i className="chill" /><Frost frozen={frozen} /></>}
    <i className="holo" /><i className="glare" /><i className="sheen" />
  </div>
);

export function App() {
  const [frozen, setFrozen] = useState(false);
  const [muted, mute] = useState(isMuted);
  const button = useRef<HTMLButtonElement>(null), wave = useRef<DistortionWaveHandle>(null);
  useEffect(() => measureFlat(wave.current?.element ?? null), []);
  // the document behind the page and the browser's own chrome follow the page from warm to cold
  useEffect(() => {
    document.documentElement.classList.toggle("cold", frozen);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", frozen ? "#d6e3f1" : "#e9e6e0");
  }, [frozen]);
  const motion = useCardMotion(frozen);

  const [scrub, setScrub] = useState<number | null>(null), thaw = useRef(0);
  const toggle = () => {
    const next = !frozen;
    cancelAnimationFrame(thaw.current);
    motion.current.kick(next);
    sfx[next ? "freeze" : "thaw"]();
    setFrozen(next);
    if (next) { setScrub(null); return; }
    const t0 = performance.now();
    const step = (now: number) => {
      const u = Math.min(1, (now - t0) / THAW_MS);
      if (u < 1) { setScrub(THAW_FROM * (1 - ease(u))); thaw.current = requestAnimationFrame(step); }
      else setScrub(null);   // at 0 the warm face is all that shows: let go of the scrub and settle on it
    };
    setScrub(THAW_FROM); thaw.current = requestAnimationFrame(step);
  };

  return (
    <main className={`page${frozen ? " cold" : ""}`}>
      <i className="bg warm" /><i className="bg chilly" />
      <div className="scene">
        <i className="ground" data-ground />
        <div className="card" data-card onPointerDown={e => { if (!e.button) motion.current.press(true); }}>
          <i className="side l" /><i className="side r" /><i className="side t" /><i className="side b" />
          <div className="skin back" />
          {/* the wave runs on the face alone, inside its rounded corners. Its lens bends a picture of the
              card from the warm face into the frozen one, up from the button; revealed=false runs it back down into it.
              pull/inhale off: they drag the picture toward the source and tear its top edge.
              Thaw switches to the warm palette: a thaw, not more cold */}
          <DistortionWave
            ref={wave}
            className="skin front"
            revealed={frozen || scrub !== null}
            scrub={scrub}
            source={button}
            type="vertical"
            palette={frozen ? "ocean" : "sunset"}
            waveStyle={frozen ? FREEZE_STYLE : THAW_STYLE}
            revealedContent={<Face cold frozen={frozen} />}
          >
            <Face />
          </DistortionWave>
        </div>
      </div>
      <button type="button" className="mute" aria-label="Звук" aria-pressed={muted} onClick={() => { setMuted(!muted); mute(!muted); }}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 9.5v5h3.5l4.5 4v-13l-4.5 4z" fill="currentColor" /><g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">{muted ? <path d="m15.5 9.5 5 5m0-5-5 5" /> : <><path d="M15.5 9.2a4 4 0 0 1 0 5.6" /><path d="M18.2 6.8a7.5 7.5 0 0 1 0 10.4" /></>}</g></svg>
      </button>
      <button ref={button} type="button" className="action" onClick={toggle} aria-pressed={frozen}>
        {frozen ? "Разморозить карту" : "Заморозить карту"}
      </button>
    </main>
  );
}
