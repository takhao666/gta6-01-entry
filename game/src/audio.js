// All sound is synthesised with WebAudio — no audio files, no network.
// Engine hum, sirens, gunshots, pickups and a small bass-driven music loop.
export function createAudio() {
  const audio = {
    ctx: null, master: null, muted: false, engineOsc: null, engineGain: null,
    sirenOsc: null, sirenGain: null, sirenTimer: 0, musicTimer: 0, musicStep: 0,
    ensure() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      // Engine: a low sawtooth whose pitch follows speed.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 50;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const engineFilter = this.ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      this.engineOsc.connect(engineFilter);
      engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
      // Siren: a sine that swings between two tones.
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'sine';
      this.sirenOsc.frequency.value = 700;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
    },
    setMuted(m) {
      this.muted = m;
      if (this.master) this.master.gain.value = m ? 0 : 0.5;
    },
    setEngine(speedRatio, driving) {
      if (!this.ctx) return;
      const target = driving ? 0.05 + 0.09 * speedRatio : 0;
      this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
      this.engineOsc.frequency.setTargetAtTime(46 + 130 * speedRatio, this.ctx.currentTime, 0.08);
    },
    setSiren(on, dt) {
      if (!this.ctx) return;
      this.sirenTimer += dt;
      if (on) {
        this.sirenGain.gain.setTargetAtTime(0.045, this.ctx.currentTime, 0.1);
        const f = this.sirenTimer % 1 < 0.5 ? 660 : 880;
        this.sirenOsc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.05);
      } else {
        this.sirenGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      }
    },
    blip(freq, dur, type = 'square', vol = 0.12) {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g);
      g.connect(this.master);
      o.start(t);
      o.stop(t + dur);
    },
    noise(dur, vol = 0.25, low = 400) {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = low;
      const g = this.ctx.createGain();
      g.gain.value = vol;
      src.connect(filter);
      filter.connect(g);
      g.connect(this.master);
      src.start(t);
    },
    gunshot() { this.noise(0.16, 0.3, 900); this.blip(140, 0.1, 'square', 0.1); },
    crash() { this.noise(0.3, 0.3, 200); },
    pickup() { this.blip(660, 0.09); setTimeout(() => this.blip(990, 0.12), 70); },
    missionDone() {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.blip(f, 0.18, 'triangle', 0.16), i * 110));
    },
    missionFail() {
      [392, 330, 262].forEach((f, i) => setTimeout(() => this.blip(f, 0.25, 'triangle', 0.14), i * 140));
    },
    // A slow funk bassline + hats, stepped on a timer so it costs nothing.
    musicTick(dt) {
      if (!this.ctx || this.muted) return;
      this.musicTimer += dt;
      if (this.musicTimer < 0.21) return;
      this.musicTimer = 0;
      const bass = [55, 0, 55, 65.4, 0, 55, 49, 58.3, 55, 0, 55, 65.4, 73.4, 0, 65.4, 58.3];
      const note = bass[this.musicStep % bass.length];
      if (note) this.blip(note, 0.19, 'triangle', 0.07);
      if (this.musicStep % 2 === 0) this.noise(0.03, 0.03, 6000);
      this.musicStep += 1;
    },
  };
  return audio;
}
