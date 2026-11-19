/* All synthesised, built on the envelope's voices in convert-card. Freeze is ice taking hold:
   a fizz of crystallisation, the creak of ice tightening, the "pew" a frozen lake sings under
   tension and a thin glass ping as it closes. Thaw is quiet: the ice loosening, a warm breath and two soft drops. */

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
  // the sound of something being gripped by ice, drawn sample by sample so it can be dense and fine
  function iceBuffer(T: number, kind: "freeze" | "thaw") {
    const b = ctx.createBuffer(2, T * sr | 0, sr), L = b.getChannelData(0), R = b.getChannelData(1);
    const put = (i: number, v: number, pan: number) => { if (i < 0 || i >= L.length) return; L[i] += v * (1 - pan) * .5 * 2 ** .5; R[i] += v * (1 + pan) * .5 * 2 ** .5; };
    // crystallisation: a fizz of tiny clicks, thickening as the ice spreads, then thinning as it sets
    const rate = (t: number) => kind === "freeze" ? 520 * Math.sin(Math.PI * Math.min(1, t / (T * .9))) ** 1.4 : 160 * Math.sin(Math.PI * Math.min(1, t / T)) * Math.exp(-t / .7);
    for (let t = 0; t < T; t += 1 / sr * 64) {
      let n = rate(t) * 64 / sr;
      while (n > 0) { if (Math.random() < n) {
        const at = (t * sr + Math.random() * 64) | 0, len = 6 + Math.random() * 50 | 0, amp = Math.random() ** 2.6 * .5, pan = rand(-.9, .9);
        let prev = 0;
        for (let k = 0; k < len; k++) { const x = (Math.random() * 2 - 1) * Math.exp(-k / len * 5); put(at + k, (x - prev * .7) * amp, pan); prev = x; }
      } n -= 1; }
    }
    // tiny ringing pops: bubbles in the ice giving way
    const pops = kind === "freeze" ? 30 : 0;
    for (let n = 0; n < pops; n++) {
      const at = (kind === "freeze" ? T * Math.random() ** .8 : .5 * Math.random()) * sr | 0, f = rand(2800, 9000), d = rand(.01, .04) * sr, amp = rand(.05, .16), pan = rand(-.8, .8);
      for (let k = 0; k < d * 4; k++) put(at + k, Math.sin(2 * Math.PI * f * k / sr) * Math.exp(-k / d) * amp, pan);
    }
    // creak: stick-slip, the clicks crowding together as the ice tightens round the card
    const creak = (from: number, len: number, gap0: number, gap1: number, amp: number, pan: number) => {
      for (let t = 0; t < len;) {
        const u = t / len, at = (from + t) * sr | 0, f = rand(650, 1150), a = amp * Math.sin(Math.PI * u) ** .7 * rand(.6, 1);
        for (let k = 0; k < .006 * sr; k++) put(at + k, Math.sin(2 * Math.PI * f * k / sr) * Math.exp(-k / (.0012 * sr)) * a, pan);
        t += (gap0 + (gap1 - gap0) * u) * rand(.7, 1.3);
      }
    };
    // pew: the singing of ice under tension, high frequencies arriving first, the rest sliding down after
    const pew = (at: number, f0: number, amp: number, pan: number) => {
      let ph = 0;
      for (let k = 0; k < .45 * sr; k++) { const t = k / sr, f = 180 + f0 * Math.exp(-t / .03); ph += 2 * Math.PI * f / sr; put((at * sr | 0) + k, Math.sin(ph) * Math.exp(-t / .13) * amp * Math.min(1, t / .002), pan); }
    };
    // glass: a thin inharmonic ping when the ice has closed
    const glass = (at: number, f: number, amp: number) => {
      for (const [ratio, lvl, life] of [[1, 1, .7], [2.76, .45, .35], [5.4, .22, .18], [8.93, .1, .1]]) for (let k = 0; k < life * 3 * sr; k++) put((at * sr | 0) + k, Math.sin(2 * Math.PI * f * ratio * k / sr) * Math.exp(-k / (life * sr)) * lvl * amp, 0);
    };
    if (kind === "freeze") {
      creak(.05, .7, .02, .006, .22, -.3);
      creak(1.45, .35, .012, .005, .14, .4);
      pew(.4, rand(3200, 4200), .1, rand(-.5, .5)); pew(1.15, rand(2600, 3600), .08, rand(-.5, .5)); pew(2.05, rand(3800, 4800), .06, rand(-.5, .5));
      glass(T - .6, rand(1900, 2300), .05);
    }
    return b;
  }
  const play = (b: AudioBuffer, send: number, gain = 1) => { const s = ctx.createBufferSource(), g = ctx.createGain(); g.gain.value = gain; s.buffer = b; s.connect(g); out(g, send); s.start(); };

  return {
    ctx,
    freeze() {
      const at = now();
      play(iceBuffer(3.2, "freeze"), .55);
      air({ at, type: "highpass", from: 5000, to: 8000, Q: .5, gain: .02, attack: 1.2, dur: 2.6, send: .6 });   // the cold settling in
    },
    thaw() {   // quiet: the ice loosening its grip as the warm wave rises, then two soft drops
      const at = now();
      play(iceBuffer(1.8, "thaw"), .4, .6);
      air({ at: at + .3, type: "lowpass", from: 300, to: 900, Q: .4, gain: .035, attack: .6, dur: 1.4, send: .5 });
      coo(rand(560, 640), [[0, 1], [.05, 1.6]], { at: at + 1.3, gain: .03, wave: "sine", send: .7, pan: -.3 });
      coo(rand(700, 780), [[0, 1], [.05, 1.6]], { at: at + 1.75, gain: .022, wave: "sine", send: .8, pan: .35 });
    },
    grab() { air({ buffer: foil, from: 3000, to: 2200, Q: .7, gain: .3, attack: .003, dur: .09 }); },
    boing() { coo(340, [[0, .8], [.05, 1.6], [.12, .85], [.2, 1.25], [.3, 1]], { gain: .12, send: .2 }); },
    arrive() { const at = now(); air({ at, from: 900, to: 2600, gain: .06, attack: .3, dur: .75, send: .4, pan: [.7, 0] }); coo(note(3), [[0, .9], [.05, 1.03]], { at: at + .78, gain: .05 }); coo(note(5), [[0, .9], [.06, 1.03]], { at: at + .87, gain: .05 }); },
  };
}

type Voices = ReturnType<typeof voices>;
let v: Voices | undefined;

/* audio can only start from a gesture: the first press anywhere wakes it */
export function wake() {
  if (v) { if (v.ctx.state === "suspended") v.ctx.resume(); return; }
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    v = voices(new Ctx()); v.ctx.resume();
  } catch { v = undefined; }
}

export const sfx = new Proxy({} as Omit<Voices, "ctx">, {
  get: (_, k: string) => (...a: unknown[]) => { try { (v as unknown as Record<string, (...x: unknown[]) => void>)?.[k]?.(...a); } catch { /* sound is never worth an error */ } },
});
