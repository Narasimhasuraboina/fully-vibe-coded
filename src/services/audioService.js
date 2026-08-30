// Silent Sound Synthesizer (Sound permanently disabled)
class SoundFX {
  constructor() {
    this.enabled = false;
  }

  init() {}
  playBeep() {}
  playKeypress() {}
  playSent() {}
  playReceived() {}
  playGlitchAlarm() {}
  playRing() {}
  playCommandExec() {}
}

export const soundFX = new SoundFX();
