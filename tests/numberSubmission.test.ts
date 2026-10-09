/**
 * Tests for numberSubmission.ts — submission phase validation.
 */
import { describe, it, expect } from "vitest";
import {
  createSubmissionPhase,
  submitNumber,
  closePhase,
  allActivePlayersSubmitted,
  shouldAutoClose,
  SUBMISSION_NUMBERS,
} from "@/game/numberSubmission";
import type { PlayerState } from "@/game/types";

function mkPlayer(id: number, spectator = false, connected = true): PlayerState {
  return {
    id,
    name: `P${id}`,
    startingNumber: 5,
    submittedNumber: null,
    isSpectator: spectator,
    finishingPosition: null,
    skinTone: (id - 1) as 0,
    connected,
    ready: true,
  };
}

describe("SUBMISSION_NUMBERS", () => {
  it("always exposes 0..5", () => {
    expect([...SUBMISSION_NUMBERS]).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe("submitNumber", () => {
  it("accepts a valid submission for an active player", () => {
    const phase = createSubmissionPhase(1000, 5);
    const players = [mkPlayer(1), mkPlayer(2)];
    const { result, phase: next } = submitNumber(phase, players, 1, 3, 1500);
    expect(result.ok).toBe(true);
    expect(next.submissions.get(1)).toBe(3);
  });

  it("rejects spectators", () => {
    const phase = createSubmissionPhase(1000, 5);
    const players = [mkPlayer(1, true), mkPlayer(2)];
    const { result } = submitNumber(phase, players, 1, 3, 1500);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("spectator");
  });

  it("rejects disconnected players", () => {
    const phase = createSubmissionPhase(1000, 5);
    const players = [mkPlayer(1, false, false), mkPlayer(2)];
    const { result } = submitNumber(phase, players, 1, 3, 1500);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("disconnected");
  });

  it("rejects invalid numbers", () => {
    const phase = createSubmissionPhase(1000, 5);
    const players = [mkPlayer(1), mkPlayer(2)];
    expect(submitNumber(phase, players, 1, 6, 1500).result.ok).toBe(false);
    expect(submitNumber(phase, players, 1, -1, 1500).result.ok).toBe(false);
    expect(submitNumber(phase, players, 1, 2.5, 1500).result.ok).toBe(false);
  });

  it("rejects double submission (already_submitted)", () => {
    const phase = createSubmissionPhase(1000, 5);
    const players = [mkPlayer(1), mkPlayer(2)];
    const r1 = submitNumber(phase, players, 1, 3, 1500);
    expect(r1.result.ok).toBe(true);
    const r2 = submitNumber(r1.phase, players, 1, 4, 1600);
    expect(r2.result.ok).toBe(false);
    if (!r2.result.ok) expect(r2.result.reason).toBe("already_submitted");
  });

  it("rejects late submissions (phase_closed)", () => {
    const phase = createSubmissionPhase(1000, 5); // closes at 6000
    const players = [mkPlayer(1), mkPlayer(2)];
    const r = submitNumber(phase, players, 1, 3, 7000);
    expect(r.result.ok).toBe(false);
    if (!r.result.ok) expect(r.result.reason).toBe("phase_closed");
  });

  it("allows duplicate numbers across players", () => {
    const phase = createSubmissionPhase(1000, 5);
    const players = [mkPlayer(1), mkPlayer(2)];
    const r1 = submitNumber(phase, players, 1, 4, 1500);
    const r2 = submitNumber(r1.phase, players, 2, 4, 1600);
    expect(r1.result.ok).toBe(true);
    expect(r2.result.ok).toBe(true);
    expect(r2.phase.submissions.get(1)).toBe(4);
    expect(r2.phase.submissions.get(2)).toBe(4);
  });

  it("allows submission != starting number", () => {
    const phase = createSubmissionPhase(1000, 5);
    const players = [{ ...mkPlayer(1), startingNumber: 5 }];
    const r = submitNumber(phase, players, 1, 0, 1500);
    expect(r.result.ok).toBe(true);
  });
});

describe("closePhase", () => {
  it("marks phase closed; subsequent submissions rejected", () => {
    const phase = createSubmissionPhase(1000, 5);
    const players = [mkPlayer(1), mkPlayer(2)];
    const closed = closePhase(phase);
    expect(closed.closed).toBe(true);
    const r = submitNumber(closed, players, 1, 3, 1500);
    expect(r.result.ok).toBe(false);
    if (!r.result.ok) expect(r.result.reason).toBe("phase_closed");
  });
});

describe("allActivePlayersSubmitted / shouldAutoClose", () => {
  it("false when some active players haven't submitted", () => {
    const phase = createSubmissionPhase(1000, 5);
    const players = [mkPlayer(1), mkPlayer(2)];
    const next = submitNumber(phase, players, 1, 3, 1500).phase;
    expect(allActivePlayersSubmitted(next, players)).toBe(false);
    expect(shouldAutoClose(next, players)).toBe(false);
  });

  it("true when every active player has submitted", () => {
    const phase = createSubmissionPhase(1000, 5);
    const players = [mkPlayer(1), mkPlayer(2)];
    const p1 = submitNumber(phase, players, 1, 3, 1500).phase;
    const p2 = submitNumber(p1, players, 2, 4, 1600).phase;
    expect(allActivePlayersSubmitted(p2, players)).toBe(true);
    expect(shouldAutoClose(p2, players)).toBe(true);
  });

  it("ignores spectators when checking completion", () => {
    const phase = createSubmissionPhase(1000, 5);
    const players = [mkPlayer(1), mkPlayer(2, true)]; // P2 spectator
    const p1 = submitNumber(phase, players, 1, 3, 1500).phase;
    expect(allActivePlayersSubmitted(p1, players)).toBe(true);
  });
});
