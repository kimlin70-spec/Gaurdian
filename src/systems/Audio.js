// 웹오디오로 만든 간단한 효과음/배경음. 첫 탭에서 unlock() 호출 (iOS 사파리).
import Save from './Save.js';

const NOTE = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 배경음: [미디음, 박자] 멜로디와 베이스. tempo 는 BPM.
const BGM = {
  title:   { tempo: 100, mel: [[72, 1], [76, 1], [79, 1], [76, 1], [77, 1], [81, 1], [84, 2], [79, 1], [77, 1], [76, 1], [74, 1], [72, 4]], bass: [[48, 2], [52, 2], [53, 2], [55, 2], [52, 2], [50, 2], [48, 4]] },
  village: { tempo: 112, mel: [[72, 1], [74, 1], [76, 1], [79, 1], [76, 1], [74, 1], [72, 2], [69, 1], [72, 1], [74, 1], [76, 1], [74, 1], [72, 1], [69, 2]], bass: [[48, 2], [55, 2], [53, 2], [55, 2], [45, 2], [50, 2], [53, 2], [55, 2]] },
  field:   { tempo: 96,  mel: [[69, 1.5], [72, 0.5], [71, 1], [69, 1], [67, 2], [64, 2], [65, 1.5], [67, 0.5], [69, 1], [72, 1], [71, 2], [69, 2]], bass: [[45, 2], [45, 2], [43, 2], [40, 2], [41, 2], [41, 2], [43, 2], [45, 2]] },
  battle:  { tempo: 140, mel: [[69, 0.5], [69, 0.5], [72, 0.5], [69, 0.5], [74, 1], [72, 1], [71, 0.5], [71, 0.5], [74, 0.5], [71, 0.5], [76, 1], [74, 1], [77, 0.5], [76, 0.5], [74, 0.5], [72, 0.5], [71, 1], [69, 1]], bass: [[45, 1], [45, 1], [45, 1], [45, 1], [43, 1], [43, 1], [43, 1], [43, 1], [41, 1], [41, 1], [43, 1], [43, 1], [45, 1], [45, 1], [45, 1], [45, 1]] },
  boss:    { tempo: 120, mel: [[62, 1], [62, 0.5], [65, 0.5], [68, 1], [67, 1], [65, 1], [62, 1], [60, 2], [62, 1], [65, 1], [69, 1], [68, 1], [67, 2], [65, 2]], bass: [[38, 1], [38, 1], [38, 1], [38, 1], [36, 1], [36, 1], [36, 1], [36, 1], [41, 2], [43, 2], [38, 2], [38, 2]] },
  victory: { tempo: 130, mel: [[72, 0.5], [72, 0.5], [72, 0.5], [76, 1.5], [79, 1], [76, 1], [79, 2]], bass: [[48, 2], [52, 2], [55, 2], [48, 2]], once: true },
};

const Audio = {
  ctx: null, master: null, muted: false, current: null, timer: null,
  nextTime: 0, melIdx: 0, bassIdx: 0, melTime: 0, bassTime: 0,

  init() { this.muted = !!Save.loadSettings().muted; },

  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.5; this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      // 무음 버퍼 한 번 재생 (iOS 언락)
      const b = this.ctx.createBuffer(1, 1, 22050); const s = this.ctx.createBufferSource(); s.buffer = b; s.connect(this.ctx.destination); s.start(0);
      if (this.pendingBgm) { const n = this.pendingBgm; this.pendingBgm = null; this.playBgm(n); }
    } catch (e) { /* ignore */ }
  },

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    const s = Save.loadSettings(); s.muted = this.muted; Save.writeSettings(s);
  },

  tone(freq, start, dur, type = 'square', vol = 0.15, slide = 0) {
    if (!this.ctx || !this.master) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, start);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), start + dur);
    g.gain.setValueAtTime(vol, start); g.gain.exponentialRampToValueAtTime(0.001, start + dur);
    o.connect(g); g.connect(this.master); o.start(start); o.stop(start + dur + 0.02);
  },

  sfx(name) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    switch (name) {
      case 'tap': this.tone(880, t, 0.06, 'square', 0.08); break;
      case 'hit': this.tone(180, t, 0.12, 'sawtooth', 0.2, -120); this.tone(90, t + 0.02, 0.1, 'square', 0.15); break;
      case 'slash': this.tone(600, t, 0.1, 'sawtooth', 0.15, -400); break;
      case 'heal': [523, 659, 784].forEach((f, i) => this.tone(f, t + i * 0.08, 0.2, 'triangle', 0.15)); break;
      case 'purify': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, t + i * 0.1, 0.35, 'triangle', 0.15)); break;
      case 'levelup': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, t + i * 0.09, 0.25, 'square', 0.12)); break;
      case 'chest': this.tone(660, t, 0.1, 'square', 0.12); this.tone(990, t + 0.1, 0.2, 'square', 0.12); break;
      case 'error': this.tone(200, t, 0.15, 'square', 0.12); this.tone(150, t + 0.12, 0.2, 'square', 0.12); break;
      case 'step': this.tone(300, t, 0.03, 'triangle', 0.05); break;
      case 'encounter': this.tone(400, t, 0.15, 'sawtooth', 0.15, 300); this.tone(400, t + 0.15, 0.3, 'sawtooth', 0.15, -200); break;
      case 'star': [988, 1319, 1760].forEach((f, i) => this.tone(f, t + i * 0.05, 0.15, 'triangle', 0.1)); break;
      case 'defend': this.tone(330, t, 0.15, 'triangle', 0.12); break;
      case 'win': [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, t + i * 0.1, 0.3, 'square', 0.1)); break;
    }
  },

  playBgm(name) {
    if (this.current === name) return;
    this.stopBgm();
    if (!this.ctx) { this.pendingBgm = name; return; }
    const track = BGM[name]; if (!track) return;
    this.current = name;
    this.melIdx = 0; this.bassIdx = 0;
    this.melTime = this.ctx.currentTime + 0.1; this.bassTime = this.melTime;
    const beat = 60 / track.tempo;
    const schedule = () => {
      if (!this.ctx || this.current !== name) return;
      const ahead = this.ctx.currentTime + 0.4;
      while (this.melTime < ahead) {
        const [m, d] = track.mel[this.melIdx];
        this.tone(NOTE(m), this.melTime, beat * d * 0.9, 'square', 0.06);
        this.melTime += beat * d; this.melIdx = (this.melIdx + 1) % track.mel.length;
        if (this.melIdx === 0 && track.once) { this.current = null; clearInterval(this.timer); this.timer = null; return; }
      }
      while (this.bassTime < ahead) {
        const [m, d] = track.bass[this.bassIdx];
        this.tone(NOTE(m), this.bassTime, beat * d * 0.8, 'triangle', 0.09);
        this.bassTime += beat * d; this.bassIdx = (this.bassIdx + 1) % track.bass.length;
      }
    };
    schedule();
    this.timer = setInterval(schedule, 120);
  },
  stopBgm() { if (this.timer) clearInterval(this.timer); this.timer = null; this.current = null; this.pendingBgm = null; },
};
export default Audio;
