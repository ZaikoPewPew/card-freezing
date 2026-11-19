/* All synthesised, built on the envelope's voices in convert-card. The ice sounds are noise only:
   freeze is a crunch as the ice grips, a fizz of crystallisation and a few sharp cracks; thaw is the
   grip letting go, soft and fading. The card's press and release keep the envelope's grab and boing. */

const VOLUME = .8, note = (i: number) => 440 * 2 ** ((72 + 12 * (i / 5 | 0) + [0, 2, 4, 7, 9][i % 5] - 69) / 12);
const rand = (a: number, b: number) => a + Math.random() * (b - a);

type Air = { at?: number; buffer?: AudioBuffer; type?: BiquadFilterType; from: number; to: number; Q?: number; gain: number; attack?: number; dur: number; send?: number; pan?: [number, number] };

function voices(ctx: AudioContext) {
  const sr = ctx.sampleRate, now = () => ctx.currentTime;
  const master = ctx.createGain(), limit = ctx.createDynamicsCompressor(), room = ctx.createConvolver(), wet = ctx.createGain();
  limit.threshold.value = -9; limit.ratio.value = 8; master.gain.value = VOLUME; wet.gain.value = .3;
  master.connect(limit).connect(ctx.destination); room.connect(wet).connect(master);
  const sheet = (ch: number, sec: number, fill: (d: Float32Array) => void) => { const b = ctx.createBuffer(ch, sec * sr | 0, sr); for (let c = 0; c < ch; c++) fill(b.getChannelData(c)); return b; };
  const hiss = sheet(1, 2, d => { for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; });
  const foil = sheet(1, 2, d => { for (let n = 0; n < 900; n++) { const s = Math.random() * (d.length - 400) | 0, a = Math.random() ** 3 * (Math.random() < .5 ? -1 : 1), len = 30 + Math.random() * 260 | 0; for (let i = 0; i < len; i++) d[s + i] += a * (Math.random() * 2 - 1) * Math.exp(-i / len * 5); } });
  room.buffer = sheet(2, 1.2, d => { let soft = 0; for (let i = 0; i < d.length; i++) { const k = i / d.length; soft += (Math.random() * 2 - 1 - soft) * (.5 - .42 * k); d[i] = soft * (1 - k) ** 3; } });
  const env = (pm: AudioParam, at: number, peak: number, attack: number, dur: number) => { pm.setValueAtTime(.0001, at); pm.exponentialRampToValueAtTime(peak, at + attack); pm.exponentialRampToValueAtTime(.0001, at + dur); };
  const out = (node: AudioNode, send: number) => { node.connect(master); if (send) { const s = ctx.createGain(); s.gain.value = send; node.connect(s).connect(room); } };

  function air({ at = now(), buffer = hiss, type = "bandpass", from, to, Q = 1, gain, attack = .004, dur, send = 0, pan = [0, 0] }: Air) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), p = ctx.createStereoPanner();
    s.buffer = buffer; s.loop = true; f.type = type; f.Q.value = Q;
    f.frequency.setValueAtTime(from, at); f.frequency.exponentialRampToValueAtTime(to, at + dur);
    env(g.gain, at, gain, attack, dur);
    p.pan.setValueAtTime(pan[0], at); p.pan.linearRampToValueAtTime(pan[1], at + dur);
    s.connect(f).connect(g).connect(p); out(p, send); s.start(at, Math.random() * 1.8); s.stop(at + dur + .02);
  }
  function chime(freq: number, { at = now(), gain = .1, dur = .5, send = .5, pan = 0 } = {}) {
    const g = ctx.createGain(), p = ctx.createStereoPanner(); g.gain.value = gain; p.pan.value = pan; g.connect(p); out(p, send);
    for (const [ratio, level, life] of [[1, 1, 1], [3.9, .18, .22], [9.2, .05, .08]]) { const o = ctx.createOscillator(), a = ctx.createGain(), d = Math.max(.03, dur * life); o.frequency.value = freq * ratio; env(a.gain, at, level, .002, d); o.connect(a).connect(g); o.start(at); o.stop(at + d + .02); }
  }
  function coo(freq: number, shape: [number, number][], { at = now(), gain = .06, attack = .008, send = .25, pan = 0, wave = "triangle" as OscillatorType } = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain(), p = ctx.createStereoPanner(), dur = shape[shape.length - 1][0] + .05;
    o.type = wave; p.pan.value = pan;
    for (const [s, m] of shape) if (s) o.frequency.exponentialRampToValueAtTime(freq * m, at + s); else o.frequency.setValueAtTime(freq * m, at);
    env(g.gain, at, gain, attack, dur);
    o.connect(g).connect(p); out(p, send); o.start(at); o.stop(at + dur + .02);
  }
  /* ice, from noise alone (no tones: tones read as sci-fi). Each grain is a few ms of noise; how many,
     how loud and how dark they are is what turns them into fizz, crunch or a crack */
  function iceBuffer(T: number, kind: "freeze" | "thaw") {
    const b = ctx.createBuffer(2, T * sr | 0, sr), L = b.getChannelData(0), R = b.getChannelData(1);
    const grain = (at: number, len: number, amp: number, pan: number, dark: number) => {
      // dark 0: bright click (differentiated noise); dark near 1: a duller, lower crunch (smoothed noise)
      let lp = 0, prev = 0;
      const gl = Math.cos((pan + 1) * Math.PI / 4), gr = Math.sin((pan + 1) * Math.PI / 4);
      for (let k = 0; k < len; k++) {
        const i = at + k; if (i < 0 || i >= L.length) break;
        const x = (Math.random() * 2 - 1) * Math.exp(-k / len * 5);
        lp += (x - lp) * (1 - dark); const y = dark ? lp : x - prev * .8; prev = x;
        L[i] += y * amp * gl; R[i] += y * amp * gr;
      }
    };
    const at = (s: number) => s * sr | 0;
    if (kind === "freeze") {
      // crunch: the first grip, ice packing tight round the card as it squats
      for (let n = 0; n < 160; n++) { const t = .05 + .55 * Math.random() ** 1.5; grain(at(t), 60 + Math.random() * 380 | 0, Math.random() ** 2 * .5, rand(-.5, .5), rand(.75, .92)); }
      // crystallisation: a fine fizz that swells as the frost spreads and thins as it sets
      for (let t = .35; t < T; t += 1 / 900) {
        const d = Math.sin(Math.PI * Math.min(1, (t - .35) / (T - .45))) ** 1.3;
        if (Math.random() < d * .55) grain(at(t), 4 + Math.random() * 40 | 0, Math.random() ** 2.6 * .45 * d, rand(-.9, .9), 0);
      }
      // cracks: a handful of sharp, louder snaps as the ice tightens
      for (let n = 0; n < 9; n++) { const t = rand(.55, T - .4); grain(at(t), 120 + Math.random() * 500 | 0, rand(.35, .7), rand(-.7, .7), rand(0, .35)); grain(at(t + .004), 400, rand(.1, .2), 0, .9); }
    } else {
      // the grip letting go: soft, sparse crackle that fades, with a little dull slush
      for (let t = 0; t < T; t += 1 / 600) {
        const d = Math.exp(-t / .55) * Math.min(1, t / .08);
        if (Math.random() < d * .4) grain(at(t), 6 + Math.random() * 30 | 0, Math.random() ** 2.6 * .3, rand(-.8, .8), 0);
        if (Math.random() < d * .08) grain(at(t), 200 + Math.random() * 400 | 0, Math.random() ** 2 * .18, rand(-.5, .5), rand(.85, .95));
      }
    }
    return b;
  }
  const play = (b: AudioBuffer, send: number, gain = 1) => { const s = ctx.createBufferSource(), g = ctx.createGain(); g.gain.value = gain; s.buffer = b; s.connect(g); out(g, send); s.start(); };

  return {
    ctx,
    mute(off: boolean) { master.gain.setTargetAtTime(off ? 0 : VOLUME, now(), .015); },
    freeze() { play(iceBuffer(3.2, "freeze"), .3); },
    thaw() { play(iceBuffer(1.8, "thaw"), .3, .8); air({ at: now() + .4, type: "lowpass", from: 260, to: 700, Q: .3, gain: .03, attack: .5, dur: 1.2, send: .3 }); },
    // the push as the card springs up: a short, low, dull thud of noise
    thump() { air({ type: "lowpass", from: 320, to: 70, Q: .8, gain: .35, attack: .003, dur: .16, send: .1 }); },
    grab() { air({ buffer: foil, from: 3000, to: 2200, Q: .7, gain: .3, attack: .003, dur: .09 }); },
    boing() { coo(340, [[0, .8], [.05, 1.6], [.12, .85], [.2, 1.25], [.3, 1]], { gain: .12, send: .2 }); },
    arrive() { const at = now(); air({ at, from: 900, to: 2600, gain: .06, attack: .3, dur: .75, send: .4, pan: [.7, 0] }); coo(note(3), [[0, .9], [.05, 1.03]], { at: at + .78, gain: .05 }); coo(note(5), [[0, .9], [.06, 1.03]], { at: at + .87, gain: .05 }); },
  };
}

type Voices = ReturnType<typeof voices>;
let v: Voices | undefined;

/* the mute switch, remembered across visits like the envelope's */
const KEY = "card-freezing-muted";
let muted = false;
try { muted = localStorage.getItem(KEY) === "1"; } catch { /* private mode: start with sound */ }
export const isMuted = () => muted;
export function setMuted(off: boolean) {
  muted = off; v?.mute(off);
  try { localStorage.setItem(KEY, off ? "1" : "0"); } catch { /* not remembered, still applied */ }
}

/* audio can only start from a gesture: the first press anywhere wakes it */
export function wake() {
  if (v) { if (v.ctx.state === "suspended") v.ctx.resume(); return; }
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    v = voices(new Ctx()); v.mute(muted); v.ctx.resume();
  } catch { v = undefined; }
}

export const sfx = new Proxy({} as Omit<Voices, "ctx">, {
  get: (_, k: string) => (...a: unknown[]) => { try { (v as unknown as Record<string, (...x: unknown[]) => void>)?.[k]?.(...a); } catch { /* sound is never worth an error */ } },
});
