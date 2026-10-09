/**
 * gameState.ts — the match state machine.
 *
 * Owns the authoritative list of PlayerState and drives FSM transitions.
 *
 * States:
 *   MENU → LOBBY → STARTING_NUMBER_SELECTION → READY_CHECK → ROLLING →
 *   NUMBER_SUBMISSION → CALCULATING_RESULT → DRAW_RESULTS / ROUND_WINNER →
 *   (loop ROLLING..ROUND_WINNER) → FINAL_RESULTS → PENALTY → MATCH_COMPLETE
 *
 * Critical guarantees:
 *   - Only ONE active timer per phase.
 *   - Each round's outcome is computed EXACTLY once.
 *   - Each finishing position is assigned EXACTLY once (via applyRoundOutcome).
 *   - Draws never promote a player.
 *   - Spectators can never submit.
 *   - Late submissions never change a completed result.
 *
 * This module is pure (no DOM, no Three.js, no network). It emits events via
 * a tiny subscribe() pattern; the React layer listens and re-renders.
 */

import type {
  GameMode,
  GameState,
  MatchConfig,
  PlayerState,
  RoundOutcome,
  SkinTone,
  StartingNumber,
  SubmissionNumber,
} from "./types";
import { DEFAULT_MATCH_CONFIG, SKIN_TONES, startingNumberMax } from "./types";
import {
  computeOutcome,
  activePlayers,
} from "./winnerCalculation";
import { applyRoundOutcome, isMatchComplete } from "./multiplayerProgression";
import {
  createSubmissionPhase,
  closePhase,
  submitNumber,
  allActivePlayersSubmitted,
  type SubmissionPhaseState,
} from "./numberSubmission";
import { finalRanking } from "./multiplayerProgression";

export interface MatchSnapshot {
  state: GameState;
  config: MatchConfig;
  players: PlayerState[];
  roundNumber: number;
  /** Outcome of the most recently completed round, or null mid-round. */
  lastOutcome: RoundOutcome | null;
  /** The id of the local player (local mode = currently-acting player). */
  localPlayerId: number;
  /** Server-provided authoritative timestamp at last state change (online). */
  serverTime: number | null;
  /** Submission phase state. */
  submission: SubmissionPhaseState | null;
  /** Round start time (ms epoch). Used by roundTimer. */
  roundStartTime: number | null;
  /** Final rankings (filled at FINAL_RESULTS). */
  rankings: PlayerState[] | null;
  /** Optional info message for the UI. */
  message: string | null;
}

type Listener = (snapshot: MatchSnapshot) => void;

export class Match {
  private snapshot: MatchSnapshot;
  private listeners = new Set<Listener>();

  constructor(config?: Partial<MatchConfig>) {
    this.snapshot = {
      state: "MENU",
      config: { ...DEFAULT_MATCH_CONFIG, ...config },
      players: [],
      roundNumber: 0,
      lastOutcome: null,
      localPlayerId: 1,
      serverTime: null,
      submission: null,
      roundStartTime: null,
      rankings: null,
      message: null,
    };
  }

  /** Subscribe to snapshot changes. Returns an unsubscribe fn. */
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.getSnapshot());
    return () => this.listeners.delete(fn);
  }

  getSnapshot(): MatchSnapshot {
    // Shallow clone players so callers can't mutate internal state.
    return {
      ...this.snapshot,
      players: this.snapshot.players.map((p) => ({ ...p })),
      rankings: this.snapshot.rankings?.map((p) => ({ ...p })) ?? null,
    };
  }

  private commit(next: Partial<MatchSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...next };
    for (const l of this.listeners) l(this.getSnapshot());
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Lobby & player setup
  // ──────────────────────────────────────────────────────────────────────────

  /** Go to lobby and seed the player roster. */
  enterLobby(playerNames: string[], config?: Partial<MatchConfig>): void {
    const cfg = { ...this.snapshot.config, ...config };
    const players: PlayerState[] = playerNames.map((name, i) => ({
      id: i + 1,
      name,
      startingNumber: null,
      submittedNumber: null,
      isSpectator: false,
      finishingPosition: null,
      // Skin tones cycle deterministically across 5 visual variations.
      skinTone: (i % SKIN_TONES.length) as SkinTone,
      connected: true,
      ready: false,
    }));
    this.commit({
      state: "LOBBY",
      config: cfg,
      players,
      roundNumber: 0,
      lastOutcome: null,
      submission: null,
      roundStartTime: null,
      rankings: null,
      message: `${playerNames.length} players joined`,
    });
  }

  setConfig(partial: Partial<MatchConfig>): void {
    this.commit({ config: { ...this.snapshot.config, ...partial } });
  }

  setPlayerName(id: number, name: string): void {
    this.commit({
      players: this.snapshot.players.map((p) =>
        p.id === id ? { ...p, name } : p,
      ),
    });
  }

  /** Transition into starting-number selection. */
  startStartingNumberSelection(): void {
    if (this.snapshot.state !== "LOBBY") return;
    this.commit({ state: "STARTING_NUMBER_SELECTION", message: "Pick your starting number" });
  }

  /** A player picks their starting number. */
  setStartingNumber(playerId: number, n: StartingNumber): boolean {
    if (this.snapshot.state !== "STARTING_NUMBER_SELECTION") return false;
    const max = startingNumberMax(this.snapshot.config.playerCount);
    if (n < 1 || n > max) return false;
    const players = this.snapshot.players.map((p) =>
      p.id === playerId ? { ...p, startingNumber: n } : p,
    );
    this.commit({ players, message: null });
    return true;
  }

  /** Mark a player ready (after starting-number selection). */
  setReady(playerId: number, ready: boolean): void {
    const players = this.snapshot.players.map((p) =>
      p.id === playerId ? { ...p, ready } : p,
    );
    this.commit({ players });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Round flow
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Begin READY_CHECK → ROLLING transition once all active players are ready.
   * Returns true if the round started.
   */
  startRound(now: number = Date.now(), serverTime?: number): boolean {
    const active = activePlayers(this.snapshot.players);
    if (active.length < 2) return false;
    if (this.snapshot.state !== "READY_CHECK" && this.snapshot.state !== "DRAW_RESULTS" && this.snapshot.state !== "ROUND_WINNER") {
      // allow explicit start from READY_CHECK only normally
      if (this.snapshot.state !== "STARTING_NUMBER_SELECTION" && this.snapshot.state !== "LOBBY") {
        return false;
      }
    }
    // Move into READY_CHECK if we just finished starting-number selection.
    if (this.snapshot.state === "STARTING_NUMBER_SELECTION") {
      const allReady = active.every((p) => p.startingNumber !== null && p.ready);
      if (!allReady) {
        this.commit({ state: "READY_CHECK", message: "Waiting for all players to ready up" });
        return false;
      }
    }

    const roundNumber = this.snapshot.roundNumber + 1;
    this.commit({
      state: "ROLLING",
      roundNumber,
      roundStartTime: now,
      submission: null,
      lastOutcome: null,
      message: `Round ${roundNumber} — ROLL!`,
      serverTime: serverTime ?? null,
      players: this.snapshot.players.map((p) => ({ ...p, submittedNumber: null })),
    });
    return true;
  }

  /** Transition from ROLLING to NUMBER_SUBMISSION when the timer expires. */
  enterSubmissionPhase(now: number = Date.now()): void {
    if (this.snapshot.state !== "ROLLING") return;
    const deadline = this.snapshot.config.submissionDeadline;
    const phase = createSubmissionPhase(now, deadline);
    this.commit({
      state: "NUMBER_SUBMISSION",
      submission: phase,
      message: `Pick a number (0-5)! ${deadline}s`,
    });
  }

  /**
   * Active player submits a number. Returns the SubmissionResult.ok flag.
   */
  submit(playerId: number, number: unknown, now: number = Date.now()): boolean {
    if (this.snapshot.state !== "NUMBER_SUBMISSION" || !this.snapshot.submission) {
      return false;
    }
    // Guard against late / phase-closed submissions at the source.
    if (this.snapshot.submission.closed || now >= this.snapshot.submission.closesAt) {
      return false;
    }
    const result = submitNumber(
      this.snapshot.submission,
      this.snapshot.players,
      playerId,
      number,
      now,
    );
    if (!result.result.ok) return false;
    this.commit({ submission: result.phase });
    return true;
  }

  /** Close the submission phase and compute the round outcome. */
  resolveRound(now: number = Date.now()): RoundOutcome {
    if (this.snapshot.state !== "NUMBER_SUBMISSION") {
      // Defensive: if still in ROLLING (e.g. user force-stopped early) still
      // treat as submission phase with zero submissions.
      if (this.snapshot.state === "ROLLING") {
        this.enterSubmissionPhase(now);
      } else {
        return { kind: "draw", total: 0 };
      }
    }
    const submission = this.snapshot.submission
      ? closePhase(this.snapshot.submission)
      : null;
    this.commit({ submission });

    const outcome = computeOutcome(
      this.snapshot.players,
      submission?.submissions ?? new Map(),
      this.snapshot.config.missingSubmissionRule,
    );

    // Apply progression immediately so the snapshot is consistent.
    const progression = applyRoundOutcome(this.snapshot.players, outcome);
    this.commit({
      players: progression.players,
      lastOutcome: outcome,
      state: outcome.kind === "draw" ? "DRAW_RESULTS" : "ROUND_WINNER",
      message:
        outcome.kind === "draw"
          ? `DRAW — total was ${outcome.total}. Replay!`
          : `Round won by player(s) ${outcome.winners.join(", ")} (total ${outcome.total})`,
    });

    // Mark match complete if progression says so.
    if (progression.matchComplete || isMatchComplete(progression.players)) {
      // Match completion is detected via finalRanking / nextRound flow.
      void progression;
    }
    return outcome;
  }

  /** After a DRAW_RESULTS pause, restart the round. */
  replayRound(now: number = Date.now()): void {
    if (this.snapshot.state !== "DRAW_RESULTS") return;
    // Don't increment round number on a draw — we're replaying the same round.
    const roundNumber = this.snapshot.roundNumber; // unchanged
    this.commit({
      state: "ROLLING",
      roundNumber,
      roundStartTime: now,
      submission: null,
      lastOutcome: null,
      message: `Replay round ${roundNumber} — ROLL!`,
      players: this.snapshot.players.map((p) => ({ ...p, submittedNumber: null })),
    });
  }

  /** After ROUND_WINNER, advance to next round (or FINAL_RESULTS). */
  nextRound(now: number = Date.now()): void {
    if (this.snapshot.state !== "ROUND_WINNER") return;
    const active = activePlayers(this.snapshot.players);
    if (active.length <= 1 || isMatchComplete(this.snapshot.players)) {
      this.finishMatch();
      return;
    }
    this.commit({
      state: "ROLLING",
      roundStartTime: now,
      submission: null,
      lastOutcome: null,
      message: `Round ${this.snapshot.roundNumber + 1} — ROLL!`,
      players: this.snapshot.players.map((p) => ({ ...p, submittedNumber: null })),
    });
  }

  /** Finalize rankings and transition to FINAL_RESULTS. */
  finishMatch(): void {
    const rankings = finalRanking(this.snapshot.players);
    this.commit({
      state: "FINAL_RESULTS",
      rankings,
      message: "Match complete — see final standings!",
    });
  }

  /** Move to penalty screen (only relevant for bet / just_for_fun modes). */
  enterPenalty(): void {
    if (this.snapshot.state !== "FINAL_RESULTS") return;
    this.commit({ state: "PENALTY", message: "Penalty time!" });
  }

  /** Mark the match fully complete. */
  completeMatch(): void {
    this.commit({ state: "MATCH_COMPLETE", message: "Thanks for playing!" });
  }

  /** Reset back to menu (preserves config). */
  resetToMenu(): void {
    this.commit({
      state: "MENU",
      players: [],
      roundNumber: 0,
      lastOutcome: null,
      submission: null,
      roundStartTime: null,
      rankings: null,
      message: null,
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Online / disconnect support
  // ──────────────────────────────────────────────────────────────────────────

  setPlayerConnected(playerId: number, connected: boolean): void {
    this.commit({
      players: this.snapshot.players.map((p) =>
        p.id === playerId ? { ...p, connected } : p,
      ),
    });
  }

  /** Set the local player (for hot-seat / online). */
  setLocalPlayer(id: number): void {
    this.commit({ localPlayerId: id });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Reactions for UI
  // ──────────────────────────────────────────────────────────────────────────

  /** Returns the list of active (non-spectator, connected) players. */
  getActivePlayers(): PlayerState[] {
    return activePlayers(this.snapshot.players);
  }

  /** Returns true if every active player has submitted this round. */
  allSubmitted(): boolean {
    if (!this.snapshot.submission) return false;
    return allActivePlayersSubmitted(this.snapshot.submission, this.snapshot.players);
  }
}

// Re-export key bits for convenience.
export { startingNumberMax, DEFAULT_MATCH_CONFIG };
export type { GameMode, SubmissionNumber };
