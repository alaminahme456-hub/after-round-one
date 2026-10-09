"use client";

import { useEffect, useState } from "react";
import { useMatchStore } from "@/hooks/game/useMatchStore";
import { sound } from "@/audio/soundManager";
import { assignPenalties } from "@/game/penaltyRules";
import { Button } from "@/components/ui/button";

const MEDAL = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];

export function FinalResultsScreen() {
  const snapshot = useMatchStore((s) => s.snapshot)!;
  const _match = useMatchStore((s) => s._match);

  const rankings = snapshot.rankings ?? snapshot.players;
  const penaltyAssignments = assignPenalties(snapshot.players, snapshot.config);
  const [penaltyAccepted, setPenaltyAccepted] = useState<Record<number, "accept" | "skip" | "completed">>({});

  useEffect(() => {
    sound.finalWinner();
  }, []);

  const playAgain = () => {
    sound.click();
    if (!_match) return;
    // Reset to lobby keeping the same players + config.
    _match.enterLobby(
      snapshot.players.map((p) => p.name),
      snapshot.config,
    );
    _match.startStartingNumberSelection();
  };

  const backToMenu = () => {
    sound.click();
    _match?.resetToMenu();
  };

  const enterPenalty = () => {
    sound.penaltySelect();
    _match?.enterPenalty();
  };

  const completeMatch = () => {
    sound.click();
    _match?.completeMatch();
  };

  const isPenaltyMode =
    snapshot.config.penaltyMode === "bet" || snapshot.config.penaltyMode === "just_for_fun";
  const showPenaltyScreen = snapshot.state === "PENALTY";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 aro-fade-in">
      <div className="aro-panel rounded-3xl p-6 sm:p-10 max-w-2xl w-full">
        <div className="text-center mb-6">
          <div className="text-xs text-white/60 uppercase tracking-[0.4em] mb-2">
            Match Complete
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white aro-text-glow">
            FINAL STANDINGS
          </h1>
        </div>

        <div className="space-y-2 mb-6">
          {rankings.map((p, i) => {
            const assignment = penaltyAssignments.find((a) => a.playerId === p.id);
            return (
              <div
                key={p.id}
                className={`flex items-center gap-3 rounded-xl p-3 transition ${
                  i === 0
                    ? "bg-gradient-to-r from-[#ff5a3c]/25 to-transparent border border-[#ff5a3c]/40"
                    : "bg-white/5 border border-white/10"
                }`}
              >
                <div className="text-3xl">{MEDAL[i] ?? "•"}</div>
                <div className="flex-1">
                  <div className="font-bold text-white">{p.name}</div>
                  <div className="text-xs text-white/60">
                    Starting #{p.startingNumber} · {p.isSpectator ? "spectator" : "active"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-white/40 uppercase">Place</div>
                  <div className="text-xl font-bold text-[#ffb547]">
                    {p.finishingPosition}
                    {ordinal(p.finishingPosition ?? 0)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {!showPenaltyScreen && isPenaltyMode && (
          <Button
            className="aro-btn-secondary w-full mb-3"
            onClick={enterPenalty}
            style={{ minHeight: 44 }}
          >
            View Penalty / Wager →
          </Button>
        )}

        {showPenaltyScreen && (
          <div className="bg-white/5 rounded-2xl p-4 mb-4 aro-slide-up">
            <h3 className="text-lg font-bold mb-3 text-[#ffb547]">
              {snapshot.config.penaltyMode === "bet" ? "Wager Terms" : "Penalty Time"}
            </h3>
            {penaltyAssignments.map((a) => (
              <div key={a.playerId} className="mb-3 last:mb-0">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="font-semibold text-white">
                    {a.playerName}
                    {a.role === "loser" && <span className="text-[#ff5a3c]"> (loser)</span>}
                    {a.role === "winner" && <span className="text-[#3cd2a5]"> (winner)</span>}
                  </span>
                  {a.finishingPosition && (
                    <span className="text-xs text-white/40">
                      {a.finishingPosition}
                      {ordinal(a.finishingPosition)} place
                    </span>
                  )}
                </div>
                {a.penaltyText ? (
                  <div className="bg-black/30 rounded-lg p-2 text-sm text-white/90">
                    {a.penaltyText}
                  </div>
                ) : (
                  <div className="text-xs text-white/40 italic">No penalty assigned.</div>
                )}
                {a.role === "loser" && a.penaltyText && (
                  <div className="flex gap-2 mt-2">
                    <Button
                      size="sm"
                      className="aro-btn-primary"
                      onClick={() => {
                        setPenaltyAccepted((s) => ({ ...s, [a.playerId]: "accept" }));
                        sound.click();
                      }}
                    >
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-white/5 border-white/10"
                      onClick={() => {
                        setPenaltyAccepted((s) => ({ ...s, [a.playerId]: "completed" }));
                        sound.click();
                      }}
                    >
                      Mark completed
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-white/5 border-white/10"
                      onClick={() => {
                        setPenaltyAccepted((s) => ({ ...s, [a.playerId]: "skip" }));
                        sound.click();
                      }}
                    >
                      Skip
                    </Button>
                  </div>
                )}
                {penaltyAccepted[a.playerId] && (
                  <div className="text-xs text-[#3cd2a5] mt-1">
                    ✓ {penaltyAccepted[a.playerId].replace("_", " ")}
                  </div>
                )}
              </div>
            ))}
            <Button
              className="aro-btn-secondary w-full mt-2"
              onClick={completeMatch}
              style={{ minHeight: 44 }}
            >
              Finish
            </Button>
          </div>
        )}

        <div className="flex gap-3">
          <Button
            className="aro-btn-primary flex-1"
            onClick={playAgain}
            style={{ minHeight: 56, fontSize: "1.05rem" }}
          >
            ▶ Play Again
          </Button>
          <Button
            className="aro-btn-secondary"
            onClick={backToMenu}
            style={{ minHeight: 56 }}
          >
            Main Menu
          </Button>
        </div>
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
