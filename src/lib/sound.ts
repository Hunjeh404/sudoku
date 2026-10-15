// 효과음은 Web Audio 합성음(파일 없음). 배경음악은 필요할 때만 불러온다.
// 기본값: 소리 꺼짐. 동시 효과음은 2개까지.

let ctx: AudioContext | null = null;
let fxVolume = 0.6;
let fxEnabled = false;
let active = 0;
const MAX_SOUNDS = 2;

export function configureSound(opts: { enabled: boolean; fx: number; music: number }) {
  fxEnabled = opts.enabled;
  fxVolume = opts.fx;
  musicVolume = opts.music;
  const d = currentTrack ? decks.get(currentTrack) : null;
  if (d) rampTo(d, level(), 0.2);
}

function ac() {
  if (!ctx) {
    const C = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx!.state === 'suspended') ctx!.resume();
  return ctx;
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.25) {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t0 = c.currentTime + start;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain * fxVolume, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

function play(f: () => void, ms: number) {
  if (!fxEnabled || active >= MAX_SOUNDS) return;
  active++;
  f();
  setTimeout(() => active--, ms);
}

// 리라 7음(도리아 느낌의 음계)
export const LYRE_NOTES = [293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25];
export function pluck(i: number) {
  if (!fxEnabled) return;
  const f = LYRE_NOTES[i];
  const c = ac();
  if (!c) return;
  tone(f, 0, 1.4, 'triangle', 0.3);
  tone(f * 2, 0, 0.6, 'sine', 0.08);
}

export const sfx = {
  chime: () => play(() => { tone(880, 0, 0.6); tone(1318.5, 0.12, 0.7); tone(1760, 0.24, 0.9, 'sine', 0.15); }, 900),
  door: () => play(() => { tone(659.25, 0, 0.5, 'triangle'); tone(523.25, 0.18, 0.6, 'triangle'); }, 700),
  soft: () => play(() => tone(220, 0, 0.25, 'sine', 0.2), 300),
  pop: () => play(() => tone(520, 0, 0.12, 'square', 0.06), 150),
  rustle: () => play(() => { for (let i = 0; i < 5; i++) tone(2000 + Math.random() * 2000, i * 0.04, 0.05, 'sawtooth', 0.02); }, 300),
  water: () => play(() => { tone(400, 0, 0.3, 'sine', 0.15); tone(600, 0.15, 0.3, 'sine', 0.1); }, 500),
  success: () => play(() => { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.12, 0.6, 'triangle', 0.22)); }, 1200),
  tap: () => play(() => tone(700, 0, 0.06, 'sine', 0.08), 80),
  // 판의 피리: 숫자마다 도레미파솔라시도레
  note: (d: number) => play(() => { const f = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25, 587.33][d - 1] ?? 440; tone(f, 0, 0.35, 'triangle', 0.18); tone(f * 2, 0, 0.15, 'sine', 0.04); }, 380),
};

// ---------- 배경음악 ----------
// 곡마다 오디오를 하나씩 두고, 바꿀 때 이전 곡은 천천히 줄이고 새 곡은 천천히 키운다(엇갈려 페이드).
// 음량은 Web Audio 게인으로 조절한다(아이폰은 audio.volume을 바꿀 수 없음).
// 되돌아온 곡은 멈췄던 자리부터 이어서 나온다.
const FADE_SEC = 2.5;
interface Deck { el: HTMLAudioElement; gain: GainNode; timer?: number }
const decks = new Map<string, Deck>();
let musicVolume = 0.4;
let duck = 1;
let hooked = false;
export let currentTrack: string | null = null;

const level = () => (fxEnabled ? musicVolume * duck : 0);

function deckFor(base: string, id: string): Deck | null {
  let d = decks.get(id);
  if (d) return d;
  const c = ac();
  if (!c) return null;
  const el = new Audio(`${base}assets/audio/${id}.mp3`);
  el.loop = true;
  const gain = c.createGain();
  gain.gain.value = 0;
  c.createMediaElementSource(el).connect(gain).connect(c.destination);
  d = { el, gain };
  decks.set(id, d);
  return d;
}

function rampTo(d: Deck, target: number, sec: number, then?: () => void) {
  clearTimeout(d.timer);
  const g = d.gain.gain, t = ctx!.currentTime;
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(target, t + sec);
  if (then) d.timer = window.setTimeout(then, sec * 1000 + 50);
}

function start(d: Deck) {
  if (ctx && ctx.state !== 'running') window.addEventListener('pointerdown', () => { ctx?.resume(); }, { once: true });
  d.el.play().catch(() => {
    // 브라우저는 첫 터치 전에는 소리를 막는다 → 첫 터치 때 다시 재생
    window.addEventListener('pointerdown', () => { ctx?.resume(); if (decks.get(currentTrack ?? '') === d) d.el.play().catch(() => {}); }, { once: true });
  });
}

export function playMusic(base: string, id: string | null) {
  if (!id) return stopMusic();
  if (!hooked) {
    hooked = true;
    document.addEventListener('visibilitychange', () => {
      const d = currentTrack ? decks.get(currentTrack) : null;
      if (!d) return;
      if (document.hidden) d.el.pause();
      else if (fxEnabled) start(d);
    });
  }
  const prev = currentTrack ? decks.get(currentTrack) : null;
  const d = deckFor(base, id);
  if (!d) return;
  if (prev && prev !== d) rampTo(prev, 0, FADE_SEC, () => prev.el.pause());
  currentTrack = id;
  rampTo(d, level(), FADE_SEC);
  if (d.el.paused) start(d);
}
export function stopMusic() {
  const d = currentTrack ? decks.get(currentTrack) : null;
  currentTrack = null;
  if (d) rampTo(d, 0, 1, () => d.el.pause());
}
/** 다른 소리가 날 때 배경음악을 잠깐 줄인다 */
export function duckMusic(ms = 1200) {
  const d = currentTrack ? decks.get(currentTrack) : null;
  if (!d || d.el.paused) return;
  duck = 0.3;
  rampTo(d, level(), 0.1);
  setTimeout(() => { duck = 1; if (decks.get(currentTrack ?? '') === d) rampTo(d, level(), 0.4); }, ms);
}
