/**
 * Table.ts — the 3D round-table arena.
 *
 * Builds a polished circular tabletop with a textured top, a thick beveled
 * edge, a base pedestal, and a subtle floor. The table is sized so that
 * 2-5 hands fit comfortably around its rim with clear spacing.
 */

import * as THREE from "three";

export interface TableOptions {
  /** Number of active players (drives nothing here — positions handled by layout). */
  playerCount: number;
  quality: "low" | "medium" | "high";
  accentColor: THREE.ColorRepresentation;
}

export class Table {
  readonly group: THREE.Group;
  private disposables: Array<{ dispose: () => void }> = [];

  constructor(opts: TableOptions) {
    this.group = new THREE.Group();

    const tableRadius = 1.6;
    const tableHeight = 0.12;

    // Tabletop: a flat cylinder with beveled top.
    const topGeo = new THREE.CylinderGeometry(
      tableRadius,
      tableRadius * 0.96,
      tableHeight,
      opts.quality === "low" ? 32 : 64,
    );
    this.disposables.push(topGeo);
    const topMat = new THREE.MeshStandardMaterial({
      color: 0x1f2a36,
      roughness: 0.35,
      metalness: 0.25,
    });
    this.disposables.push(topMat);
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.y = 0;
    top.castShadow = opts.quality !== "low";
    top.receiveShadow = opts.quality !== "low";
    this.group.add(top);

    // Accent ring on the rim (cinematic glow strip).
    const ringGeo = new THREE.TorusGeometry(tableRadius * 0.99, 0.025, 8, 64);
    this.disposables.push(ringGeo);
    const ringMat = new THREE.MeshStandardMaterial({
      color: opts.accentColor,
      emissive: opts.accentColor,
      emissiveIntensity: 1.4,
      roughness: 0.2,
    });
    this.disposables.push(ringMat);
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = tableHeight / 2;
    this.group.add(ring);

    // Inner accent ring near center.
    const innerRingGeo = new THREE.TorusGeometry(tableRadius * 0.45, 0.015, 6, 48);
    this.disposables.push(innerRingGeo);
    const innerRing = new THREE.Mesh(innerRingGeo, ringMat.clone());
    innerRing.rotation.x = Math.PI / 2;
    innerRing.position.y = tableHeight / 2 + 0.001;
    this.group.add(innerRing);

    // Pedestal base.
    const baseGeo = new THREE.CylinderGeometry(0.5, 0.7, 0.6, 24);
    this.disposables.push(baseGeo);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x14181f,
      roughness: 0.6,
      metalness: 0.4,
    });
    this.disposables.push(baseMat);
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = -0.36;
    base.castShadow = opts.quality !== "low";
    base.receiveShadow = opts.quality !== "low";
    this.group.add(base);

    // Floor: large dark disc with subtle reflection.
    const floorGeo = new THREE.CircleGeometry(8, 48);
    this.disposables.push(floorGeo);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0a0d12,
      roughness: 0.9,
      metalness: 0.1,
    });
    this.disposables.push(floorMat);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.66;
    floor.receiveShadow = true;
    this.group.add(floor);

    // Subtle accent ground glow ring under the table.
    const glowGeo = new THREE.RingGeometry(tableRadius * 1.05, tableRadius * 1.4, 64);
    this.disposables.push(glowGeo);
    const glowMat = new THREE.MeshBasicMaterial({
      color: opts.accentColor,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
    });
    this.disposables.push(glowMat);
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = -0.65;
    this.group.add(glow);
  }

  dispose(): void {
    for (const d of this.disposables) {
      try {
        d.dispose();
      } catch {
        /* noop */
      }
    }
    this.disposables = [];
    this.group.clear();
  }
}
