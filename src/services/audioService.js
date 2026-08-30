// Completely Silent Audio Service (All sounds and sound effects permanently muted)
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
