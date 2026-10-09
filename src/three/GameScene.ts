/**
 * GameScene.ts — top-level Three.js scene manager.
 *
 * Owns the renderer, scene, camera, lights, table, and all per-player HandModel
 * instances. Exposes a small imperative API used by the React layer:
 *
 *   - mount(container)         attach canvas + start RAF loop
 *   - setPlayers(players)      rebuild hand roster around the table
 *   - setRolling(rolling)      start/stop the rapid hand-rolling animation
 *   - setReducedMotion(on)     accessibility toggle
 *   - setQuality(q)            low/medium/high (toggles shadows, etc.)
 *   - highlightWinner(playerId) glow effect on the winning hand
 *   - dispose()                free GPU resources
 *
 * The renderer's pixel ratio is capped to 2 for performance on mobile.
 */

import * as THREE from "three";
import { Table } from "./Table";
import { HandModel } from "./HandModel";
import { HandAnimator } from "./HandAnimation";
import { CameraController } from "./CameraController";
import { assetLoader } from "./AssetLoader";
import type { PlayerState } from "@/game/types";

const ACCENT_COLOR = 0xff5a3c; // warm orange — premium party-game accent

export interface GameSceneOptions {
  reducedMotion: boolean;
  quality: "low" | "medium" | "high";
}

export class GameScene {
  private container: HTMLElement | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene;
  private camera: CameraController;
  private table: Table | null = null;
  private hands = new Map<number, HandModel>();
  private animator = new HandAnimator({ reducedMotionScale: 1 });
  private rafId: number | null = null;
  private clock = new THREE.Clock();
  private resizeObserver: ResizeObserver | null = null;
  private reducedMotion = false;
  private quality: "low" | "medium" | "high" = "medium";
  private winnerHighlightId: number | null = null;
  private winnerGlowMaterials: THREE.MeshStandardMaterial[] = [];

  constructor(opts: GameSceneOptions) {
    this.reducedMotion = opts.reducedMotion;
    this.quality = opts.quality;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x07090d);
    this.scene.fog = new THREE.FogExp2(0x07090d, 0.08);

    this.camera = new CameraController({
      aspect: 1,
      quality: this.quality,
    });
  }

  mount(container: HTMLElement): void {
    this.container = container;
    const renderer = new THREE.WebGLRenderer({
      antialias: this.quality !== "low",
      powerPreference: "high-performance",
      alpha: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(container.clientWidth, container.clientHeight, false);
    renderer.shadowMap.enabled = this.quality !== "low";
    renderer.shadowMap.type =
      this.quality === "high" ? THREE.PCFSoftShadowMap : THREE.BasicShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.touchAction = "none";
    this.renderer = renderer;

    this.setupLights();
    this.table = new Table({ playerCount: 2, quality: this.quality, accentColor: ACCENT_COLOR });
    this.scene.add(this.table.group);

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);
    this.handleResize();
    this.startLoop();
  }

  private setupLights(): void {
    // Ambient + hemisphere for soft fill.
    const ambient = new THREE.AmbientLight(0x404656, 0.6);
    this.scene.add(ambient);
    const hemi = new THREE.HemisphereLight(0x6b7a99, 0x10141c, 0.5);
    this.scene.add(hemi);

    // Key spotlight from above — cinematic.
    const key = new THREE.SpotLight(0xfff1e0, 2.5, 12, Math.PI * 0.32, 0.5, 1.5);
    key.position.set(0, 6, 0.5);
    key.target.position.set(0, 0, 0);
    if (this.quality !== "low") {
      key.castShadow = true;
      key.shadow.mapSize.width = this.quality === "high" ? 2048 : 1024;
      key.shadow.mapSize.height = this.quality === "high" ? 2048 : 1024;
      key.shadow.bias = -0.0005;
    }
    this.scene.add(key);
    this.scene.add(key.target);

    // Accent rim light from below to make the table glow.
    const rim = new THREE.PointLight(ACCENT_COLOR, 1.6, 6, 2);
    rim.position.set(0, -0.3, 0);
    this.scene.add(rim);

    // Side fill so hands aren't pitch black on the far side.
    const side = new THREE.DirectionalLight(0x8ea3c7, 0.4);
    side.position.set(3, 2, 3);
    this.scene.add(side);
  }

  private handleResize(): void {
    if (!this.container || !this.renderer) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.renderer.setSize(w, h, false);
    const aspect = w / Math.max(1, h);
    this.camera.setAspect(aspect);
    const isMobile = Math.min(w, h) < 600;
    this.camera.reframe(this.activePlayerCount(), aspect, isMobile);
  }

  private activePlayerCount(): number {
    let n = 0;
    for (const h of this.hands.values()) n++;
    return n;
  }

  private startLoop(): void {
    const loop = () => {
      this.rafId = requestAnimationFrame(loop);
      const dt = Math.min(0.05, this.clock.getDelta());
      this.animator.update(dt);
      this.camera.update(dt);
      this.camera.applyBob(this.clock.elapsedTime, this.reducedMotion);
      // Pulse the winner glow if any.
      if (this.winnerHighlightId !== null) {
        const pulse = 1 + 0.5 * Math.sin(this.clock.elapsedTime * 4);
        for (const m of this.winnerGlowMaterials) {
          m.emissiveIntensity = 1.5 * pulse;
        }
      }
      if (this.renderer) this.renderer.render(this.scene, this.camera.camera);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  /**
   * Rebuild the per-player hand roster. Hands are positioned evenly around
   * the table rim. Spectators' hands fade out and are removed.
   */
  setPlayers(players: PlayerState[]): void {
    if (!this.table) return;

    const active = players.filter((p) => !p.isSpectator && p.connected);
    const activeIds = new Set(active.map((p) => p.id));

    // Remove hands no longer active.
    for (const [id, hand] of [...this.hands.entries()]) {
      if (!activeIds.has(id)) {
        this.scene.remove(hand.pivot);
        this.animator.untrack(hand);
        hand.dispose();
        this.hands.delete(id);
      }
    }

    // Position active hands around the table.
    const n = active.length;
    const tableRadius = 1.55;
    for (let i = 0; i < n; i++) {
      const p = active[i];
      const angle = (i / n) * Math.PI * 2;
      const x = Math.cos(angle) * tableRadius;
      const z = Math.sin(angle) * tableRadius;
      let hand = this.hands.get(p.id);
      if (!hand) {
        hand = new HandModel({
          skinTone: p.skinTone,
          quality: this.quality,
        });
        this.hands.set(p.id, hand);
        this.scene.add(hand.pivot);
        this.animator.trackHands([hand]);
      }
      // Position the pivot at the table edge, oriented to face the center.
      hand.pivot.position.set(x, 0.08, z);
      // Rotate so the hand's +X (fingers) points inward toward origin.
      hand.pivot.rotation.y = -angle + Math.PI / 2;
      // Slight downward tilt so fingers rest on the table.
      hand.pivot.rotation.z = -0.15;
    }

    // Reframe camera for the new player count.
    const w = this.container?.clientWidth ?? 1;
    const h = this.container?.clientHeight ?? 1;
    this.camera.reframe(n, w / h, Math.min(w, h) < 600);
  }

  /** Start or stop the rapid hand-rolling animation. */
  setRolling(rolling: boolean): void {
    if (rolling) this.animator.start();
    else this.animator.stop();
  }

  setReducedMotion(on: boolean): void {
    this.reducedMotion = on;
    this.animator.setConfig({ reducedMotionScale: on ? 0.25 : 1 });
  }

  setQuality(q: "low" | "medium" | "high"): void {
    this.quality = q;
    if (this.renderer) {
      this.renderer.shadowMap.enabled = q !== "low";
    }
  }

  /** Glow the winning player's hand until reset. */
  highlightWinner(playerId: number | null): void {
    this.winnerHighlightId = playerId;
    this.winnerGlowMaterials = [];
    if (playerId === null) return;
    const hand = this.hands.get(playerId);
    if (!hand) return;
    hand.pivot.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshStandardMaterial) {
        obj.material.emissive = new THREE.Color(ACCENT_COLOR);
        obj.material.emissiveIntensity = 1.5;
        this.winnerGlowMaterials.push(obj.material);
      }
    });
  }

  /** Reset any winner glow back to default. */
  clearWinnerHighlight(): void {
    for (const m of this.winnerGlowMaterials) {
      m.emissiveIntensity = 0;
      m.emissive = new THREE.Color(0x000000);
    }
    this.winnerGlowMaterials = [];
    this.winnerHighlightId = null;
  }

  dispose(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    for (const hand of this.hands.values()) hand.dispose();
    this.hands.clear();
    this.table?.dispose();
    this.table = null;
    this.renderer?.dispose();
    if (this.renderer?.domElement && this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
    this.renderer = null;
    this.container = null;
  }
}
