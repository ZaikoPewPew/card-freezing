/* All synthesised, built on the envelope's voices in convert-card: shaped noise, toy chimes and
   tiny pitched coos on one pentatonic scale. Freeze is a cold gust, ice crackling as it sets and
   glassy chimes climbing; thaw is a warm swell, cracks letting go and a few melting drips. */

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
  // one tick of ice: a few ms of bright, narrow noise
  const crack = (at: number, gain: number) => { const f = rand(2600, 8500); air({ at, buffer: foil, from: f, to: f * rand(.8, 1.1), Q: rand(3, 9), gain, attack: .001, dur: rand(.012, .045), send: .35, pan: [rand(-.8, .8), rand(-.8, .8)] }); };

  return {
    ctx,
    freeze() {
      const at = now();
      air({ at, from: 500, to: 3800, Q: .7, gain: .1, attack: .3, dur: 1, send: .5, pan: [0, .4] });                  // a cold gust up the screen
      air({ at: at + .05, type: "highpass", from: 6000, to: 9000, Q: .5, gain: .025, attack: .5, dur: 1.1, send: .6 }); // and its icy hiss
      for (let i = 0; i < 46; i++) crack(at + .12 + 1.05 * Math.sqrt(Math.random()), rand(.04, .16));                // crackling thickens as it sets
      [9, 10, 12, 14].forEach((n, i) => chime(note(n), { at: at + .22 + i * .14, gain: .022, dur: .7, send: .9, pan: rand(-.5, .5) }));
      coo(170, [[0, 1], [.14, .62]], { at: at + 1.05, gain: .12, wave: "sine", send: .2 });                            // locked: a low set
      chime(note(15), { at: at + 1.08, gain: .03, dur: 1.1, send: 1 });
      for (let i = 0; i < 8; i++) crack(at + 1.05 + Math.random() * .12, rand(.08, .18));
    },
    thaw() {
      const at = now();
      for (let i = 0; i < 14; i++) crack(at + Math.random() * .35, rand(.08, .2));                                    // the ice lets go
      air({ at: at + .05, type: "lowpass", from: 500, to: 2200, Q: .6, gain: .1, attack: .35, dur: .95, send: .4, pan: [.3, -.2] }); // a warm swell
      [12, 10, 9, 7].forEach((n, i) => chime(note(n), { at: at + .18 + i * .13, gain: .016, dur: .6, send: .8, pan: rand(-.5, .5) }));
      for (let i = 0; i < 3; i++) coo(rand(520, 760), [[0, 1], [.07, 2.3]], { at: at + .45 + i * rand(.16, .24), gain: .07, wave: "sine", send: .5, pan: rand(-.6, .6) }); // drips
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
