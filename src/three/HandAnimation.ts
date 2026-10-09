/**
 * HandAnimation.ts — drives the rapid left-to-right hand-rolling motion with smooth Bezier easing.
 *
 * Behaviour:
 *   - When `rolling = true`, hands sway between keyframes (Left to Right to Left).
 *   - Keyframes at the start and end of each sway stroke use smooth cubic Bézier easing
 *     to eliminate harsh reversals and maintain natural, steady physical motion.
 *   - Movement is delta-time-based so it is frame-rate independent.
 *   - Can be paused/resumed gracefully when the match is paused.
 *   - Respects reduced-motion settings.
 */

import * as THREE from "three";
import type { HandModel } from "./HandModel";

export interface HandAnimationConfig {
  /** Oscillation frequency in Hz. Default 3.2 (steady, natural sway tempo). */
  frequency: number;
  /** Horizontal sway amplitude in world units (along hand lateral Y axis). Default 0.28. */
  lateralAmplitude: number;
  /** Wrist roll amplitude (radians). Default 0.36. */
  wristAmplitude: number;
  /** Forearm lift amplitude (vertical off table). Default 0.025. */
  verticalAmplitude: number;
  /** Reduced-motion multiplier. Default 1. */
  reducedMotionScale: number;
}

export const DEFAULT_ANIM_CONFIG: HandAnimationConfig = {
  frequency: 3.2,
  lateralAmplitude: 0.28,
  wristAmplitude: 0.36,
  verticalAmplitude: 0.025,
  reducedMotionScale: 1,
};

/**
 * Evaluates a cubic Bézier ease-in-out curve with control points (x1, y1) and (x2, y2).
 * Uses Newton-Raphson to solve for t at a given progress value, then samples y(t).
 * Guarantees smooth easing (zero velocity / gentle acceleration and deceleration)
 * at the start and end of each left-to-right sway stroke.
 */
export function cubicBezierEasing(progress: number, x1 = 0.42, y1 = 0.0, x2 = 0.58, y2 = 1.0): number {
  const p = Math.max(0, Math.min(1, progress));
  if (p <= 0) return 0;
  if (p >= 1) return 1;

  let t = p;
  for (let i = 0; i < 6; i++) {
    const currentX = 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
    const dx = 3 * (1 - t) * (1 - t) * x1 + 6 * (1 - t) * t * (x2 - x1) + 3 * t * t * (1 - x2);
    if (Math.abs(dx) < 1e-6) break;
    t -= (currentX - p) / dx;
    t = Math.max(0, Math.min(1, t));
  }

  return 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
}

export interface SwayKeyframe {
  progress: number;
  lateral: number;
  wristTwist: number;
  verticalLift: number;
}

export const SWAY_KEYFRAMES: SwayKeyframe[] = [
  { progress: 0.0, lateral: -1.0, wristTwist: -1.0, verticalLift: 0.0 },
  { progress: 0.5, lateral: 1.0, wristTwist: 1.0, verticalLift: 0.0 },
  { progress: 1.0, lateral: -1.0, wristTwist: -1.0, verticalLift: 0.0 },
];

/**
 * Animates a list of HandModel pivots. Each player's hands share a phase but
 * with a small per-hand offset for a more natural look.
 */
export class HandAnimator {
  private config: HandAnimationConfig;
  /** elapsed seconds; only advances while `rolling` is true and not paused. */
  private elapsed = 0;
  /** Whether the hands are currently in the rolling phase. */
  rolling = false;
  /** Whether the animator is paused. */
  paused = false;
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

  /** Pause or resume the hand animation. */
  setPaused(paused: boolean): void {
    this.paused = paused;
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
   * Per-frame update. Uses Bézier keyframe interpolation between left and right peaks.
   */
  update(deltaSeconds: number): void {
    if (this.paused) return;

    // Smoothly approach target speed (1 when rolling, 0 when stopped).
    const target = this.rolling ? 1 : 0;
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
      // Normalized cycle progress [0, 1) across the full left-right-left sway period
      const cycleProgress = (((this.elapsed * omega + phase) / (Math.PI * 2)) % 1 + 1) % 1;

      let swayFactor = 0;
      let wristFactor = 0;
      let liftFactor = 0;

      if (cycleProgress < 0.5) {
        // Keyframe 0.0 (Left) to Keyframe 0.5 (Right) with cubic Bézier easing at start & end
        const segmentProgress = cycleProgress / 0.5;
        const eased = cubicBezierEasing(segmentProgress, 0.42, 0.0, 0.58, 1.0);
        swayFactor = -1.0 + 2.0 * eased;
        wristFactor = -1.0 + 2.0 * eased;
        liftFactor = Math.sin(segmentProgress * Math.PI);
      } else {
        // Keyframe 0.5 (Right) to Keyframe 1.0 (Left) with cubic Bézier easing at start & end
        const segmentProgress = (cycleProgress - 0.5) / 0.5;
        const eased = cubicBezierEasing(segmentProgress, 0.42, 0.0, 0.58, 1.0);
        swayFactor = 1.0 - 2.0 * eased;
        wristFactor = 1.0 - 2.0 * eased;
        liftFactor = Math.sin(segmentProgress * Math.PI);
      }

      // Horizontal (left and right) oscillation along hand-local Y axis
      const dy = swayFactor * lateralA;
      // Slight vertical lift off table during center passage
      const dz = liftFactor * verticalA;
      // Natural wrist roll along the hand forearm axis (local X)
      const rx = wristFactor * wristA;
      // Subtle yaw pivoting slightly into the sway direction (local Z)
      const rz = -swayFactor * wristA * 0.2;

      hand.handGroup.position.x = 0;
      hand.handGroup.position.y = dy;
      hand.handGroup.position.z = dz;
      hand.handGroup.rotation.x = rx;
      hand.handGroup.rotation.y = 0;
      hand.handGroup.rotation.z = rz;
    }
  }

  /** Reset all tracked hands to their rest pose. */
  reset(): void {
    this.elapsed = 0;
    this.speed = 0;
    this.paused = false;
    for (const hand of this.phaseOffsets.keys()) {
      hand.handGroup.position.set(0, 0, 0);
      hand.handGroup.rotation.set(0, 0, 0);
    }
  }
}
