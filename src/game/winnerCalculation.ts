/**
 * winnerCalculation.ts — THE game-rules engine.
 *
 * Pure TypeScript, no rendering, no networking, no DOM. Unit-tested.
 *
 * Rules (per the AFTER ROUND ONE spec):
 *   - Every active (non-spectator, connected) player submits a number 0..5.
 *   - Total T = sum of all active players' submitted numbers.
 *   - A player wins the round iff their starting number S(i) equals T.
 *   - If one active player matches: unique winner.
 *   - If multiple active players share the same matching starting number: tie.
 *   - If no active player's starting number matches T: draw, replay the round.
 *   - Spectators never contribute to T.
 *
 * All arithmetic uses plain integers (0..5 submissions, totals ≤ 25).
 */

import type {
  PlayerState,
  RoundOutcome,
  SubmissionNumber,
} from "./types";
import { SUBMISSION_NUMBERS } from "./types";

/**
 * Returns only the active (non-spectator, connected) players, in stable id order.
 */
export function activePlayers(players: readonly PlayerState[]): PlayerState[] {
  return players
    .filter((p) => !p.isSpectator && p.connected)
    .sort((a, b) => a.id - b.id);
}

/**
 * Resolve a missing submission per the configured rule.
 * Returns the integer that should be added to the total in that player's place.
 */
export function resolveMissingSubmission(
  rule: "treat_as_zero" | "treat_as_five" | "eliminate",
): number {
  if (rule === "treat_as_five") return 5;
  return 0; // treat_as_zero; eliminate handled elsewhere
}

/**
 * Compute the round outcome from a player list.
 *
 * @param players         full roster (active + spectator)
 * @param submissions     map of playerId → submitted number. Must contain an
 *                        entry for every active player OR that player's
 *                        contribution falls back to the missing-submission rule.
 * @param missingRule     how to handle active players missing from `submissions`.
 */
export function computeOutcome(
  players: readonly PlayerState[],
  submissions: ReadonlyMap<number, SubmissionNumber>,
  missingRule: "treat_as_zero" | "treat_as_five" | "eliminate" = "treat_as_zero",
): RoundOutcome {
  const active = activePlayers(players);

  // Sum integer contributions from every active player.
  let total = 0;
  for (const p of active) {
    const submitted = submissions.get(p.id);
    if (submitted === undefined) {
      // Missing submission → apply the configured rule.
      total += resolveMissingSubmission(missingRule);
    } else {
      total += submitted;
    }
  }

  // Find all active players whose starting number equals the total.
  // NOTE: a player with startingNumber === null cannot win (shouldn't happen
  // past STARTING_NUMBER_SELECTION, but defend against it anyway).
  const winners = active
    .filter((p) => p.startingNumber !== null && p.startingNumber === total)
    .map((p) => p.id);

  if (winners.length === 0) {
    return { kind: "draw", total };
  }
  return { kind: "winner", winners, total };
}

/**
 * Validate a submission number. Returns true iff it is one of {0,1,2,3,4,5}.
 */
export function isValidSubmission(n: unknown): n is SubmissionNumber {
  return (
    typeof n === "number" &&
    Number.isInteger(n) &&
    (SUBMISSION_NUMBERS as readonly number[]).includes(n)
  );
}

/**
 * Pure helper used by tests: build a submissions map from a record.
 */
export function submissionsFromRecord(
  rec: Record<number, SubmissionNumber>,
): Map<number, SubmissionNumber> {
  return new Map(Object.entries(rec).map(([k, v]) => [Number(k), v]));
}
