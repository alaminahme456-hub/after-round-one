/**
 * roundTimer.ts — synchronized countdown timer.
 *
 * Pure logic: the actual scheduling lives in `gameState.ts`. This module just
 * computes remaining time given a start timestamp and duration, and emits tick
 * values (0..N). Used both by local play (Date.now()) and by online play
 * (server-provided timestamps).
 *
 * The authoritative end of a round is always determined by a single timestamp:
 *   endTime = startTime + roundDuration
 * NOT by each client independently counting down. This prevents drift.
 */

export interface TimerSnapshot {
  /** Whole seconds remaining, clamped to >= 0. */
  remainingSeconds: number;
  /** Total elapsed since start, in ms. */
  elapsedMs: number;
  /** Total duration, in ms. */
  durationMs: number;
  /** True once `now >= endTime`. */
  expired: boolean;
  /** Float fraction 0..1 (elapsed / duration). Useful for progress bars. */
  progress: number;
}

export function computeTimer(
  startTime: number,
  durationMs: number,
  now: number,
): TimerSnapshot {
  const elapsedMs = Math.max(0, now - startTime);
  const remainingMs = Math.max(0, durationMs - elapsedMs);
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const progress = Math.min(1, durationMs === 0 ? 1 : elapsedMs / durationMs);
  return {
    remainingSeconds,
    elapsedMs,
    durationMs,
    expired: now >= startTime + durationMs,
    progress,
  };
}

/**
 * Tension tier used for SFX / visual cues:
 *   "calm"   → > 50% remaining
 *   "warn"   → 25..50%
 *   "urgent" → 5..25%
 *   "final"  → < 5% (or 0)
 */
export type TensionTier = "calm" | "warn" | "urgent" | "final";

export function tensionTier(snap: TimerSnapshot): TensionTier {
  const r = 1 - snap.progress; // remaining fraction
  if (r <= 0.05) return "final";
  if (r <= 0.25) return "urgent";
  if (r <= 0.5) return "warn";
  return "calm";
}
