/** 極簡音效：WebAudio 合成，不需外部檔案 */
let ctx: AudioContext | null = null;
let enabled = true;
let bz: OscillatorNode | null = null;

function ac(): AudioContext | null {
  try { ctx ??= new AudioContext(); if (ctx.state === 'suspended') void ctx.resume(); return ctx; } catch { return null; }
}

function blip(freq: number, ms: number, type: OscillatorType = 'sine', gain = 0.08, slide = 0): void {
  if (!enabled) return;
  const a = ac(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.value = freq;
  if (slide) o.frequency.linearRampToValueAtTime(freq + slide, a.currentTime + ms / 1000);
  g.gain.setValueAtTime(gain, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + ms / 1000);
  o.connect(g).connect(a.destination);
  o.start(); o.stop(a.currentTime + ms / 1000);
}

export const sfx = {
  setEnabled(v: boolean) { enabled = v; if (!v) sfx.buzzer(false); },
  isEnabled() { return enabled; },
  pick() { blip(880, 60, 'triangle', 0.05); },
  connect() { blip(660, 90, 'triangle', 0.07, 220); },
  remove() { blip(300, 120, 'sawtooth', 0.04, -120); },
  error() { blip(180, 160, 'square', 0.05); },
  step() { blip(523, 80, 'sine', 0.06); setTimeout(() => blip(784, 120, 'sine', 0.06), 90); },
  click() { blip(1200, 30, 'square', 0.02); },
  buzzer(on: boolean) {
    const a = ac(); if (!a) return;
    if (on && enabled && !bz) {
      bz = a.createOscillator(); const g = a.createGain(); g.gain.value = 0.06;
      bz.type = 'square'; bz.frequency.value = 420;
      bz.connect(g).connect(a.destination); bz.start();
    } else if ((!on || !enabled) && bz) { bz.stop(); bz.disconnect(); bz = null; }
  },
};
