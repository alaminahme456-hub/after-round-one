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
  /** Currently-registered `ended` callback for the round audio. */
  private roundAudioEndedCb: (() => void) | null = null;
  /** Tracks the round number we last started audio for, to prevent duplicate playback. */
  private roundAudioStartedFor: { round: number; state: string } | null = null;
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

  rollingLoop(roundNumber: number = 0, onEnded?: () => void): void {
    // Play the supplied countdown sound for the duration of the round timer.
    //
    // SYNC CONTRACT with GameScreen.tsx:
    //   - Audio starts the moment the round enters ROLLING (currentTime=0).
    //   - Audio does NOT loop (loop=false) so the `ended` event fires.
    //   - When the audio `ended` event fires, the optional `onEnded` callback
    //     is invoked — the caller uses it to force-transition the match into
    //     NUMBER_SUBMISSION, which immediately stops the timer.
    //   - When the timer expires first (before audio ends), the caller invokes
    //     stopRoundCountdownAudio() to pause + reset the audio.
    //   - Per-round guard via roundAudioStartedFor prevents duplicate playback
    //     across React re-renders.
    if (!this.soundEnabled || typeof window === "undefined") return;

    // Per-round dedupe: don't restart audio for a (round, "ROLLING") we already
    // started audio for. This survives React effect re-runs.
    const key = { round: roundNumber, state: "ROLLING" };
    if (
      this.roundAudioStartedFor?.round === key.round &&
      this.roundAudioStartedFor.state === key.state
    ) {
      // Already playing this round — but if a new onEnded callback was supplied,
      // update it (the caller may have re-mounted).
      if (onEnded && this.roundAudio && this.roundAudioEndedCb !== onEnded) {
        if (this.roundAudioEndedCb) {
          this.roundAudio.removeEventListener("ended", this.roundAudioEndedCb);
        }
        this.roundAudioEndedCb = onEnded;
        this.roundAudio.addEventListener("ended", onEnded);
      }
      return;
    }
    this.roundAudioStartedFor = key;

    if (!this.roundAudio) {
      this.roundAudio = new Audio("/audio/after-round-one.mp3");
      this.roundAudio.preload = "auto";
      this.roundAudio.volume = this.masterVolume;
      this.roundAudio.playsInline = true;
    }
    // CRITICAL: do NOT loop. The `ended` event must fire so the caller can stop
    // the timer when the audio finishes before the configured roundDuration.
    this.roundAudio.loop = false;

    // Replace any previously-registered `ended` listener.
    if (this.roundAudioEndedCb) {
      this.roundAudio.removeEventListener("ended", this.roundAudioEndedCb);
    }
    this.roundAudioEndedCb = onEnded ?? null;
    if (onEnded) {
      this.roundAudio.addEventListener("ended", onEnded);
    }

    try {
      this.roundAudio.currentTime = 0;
    } catch {
      /* noop — seek can throw if metadata not loaded yet */
    }
    this.roundAudioPaused = false;
    const p = this.roundAudio.play();
    if (p && typeof p.catch === "function") {
      p.catch((err) => {
        // Autoplay blocked or load failure — keep the game going.
        console.warn("[RoundAudio] playback failed:", err?.name ?? err);
      });
    }
  }

  stopRoundCountdownAudio(): void {
    if (!this.roundAudio) return;
    // Pause + reset to 0 so the next round starts from the beginning.
    try {
      if (!this.roundAudio.paused) this.roundAudio.pause();
      this.roundAudio.currentTime = 0;
    } catch {
      /* noop */
    }
    this.roundAudioPaused = false;
    // Allow the next rollingLoop() call to start fresh.
    this.roundAudioStartedFor = null;
    // Remove the per-round `ended` listener.
    if (this.roundAudioEndedCb) {
      this.roundAudio.removeEventListener("ended", this.roundAudioEndedCb);
      this.roundAudioEndedCb = null;
    }
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
