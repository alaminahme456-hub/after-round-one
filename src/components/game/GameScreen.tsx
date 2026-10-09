"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useMatchStore } from "@/hooks/game/useMatchStore";
import { sound } from "@/audio/soundManager";
import { GameScene } from "@/three/GameScene";
import { computeTimer, tensionTier } from "@/game/roundTimer";
import { keyboard } from "@/controls/keyboardControls";
import { gamepad } from "@/controls/gamepadControls";
import { SUBMISSION_NUMBERS } from "@/game/types";
import { Pause, Play, RotateCcw, Home } from "lucide-react";

/**
 * The 3D arena + HUD. Hosts the Three.js canvas, the countdown timer, the
 * per-player starting-number panel, and the 0–5 submission buttons.
 *
 * Local hot-seat: every active player shares one screen. We use a "current
 * player turn" model where the local player picks their number using the
 * on-screen buttons / keyboard 0-5 / gamepad face buttons. To prevent
 * accidental cross-control, the active player is highlighted and only their
 * submission is accepted at a time.
 */
export function GameScreen() {
  const snapshot = useMatchStore((s) => s.snapshot)!;
  const _match = useMatchStore((s) => s._match);
  const initMatch = useMatchStore((s) => s.initMatch);

  // Keep a ref to the latest match so the timer interval never goes stale.
  const matchRef = useRef(_match);
  useEffect(() => {
    matchRef.current = _match;
  }, [_match]);
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<GameScene | null>(null);
  const [, forceTick] = useState(0);
  const [remaining, setRemaining] = useState(snapshot.config.roundDuration);
  const [tier, setTier] = useState<ReturnType<typeof tensionTier>>("calm");
  const localHumanId = snapshot.players.find((p) => !p.isAi)?.id ?? snapshot.localPlayerId;
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const activePlayerId = snapshot.state === "ROLLING" ? localHumanId : (selectedPlayerId ?? localHumanId);
  const setActivePlayerId = setSelectedPlayerId;
  const lastTickRef = useRef(-1);

  const isPaused = Boolean(snapshot.isPaused);

  const togglePause = useCallback(() => {
    const m = matchRef.current;
    if (!m) return;
    const currentlyPaused = Boolean(m.getSnapshot().isPaused);
    if (!currentlyPaused) {
      sound.pause();
      sound.pauseRoundCountdownAudio();
      m.pause();
      sceneRef.current?.setPaused(true);
    } else {
      sound.resume();
      sound.resumeRoundCountdownAudio();
      m.resume();
      sceneRef.current?.setPaused(false);
    }
  }, []);

  // Initialize Three.js scene once.
  useEffect(() => {
    if (!containerRef.current) return;
    const scene = new GameScene({
      reducedMotion: snapshot.config.reducedMotion,
      quality: snapshot.config.graphicsQuality,
    });
    scene.mount(containerRef.current);
    sceneRef.current = scene;
    scene.setPlayers(snapshot.players, snapshot.localPlayerId);
    if (snapshot.state === "ROLLING") scene.setRolling(true);

    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
    // Empty deps: only mount once.
  }, []);

  // Sync players into the 3D scene whenever the roster changes.
  useEffect(() => {
    sceneRef.current?.setPlayers(snapshot.players, snapshot.localPlayerId);
  }, [snapshot.players, snapshot.localPlayerId]);

  // Rolling state.
  useEffect(() => {
    if (snapshot.state === "ROLLING") {
      sceneRef.current?.setRolling(true);
      sound.rollingLoop();
    } else if (snapshot.state === "NUMBER_SUBMISSION" || snapshot.state === "CALCULATING_RESULT") {
      sceneRef.current?.setRolling(false);
      sceneRef.current?.clearWinnerHighlight();
      sound.timerStop();
    }
  }, [snapshot.state]);

  // Winner highlight.
  useEffect(() => {
    if (snapshot.state === "ROUND_WINNER" && snapshot.lastOutcome?.kind === "winner") {
      const winnerId = snapshot.lastOutcome.winners[0];
      sceneRef.current?.highlightWinner(winnerId);
      sound.roundWinner();
    } else if (snapshot.state === "DRAW_RESULTS") {
      sound.draw();
    }
  }, [snapshot.state, snapshot.lastOutcome]);

  // Single stable interval drives both phases. Reads the latest match via ref.
  useEffect(() => {
    const id = setInterval(() => {
      const m = matchRef.current;
      if (!m) return;
      const snap = m.getSnapshot();
      if (snap.isPaused) return;
      const now = Date.now();
      if (snap.state === "ROLLING" && snap.roundStartTime) {
        const dur = snap.config.roundDuration * 1000;
        const t = computeTimer(snap.roundStartTime, dur, now);
        if (t.remainingSeconds !== lastTickRef.current) {
          lastTickRef.current = t.remainingSeconds;
          setRemaining(t.remainingSeconds);
          setTier(tensionTier(t));
          // The uploaded round audio replaces individual ticking sounds.
        }
        if (t.expired) {
          m.enterSubmissionPhase();
        }
      } else if (snap.state === "NUMBER_SUBMISSION" && snap.submission) {
        const t = computeTimer(snap.submission.openedAt, snap.config.submissionDeadline * 1000, now);
        if (t.remainingSeconds !== lastTickRef.current) {
          lastTickRef.current = t.remainingSeconds;
          setRemaining(t.remainingSeconds);
          setTier(tensionTier(t));
          if (t.remainingSeconds > 0) sound.countdownTick(tensionTier(t));
        }
        if (t.expired) {
          m.resolveRound();
        }
      }
      // Always nudge a re-render so React state stays in sync.
      forceTick((n) => (n + 1) & 0xffff);
    }, 200);
    return () => clearInterval(id);
  }, []);

  // Keyboard shortcut to toggle pause (Escape or Space).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === "Escape" ||
        (e.key === " " &&
          (e.target as HTMLElement)?.tagName !== "BUTTON" &&
          (e.target as HTMLElement)?.tagName !== "INPUT")
      ) {
        e.preventDefault();
        togglePause();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePause]);

  // Autonomous AI player submission logic in single-player / AI matches.
  useEffect(() => {
    if (snapshot.state !== "NUMBER_SUBMISSION" || !snapshot.submission || snapshot.isPaused) {
      return;
    }
    const aiPlayers = snapshot.players.filter(
      (p) => p.isAi && !p.isSpectator && p.connected && !snapshot.submission?.submissions.has(p.id),
    );
    if (aiPlayers.length === 0) return;

    // AI thinks and submits with a human-like reaction delay between 650ms and 1100ms
    const timer = setTimeout(() => {
      const m = matchRef.current;
      if (!m) return;
      const snap = m.getSnapshot();
      if (snap.state !== "NUMBER_SUBMISSION" || !snap.submission || snap.isPaused) return;

      for (const ai of aiPlayers) {
        if (snap.submission.submissions.has(ai.id)) continue;
        const target = ai.startingNumber ?? 5;
        // Tactical number selection: aim for difference from expected opponent submission (~2.5)
        const expectedOpponent = 2.5;
        let ideal = Math.round(target - expectedOpponent + (Math.random() * 1.6 - 0.8));
        ideal = Math.max(0, Math.min(5, ideal));
        const ok = m.submit(ai.id, ideal as 0 | 1 | 2 | 3 | 4 | 5);
        if (ok) {
          const updated = m.getSnapshot();
          if (
            updated.submission &&
            updated.players.every(
              (p) => p.isSpectator || !p.connected || updated.submission!.submissions.has(p.id),
            )
          ) {
            m.resolveRound();
          }
        }
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [snapshot.state, snapshot.submission, snapshot.isPaused, snapshot.players]);

  // Submission handler — accepts number for the currently-active local player.
  const submit = (n: 0 | 1 | 2 | 3 | 4 | 5) => {
    if (!_match) return;
    const snap = _match.getSnapshot();
    if (snap.state !== "NUMBER_SUBMISSION") return;
    const ok = _match.submit(activePlayerId, n);
    if (ok) {
      sound.submit();
      // Auto-advance to next human player who hasn't submitted.
      const updated = _match.getSnapshot();
      const next = updated.players.find(
        (p) => !p.isSpectator && p.connected && !p.isAi && !updated.submission?.submissions.has(p.id),
      );
      if (next) setActivePlayerId(next.id);
      // If everyone (including AI) has submitted, resolve the round immediately.
      if (
        updated.submission &&
        updated.players.every(
          (p) => p.isSpectator || !p.connected || updated.submission!.submissions.has(p.id),
        )
      ) {
        _match.resolveRound();
      }
    }
  };

  // Keyboard + gamepad wiring.
  useEffect(() => {
    keyboard.setCallbacks({
      onNumber: (n) => submit(n),
    });
    keyboard.start();
    gamepad.setCallbacks({
      onNumber: (n) => submit(n),
      onConfirm: () => {
        // Confirm = submit 0 (placeholder for "no choice")
        if (snapshot.state === "NUMBER_SUBMISSION") submit(0);
      },
    });
    gamepad.start();
    return () => {
      keyboard.stop();
      gamepad.stop();
    };
    // eslint not needed: activePlayerId is captured.
  }, [activePlayerId, snapshot.state]);

  const isRolling = snapshot.state === "ROLLING";
  const isSubmitting = snapshot.state === "NUMBER_SUBMISSION";
  const active = snapshot.players.filter((p) => !p.isSpectator && p.connected);
  const current = snapshot.players.find((p) => p.id === activePlayerId);
  const alreadySubmitted =
    snapshot.submission?.submissions.has(activePlayerId) ?? false;

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* 3D canvas */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* Top-center timer */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
        <div
          className={`aro-panel rounded-full px-6 py-2.5 text-center ${
            tier === "urgent" || tier === "final" ? "aro-pulse-urgent" : ""
          }`}
          style={{
            borderColor:
              tier === "final"
                ? "#ff5a3c"
                : tier === "urgent"
                ? "#ffb547"
                : "rgba(255,255,255,0.14)",
          }}
        >
          <div className="text-xs text-white/60 uppercase tracking-widest">
            {isRolling ? "ROLLING" : isSubmitting ? "SUBMIT!" : snapshot.state.replace(/_/g, " ")}
          </div>
          <div
            className="aro-timer font-black leading-none"
            style={{
              fontSize: "clamp(2rem, 7vw, 4rem)",
              color:
                tier === "final"
                  ? "#ff5a3c"
                  : tier === "urgent"
                  ? "#ffb547"
                  : "#fff",
            }}
          >
            {remaining}
          </div>
          <div className="text-[10px] text-white/50">
            Round {snapshot.roundNumber} · {active.length} active
          </div>
        </div>
      </div>

      {/* Round number / state indicator top-left */}
      <div className="absolute top-4 left-4 z-20 aro-panel rounded-lg px-3 py-2 text-xs text-white/70">
        Mode: {snapshot.config.penaltyMode.replace(/_/g, " ")}
        <br />
        Spectators: {snapshot.players.filter((p) => p.isSpectator).length}
      </div>

      {/* Pause button top-right */}
      <div className="absolute top-4 right-4 z-30">
        <button
          onClick={() => togglePause()}
          aria-label={isPaused ? "Resume match" : "Pause match"}
          className="aro-panel flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-white/90 hover:text-white hover:border-[#ff5a3c]/60 transition-all aro-btn-secondary shadow-lg active:scale-95"
        >
          {isPaused ? (
            <>
              <Play className="w-4 h-4 text-[#3cd2a5] fill-[#3cd2a5]" />
              <span>Resume</span>
            </>
          ) : (
            <>
              <Pause className="w-4 h-4 text-[#ffb547]" />
              <span>Pause</span>
            </>
          )}
        </button>
      </div>

      {/* Player panels around the screen edges */}
      <PlayerRoster
        players={snapshot.players}
        activeId={activePlayerId}
        onPick={(id) => setActivePlayerId(id)}
        hideStartingNumbers={snapshot.config.hideStartingNumbers}
        submission={snapshot.submission}
      />

      {/* Submission buttons 0-5 */}
      {isSubmitting && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 w-full max-w-2xl px-4">
          <div className="aro-panel rounded-2xl p-3 sm:p-4 aro-slide-up">
            <div className="text-center mb-2 text-white/80 text-sm">
              {alreadySubmitted ? (
                <span className="text-[#ffb547]">
                  {snapshot.players.some((p) => p.isAi)
                    ? "Submitted! Waiting for AI Computer…"
                    : "Submitted! Waiting for others…"}
                </span>
              ) : (
                <>
                  <span className="font-bold text-white">{current?.name}</span>, pick your number (0–5)
                </>
              )}
            </div>
            <div className="grid grid-cols-6 gap-2">
              {SUBMISSION_NUMBERS.map((n) => (
                <button
                  key={n}
                  onClick={() => submit(n)}
                  disabled={alreadySubmitted}
                  className={`aro-number-btn ${alreadySubmitted ? "opacity-50" : ""}`}
                  style={{ minHeight: 60, fontSize: "1.6rem" }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Pause overlay modal */}
      {isPaused && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="aro-panel rounded-2xl max-w-sm w-full p-6 text-center border border-white/15 shadow-2xl relative">
            <div className="w-14 h-14 rounded-full bg-[#ffb547]/15 border border-[#ffb547]/40 flex items-center justify-center mx-auto mb-3 shadow-inner">
              <Pause className="w-7 h-7 text-[#ffb547]" />
            </div>
            <h2 className="text-2xl font-black tracking-wider text-white mb-1">
              GAME PAUSED
            </h2>
            <p className="text-xs text-white/60 mb-6">
              Round {snapshot.roundNumber} · Timer frozen at {remaining}s
            </p>

            <div className="space-y-2.5">
              <button
                onClick={() => togglePause()}
                className="w-full aro-btn-primary py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                Resume Game
              </button>

              <button
                onClick={() => {
                  sound.click();
                  togglePause();
                  _match?.startRound();
                }}
                className="w-full aro-btn-secondary py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 text-white/80 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restart Round
              </button>

              <button
                onClick={() => {
                  sound.click();
                  _match?.resume();
                  initMatch({ mode: snapshot.config.mode });
                }}
                className="w-full py-2.5 rounded-xl text-xs text-white/50 hover:text-white/80 flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Home className="w-3.5 h-3.5" />
                Quit to Menu
              </button>
            </div>

            <div className="mt-5 text-[11px] text-white/40">
              Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-white/70">Space</kbd> or <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-white/70">Esc</kbd> to resume
            </div>
          </div>
        </div>
      )}

      {/* Subtle vignette for cinematic feel */}
      <div className="pointer-events-none absolute inset-0 z-10"
        style={{ boxShadow: "inset 0 0 120px rgba(0,0,0,0.6)" }}
      />
    </div>
  );
}

interface PlayerRosterProps {
  players: import("@/game/types").PlayerState[];
  activeId: number;
  onPick: (id: number) => void;
  hideStartingNumbers: boolean;
  submission: import("@/game/numberSubmission").SubmissionPhaseState | null;
}

function PlayerRoster({
  players,
  activeId,
  onPick,
  hideStartingNumbers,
  submission,
}: PlayerRosterProps) {
  // Show as horizontal chips at the top during rolling/submission.
  return (
    <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 max-w-md w-full px-4">
      <div className="flex flex-wrap gap-2 justify-center">
        {players.map((p) => {
          const isActive = p.id === activeId;
          const submitted = submission?.submissions.has(p.id) ?? false;
          return (
            <button
              key={p.id}
              onClick={() => {
                if (!p.isAi) onPick(p.id);
              }}
              disabled={p.isSpectator || !p.connected || p.isAi}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition border ${
                p.isSpectator
                  ? "opacity-40 border-white/10 bg-white/5 cursor-not-allowed"
                  : p.isAi
                  ? "border-[#3cd2a5]/30 bg-[#3cd2a5]/10 cursor-default"
                  : isActive
                  ? "aro-btn-primary border-transparent"
                  : submitted
                  ? "bg-[#ffb547]/15 border-[#ffb547]/40"
                  : "aro-btn-secondary"
              }`}
              style={{ minHeight: 32 }}
            >
              <span className="opacity-70">{p.isAi ? "AI" : `P${p.id}`}</span> {p.name}
              {!p.isSpectator && p.startingNumber !== null && !hideStartingNumbers && (
                <span className="ml-1.5 opacity-80">#{p.startingNumber}</span>
              )}
              {p.isSpectator && (
                <span className="ml-1 opacity-70">
                  ·{p.finishingPosition ? `${p.finishingPosition}${ordinal(p.finishingPosition)}` : "spectator"}
                </span>
              )}
              {submitted && (
                <span className="ml-1.5 text-[#3cd2a5]">✓</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ordinal(n: number): string {
  if (n === 1) return "st";
  if (n === 2) return "nd";
  if (n === 3) return "rd";
  return "th";
}
