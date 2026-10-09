/**
 * Tests for winnerCalculation.ts — the core game-rules engine.
 */
import { describe, it, expect } from "vitest";
import {
  activePlayers,
  computeOutcome,
  isValidSubmission,
  resolveMissingSubmission,
  submissionsFromRecord,
} from "@/game/winnerCalculation";
import type { PlayerState } from "@/game/types";
import type { SubmissionNumber } from "@/game/types";

function mkPlayer(id: number, starting: number | null, spectator = false): PlayerState {
  return {
    id,
    name: `P${id}`,
    startingNumber: starting,
    submittedNumber: null,
    isSpectator: spectator,
    finishingPosition: null,
    skinTone: (id - 1) as 0,
    connected: true,
    ready: true,
  };
}

function subs(rec: Record<number, SubmissionNumber>) {
  return submissionsFromRecord(rec);
}

describe("activePlayers", () => {
  it("excludes spectators", () => {
    const players = [mkPlayer(1, 5), mkPlayer(2, 7, true), mkPlayer(3, 9)];
    const active = activePlayers(players);
    expect(active.map((p) => p.id)).toEqual([1, 3]);
  });

  it("excludes disconnected players", () => {
    const players = [
      mkPlayer(1, 5),
      { ...mkPlayer(2, 7), connected: false },
      mkPlayer(3, 9),
    ];
    const active = activePlayers(players);
    expect(active.map((p) => p.id)).toEqual([1, 3]);
  });

  it("returns players sorted by id", () => {
    const players = [mkPlayer(3, 5), mkPlayer(1, 7), mkPlayer(2, 9)];
    const active = activePlayers(players);
    expect(active.map((p) => p.id)).toEqual([1, 2, 3]);
  });
});

describe("computeOutcome — examples from spec", () => {
  it("Example 1: total 5 → Player A wins (starting 5)", () => {
    const players = [mkPlayer(1, 5), mkPlayer(2, 7)];
    const outcome = computeOutcome(players, subs({ 1: 0, 2: 5 }), "treat_as_zero");
    expect(outcome.kind).toBe("winner");
    if (outcome.kind === "winner") {
      expect(outcome.total).toBe(5);
      expect(outcome.winners).toEqual([1]);
    }
  });

  it("Example 2: total 7 → Player B wins (starting 7)", () => {
    const players = [mkPlayer(1, 5), mkPlayer(2, 7)];
    const outcome = computeOutcome(players, subs({ 1: 5, 2: 2 }), "treat_as_zero");
    expect(outcome.kind).toBe("winner");
    if (outcome.kind === "winner") {
      expect(outcome.total).toBe(7);
      expect(outcome.winners).toEqual([2]);
    }
  });

  it("Example 3: total 7 → DRAW (no player has 7)", () => {
    const players = [mkPlayer(1, 5), mkPlayer(2, 12), mkPlayer(3, 20)];
    const outcome = computeOutcome(players, subs({ 1: 1, 2: 4, 3: 2 }), "treat_as_zero");
    expect(outcome.kind).toBe("draw");
    if (outcome.kind === "draw") expect(outcome.total).toBe(7);
  });
});

describe("computeOutcome — player counts", () => {
  it("2 players: duplicate starting numbers → tie if both match", () => {
    const players = [mkPlayer(1, 5), mkPlayer(2, 5)];
    const outcome = computeOutcome(players, subs({ 1: 2, 2: 3 }), "treat_as_zero");
    expect(outcome.kind).toBe("winner");
    if (outcome.kind === "winner") {
      expect(outcome.total).toBe(5);
      expect(outcome.winners).toEqual([1, 2]);
    }
  });

  it("3 players: unique winner", () => {
    const players = [mkPlayer(1, 3), mkPlayer(2, 7), mkPlayer(3, 11)];
    const outcome = computeOutcome(players, subs({ 1: 1, 2: 1, 3: 1 }), "treat_as_zero");
    expect(outcome.kind).toBe("winner");
    if (outcome.kind === "winner") {
      expect(outcome.total).toBe(3);
      expect(outcome.winners).toEqual([1]);
    }
  });

  it("4 players: draw", () => {
    const players = [mkPlayer(1, 4), mkPlayer(2, 8), mkPlayer(3, 12), mkPlayer(4, 16)];
    // 1+2+3+4 = 10, no player has 10
    const outcome = computeOutcome(players, subs({ 1: 1, 2: 2, 3: 3, 4: 4 }), "treat_as_zero");
    expect(outcome.kind).toBe("draw");
  });

  it("5 players: unique winner at max total", () => {
    // All submit 5 → total 25; player 5 starts with 25
    const players = [
      mkPlayer(1, 5),
      mkPlayer(2, 10),
      mkPlayer(3, 15),
      mkPlayer(4, 20),
      mkPlayer(5, 25),
    ];
    const outcome = computeOutcome(
      players,
      subs({ 1: 5, 2: 5, 3: 5, 4: 5, 5: 5 }),
      "treat_as_zero",
    );
    expect(outcome.kind).toBe("winner");
    if (outcome.kind === "winner") {
      expect(outcome.total).toBe(25);
      expect(outcome.winners).toEqual([5]);
    }
  });
});

describe("computeOutcome — duplicate submissions allowed", () => {
  it("two players can submit the same number", () => {
    const players = [mkPlayer(1, 8), mkPlayer(2, 4)];
    const outcome = computeOutcome(players, subs({ 1: 4, 2: 4 }), "treat_as_zero");
    expect(outcome.kind).toBe("winner");
    if (outcome.kind === "winner") {
      expect(outcome.total).toBe(8);
      expect(outcome.winners).toEqual([1]);
    }
  });

  it("player may submit a number != their starting number", () => {
    const players = [mkPlayer(1, 5), mkPlayer(2, 7)];
    // P1 starts 5 but submits 3; P2 submits 2 → total 5 → P1 wins
    const outcome = computeOutcome(players, subs({ 1: 3, 2: 2 }), "treat_as_zero");
    expect(outcome.kind).toBe("winner");
    if (outcome.kind === "winner") expect(outcome.winners).toEqual([1]);
  });
});

describe("computeOutcome — missing submissions", () => {
  it("missing submission treated as zero by default", () => {
    const players = [mkPlayer(1, 5), mkPlayer(2, 7)];
    // Only P2 submits 5 → total 5 (P1 missing → 0) → P1 wins!
    const outcome = computeOutcome(players, subs({ 2: 5 }), "treat_as_zero");
    expect(outcome.kind).toBe("winner");
    if (outcome.kind === "winner") {
      expect(outcome.total).toBe(5);
      expect(outcome.winners).toEqual([1]);
    }
  });

  it("missing submission treated as five when configured", () => {
    const players = [mkPlayer(1, 5), mkPlayer(2, 10)];
    // P1 submits 5, P2 missing → 5 → total 10 → P2 wins
    const outcome = computeOutcome(players, subs({ 1: 5 }), "treat_as_five");
    expect(outcome.kind).toBe("winner");
    if (outcome.kind === "winner") expect(outcome.winners).toEqual([2]);
  });

  it("max submission (5) on all players", () => {
    const players = [mkPlayer(1, 10), mkPlayer(2, 10)];
    const outcome = computeOutcome(players, subs({ 1: 5, 2: 5 }), "treat_as_zero");
    expect(outcome.kind).toBe("winner");
    if (outcome.kind === "winner") {
      expect(outcome.total).toBe(10);
      expect(outcome.winners).toEqual([1, 2]);
    }
  });
});

describe("computeOutcome — spectator exclusion", () => {
  it("spectator submissions are not counted", () => {
    // 3 players, P3 is spectator. Active = P1,P2.
    const players = [mkPlayer(1, 5), mkPlayer(2, 7), mkPlayer(3, 9, true)];
    // Even if P3 submitted 100 it wouldn't count.
    const subsMap = new Map<number, SubmissionNumber>([
      [1, 2],
      [2, 3],
      // P3 is spectator — submission omitted on purpose.
    ]);
    const outcome = computeOutcome(players, subsMap, "treat_as_zero");
    // total = 2 + 3 = 5 → P1 wins
    expect(outcome.kind).toBe("winner");
    if (outcome.kind === "winner") expect(outcome.winners).toEqual([1]);
  });
});

describe("isValidSubmission", () => {
  it("accepts 0..5", () => {
    for (let i = 0; i <= 5; i++) expect(isValidSubmission(i)).toBe(true);
  });
  it("rejects negatives", () => {
    expect(isValidSubmission(-1)).toBe(false);
  });
  it("rejects > 5", () => {
    expect(isValidSubmission(6)).toBe(false);
    expect(isValidSubmission(100)).toBe(false);
  });
  it("rejects non-integers", () => {
    expect(isValidSubmission(2.5)).toBe(false);
    expect(isValidSubmission("3")).toBe(false);
    expect(isValidSubmission(null)).toBe(false);
    expect(isValidSubmission(undefined)).toBe(false);
  });
});

describe("resolveMissingSubmission", () => {
  it("returns 0 for treat_as_zero", () => {
    expect(resolveMissingSubmission("treat_as_zero")).toBe(0);
  });
  it("returns 5 for treat_as_five", () => {
    expect(resolveMissingSubmission("treat_as_five")).toBe(5);
  });
  it("returns 0 for eliminate (caller handles separately)", () => {
    expect(resolveMissingSubmission("eliminate")).toBe(0);
  });
});
