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
  if (audioEl) audioEl.volume = opts.enabled ? musicVolume : 0;
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
};

// ---------- 배경음악 ----------
let audioEl: HTMLAudioElement | null = null;
let musicVolume = 0.4;
export let currentTrack: string | null = null;

export function playMusic(base: string, id: string | null) {
  if (!id) return stopMusic();
  if (!audioEl) {
    audioEl = new Audio();
    audioEl.loop = true;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) audioEl?.pause();
      else if (currentTrack && fxEnabled) audioEl?.play().catch(() => {});
    });
  }
  if (currentTrack !== id) {
    audioEl.src = `${base}assets/audio/${id}.mp3`;
    currentTrack = id;
  }
  audioEl.volume = musicVolume;
  return audioEl.play().catch(() => {
    // 브라우저는 첫 터치 전에는 소리를 막는다 → 첫 터치 때 다시 재생
    const retry = () => { if (currentTrack) audioEl?.play().catch(() => {}); };
    window.addEventListener('pointerdown', retry, { once: true });
  });
}
export function stopMusic() {
  audioEl?.pause();
  currentTrack = null;
}
/** 다른 소리가 날 때 배경음악을 잠깐 줄인다 */
export function duckMusic(ms = 1200) {
  if (!audioEl || audioEl.paused) return;
  audioEl.volume = musicVolume * 0.3;
  setTimeout(() => { if (audioEl) audioEl.volume = musicVolume; }, ms);
}
