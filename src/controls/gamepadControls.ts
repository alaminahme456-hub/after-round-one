/**
 * gamepadControls.ts — Gamepad API polling + mapping.
 *
 * Polls connected gamepads every frame and emits high-level events:
 *   - onDirection(dir)     d-pad / left-stick
 *   - onConfirm()          A / Cross / Enter
 *   - onCancel()           B / Circle / Esc
 *   - onNumber(n: 0..5)    buttons mapped to numbers when available
 *   - onPause()            Start / Menu button
 *
 * Keyboard + touch controls are independent and handled in their own hooks.
 *
 * The manager is a singleton and works for both menu navigation and in-game
 * number submission. It does NOT require a controller to play.
 */

"use client";

export type GamepadDirection = "up" | "down" | "left" | "right";

export interface GamepadCallbacks {
  onDirection?: (dir: GamepadDirection) => void;
  onConfirm?: () => void;
  onCancel?: () => void;
  onNumber?: (n: 0 | 1 | 2 | 3 | 4 | 5) => void;
  onPause?: () => void;
  onConnected?: (index: number, id: string) => void;
  onDisconnected?: (index: number) => void;
}

// Standard gamepad mapping (most browsers).
const BUTTON_A = 0;
const BUTTON_B = 1;
const BUTTON_X = 2;
const BUTTON_Y = 3;
const BUTTON_LB = 4;
const BUTTON_RB = 5;
const BUTTON_LT = 6;
const BUTTON_RT = 7;
const BUTTON_SELECT = 8;
const BUTTON_START = 9;
const BUTTON_DPAD_UP = 12;
const BUTTON_DPAD_DOWN = 13;
const BUTTON_DPAD_LEFT = 14;
const BUTTON_DPAD_RIGHT = 15;

class GamepadManager {
  private callbacks: GamepadCallbacks = {};
  private rafId: number | null = null;
  private prevButtons: Record<number, boolean[]> = {};
  private prevConnected: number[] = [];
  /** Returns true if any gamepad is currently connected. */
  hasGamepad = false;

  constructor() {
    if (typeof window === "undefined") return;
    window.addEventListener("gamepadconnected", (e) => {
      this.hasGamepad = true;
      this.callbacks.onConnected?.(e.gamepad.index, e.gamepad.id);
    });
    window.addEventListener("gamepaddisconnected", (e) => {
      this.callbacks.onDisconnected?.(e.gamepad.index);
      const pads = navigator.getGamepads?.() ?? [];
      this.hasGamepad = Array.from(pads).some((p) => p !== null);
    });
  }

  setCallbacks(cb: GamepadCallbacks): void {
    this.callbacks = cb;
  }

  start(): void {
    if (this.rafId !== null) return;
    const tick = () => {
      this.rafId = requestAnimationFrame(tick);
      this.poll();
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  private poll(): void {
    if (typeof navigator === "undefined" || !navigator.getGamepads) return;
    const pads = navigator.getGamepads();
    for (const pad of pads) {
      if (!pad) continue;
      const prev = this.prevButtons[pad.index] ?? new Array(16).fill(false);
      const cur = pad.buttons.map((b) => b.pressed);
      // Detect newly pressed buttons (rising edge).
      for (let i = 0; i < cur.length; i++) {
        if (cur[i] && !prev[i]) this.handlePress(i);
      }
      // Left-stick → direction (debounced by axis threshold).
      const dx = pad.axes[0] ?? 0;
      const dy = pad.axes[1] ?? 0;
      const THRESH = 0.5;
      if (Math.abs(dx) > THRESH || Math.abs(dy) > THRESH) {
        // Use a small hysteresis: only fire on direction change.
        const dir: GamepadDirection | null =
          Math.abs(dx) > Math.abs(dy)
            ? dx > 0 ? "right" : "left"
            : dy > 0 ? "down" : "up";
        if (dir && dir !== this.lastStickDir) {
          this.callbacks.onDirection?.(dir);
        }
        this.lastStickDir = dir;
      } else {
        this.lastStickDir = null;
      }
      this.prevButtons[pad.index] = cur;
    }
  }
  private lastStickDir: GamepadDirection | null = null;

  private handlePress(button: number): void {
    switch (button) {
      case BUTTON_A:
        this.callbacks.onConfirm?.();
        break;
      case BUTTON_B:
        this.callbacks.onCancel?.();
        break;
      case BUTTON_X:
        this.callbacks.onNumber?.(0);
        break;
      case BUTTON_Y:
        this.callbacks.onNumber?.(5);
        break;
      case BUTTON_LB:
        this.callbacks.onNumber?.(1);
        break;
      case BUTTON_RB:
        this.callbacks.onNumber?.(2);
        break;
      case BUTTON_LT:
        this.callbacks.onNumber?.(3);
        break;
      case BUTTON_RT:
        this.callbacks.onNumber?.(4);
        break;
      case BUTTON_START:
        this.callbacks.onPause?.();
        break;
      case BUTTON_DPAD_UP:
        this.callbacks.onDirection?.("up");
        break;
      case BUTTON_DPAD_DOWN:
        this.callbacks.onDirection?.("down");
        break;
      case BUTTON_DPAD_LEFT:
        this.callbacks.onDirection?.("left");
        break;
      case BUTTON_DPAD_RIGHT:
        this.callbacks.onDirection?.("right");
        break;
    }
  }
}

export const gamepad = new GamepadManager();
