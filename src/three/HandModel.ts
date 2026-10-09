/**
 * HandModel.ts — procedural rigged 3D human hand (forearm + palm + 5 fingers).
 *
 * Why procedural: no GLB assets are present in the repo and the spec forbids
 * inventing model paths. We build a recognizable stylized human hand from
 * Three.js primitives, with skin-tone variations per player (visual only).
 *
 * Each finger is a small hierarchy of capsules (3 phalanges per finger, 2 for
 * the thumb) so we can later animate "rolling" via root translation + wrist
 * rotation. The mesh is grouped under a `pivot` Object3D so the rolling
 * animation can translate/rotate the whole hand without disturbing the local
 * finger transforms.
 *
 * The hand is oriented palm-down, fingers pointing +X, palm facing +Z.
 * The pivot's position is set by the caller (TableLayout) to sit at the
 * player's edge of the table.
 */

import * as THREE from "three";
import type { SkinTone } from "@/game/types";

/** Five distinct natural human skin tones (visual only — never used for logic). */
export const SKIN_TONE_COLORS: THREE.ColorRepresentation[] = [
  0xf3d2b4, // light
  0xe5b188, // medium-light
  0xb07a4f, // medium
  0x8a5230, // medium-dark
  0x5e3522, // dark
];

export interface HandModelOptions {
  skinTone: SkinTone;
  /** Quality: low omits fingernails + reduces segment count. */
  quality: "low" | "medium" | "high";
}

interface FingerSpec {
  name: string;
  /** Base position relative to palm (x = along fingers, y = across palm). */
  base: [number, number, number];
  /** Phalange lengths. */
  lengths: number[];
  /** Finger radii. */
  radii: number[];
  /** Initial bend (radians). */
  bend?: number;
}

const FINGER_SPECS: FingerSpec[] = [
  { name: "thumb", base: [-0.18, -0.06, 0.02], lengths: [0.06, 0.06, 0.05], radii: [0.028, 0.025, 0.022], bend: 0.3 },
  { name: "index", base: [0.02, 0.05, 0], lengths: [0.07, 0.07, 0.06], radii: [0.022, 0.019, 0.016] },
  { name: "middle", base: [0.02, 0.0, 0], lengths: [0.08, 0.075, 0.06], radii: [0.024, 0.020, 0.017] },
  { name: "ring", base: [0.02, -0.05, 0], lengths: [0.07, 0.065, 0.05], radii: [0.022, 0.019, 0.016] },
  { name: "pinky", base: [0.02, -0.10, 0], lengths: [0.055, 0.05, 0.045], radii: [0.020, 0.017, 0.015] },
];

/**
 * A complete hand model: forearm + palm + 5 fingers, all under a pivot group.
 * The pivot is what gets positioned around the table.
 */
export class HandModel {
  /** Outer pivot: position this around the table. */
  readonly pivot: THREE.Group;
  /** Inner hand group: roll this for animation. */
  readonly handGroup: THREE.Group;
  readonly skinTone: SkinTone;
  readonly quality: HandModelOptions["quality"];
  private disposables: Array<{ dispose: () => void }> = [];

  constructor(opts: HandModelOptions) {
    this.skinTone = opts.skinTone;
    this.quality = opts.quality;
    this.pivot = new THREE.Group();
    this.handGroup = new THREE.Group();
    this.pivot.add(this.handGroup);

    const skinColor = SKIN_TONE_COLORS[opts.skinTone] ?? SKIN_TONE_COLORS[0];
    const skinMaterial = new THREE.MeshStandardMaterial({
      color: skinColor,
      roughness: 0.7,
      metalness: 0.05,
    });
    this.disposables.push(skinMaterial);

    // Forearm: a tapered cylinder.
    const forearmLen = 0.35;
    const forearmGeo = new THREE.CylinderGeometry(0.055, 0.075, forearmLen, opts.quality === "low" ? 8 : 16);
    this.disposables.push(forearmGeo);
    const forearm = new THREE.Mesh(forearmGeo, skinMaterial);
    forearm.rotation.z = Math.PI / 2; // lay along +X
    forearm.position.x = -forearmLen / 2;
    this.handGroup.add(forearm);

    // Wrist joint: small sphere.
    const wristGeo = new THREE.SphereGeometry(0.06, opts.quality === "low" ? 8 : 16, 12);
    this.disposables.push(wristGeo);
    const wrist = new THREE.Mesh(wristGeo, skinMaterial);
    wrist.position.set(0, 0, 0);
    this.handGroup.add(wrist);

    // Palm: a flattened box with rounded edges (use box for simplicity).
    const palmGeo = new THREE.BoxGeometry(0.16, 0.16, 0.04);
    this.disposables.push(palmGeo);
    const palm = new THREE.Mesh(palmGeo, skinMaterial);
    palm.position.set(0.08, 0, 0);
    palm.rotation.x = 0;
    this.handGroup.add(palm);

    // Fingers — built as small hierarchies under the palm.
    for (const spec of FINGER_SPECS) {
      this.buildFinger(spec, skinMaterial);
    }

    // Optional fingernails for medium/high quality.
    if (opts.quality !== "low") {
      const nailMaterial = new THREE.MeshStandardMaterial({
        color: 0xf2e6d8,
        roughness: 0.4,
        metalness: 0.0,
      });
      this.disposables.push(nailMaterial);
      // One small disc at each fingertip.
      for (const spec of FINGER_SPECS) {
        const lastLen = spec.lengths[spec.lengths.length - 1];
        const lastRad = spec.radii[spec.radii.length - 1];
        const nailGeo = new THREE.CylinderGeometry(
          lastRad * 0.7,
          lastRad * 0.7,
          0.005,
          8,
        );
        this.disposables.push(nailGeo);
        const nail = new THREE.Mesh(nailGeo, nailMaterial);
        // Position is set later via the finger hierarchy; for simplicity we
        // attach to handGroup at the fingertip position computed below.
        // Compute fingertip X position by summing lengths.
        let x = 0.08 + 0.10; // palm center + half palm
        for (const l of spec.lengths) x += l;
        nail.position.set(x, spec.base[1], spec.base[2] + 0.025);
        nail.rotation.x = Math.PI / 2;
        this.handGroup.add(nail);
      }
    }

    // Initial orientation: hand lies palm-down, fingers pointing +X.
    // The Table layout will rotate the pivot so fingers face the table center.
  }

  private buildFinger(spec: FingerSpec, material: THREE.Material): void {
    // Root joint under handGroup at palm edge.
    let parent: THREE.Object3D = this.handGroup;
    let x = 0.08 + 0.08; // palm center + half-depth to reach palm edge
    let y = spec.base[1];
    let z = spec.base[2];

    for (let i = 0; i < spec.lengths.length; i++) {
      const len = spec.lengths[i];
      const rad = spec.radii[i];
      const segGeo = new THREE.CapsuleGeometry(rad, len, 4, this.quality === "low" ? 4 : 8);
      this.disposables.push(segGeo);
      const seg = new THREE.Mesh(segGeo, material);
      // Capsule axis is Y; rotate so it points along +X.
      seg.rotation.z = -Math.PI / 2;
      seg.position.set(x + len / 2, y, z);
      parent.add(seg);

      // Knuckle sphere at the joint.
      const jointGeo = new THREE.SphereGeometry(rad * 0.9, 8, 6);
      this.disposables.push(jointGeo);
      const joint = new THREE.Mesh(jointGeo, material);
      joint.position.set(x + len, y, z);
      parent.add(joint);

      x += len;
      // parent stays as handGroup; further segments are placed at x.
      parent = this.handGroup;
    }
  }

  /** Dispose all GPU resources. Call when the player leaves the scene. */
  dispose(): void {
    for (const d of this.disposables) {
      try {
        d.dispose();
      } catch {
        /* noop */
      }
    }
    this.disposables = [];
    this.pivot.clear();
  }
}
