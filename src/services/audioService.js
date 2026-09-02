// Web Audio API Sound Synthesizer for Cyberpunk & Terminal Sound FX
class SoundFX {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.muted = false;
    this.masterVolume = 0.8;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMuted(isMuted) {
    this.muted = !!isMuted;
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  isMuted() {
    return this.muted || !this.enabled;
  }

  setVolume(vol) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
  }

  playBeep(freq = 800, type = 'sine', duration = 0.05, gainValue = 0.05) {
    if (this.isMuted()) return;
    try {
      this.init();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      const effectiveGain = gainValue * this.masterVolume;
      gain.gain.setValueAtTime(effectiveGain, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch {
      // Audio context might be restricted before user interaction
    }
  }

  // Keypress tick
  playKeypress() {
    this.playBeep(1200 + Math.random() * 400, 'triangle', 0.02, 0.02);
  }

  // Sent message chirp
  playSent() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.08); // A5

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    } catch {
      // Audio context might be restricted before user interaction
    }
  }

  // Received message alert
  playReceived() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(1174.66, now + 0.06);

      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.18);
    } catch {
      // Audio context might be restricted before user interaction
    }
  }

  // Anti-delete intercepted alarm
  playGlitchAlarm() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.linearRampToValueAtTime(800, now + 0.1);
      osc.frequency.linearRampToValueAtTime(150, now + 0.2);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } catch {
      // Audio context might be restricted before user interaction
    }
  }

  // Call ring sound
  playRing() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(480, now + 0.1);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.6);
    } catch {
      // Audio context might be restricted before user interaction
    }
  }

  // Cyber command execute
  playCommandExec() {
    this.playBeep(450, 'sawtooth', 0.08, 0.04);
  }

  // Read receipt tick (crisp double micro-chirp)
  playReadTick() {
    if (this.isMuted()) return;
    this.playBeep(1200, 'sine', 0.025, 0.03);
    setTimeout(() => {
      this.playBeep(1500, 'sine', 0.035, 0.04);
    }, 45);
  }

  // Message Pin / Anchor tone (futuristic resonant ping)
  playPinSound() {
    if (this.isMuted()) return;
    this.playBeep(987.77, 'triangle', 0.07, 0.06); // B5
    setTimeout(() => {
      this.playBeep(1318.51, 'sine', 0.12, 0.07); // E6
    }, 60);
  }
}

export const soundFX = new SoundFX();

