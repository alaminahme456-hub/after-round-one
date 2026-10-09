/**
 * numberSubmission.ts — submission-phase rules + validation.
 *
 * Invariants enforced here (and only here):
 *   - Only 0..5 are valid submissions.
 *   - A submission is locked once received (cannot be edited after submission).
 *   - Submissions from spectators / disconnected players are REJECTED.
 *   - Submissions received after the phase closed are REJECTED (late submissions).
 *   - Duplicate submissions across players are ALLOWED (multiple players may
 *     pick the same number).
 *   - Players may submit a number != their starting number.
 */

import type { PlayerState, SubmissionNumber } from "./types";
import { SUBMISSION_NUMBERS } from "./types";
import { isValidSubmission } from "./winnerCalculation";

export type SubmissionResult =
  | { ok: true; playerId: number; number: SubmissionNumber }
  | { ok: false; reason: SubmissionError };

export type SubmissionError =
  | "invalid_number" // not 0..5
  | "spectator" // player is a spectator
  | "disconnected" // player is offline
  | "already_submitted" // already locked in this round
  | "phase_closed" // server/client says phase ended
  | "unknown_player";

export interface SubmissionPhaseState {
  /** Map playerId → submission. */
  submissions: Map<number, SubmissionNumber>;
  /** True once the phase is closed (timer expired or all submitted). */
  closed: boolean;
  /** Unix ms timestamp when the phase opened. */
  openedAt: number;
  /** Unix ms timestamp when the phase closes (deadline). */
  closesAt: number;
}

export function createSubmissionPhase(
  openedAt: number,
  deadlineSeconds: number,
): SubmissionPhaseState {
  return {
    submissions: new Map(),
    closed: false,
    openedAt,
    closesAt: openedAt + deadlineSeconds * 1000,
  };
}

/**
 * Attempt to submit a number for a player.
 * Pure: does not mutate `phase`; returns a new phase + result.
 */
export function submitNumber(
  phase: SubmissionPhaseState,
  players: readonly PlayerState[],
  playerId: number,
  number: unknown,
  now: number,
): { phase: SubmissionPhaseState; result: SubmissionResult } {
  const player = players.find((p) => p.id === playerId);
  if (!player) {
    return { phase, result: { ok: false, reason: "unknown_player" } };
  }
  if (player.isSpectator) {
    return { phase, result: { ok: false, reason: "spectator" } };
  }
  if (!player.connected) {
    return { phase, result: { ok: false, reason: "disconnected" } };
  }
  if (phase.closed || now >= phase.closesAt) {
    return { phase, result: { ok: false, reason: "phase_closed" } };
  }
  if (phase.submissions.has(playerId)) {
    return { phase, result: { ok: false, reason: "already_submitted" } };
  }
  if (!isValidSubmission(number)) {
    return { phase, result: { ok: false, reason: "invalid_number" } };
  }

  const submissions = new Map(phase.submissions);
  submissions.set(playerId, number);
  const next: SubmissionPhaseState = { ...phase, submissions };
  return {
    phase: next,
    result: { ok: true, playerId, number },
  };
}

/**
 * Returns true iff every active player has a submission in the phase.
 */
export function allActivePlayersSubmitted(
  phase: SubmissionPhaseState,
  players: readonly PlayerState[],
): boolean {
  return players
    .filter((p) => !p.isSpectator && p.connected)
    .every((p) => phase.submissions.has(p.id));
}

/**
 * Close the submission phase (e.g. timer expired). Returns a new phase with
 * `closed = true`. Subsequent submissions will be rejected as phase_closed.
 */
export function closePhase(
  phase: SubmissionPhaseState,
): SubmissionPhaseState {
  return { ...phase, closed: true };
}

/**
 * Whether submissions should auto-close because every active player has
 * submitted (and at least 2 players exist).
 */
export function shouldAutoClose(
  phase: SubmissionPhaseState,
  players: readonly PlayerState[],
): boolean {
  const activeCount = players.filter((p) => !p.isSpectator && p.connected).length;
  return activeCount >= 1 && allActivePlayersSubmitted(phase, players);
}

export { SUBMISSION_NUMBERS };
