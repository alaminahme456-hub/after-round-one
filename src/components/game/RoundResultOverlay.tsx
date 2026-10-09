"use client";

import { useEffect } from "react";
import { useMatchStore } from "@/hooks/game/useMatchStore";
import { Button } from "@/components/ui/button";

/**
 * Overlay shown when a round resolves (DRAW_RESULTS or ROUND_WINNER).
 * Offers the next-step button (Replay or Continue) and shows the calculated total.
 */
export function RoundResultOverlay() {
  const snapshot = useMatchStore((s) => s.snapshot)!;
  const _match = useMatchStore((s) => s._match);

  const isActive = snapshot.state === "DRAW_RESULTS" || snapshot.state === "ROUND_WINNER";
  const outcome = snapshot.lastOutcome;
  const isDraw = outcome?.kind === "draw";

  // Auto-advance after a short delay so the game keeps flowing.
  useEffect(() => {
    if (!isActive || !outcome) return;
    const t = setTimeout(() => {
      if (!_match) return;
      if (isDraw) _match.replayRound();
      else _match.nextRound();
    }, isDraw ? 2500 : 3000);
    return () => clearTimeout(t);
  }, [snapshot.state, snapshot.roundNumber, isActive, isDraw, outcome, _match]);

  if (!isActive || !outcome) return null;

  const handleNext = () => {
    if (!_match) return;
    if (isDraw) {
      _match.replayRound();
    } else {
      _match.nextRound();
    }
  };

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none transition-opacity opacity-100"
    >
      <div className="aro-panel rounded-3xl p-8 sm:p-10 text-center max-w-md w-[90%] aro-slide-up pointer-events-auto">
        {isDraw ? (
          <>
            <div className="text-xs text-white/60 uppercase tracking-[0.4em] mb-2">Round Result</div>
            <div className="text-5xl sm:text-6xl font-black text-[#ffb547] aro-text-glow mb-2">
              DRAW
            </div>
            <div className="text-white/80 mb-4">
              Total was <span className="font-mono font-bold text-2xl text-white">{outcome.total}</span>
              <br />
              No active player's starting number matched.
            </div>
            <div className="text-sm text-white/50">Replaying the round…</div>
          </>
        ) : (
          <>
            <div className="text-xs text-white/60 uppercase tracking-[0.4em] mb-2">Round Winner</div>
            <div className="text-5xl sm:text-6xl font-black text-[#ff5a3c] aro-text-glow mb-2">
              🏆
            </div>
            {outcome.kind === "winner" && (
              <>
                <div className="text-white text-xl mb-2">
                  {outcome.winners
                    .map((id) => snapshot.players.find((p) => p.id === id)?.name ?? `P${id}`)
                    .join(", ")}
                  {outcome.winners.length > 1 ? " are tied!" : " wins the round!"}
                </div>
                <div className="text-white/70 mb-4">
                  Total: <span className="font-mono font-bold text-2xl text-white">{outcome.total}</span>
                </div>
                {outcome.winners.length > 1 && (
                  <div className="text-xs text-white/50 mb-2">
                    Tie resolved: lowest-id player is promoted this round.
                  </div>
                )}
              </>
            )}
            <div className="text-sm text-white/50">Continuing to next round…</div>
          </>
        )}
        <Button
          className="aro-btn-secondary mt-5"
          onClick={handleNext}
          style={{ minHeight: 44 }}
        >
          {isDraw ? "Replay now →" : "Next round →"}
        </Button>
      </div>
    </div>
  );
}
