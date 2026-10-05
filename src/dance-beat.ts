/** Original short percussion/bass loop; no external recordings. */
export class DanceBeat {
  private context?: AudioContext;
  private timer?: number;
  private next = 0;
  private count = 0;
  private revision = 0;
  private voices = new Set<OscillatorNode>();
  epoch = 0;
  bpm = 120;
  get playing() { return this.timer !== undefined; }
  async start(bpm = this.bpm) {
    this.stop();
    const revision = this.revision;
    this.context ??= new AudioContext();
    await this.context.resume();
    if (revision !== this.revision) return;
    this.bpm = bpm;
    this.epoch = performance.now() + 120;
    this.next = this.context.currentTime + .12;
    this.count = 0;
    this.timer = window.setInterval(() => this.schedule(), 20);
    this.schedule();
  }
  stop() {
    this.revision++;
    if (this.timer !== undefined) window.clearInterval(this.timer);
    this.timer = undefined;
    for (const voice of this.voices) { try { voice.stop(); } catch { /* already ended */ } voice.disconnect(); }
    this.voices.clear();
    void this.context?.suspend();
  }
  dispose() { this.stop(); void this.context?.close(); }
  private tone(time: number, frequency: number, duration: number, volume: number, type: OscillatorType) {
    const context = this.context!;
    const oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, time);
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
    oscillator.connect(gain).connect(context.destination);
    this.voices.add(oscillator);
    oscillator.start(time); oscillator.stop(time + duration);
    oscillator.onended = () => { this.voices.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
  }
  private schedule() {
    const context = this.context!;
    while (this.next < context.currentTime + .1) {
      this.tone(this.next, this.count % 4 === 0 ? 110 : 160, .12, .12, 'sine');
      this.tone(this.next, 1500, .035, .025, 'triangle');
      if (this.count % 2 === 0) this.tone(this.next, [130.81, 155.56, 174.61, 155.56][Math.floor(this.count / 2) % 4], .2, .035, 'triangle');
      this.next += 60 / this.bpm; this.count++;
    }
  }
}
