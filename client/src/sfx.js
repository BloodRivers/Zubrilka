const SFX_KEY = "zubrilka:sfx";
let enabled = true;
try {
  enabled = localStorage.getItem(SFX_KEY) !== "0";
} catch {
  /* ignore */
}
const changeListeners = new Set();

export function isSfxEnabled() {
  return enabled;
}

export function setSfxEnabled(v) {
  enabled = Boolean(v);
  try {
    localStorage.setItem(SFX_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
  for (const fn of changeListeners) fn(enabled);
}

export function onSfxChange(fn) {
  changeListeners.add(fn);
  fn(enabled);
  return () => changeListeners.delete(fn);
}

let ac = null;

function ctx() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
  }
  if (ac.state === "suspended") ac.resume();
  return ac;
}

function pop({ from = 900, to = 300, dur = 0.09, gain = 0.1, type = "sine", when = 0, detune = 0 }) {
  if (!enabled) return;
  const audio = ctx();
  if (!audio) return;
  const t0 = audio.currentTime + when;
  const osc = audio.createOscillator();
  const g = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, to), t0 + dur);
  osc.detune.setValueAtTime(detune, t0);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(audio.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

const pitch = (base, spread) => base * Math.pow(2, (Math.random() * 2 - 1) * spread / 12);

export const sfx = {
  tap() { pop({ from: pitch(1200, 4), to: pitch(500, 4), dur: 0.05, gain: 0.05 }); },
  flip() { pop({ from: pitch(1000, 4), to: pitch(420, 4), dur: 0.06, gain: 0.05 }); },
  correct() {
    pop({ from: pitch(740, 3), to: pitch(500, 3), dur: 0.07, gain: 0.08 });
    pop({ from: pitch(1100, 3), to: pitch(740, 3), dur: 0.07, gain: 0.07, when: 0.07 });
  },
  wrong() { pop({ from: pitch(320, 6), to: pitch(120, 6), dur: 0.14, gain: 0.08, type: "triangle" }); },
  match() { pop({ from: pitch(900, 5), to: pitch(620, 5), dur: 0.06, gain: 0.07 }); },
  win() {
    [523, 659, 784, 1047].forEach((f, i) =>
      pop({ from: f * 1.4, to: f, dur: 0.1, gain: 0.07, when: i * 0.09, detune: (Math.random() * 2 - 1) * 30 })
    );
  },
};