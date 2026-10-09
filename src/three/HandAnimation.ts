/**
 * HandAnimation.ts — drives the rapid left-to-right hand-rolling motion.
 *
 * Behaviour:
 *   - When `rolling = true`, hands oscillate rapidly along the table's tangent
 *     direction (the player's local X axis), with subtle wrist rotation.
 *   - When `rolling = false`, hands smoothly decelerate to a stop.
 *   - Movement is delta-time-based so it's frame-rate independent.
 *   - Respects reduced-motion: oscillation amplitude is reduced but the game
 *     rule (hands "rolling" then "stopped") still applies visually.
 *
 * The signature mechanic: the spec calls for "rapid horizontal oscillation" —
 * we use a sine wave at ~6 Hz with a wrist-twist component for realism.
 */

import * as THREE from "three";
import type { HandModel } from "./HandModel";

export interface HandAnimationConfig {
  /** Oscillation frequency in Hz. Default 6. */
  frequency: number;
  /** Lateral amplitude in world units. Default 0.32. */
  lateralAmplitude: number;
  /** Wrist rotation amplitude (radians). Default 0.55. */
  wristAmplitude: number;
  /** Forearm lift amplitude (vertical). Default 0.04. */
  verticalAmplitude: number;
  /** Reduced-motion multiplier. Default 1. */
  reducedMotionScale: number;
}

export const DEFAULT_ANIM_CONFIG: HandAnimationConfig = {
  frequency: 6,
  lateralAmplitude: 0.32,
  wristAmplitude: 0.55,
  verticalAmplitude: 0.04,
  reducedMotionScale: 1,
};

/**
 * Animates a list of HandModel pivots. Each player's hands share a phase but
 * with a small per-hand offset for a more natural look.
 */
export class HandAnimator {
  private config: HandAnimationConfig;
  /** elapsed seconds; only advances while `rolling` is true. */
  private elapsed = 0;
  /** Whether the hands are currently in the rolling phase. */
  rolling = false;
  /** Smooth-stop factor: 1 = full speed, 0 = stopped. */
  private speed = 0;
  /** Per-hand phase offsets. */
  private phaseOffsets = new Map<HandModel, number>();

  constructor(config: Partial<HandAnimationConfig> = {}) {
    this.config = { ...DEFAULT_ANIM_CONFIG, ...config };
  }

  setConfig(partial: Partial<HandAnimationConfig>): void {
    this.config = { ...this.config, ...partial };
  }

  /** Add hands to animate. Each HandModel gets a unique phase offset. */
  trackHands(hands: HandModel[]): void {
    for (const h of hands) {
      if (!this.phaseOffsets.has(h)) {
        this.phaseOffsets.set(h, Math.random() * Math.PI * 2);
      }
    }
  }

  /** Stop tracking a hand (e.g. player became spectator). */
  untrack(h: HandModel): void {
    this.phaseOffsets.delete(h);
  }

  /** Start the rolling animation. */
  start(): void {
    this.rolling = true;
  }

  /** Stop the rolling animation (smooth deceleration). */
  stop(): void {
    this.rolling = false;
  }

  /**
   * Per-frame update. `deltaSeconds` should be clamped to e.g. 1/30 max to
   * avoid huge jumps after tab-switches.
   */
  update(deltaSeconds: number): void {
    // Smoothly approach target speed (1 when rolling, 0 when stopped).
    const target = this.rolling ? 1 : 0;
    // Time constant ~120ms for smooth stop on zero, instant-ish start.
    const tau = this.rolling ? 0.04 : 0.18;
    this.speed += (target - this.speed) * (1 - Math.exp(-deltaSeconds / tau));

    if (this.speed > 0.001) {
      this.elapsed += deltaSeconds * this.speed;
    }

    const cfg = this.config;
    const reduced = cfg.reducedMotionScale;
    const lateralA = cfg.lateralAmplitude * reduced * this.speed;
    const wristA = cfg.wristAmplitude * reduced * this.speed;
    const verticalA = cfg.verticalAmplitude * reduced * this.speed;
    const omega = cfg.frequency * Math.PI * 2;

    for (const [hand, phase] of this.phaseOffsets) {
      const t = this.elapsed * omega + phase;
      // Lateral oscillation along hand-local X.
      const dx = Math.sin(t) * lateralA;
      const dz = Math.sin(t * 0.5 + phase) * verticalA;
      // Wrist rotation around Z (twist).
      const rz = Math.sin(t) * wristA;
      // Subtle forearm rotation around Y.
      const ry = Math.sin(t * 0.7) * wristA * 0.3;

      hand.handGroup.position.x = dx;
      hand.handGroup.position.z = dz;
      hand.handGroup.rotation.z = rz;
      hand.handGroup.rotation.y = ry;
    }
  }

  /** Reset all tracked hands to their rest pose. */
  reset(): void {
    this.elapsed = 0;
    this.speed = 0;
    for (const hand of this.phaseOffsets.keys()) {
      hand.handGroup.position.set(0, 0, 0);
      hand.handGroup.rotation.set(0, 0, 0);
    }
  }
}
