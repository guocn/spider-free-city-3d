// Each open menu owns a pause reason; closing it releases only that reason.
export class PauseState {
  constructor() {
    this.started = false;
    this.reasons = new Set();
  }
  get running() { return this.started && this.reasons.size === 0; }
  get paused() { return this.started && !this.running; }
  start() { this.started = true; this.release('pause'); }
  hold(reason) { this.reasons.add(reason); }
  release(reason) { this.reasons.delete(reason); }
  has(reason) { return this.reasons.has(reason); }
}
