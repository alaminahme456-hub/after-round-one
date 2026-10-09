/**
 * CameraController.ts — top-down camera framing for 2-5 players.
 *
 * Sits directly on the Y-axis looking straight down at coordinates (0, 0, 0),
 * oriented so that the player paddle / hand appears at the bottom of the screen.
 * Automatically reframes height and FOV based on player count and viewport aspect ratio.
 */

import * as THREE from "three";

export interface CameraOptions {
  aspect: number;
  quality: "low" | "medium" | "high";
}

export class CameraController {
  readonly camera: THREE.PerspectiveCamera;
  private targetPos = new THREE.Vector3(0, 5.0, 0);
  private currentPos = new THREE.Vector3(0, 5.0, 0);
  private lookAt = new THREE.Vector3(0, 0, 0);
  private currentLookAt = new THREE.Vector3(0, 0, 0);

  constructor(opts: CameraOptions) {
    this.camera = new THREE.PerspectiveCamera(50, opts.aspect, 0.1, 100);
    this.camera.position.copy(this.currentPos);
    // Setting up to (-1, 0, 0) rotates the camera around the Y-axis looking down at (0, 0, 0)
    // so that the +X axis (player position) appears at the bottom of the screen.
    this.camera.up.set(-1, 0, 0);
    this.camera.lookAt(this.currentLookAt);
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Reframe the camera based on player count + screen aspect.
   * Maintains top-down view directly on the Y-axis.
   */
  reframe(activePlayerCount: number, aspect: number, isMobile: boolean): void {
    const tableSpan = 4.2 + Math.max(0, activePlayerCount - 2) * 0.35;
    const fov = isMobile && aspect < 1 ? 55 : aspect < 1 ? 52 : 48;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();

    const fovRad = (fov * Math.PI) / 180;
    const vSpanNeeded = aspect < 1 ? tableSpan / Math.max(0.4, aspect) : tableSpan;
    const height = Math.max(4.6, (vSpanNeeded / 2) / Math.tan(fovRad / 2));

    // Strictly position on the Y-axis (X = 0, Z = 0) looking down at (0, 0, 0)
    this.targetPos.set(0, height, 0);
    this.lookAt.set(0, 0, 0);
  }

  /**
   * Per-frame smoothing toward the target pose.
   * Keeps camera directly on the Y-axis looking straight down at (0, 0, 0).
   */
  update(deltaSeconds: number): void {
    const tau = 0.25; // smoothing time constant
    const k = 1 - Math.exp(-deltaSeconds / tau);
    this.currentPos.lerp(this.targetPos, k);
    this.currentLookAt.lerp(this.lookAt, k);

    // Keep camera position strictly on the Y-axis
    this.camera.position.set(0, this.currentPos.y, 0);
    // Maintain orientation so player paddle appears at the bottom of the screen
    this.camera.up.set(-1, 0, 0);
    this.camera.lookAt(this.currentLookAt);
  }

  /** Subtle camera bob — vertical along Y-axis only, keeping X=0 and Z=0. */
  applyBob(timeSeconds: number, reduced: boolean): void {
    if (reduced) return;
    const amp = 0.02;
    this.camera.position.x = 0;
    this.camera.position.z = 0;
    this.camera.position.y += Math.sin(timeSeconds * 0.5) * amp;
  }
}
