/**
 * AssetLoader.ts — wraps GLB loading with a graceful fallback.
 *
 * Per the spec:
 *   "Prefer rigged GLB/GLTF hand models with suitable skeletons and animation support.
 *    If suitable assets are unavailable, create a temporary procedural hand
 *    representation or clearly identifiable placeholder hands while keeping the
 *    model-loading system ready for proper GLB assets.
 *    Do not invent model file paths and assume the assets exist."
 *
 * We attempt to load any GLB found at /models/hand.glb, but if missing we
 * return null and the caller falls back to procedural hands.
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export interface LoadedHandAsset {
  scene: THREE.Object3D;
  animations: THREE.AnimationClip[];
}

export class AssetLoader {
  private gltf = new GLTFLoader();
  private cache = new Map<string, LoadedHandAsset | null>();

  /**
   * Try to load a GLB hand. Returns null if the file does not exist or fails.
   * Never throws — callers must handle the null fallback.
   */
  async loadHand(url: string): Promise<LoadedHandAsset | null> {
    if (this.cache.has(url)) return this.cache.get(url)!;
    try {
      const asset = await this.gltf.loadAsync(url);
      const result: LoadedHandAsset = {
        scene: asset.scene,
        animations: asset.animations,
      };
      this.cache.set(url, result);
      return result;
    } catch (err) {
      // File not found or parse error — use procedural fallback.
      console.warn(`[AssetLoader] Could not load ${url}, using procedural hand.`, err);
      this.cache.set(url, null);
      return null;
    }
  }

  /**
   * Quick HEAD-style existence check (avoids console error spam in dev).
   */
  async exists(url: string): Promise<boolean> {
    try {
      const res = await fetch(url, { method: "HEAD" });
      return res.ok;
    } catch {
      return false;
    }
  }
}

export const assetLoader = new AssetLoader();
