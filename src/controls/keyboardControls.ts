/**
 * keyboardControls.ts — global keyboard input for menus + game.
 *
 * Mappings:
 *   - Arrow keys / WASD : navigation
 *   - Enter / Space     : confirm
 *   - Esc / Backspace  : cancel
 *   - Digit keys 0-5   : submit that number (in NUMBER_SUBMISSION phase)
 *   - R                 : ready toggle (in READY_CHECK)
 */

"use client";

export interface KeyboardCallbacks {
  onDirection?: (dir: "up" | "down" | "left" | "right") => void;
  onConfirm?: () => void;
  onCancel?: () => void;
  onNumber?: (n: 0 | 1 | 2 | 3 | 4 | 5) => void;
  onReady?: () => void;
}

class KeyboardManager {
  private callbacks: KeyboardCallbacks = {};
  private handler: ((e: KeyboardEvent) => void) | null = null;

  setCallbacks(cb: KeyboardCallbacks): void {
    this.callbacks = cb;
  }

  start(): void {
    if (this.handler) return;
    this.handler = (e: KeyboardEvent) => {
      const c = this.callbacks;
      switch (e.key) {
        case "ArrowUp":
        case "w":
        case "W":
          c.onDirection?.("up");
          break;
        case "ArrowDown":
        case "s":
        case "S":
          c.onDirection?.("down");
          break;
        case "ArrowLeft":
        case "a":
        case "A":
          c.onDirection?.("left");
          break;
        case "ArrowRight":
        case "d":
        case "D":
          c.onDirection?.("right");
          break;
        case "Enter":
        case " ":
          c.onConfirm?.();
          break;
        case "Escape":
        case "Backspace":
          c.onCancel?.();
          break;
        case "0":
          c.onNumber?.(0);
          break;
        case "1":
          c.onNumber?.(1);
          break;
        case "2":
          c.onNumber?.(2);
          break;
        case "3":
          c.onNumber?.(3);
          break;
        case "4":
          c.onNumber?.(4);
          break;
        case "5":
          c.onNumber?.(5);
          break;
        case "r":
        case "R":
          c.onReady?.();
          break;
      }
    };
    window.addEventListener("keydown", this.handler);
  }

  stop(): void {
    if (this.handler) {
      window.removeEventListener("keydown", this.handler);
      this.handler = null;
    }
  }
}

export const keyboard = new KeyboardManager();
