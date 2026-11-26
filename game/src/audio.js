// Procedural sound for AZURE REACH: every sound is synthesized with the
// Web Audio API — engine hum, wind, ring chimes, landing thuds and the
// debrief fanfare. No audio files, no network.

export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    engineOsc: null,
    engineGain: null,
    windSource: null,
    windGain: null,
    muted: false,
    enabled: false,

    // Start on the first user gesture (browsers require it).
    start() {
      if (this.enabled) return;
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);

        // Engine: two detuned sawtooth oscillators through a low-pass.
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.value = 55;
        const second = this.ctx.createOscillator();
        second.type = 'sawtooth';
        second.frequency.value = 55.7;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 420;
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0.0;
        this.engineOsc.connect(filter);
        second.connect(filter);
        filter.connect(this.engineGain);
        this.engineGain.connect(this.master);
        this.engineOsc.start();
        second.start();
        this.engineOsc2 = second;

        // Wind: looped noise through a band-pass, gain follows airspeed.
        const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        this.windSource = this.ctx.createBufferSource();
        this.windSource.buffer = buffer;
        this.windSource.loop = true;
        const windFilter = this.ctx.createBiquadFilter();
        windFilter.type = 'bandpass';
        windFilter.frequency.value = 600;
        windFilter.Q.value = 0.6;
        this.windGain = this.ctx.createGain();
        this.windGain.gain.value = 0.0;
        this.windSource.connect(windFilter);
        windFilter.connect(this.windGain);
        this.windGain.connect(this.master);
        this.windSource.start();

        this.enabled = true;
      } catch (err) {
        this.enabled = false;
      }
    },

    // Called every frame: engine pitch follows throttle, wind follows speed.
    update(throttle, speed, onGround) {
      if (!this.enabled || this.muted) return;
      const t = this.ctx.currentTime;
      const freq = 42 + throttle * 68 + speed * 0.35;
      this.engineOsc.frequency.setTargetAtTime(freq, t, 0.08);
      this.engineOsc2.frequency.setTargetAtTime(freq * 1.013, t, 0.08);
      const engineLevel = onGround ? 0.02 + throttle * 0.05 : 0.03 + throttle * 0.075;
      this.engineGain.gain.setTargetAtTime(engineLevel, t, 0.1);
      const windLevel = Math.min(0.12, Math.max(0, (speed - 25) / 600));
      this.windGain.gain.setTargetAtTime(onGround ? windLevel * 0.3 : windLevel, t, 0.15);
    },

    // A short tone: frequency, duration, shape and volume.
    blip(freq, dur, type, vol) {
      if (!this.enabled || this.muted) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol || 0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    },

    ringChime() {
      this.blip(880, 0.35, 'sine', 0.2);
      setTimeout(() => this.blip(1318, 0.4, 'sine', 0.16), 70);
    },

    landThud(hard) {
      this.blip(hard ? 70 : 95, 0.25, 'triangle', hard ? 0.3 : 0.18);
    },

    crashSound() {
      this.blip(55, 0.8, 'sawtooth', 0.25);
      setTimeout(() => this.blip(38, 0.9, 'sawtooth', 0.2), 120);
    },

    fanfare() {
      const notes = [523, 659, 784, 1046];
      notes.forEach((n, i) => setTimeout(() => this.blip(n, 0.45, 'triangle', 0.18), i * 130));
    },

    toggleMute() {
      this.muted = !this.muted;
      if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
      return this.muted;
    },
  };
  return audio;
}
