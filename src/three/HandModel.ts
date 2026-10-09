/**
 * HandModel.ts — procedural sculpted 3D human hand (forearm + palm + 5 articulated fingers).
 *
 * Anatomical features:
 *   - Contoured palm with fleshy thenar (thumb) and hypothenar (pinky) eminences.
 *   - Opposable thumb angled naturally outward.
 *   - Proportional fingers with 3 articulated phalanges (proximal, intermediate, distal).
 *   - Rounded fingertip pulp pads and glossy fingernails.
 *   - Dual-tone PBR skin materials (dorsal skin + warmer palmar pads).
 *   - Authentic support for Fair, Brown, Chocolate, Black, and Tan skin tones.
 */

import * as THREE from "three";
import { type SkinTone, SKIN_TONE_DEFS } from "@/game/types";

/** Skin tone color values mapped from definitions */
export const SKIN_TONE_COLORS: THREE.ColorRepresentation[] = SKIN_TONE_DEFS.map(
  (def) => def.colorNumber,
);

/** Computes a realistic warmer/lighter undertone for the palm and finger pads */
function computePalmarColor(dorsalColor: number): number {
  const c = new THREE.Color(dorsalColor);
  // Blend slightly with warm skin cream tone
  c.lerp(new THREE.Color(0xf5d3be), 0.28);
  c.offsetHSL(0.015, -0.06, 0.08);
  return c.getHex();
}

export interface HandModelOptions {
  skinTone: SkinTone;
  /** Quality: low omits fingernails and joint caps + reduces segment count. */
  quality: "low" | "medium" | "high";
}

interface FingerPhalangeSpec {
  name: string;
  isThumb?: boolean;
  base: [number, number, number];
  lengths: number[];
  radii: number[];
  baseRotation?: [number, number, number];
}

const FINGER_SPECS: FingerPhalangeSpec[] = [
  {
    name: "thumb",
    isThumb: true,
    base: [0.065, 0.082, -0.008],
    lengths: [0.064, 0.052],
    radii: [0.024, 0.020],
    baseRotation: [0.25, -0.15, 0.65],
  },
  {
    name: "index",
    base: [0.170, 0.046, 0.003],
    lengths: [0.068, 0.056, 0.046],
    radii: [0.020, 0.017, 0.014],
    baseRotation: [0, 0, 0.03],
  },
  {
    name: "middle",
    base: [0.178, 0.016, 0.005],
    lengths: [0.076, 0.064, 0.052],
    radii: [0.021, 0.018, 0.015],
    baseRotation: [0, 0, 0.0],
  },
  {
    name: "ring",
    base: [0.172, -0.016, 0.003],
    lengths: [0.070, 0.058, 0.048],
    radii: [0.020, 0.017, 0.014],
    baseRotation: [0, 0, -0.03],
  },
  {
    name: "pinky",
    base: [0.160, -0.046, -0.002],
    lengths: [0.054, 0.044, 0.038],
    radii: [0.017, 0.014, 0.012],
    baseRotation: [0, 0, -0.07],
  },
];

export class HandModel {
  /** Outer pivot: positioned around the table. */
  readonly pivot: THREE.Group;
  /** Inner hand group: animated for the rolling/swaying motion. */
  readonly handGroup: THREE.Group;
  skinTone: SkinTone;
  readonly quality: HandModelOptions["quality"];

  private dorsalMaterial: THREE.MeshStandardMaterial;
  private palmarMaterial: THREE.MeshStandardMaterial;
  private nailMaterial?: THREE.MeshStandardMaterial;
  private disposables: Array<{ dispose: () => void }> = [];

  constructor(opts: HandModelOptions) {
    this.skinTone = opts.skinTone;
    this.quality = opts.quality;
    this.pivot = new THREE.Group();
    this.handGroup = new THREE.Group();
    this.pivot.add(this.handGroup);

    const baseColor = SKIN_TONE_COLORS[opts.skinTone] ?? SKIN_TONE_COLORS[0];
    const palmarColor = computePalmarColor(Number(baseColor));

    // Dorsal skin (back of hand, arm, knuckles)
    this.dorsalMaterial = new THREE.MeshStandardMaterial({
      color: baseColor,
      roughness: 0.62,
      metalness: 0.03,
    });
    this.disposables.push(this.dorsalMaterial);

    // Palmar skin (palm, thenar/hypothenar pads, fingertip pulps)
    this.palmarMaterial = new THREE.MeshStandardMaterial({
      color: palmarColor,
      roughness: 0.68,
      metalness: 0.02,
    });
    this.disposables.push(this.palmarMaterial);

    if (opts.quality !== "low") {
      this.nailMaterial = new THREE.MeshStandardMaterial({
        color: 0xf5e6de,
        roughness: 0.28,
        metalness: 0.06,
      });
      this.disposables.push(this.nailMaterial);
    }

    this.buildArmAndWrist();
    this.buildSculptedPalm();
    this.buildArticulatedFingers();
  }

  /** Update skin tone in-place across all hand materials. */
  setSkinTone(tone: SkinTone): void {
    this.skinTone = tone;
    const baseColor = SKIN_TONE_COLORS[tone] ?? SKIN_TONE_COLORS[0];
    const palmarColor = computePalmarColor(Number(baseColor));
    this.dorsalMaterial.color.set(baseColor);
    this.palmarMaterial.color.set(palmarColor);
  }

  private buildArmAndWrist(): void {
    const isLow = this.quality === "low";
    const segs = isLow ? 10 : 20;

    // Forearm: natural tapered cylinder
    const forearmLen = 0.38;
    const forearmGeo = new THREE.CylinderGeometry(0.056, 0.076, forearmLen, segs);
    this.disposables.push(forearmGeo);
    const forearm = new THREE.Mesh(forearmGeo, this.dorsalMaterial);
    forearm.rotation.z = Math.PI / 2;
    forearm.position.x = -forearmLen / 2 - 0.02;
    forearm.castShadow = !isLow;
    forearm.receiveShadow = !isLow;
    this.handGroup.add(forearm);

    // Carpal wrist complex: smooth transitional ellipsoid
    const wristGeo = new THREE.SphereGeometry(0.062, segs, 12);
    this.disposables.push(wristGeo);
    const wrist = new THREE.Mesh(wristGeo, this.dorsalMaterial);
    wrist.scale.set(1.1, 1.25, 0.85);
    wrist.position.set(0, 0, 0);
    wrist.castShadow = !isLow;
    wrist.receiveShadow = !isLow;
    this.handGroup.add(wrist);
  }

  private buildSculptedPalm(): void {
    const isLow = this.quality === "low";
    const segs = isLow ? 8 : 16;

    // Main metacarpal palm slab: slightly tapered and curved
    const palmGeo = new THREE.BoxGeometry(0.165, 0.145, 0.046);
    this.disposables.push(palmGeo);
    const palm = new THREE.Mesh(palmGeo, this.dorsalMaterial);
    palm.position.set(0.088, 0.005, 0.002);
    palm.castShadow = !isLow;
    palm.receiveShadow = !isLow;
    this.handGroup.add(palm);

    // Thenar eminence (thumb base muscle pad): fleshy oval mound on thumb side
    const thenarGeo = new THREE.SphereGeometry(0.046, segs, 12);
    this.disposables.push(thenarGeo);
    const thenar = new THREE.Mesh(thenarGeo, this.palmarMaterial);
    thenar.scale.set(1.4, 0.95, 0.75);
    thenar.position.set(0.062, 0.058, -0.012);
    thenar.rotation.z = 0.25;
    this.handGroup.add(thenar);

    // Hypothenar eminence (pinky lateral muscle pad): elongated pad along outer edge
    const hypothenarGeo = new THREE.SphereGeometry(0.040, segs, 10);
    this.disposables.push(hypothenarGeo);
    const hypothenar = new THREE.Mesh(hypothenarGeo, this.palmarMaterial);
    hypothenar.scale.set(1.5, 0.85, 0.65);
    hypothenar.position.set(0.075, -0.052, -0.010);
    this.handGroup.add(hypothenar);

    // Metacarpal knuckle caps (MCP ridge where fingers meet palm)
    const knucklePositions: [number, number][] = [
      [0.170, 0.046],
      [0.178, 0.016],
      [0.172, -0.016],
      [0.160, -0.046],
    ];
    for (const [kx, ky] of knucklePositions) {
      const kGeo = new THREE.SphereGeometry(0.022, isLow ? 6 : 10, 8);
      this.disposables.push(kGeo);
      const kMesh = new THREE.Mesh(kGeo, this.dorsalMaterial);
      kMesh.position.set(kx, ky, 0.006);
      this.handGroup.add(kMesh);
    }
  }

  private buildArticulatedFingers(): void {
    const isLow = this.quality === "low";
    const capSegs = isLow ? 4 : 8;

    for (const spec of FINGER_SPECS) {
      const fingerRoot = new THREE.Group();
      fingerRoot.position.set(...spec.base);
      if (spec.baseRotation) {
        fingerRoot.rotation.set(...spec.baseRotation);
      }
      this.handGroup.add(fingerRoot);

      let currentX = 0;
      let prevRadius = spec.radii[0];

      for (let i = 0; i < spec.lengths.length; i++) {
        const len = spec.lengths[i];
        const rad = spec.radii[i];
        const isDistal = i === spec.lengths.length - 1;

        // Phalange segment (capsule)
        const segGeo = new THREE.CapsuleGeometry(rad, len, 4, capSegs);
        this.disposables.push(segGeo);
        const segMesh = new THREE.Mesh(segGeo, this.dorsalMaterial);
        segMesh.rotation.z = -Math.PI / 2;
        segMesh.position.set(currentX + len / 2, 0, 0);
        segMesh.castShadow = !isLow;
        segMesh.receiveShadow = !isLow;
        fingerRoot.add(segMesh);

        // Joint knuckle sphere (between phalanges)
        if (i > 0) {
          const jointGeo = new THREE.SphereGeometry(prevRadius * 0.98, isLow ? 6 : 10, 6);
          this.disposables.push(jointGeo);
          const jointMesh = new THREE.Mesh(jointGeo, this.dorsalMaterial);
          jointMesh.position.set(currentX, 0, 0.002);
          fingerRoot.add(jointMesh);
        }

        // On distal segment: add fleshy fingertip pad & fingernail
        if (isDistal) {
          const tipX = currentX + len + rad * 0.4;

          // Soft fleshy pulp pad on the palmar/underside (-Z)
          const padGeo = new THREE.SphereGeometry(rad * 0.92, isLow ? 6 : 10, 8);
          this.disposables.push(padGeo);
          const padMesh = new THREE.Mesh(padGeo, this.palmarMaterial);
          padMesh.scale.set(1.2, 0.95, 0.7);
          padMesh.position.set(currentX + len * 0.7, 0, -rad * 0.45);
          fingerRoot.add(padMesh);

          // Translucent glossy fingernail on the dorsal/top side (+Z)
          if (!isLow && this.nailMaterial) {
            const nailGeo = new THREE.CylinderGeometry(
              rad * 0.75,
              rad * 0.72,
              0.004,
              12,
            );
            this.disposables.push(nailGeo);
            const nail = new THREE.Mesh(nailGeo, this.nailMaterial);
            nail.scale.set(1.15, 1.0, 1.35);
            nail.position.set(tipX - rad * 0.35, 0, rad * 0.78);
            nail.rotation.x = Math.PI / 2;
            nail.rotation.z = -0.15;
            fingerRoot.add(nail);
          }
        }

        currentX += len + rad * 0.2;
        prevRadius = rad;
      }
    }
  }

  /** Dispose all GPU resources. */
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
