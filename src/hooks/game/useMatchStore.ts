/**
 * useMatchStore.ts — Zustand store that wraps the Match engine and exposes
 * a React-friendly snapshot of the game state.
 *
 * The Match engine is mutable; this store subscribes to its snapshots and
 * pushes them into React state. The store also holds UI-level settings
 * (sound on/off, reduced-motion, graphics quality).
 */

"use client";

import { create } from "zustand";
import { Match } from "@/game/gameState";
import type { MatchSnapshot } from "@/game/gameState";
import type { MatchConfig, StartingNumber } from "@/game/types";

interface Settings {
  soundEnabled: boolean;
  musicEnabled: boolean;
  masterVolume: number;
  reducedMotion: boolean;
  graphicsQuality: "low" | "medium" | "high";
}

interface MatchStore {
  snapshot: MatchSnapshot | null;
  settings: Settings;
  /** The match engine (mutable; not part of snapshot). */
  _match: Match | null;
  /** Initialize a new match with optional config overrides. */
  initMatch: (config?: Partial<MatchConfig>) => Match;
  /** Sync the store from the engine. */
  sync: () => void;
  /** Update settings. */
  setSettings: (partial: Partial<Settings>) => void;
  /** Update match config (only valid in lobby). */
  updateConfig: (partial: Partial<MatchConfig>) => void;
  /** Convenience: set a player's starting number. */
  setStartingNumber: (playerId: number, n: StartingNumber) => void;
  /** Convenience: mark a player ready. */
  setReady: (playerId: number, ready: boolean) => void;
}

const DEFAULT_SETTINGS: Settings = {
  soundEnabled: true,
  musicEnabled: true,
  masterVolume: 0.8,
  reducedMotion: false,
  graphicsQuality: "medium",
};

export const useMatchStore = create<MatchStore>((set, get) => ({
  snapshot: null,
  settings: DEFAULT_SETTINGS,
  _match: null,

  initMatch: (config) => {
    // Tear down previous engine.
    const prev = get()._match;
    if (prev) {
      // No explicit dispose needed; we just create a fresh one.
    }
    const match = new Match(config);
    set({ _match: match });
    match.subscribe((snap) => {
      set({ snapshot: snap });
    });
    return match;
  },

  sync: () => {
    const match = get()._match;
    if (!match) return;
    // Re-trigger listeners by reading snapshot.
    set({ snapshot: match.getSnapshot() });
  },

  setSettings: (partial) => {
    set({ settings: { ...get().settings, ...partial } });
    // Propagate reduced-motion + quality into the match config.
    const match = get()._match;
    if (match) {
      const snap = match.getSnapshot();
      match.setConfig({
        reducedMotion: partial.reducedMotion ?? snap.config.reducedMotion,
        graphicsQuality: partial.graphicsQuality ?? snap.config.graphicsQuality,
      });
    }
  },

  updateConfig: (partial) => {
    const match = get()._match;
    if (!match) return;
    match.setConfig(partial);
  },

  setStartingNumber: (playerId, n) => {
    const match = get()._match;
    if (!match) return;
    match.setStartingNumber(playerId, n);
  },

  setReady: (playerId, ready) => {
    const match = get()._match;
    if (!match) return;
    match.setReady(playerId, ready);
  },
}));
