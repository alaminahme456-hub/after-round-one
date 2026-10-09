/**
 * soundManager.ts — tiny Web Audio synth.
 *
 * All SFX are generated procedurally (no audio files required) so the game
 * stays self-contained. Each effect is a short envelope-shaped oscillator
 * burst. The manager respects the global soundEnabled / masterVolume flags.
 */

"use client";

class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private roundAudio: HTMLAudioElement | null = null;
  private roundAudioPaused = false;
  soundEnabled = true;
  musicEnabled = true;
  masterVolume = 0.8;

  private ensureCtx(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.masterVolume;
        this.masterGain.connect(this.ctx.destination);
      } catch {
        return null;
      }
    }
    // Resume on demand (autoplay policies).
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  setSoundEnabled(on: boolean): void {
    this.soundEnabled = on;
    if (!on) this.stopRoundCountdownAudio();
  }
  setMasterVolume(v: number): void {
    this.masterVolume = Math.max(0, Math.min(1, v));
    if (this.masterGain) this.masterGain.gain.value = this.masterVolume;
    if (this.roundAudio) this.roundAudio.volume = this.masterVolume;
  }

  private play(
    freq: number,
    duration: number,
    type: OscillatorType = "sine",
    vol = 0.3,
    glideTo?: number,
  ): void {
    if (!this.soundEnabled) return;
    const ctx = this.ensureCtx();
    if (!ctx || !this.masterGain) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (glideTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(glideTo, ctx.currentTime + duration);
    }
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration + 0.05);
  }

  // ── Named effects ─────────────────────────────────────────────────────────

  matchStart(): void {
    this.play(220, 0.18, "sawtooth", 0.25, 440);
    setTimeout(() => this.play(440, 0.2, "sawtooth", 0.25, 660), 120);
  }

  rollingLoop(): void {
    // Play the supplied countdown sound for the duration of the round timer.
    if (!this.soundEnabled || typeof window === "undefined") return;
    if (!this.roundAudio) {
      this.roundAudio = new Audio("/audio/after-round-one.mp3");
      this.roundAudio.preload = "auto";
      this.roundAudio.loop = true;
      this.roundAudio.volume = this.masterVolume;
    }
    this.roundAudioPaused = false;
    this.roundAudio.play().catch(() => {});
  }

  stopRoundCountdownAudio(): void {
    if (!this.roundAudio) return;
    this.roundAudio.pause();
    this.roundAudio.currentTime = 0;
    this.roundAudioPaused = false;
  }

  pauseRoundCountdownAudio(): void {
    if (!this.roundAudio || this.roundAudio.paused) return;
    this.roundAudio.pause();
    this.roundAudioPaused = true;
  }

  resumeRoundCountdownAudio(): void {
    if (!this.soundEnabled || !this.roundAudio || !this.roundAudioPaused) return;
    this.roundAudioPaused = false;
    this.roundAudio.play().catch(() => {});
  }

  countdownTick(tier: "calm" | "warn" | "urgent" | "final"): void {
    const f = tier === "final" ? 1200 : tier === "urgent" ? 900 : tier === "warn" ? 700 : 500;
    this.play(f, 0.08, "square", 0.18);
  }

  timerStop(): void {
    this.stopRoundCountdownAudio();
    this.play(660, 0.08, "square", 0.3);
    setTimeout(() => this.play(330, 0.18, "sawtooth", 0.25, 220), 80);
  }

  submit(): void {
    this.play(880, 0.05, "sine", 0.2);
  }

  draw(): void {
    this.play(300, 0.4, "triangle", 0.25, 200);
  }

  roundWinner(): void {
    this.play(523, 0.1, "sine", 0.3);
    setTimeout(() => this.play(659, 0.1, "sine", 0.3), 110);
    setTimeout(() => this.play(784, 0.18, "sine", 0.3), 220);
  }

  finalWinner(): void {
    [523, 659, 784, 1046].forEach((f, i) =>
      setTimeout(() => this.play(f, 0.16, "sine", 0.32), i * 120),
    );
  }

  penaltySelect(): void {
    this.play(440, 0.05, "square", 0.2);
  }

  pause(): void {
    this.play(440, 0.08, "triangle", 0.2, 330);
  }

  resume(): void {
    this.play(330, 0.08, "triangle", 0.2, 440);
  }

  click(): void {
    this.play(660, 0.03, "square", 0.15);
  }
}

export const sound = new SoundManager();
