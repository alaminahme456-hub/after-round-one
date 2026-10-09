/**
 * Tests for multiplayerProgression.ts — finishing order + ties.
 */
import { describe, it, expect } from "vitest";
import {
  applyRoundOutcome,
  finalRanking,
  isMatchComplete,
} from "@/game/multiplayerProgression";
import type { PlayerState } from "@/game/types";

function mkPlayer(id: number, starting: number): PlayerState {
  return {
    id,
    name: `P${id}`,
    startingNumber: starting,
    submittedNumber: null,
    isSpectator: false,
    finishingPosition: null,
    skinTone: (id - 1) as 0,
    connected: true,
    ready: true,
  };
}

describe("applyRoundOutcome — winner promotion", () => {
  it("promotes unique winner to 1st place; last player auto-gets 2nd (2p match)", () => {
    const players = [mkPlayer(1, 5), mkPlayer(2, 7)];
    const res = applyRoundOutcome(players, { kind: "winner", winners: [1], total: 5 });
    expect(res.promotedId).toBe(1);
    expect(res.players.find((p) => p.id === 1)?.finishingPosition).toBe(1);
    expect(res.players.find((p) => p.id === 1)?.isSpectator).toBe(true);
    // P2 is the only active player remaining → auto-promoted to 2nd.
    expect(res.players.find((p) => p.id === 2)?.finishingPosition).toBe(2);
    expect(res.players.find((p) => p.id === 2)?.isSpectator).toBe(true);
    expect(res.matchComplete).toBe(true);
  });

  it("second winner earns 2nd place; last player gets 3rd automatically (3p match)", () => {
    const players = [mkPlayer(1, 5), mkPlayer(2, 7), mkPlayer(3, 9)];
    // Round 1: P1 wins → 1st place.
    const r1 = applyRoundOutcome(players, { kind: "winner", winners: [1], total: 5 });
    expect(r1.players.find((p) => p.id === 1)?.finishingPosition).toBe(1);
    // Round 2: P2 wins → 2nd place; P3 auto → 3rd.
    const r2 = applyRoundOutcome(r1.players, { kind: "winner", winners: [2], total: 7 });
    expect(r2.players.find((p) => p.id === 2)?.finishingPosition).toBe(2);
    expect(r2.players.find((p) => p.id === 3)?.finishingPosition).toBe(3);
    expect(r2.matchComplete).toBe(true);
  });
});

describe("applyRoundOutcome — draw never promotes", () => {
  it("draw: no one promoted, match not complete", () => {
    const players = [mkPlayer(1, 5), mkPlayer(2, 7)];
    const res = applyRoundOutcome(players, { kind: "draw", total: 9 });
    expect(res.promotedId).toBeNull();
    expect(res.matchComplete).toBe(false);
    expect(res.players.every((p) => !p.isSpectator)).toBe(true);
  });

  it("draw after a promotion keeps the prior promotion intact", () => {
    const players = [mkPlayer(1, 5), mkPlayer(2, 7), mkPlayer(3, 9)];
    const r1 = applyRoundOutcome(players, { kind: "winner", winners: [1], total: 5 });
    const r2 = applyRoundOutcome(r1.players, { kind: "draw", total: 9 });
    expect(r2.players.find((p) => p.id === 1)?.finishingPosition).toBe(1);
    expect(r2.players.find((p) => p.id === 1)?.isSpectator).toBe(true);
    expect(r2.players.find((p) => p.id === 2)?.finishingPosition).toBeNull();
    expect(r2.players.find((p) => p.id === 3)?.finishingPosition).toBeNull();
  });
});

describe("applyRoundOutcome — ties", () => {
  it("tie: only lowest-id player promoted; others stay active", () => {
    const players = [mkPlayer(1, 5), mkPlayer(2, 5), mkPlayer(3, 9)];
    const res = applyRoundOutcome(players, { kind: "winner", winners: [2, 1], total: 5 });
    expect(res.promotedId).toBe(1);
    expect(res.tieIds.sort()).toEqual([1, 2]);
    expect(res.players.find((p) => p.id === 1)?.isSpectator).toBe(true);
    expect(res.players.find((p) => p.id === 2)?.isSpectator).toBe(false);
    expect(res.players.find((p) => p.id === 2)?.finishingPosition).toBeNull();
  });

  it("tie: no two players ever share the same finishing position", () => {
    const players = [mkPlayer(1, 5), mkPlayer(2, 5), mkPlayer(3, 7), mkPlayer(4, 9)];
    const r1 = applyRoundOutcome(players, { kind: "winner", winners: [1, 2], total: 5 });
    const r2 = applyRoundOutcome(r1.players, { kind: "winner", winners: [2], total: 5 });
    const positions = r2.players.map((p) => p.finishingPosition).filter((x) => x !== null);
    const uniq = new Set(positions);
    expect(uniq.size).toBe(positions.length);
  });
});

describe("isMatchComplete", () => {
  it("false when any player has no finishing position", () => {
    const players = [
      { ...mkPlayer(1, 5), finishingPosition: 1, isSpectator: true },
      mkPlayer(2, 7),
    ];
    expect(isMatchComplete(players)).toBe(false);
  });
  it("true when every player has a finishing position", () => {
    const players = [
      { ...mkPlayer(1, 5), finishingPosition: 1, isSpectator: true },
      { ...mkPlayer(2, 7), finishingPosition: 2, isSpectator: true },
    ];
    expect(isMatchComplete(players)).toBe(true);
  });
});

describe("finalRanking", () => {
  it("sorts players by finishingPosition ascending", () => {
    const players = [
      { ...mkPlayer(1, 5), finishingPosition: 3, isSpectator: true },
      { ...mkPlayer(2, 7), finishingPosition: 1, isSpectator: true },
      { ...mkPlayer(3, 9), finishingPosition: 2, isSpectator: true },
    ];
    const ranked = finalRanking(players);
    expect(ranked.map((p) => p.finishingPosition)).toEqual([1, 2, 3]);
  });

  it("5-player match completes with full ordering 1..5", () => {
    let players = [mkPlayer(1, 5), mkPlayer(2, 7), mkPlayer(3, 9), mkPlayer(4, 11), mkPlayer(5, 13)];
    const winners = [3, 1, 4, 2]; // P3 wins round1, P1 wins r2, P4 wins r3, P2 wins r4 → P5 last
    for (const w of winners) {
      const res = applyRoundOutcome(players, { kind: "winner", winners: [w], total: 0 });
      players = res.players;
    }
    const ranked = finalRanking(players);
    expect(ranked.map((p) => p.finishingPosition)).toEqual([1, 2, 3, 4, 5]);
    expect(isMatchComplete(players)).toBe(true);
  });
});
