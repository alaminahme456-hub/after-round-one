/**
 * Core shared types for AFTER ROUND ONE.
 * Pure data contracts — no rendering, no networking.
 *
 * These types are imported across the game-logic, three/, multiplayer/, and
 * controls/ layers so that gameplay stays decoupled from rendering and can be
 * unit tested in isolation.
 */

/** The six fixed submission numbers. Identical for every match. */
export const SUBMISSION_NUMBERS = [0, 1, 2, 3, 4, 5] as const;
export type SubmissionNumber = (typeof SUBMISSION_NUMBERS)[number];

/** A player's starting number (the target they want the sum to equal). */
export type StartingNumber = number;

/** Skin-tone variation index for 3D hand rendering (visual only). */
export type SkinTone = 0 | 1 | 2 | 3 | 4;

export interface SkinToneDefinition {
  id: SkinTone;
  name: string;
  hex: string;
  colorNumber: number;
  description: string;
}

/** Distinct natural human skin tones: Fair, Brown, Chocolate, Black, and Tan. */
export const SKIN_TONE_DEFS: SkinToneDefinition[] = [
  { id: 0, name: "Fair", hex: "#f8d5c2", colorNumber: 0xf8d5c2, description: "Fair warm porcelain" },
  { id: 1, name: "Brown", hex: "#9e643c", colorNumber: 0x9e643c, description: "Warm golden brown" },
  { id: 2, name: "Chocolate", hex: "#522d1b", colorNumber: 0x522d1b, description: "Rich chocolate cocoa" },
  { id: 3, name: "Black", hex: "#231712", colorNumber: 0x231712, description: "Deep ebony black" },
  { id: 4, name: "Tan", hex: "#cf9566", colorNumber: 0xcf9566, description: "Sun-kissed bronze tan" },
];

/** The five SKIN_TONES (visual only — never used for game logic). */
export const SKIN_TONES: SkinTone[] = [0, 1, 2, 3, 4];

/** Match-wide penalty mode. */
export type PenaltyMode = "bet" | "elimination" | "just_for_fun";

/** Disconnection policy for online play. */
export type DisconnectPolicy =
  | "forfeit_active_player"
  | "pause_match"
  | "auto_play_zero";

/** What happens when an active player fails to submit in time. */
export type MissingSubmissionRule = "treat_as_zero" | "treat_as_five" | "eliminate";

/** Game mode (local vs online vs ai). */
export type GameMode = "local" | "online" | "ai";

/** Finite-state-machine states for the whole match. */
export type GameState =
  | "MENU"
  | "LOBBY"
  | "STARTING_NUMBER_SELECTION"
  | "READY_CHECK"
  | "ROLLING"
  | "NUMBER_SUBMISSION"
  | "CALCULATING_RESULT"
  | "DRAW_RESULTS"
  | "ROUND_WINNER"
  | "SPECTATOR"
  | "FINAL_RESULTS"
  | "PENALTY"
  | "MATCH_COMPLETE";

/** Round outcome computed by winnerCalculation. */
export type RoundOutcome =
  | { kind: "winner"; winners: number[]; total: number }
  | { kind: "draw"; total: number };

/** A player's per-match state. */
export interface PlayerState {
  id: number;
  name: string;
  startingNumber: StartingNumber | null;
  submittedNumber: SubmissionNumber | null;
  isSpectator: boolean;
  finishingPosition: number | null;
  skinTone: SkinTone;
  connected: boolean;
  ready: boolean;
  isAi?: boolean;
}

/** Match configuration set in the lobby. */
export interface MatchConfig {
  mode: GameMode;
  playerCount: 2 | 3 | 4 | 5;
  roundDuration: number;
  submissionDeadline: number;
  penaltyMode: PenaltyMode;
  hideStartingNumbers: boolean;
  missingSubmissionRule: MissingSubmissionRule;
  disconnectPolicy: DisconnectPolicy;
  wagerText?: string;
  penalties?: string[];
  reducedMotion: boolean;
  graphicsQuality: "low" | "medium" | "high";
}

export const DEFAULT_MATCH_CONFIG: MatchConfig = {
  mode: "local",
  playerCount: 2,
  roundDuration: 10,
  submissionDeadline: 5,
  penaltyMode: "elimination",
  hideStartingNumbers: false,
  missingSubmissionRule: "treat_as_zero",
  disconnectPolicy: "auto_play_zero",
  wagerText: "",
  penalties: [],
  reducedMotion: false,
  graphicsQuality: "medium",
};

/** The upper bound for starting-number selection given the player count. */
export function startingNumberMax(playerCount: number): number {
  return playerCount === 2 ? 10 : 25;
}

export const STARTING_NUMBER_MIN = 1;
