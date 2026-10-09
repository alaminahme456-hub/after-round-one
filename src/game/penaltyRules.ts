/**
 * penaltyRules.ts — penalty / match mode logic.
 *
 * The game does NOT integrate real-money transfers. The bet mode only records
 * the agreed terms and shows them on the results screen.
 */

import type { MatchConfig, PenaltyMode, PlayerState } from "./types";
import { finalRanking } from "./multiplayerProgression";

/**
 * Apply the configured penalty rule to the finishing order, returning the
 * human-readable description for each player.
 *
 * For "bet": every player gets the wager text on the results screen.
 * For "elimination": no penalty text.
 * For "just_for_fun": the losing position gets the corresponding penalty.
 */
export interface PenaltyAssignment {
  playerId: number;
  playerName: string;
  finishingPosition: number | null;
  penaltyText: string | null;
  role: "winner" | "loser" | "neutral";
}

export function assignPenalties(
  players: readonly PlayerState[],
  config: MatchConfig,
): PenaltyAssignment[] {
  const ranked = finalRanking(players);
  const first = ranked.find((p) => p.finishingPosition === 1);
  const last = ranked.find((p) => p.finishingPosition === ranked.length);

  return ranked.map((p) => {
    let role: PenaltyAssignment["role"] = "neutral";
    let penaltyText: string | null = null;

    if (p.finishingPosition === 1) role = "winner";
    else if (p.finishingPosition === ranked.length && ranked.length > 1) role = "loser";

    if (config.penaltyMode === "bet") {
      penaltyText = config.wagerText || "No wager text provided.";
    } else if (config.penaltyMode === "just_for_fun") {
      // Penalties array is ordered by finishing position descending
      // (index 0 = last place, index N-1 = first place).
      // Default behaviour: assign the penalty to the LOSER (last place).
      const loserIdx = (p.finishingPosition ?? 1) - 1;
      const penalties = config.penalties ?? [];
      // For just_for_fun we want the WORST position to get the harshest penalty.
      // We'll index penalties by reverse finishing position so that
      // finishingPosition === totalPlayers picks penalties[0].
      const total = ranked.length;
      const penaltyIdx = total - (p.finishingPosition ?? total);
      if (role === "loser" && penalties.length > 0) {
        penaltyText = penalties[Math.min(penaltyIdx, penalties.length - 1)] || null;
      } else if (p.finishingPosition === total && penalties.length > 0) {
        // Fallback: last place gets first penalty.
        penaltyText = penalties[0] || null;
      } else {
        penaltyText = null;
      }
      // unused var guard
      void loserIdx;
    }

    return {
      playerId: p.id,
      playerName: p.name,
      finishingPosition: p.finishingPosition,
      penaltyText,
      role,
    };
  });
}

/**
 * Build the lobby-time confirmation text shown before a match starts.
 */
export function buildConfirmationText(
  config: MatchConfig,
  playerNames: readonly string[],
): string {
  const playerList = playerNames.join(", ");
  const modeLabel: Record<PenaltyMode, string> = {
    bet: "Bet Mode",
    elimination: "Elimination Mode",
    just_for_fun: "Just For Fun",
  };
  const lines: string[] = [
    `Mode: ${modeLabel[config.penaltyMode]}`,
    `Players (${playerNames.length}): ${playerList}`,
    `Round duration: ${config.roundDuration}s`,
    `Submission deadline: ${config.submissionDeadline}s`,
  ];
  if (config.penaltyMode === "bet" && config.wagerText) {
    lines.push(`Wager: ${config.wagerText}`);
  }
  if (config.penaltyMode === "just_for_fun" && config.penalties?.length) {
    lines.push(`Penalties: ${config.penalties.join(" | ")}`);
  }
  if (config.missingSubmissionRule !== "treat_as_zero") {
    lines.push(`Missing submission: ${config.missingSubmissionRule}`);
  }
  return lines.join("\n");
}

/**
 * Predefined penalty suggestions for the just_for_fun lobby picker.
 */
export const PENALTY_SUGGESTIONS: string[] = [
  "Dance for 10 seconds",
  "Sing a song",
  "Tell a joke",
  "Do 5 push-ups",
  "Speak in an accent for the next match",
  "Compliment every other player",
];
