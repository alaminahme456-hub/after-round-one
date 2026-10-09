/**
 * CameraController.ts — cinematic camera framing for 2-5 players.
 *
 * The camera sits at an elevated, slightly angled position and frames the
 * whole table + all active hands. When the player count changes (e.g. a
 * player becomes a spectator), the camera smoothly re-frames.
 *
 * For local play we use a single shared camera. For mobile, we widen the FOV
 * and pull the camera back so all hands remain visible on smaller screens.
 */

import * as THREE from "three";

export interface CameraOptions {
  aspect: number;
  quality: "low" | "medium" | "high";
}

export class CameraController {
  readonly camera: THREE.PerspectiveCamera;
  private targetPos = new THREE.Vector3(0, 2.2, 4.2);
  private currentPos = new THREE.Vector3(0, 4, 8);
  private lookAt = new THREE.Vector3(0, 0, 0);
  private currentLookAt = new THREE.Vector3(0, 0, 0);

  constructor(opts: CameraOptions) {
    this.camera = new THREE.PerspectiveCamera(50, opts.aspect, 0.1, 100);
    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.currentLookAt);
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Reframe the camera based on player count + screen aspect.
   * More players → wider framing → camera pulls back slightly.
   */
  reframe(activePlayerCount: number, aspect: number, isMobile: boolean): void {
    // Pull camera back as players increase.
    const baseDist = isMobile ? 5.2 : 4.4;
    const dist = baseDist + Math.max(0, activePlayerCount - 2) * 0.35;
    const height = isMobile ? 2.6 : 2.3;
    // Slight angular offset for cinematic feel; never break top-down readability.
    const angle = isMobile ? 0.0 : 0.05;

    this.targetPos.set(Math.sin(angle) * dist, height, Math.cos(angle) * dist);
    this.lookAt.set(0, 0.0, 0);

    // On portrait mobile, widen FOV so all 5 hands remain visible.
    const fov = isMobile && aspect < 1 ? 65 : aspect < 1 ? 60 : 50;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Per-frame smoothing toward the target pose. Call with delta seconds.
   */
  update(deltaSeconds: number): void {
    const tau = 0.25; // smoothing time constant
    const k = 1 - Math.exp(-deltaSeconds / tau);
    this.currentPos.lerp(this.targetPos, k);
    this.currentLookAt.lerp(this.lookAt, k);
    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.currentLookAt);
  }

  /** Subtle camera bob for cinematic feel — reduced when reduced-motion is on. */
  applyBob(timeSeconds: number, reduced: boolean): void {
    if (reduced) return;
    const amp = 0.012;
    this.camera.position.x += Math.sin(timeSeconds * 0.4) * amp;
    this.camera.position.y += Math.cos(timeSeconds * 0.3) * amp * 0.5;
  }
}
