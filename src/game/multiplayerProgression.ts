/**
 * multiplayerProgression.ts — manages finishing-order progression across rounds.
 *
 * Responsibilities:
 *   - Promote a round winner to a finishing position (spectator).
 *   - Handle ties deterministically without producing inconsistent rankings.
 *   - Detect when the match is complete (all positions assigned).
 *   - Never eliminate a player on a draw.
 *
 * Tie policy (documented + explicit, not silent):
 *   When multiple players share a matching starting number in the same round,
 *   they all "win" the round but only ONE finishing position is awarded per
 *   round. To keep rankings consistent we award the next finishing position to
 *   the tied player with the LOWEST player id, then demote the remaining tied
 *   players back into the active pool for the next round. This way:
 *     - No two players ever share the same finishing position.
 *     - The match always progresses by exactly one position per round.
 *     - Tied-but-not-promoted players get another shot next round.
 *
 * This policy is deterministic, observable, and survives disconnects.
 */

import type { PlayerState, RoundOutcome } from "./types";

/**
 * Apply a round outcome to the player roster, returning a NEW roster
 * (does not mutate input).
 *
 * @returns {
 *   players: updated roster,
 *   promotedId: id of the player promoted this round (or null on draw),
 *   matchComplete: true when every position has been assigned
 * }
 */
export interface ProgressionResult {
  players: PlayerState[];
  promotedId: number | null;
  matchComplete: boolean;
  tieIds: number[]; // empty when no tie; otherwise the tied ids (incl. promoted)
}

export function applyRoundOutcome(
  players: readonly PlayerState[],
  outcome: RoundOutcome,
): ProgressionResult {
  // Draw → no promotion, roster unchanged (but submitted numbers reset elsewhere).
  if (outcome.kind === "draw") {
    return {
      players: players.map((p) => ({ ...p, submittedNumber: null })),
      promotedId: null,
      matchComplete: false,
      tieIds: [],
    };
  }

  // Winner(s). On a tie pick the lowest id to promote; others stay active.
  const tieIds = [...outcome.winners].sort((a, b) => a - b);
  const promotedId = tieIds[0] ?? null;

  // Determine the next finishing position: 1 + max(positions already assigned).
  // This is robust even if a previous round produced no promotion (draw).
  const positionsAssigned = players.filter((p) => p.finishingPosition !== null).length;
  const nextPosition = positionsAssigned + 1;
  const totalPlayers = players.length;

  const updated: PlayerState[] = players.map((p) => {
    if (p.id === promotedId) {
      return {
        ...p,
        isSpectator: true,
        finishingPosition: nextPosition,
        submittedNumber: null,
      };
    }
    // Everyone else (including remaining tied players) keeps playing.
    return { ...p, submittedNumber: null };
  });

  // Match is complete when every player has a finishing position.
  // The last remaining active player receives the final position automatically.
  const activeAfter = updated.filter((p) => !p.isSpectator);
  let matchComplete = false;
  if (activeAfter.length === 1) {
    // Only one active player left → they take the last position.
    const lastPos = totalPlayers;
    const lastIdx = updated.findIndex((p) => p.id === activeAfter[0].id);
    updated[lastIdx] = {
      ...updated[lastIdx],
      isSpectator: true,
      finishingPosition: lastPos,
      submittedNumber: null,
    };
    matchComplete = true;
  } else if (activeAfter.length === 0) {
    // Edge: all players already placed.
    matchComplete = true;
  }

  return {
    players: updated,
    promotedId,
    matchComplete,
    tieIds: tieIds.length > 1 ? tieIds : [],
  };
}

/**
 * Final ranking: returns players sorted by finishingPosition ascending.
 * Players without a finishing position sort last by id.
 */
export function finalRanking(players: readonly PlayerState[]): PlayerState[] {
  return [...players].sort((a, b) => {
    const pa = a.finishingPosition ?? Number.MAX_SAFE_INTEGER;
    const pb = b.finishingPosition ?? Number.MAX_SAFE_INTEGER;
    if (pa !== pb) return pa - pb;
    return a.id - b.id;
  });
}

/**
 * Returns true iff the match has reached a terminal state (all placed).
 */
export function isMatchComplete(players: readonly PlayerState[]): boolean {
  return players.every((p) => p.finishingPosition !== null);
}
