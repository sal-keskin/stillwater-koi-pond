/** Original procedural sound: mellow plucked strings and filtered water. No audio downloads. */
export class PondAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private harp?: GainNode;
  private water?: GainNode;
  private timer?: ReturnType<typeof setInterval>;
  private noise?: AudioBufferSourceNode;
  private nextNote = 0;
  private index = 0;
  private wanted = false;
  private disposed = false;
  private volume = .4;
  private harpEnabled = true;
  private waterEnabled = true;
  private abort = new AbortController();
  private readonly melody = [0, 4, 2, 7, 4, 9, 7, 2, 4, 0, 7, 4, 2, 9, 4, 2];
  private readonly notes = [130.813, 146.832, 164.814, 195.998, 220, 261.626, 293.665, 329.628, 391.995, 440];

  constructor() {
    document.addEventListener("visibilitychange", () => {
      if (!this.context) return;
      if (document.hidden) { void this.context.suspend().catch(() => {}); }
      else if (this.wanted) {
        this.nextNote = this.context.currentTime + .15;
        void this.context.resume().catch(() => {});
      }
    }, { signal: this.abort.signal });
  }

  get enabled() { return this.wanted; }
  async enable() {
    if (this.disposed) return;
    if (!this.context) this.create();
    const ctx = this.context!;
    await ctx.resume();
    if (this.disposed) return;
    this.wanted = true;
    this.master!.gain.cancelScheduledValues(ctx.currentTime);
    this.master!.gain.setTargetAtTime(this.volume, ctx.currentTime, .5);
    this.nextNote = ctx.currentTime + .15;
    if (!this.timer) this.timer = setInterval(() => this.schedule(), 200);
    this.schedule();
  }
  async disable() {
    this.wanted = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    const ctx = this.context;
    if (!ctx || ctx.state === "closed") return;
    this.master!.gain.cancelScheduledValues(ctx.currentTime);
    this.master!.gain.setTargetAtTime(0, ctx.currentTime, .12);
    await new Promise(resolve => setTimeout(resolve, 600));
    if (!this.wanted && !this.disposed) await ctx.suspend();
  }
  setVolume(value: number) {
    this.volume = Math.max(0, Math.min(1, Number.isFinite(value) ? value : .4));
    if (this.context && this.master) this.master.gain.setTargetAtTime(this.wanted ? this.volume : 0, this.context.currentTime, .1);
  }
  setLayers(harp: boolean, water: boolean) {
    this.harpEnabled = harp; this.waterEnabled = water;
    if (!this.context) return;
    this.harp!.gain.setTargetAtTime(harp ? .5 : 0, this.context.currentTime, .3);
    this.water!.gain.setTargetAtTime(water ? .18 : 0, this.context.currentTime, .3);
  }
  touch(x: number) {
    if (this.wanted && this.context?.state === "running" && this.harpEnabled) this.pluck(this.notes[Math.min(9, Math.floor(x * 10))], this.context.currentTime + .02, .35);
  }
  async destroy() {
    this.disposed = true; this.wanted = false; this.abort.abort();
    if (this.timer) clearInterval(this.timer);
    this.noise?.stop();
    if (this.context && this.context.state !== "closed") await this.context.close();
  }

  private create() {
    const ctx = new AudioContext(); this.context = ctx;
    this.master = ctx.createGain(); this.master.gain.value = 0;
    // A limiter provides a final ceiling even when several notes overlap.
    const limiter = ctx.createDynamicsCompressor(); limiter.threshold.value = -12; limiter.knee.value = 12; limiter.ratio.value = 8; limiter.attack.value = .01; limiter.release.value = .4;
    this.master.connect(limiter); limiter.connect(ctx.destination);
    this.harp = ctx.createGain(); this.harp.gain.value = this.harpEnabled ? .5 : 0;
    this.water = ctx.createGain(); this.water.gain.value = this.waterEnabled ? .18 : 0;
    this.harp.connect(this.master); this.water.connect(this.master);
    const reverb = ctx.createConvolver();
    const impulse = ctx.createBuffer(2, Math.floor(ctx.sampleRate * 3.8), ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3.5) * .25;
    }
    reverb.buffer = impulse;
    const wet = ctx.createGain(); wet.gain.value = .23;
    this.harp.connect(reverb); reverb.connect(wet); wet.connect(this.master);
    // A long, softly filtered noise loop; no crashing waves or sudden splashes.
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 8, ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    let brown = 0;
    for (let i = 0; i < samples.length; i++) {
      brown = (brown + (Math.random() * 2 - 1) * .025) / 1.025;
      samples[i] = brown * (1.1 + .16 * Math.sin(i / ctx.sampleRate * TAU / 8));
    }
    // Crossfade the seam into the start so the water never clicks.
    const seam = Math.floor(ctx.sampleRate * .1);
    for (let i = 0; i < seam; i++) { const mix = i / seam; samples[samples.length - seam + i] = samples[samples.length - seam + i] * (1 - mix) + samples[i] * mix; }
    const source = ctx.createBufferSource(); source.buffer = buffer; source.loop = true; source.loopStart = .1; this.noise = source;
    const filter = ctx.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 950; filter.Q.value = .3;
    source.connect(filter); filter.connect(this.water); source.start();
  }
  private schedule() {
    const ctx = this.context;
    if (!ctx || !this.wanted || document.hidden || ctx.state !== "running") return;
    if (this.nextNote < ctx.currentTime) this.nextNote = ctx.currentTime + .1;
    while (this.nextNote < ctx.currentTime + .6) {
      if (this.harpEnabled) this.pluck(this.notes[this.melody[this.index % this.melody.length]], this.nextNote, .7);
      this.nextNote += [2.4, 3.2, 2.8, 4.2][this.index % 4]; this.index++;
    }
  }
  private pluck(frequency: number, when: number, strength: number) {
    const ctx = this.context!;
    const pan = ctx.createStereoPanner(); pan.pan.value = Math.sin(this.index * 1.7) * .45;
    pan.connect(this.harp!);
    const nodes: AudioNode[] = [pan];
    // Inharmonic upper partials give the pluck a soft string-like character.
    for (const [multiple, amplitude, decay] of [[1,.17,3.5],[2,.065,1.8],[3.002,.025,1.1],[4.006,.008,.6]]) {
      const oscillator = ctx.createOscillator(); oscillator.type = "sine"; oscillator.frequency.value = frequency * multiple;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, when);
      gain.gain.linearRampToValueAtTime(amplitude * strength, when + .018);
      gain.gain.exponentialRampToValueAtTime(.0001, when + decay);
      oscillator.connect(gain); gain.connect(pan); oscillator.start(when); oscillator.stop(when + decay + .1);
      nodes.push(oscillator, gain);
    }
    // Disconnect the finished voice to keep a long-running background small.
    setTimeout(() => nodes.forEach(node => node.disconnect()), 5000);
  }
}
const TAU = Math.PI * 2;
