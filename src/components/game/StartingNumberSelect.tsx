"use client";

import { useEffect, useState } from "react";
import { useMatchStore } from "@/hooks/game/useMatchStore";
import { sound } from "@/audio/soundManager";
import { startingNumberMax } from "@/game/types";
import { Button } from "@/components/ui/button";

export function StartingNumberSelect() {
  const snapshot = useMatchStore((s) => s.snapshot)!;
  const _match = useMatchStore((s) => s._match);
  const setStartingNumber = useMatchStore((s) => s.setStartingNumber);
  const setReady = useMatchStore((s) => s.setReady);

  const [activePlayer, setActivePlayer] = useState(1);

  const cfg = snapshot.config;
  const max = startingNumberMax(cfg.playerCount);
  const players = snapshot.players;
  const current = players.find((p) => p.id === activePlayer);
  const allPicked = players.every((p) => p.startingNumber !== null);
  // Derived — no effect needed.
  const showReady = allPicked;

  // Gamepad / keyboard navigation between players.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Tab" || e.key === "ArrowRight") {
        e.preventDefault();
        setActivePlayer((i) => (i % players.length) + 1);
      } else if (e.key === "ArrowLeft") {
        setActivePlayer((i) => ((i - 2 + players.length) % players.length) + 1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [players.length]);

  const pick = (n: number) => {
    setStartingNumber(activePlayer, n);
    sound.submit();
    // Auto-advance to next player who hasn't picked.
    const next = players.find((p) => p.id !== activePlayer && p.startingNumber === null);
    if (next) setActivePlayer(next.id);
  };

  const startMatch = () => {
    sound.matchStart();
    if (!_match) return;
    // Mark everyone ready (local hot-seat) then start.
    players.forEach((p) => setReady(p.id, true));
    _match.startRound();
  };

  return (
    <div className="min-h-screen flex flex-col px-4 py-5 aro-fade-in">
      <header className="text-center mb-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-white aro-text-glow">
          CHOOSE STARTING NUMBER
        </h1>
        <p className="text-sm text-white/60 mt-1">
          Pick the total you think everyone will submit. Range 1–{max}.
          Multiple players may pick the same number.
        </p>
      </header>

      {/* Player selector tabs (local hot-seat). */}
      <div className="flex justify-center gap-2 mb-5 flex-wrap">
        {players.map((p) => {
          const isActive = p.id === activePlayer;
          return (
            <button
              key={p.id}
              onClick={() => {
                setActivePlayer(p.id);
                sound.click();
              }}
              className={`rounded-lg px-3 py-2 text-sm font-bold transition ${
                isActive ? "aro-btn-primary" : "aro-btn-secondary"
              }`}
              style={{ minHeight: 44 }}
            >
              <span className="opacity-70 mr-1">P{p.id}</span>
              {p.name}
              {p.startingNumber !== null && (
                <span className="ml-2 rounded bg-black/40 px-1.5 py-0.5 text-xs">
                  #{p.startingNumber}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {!showReady ? (
        <>
          <div className="text-center mb-3 text-white/80">
            <span className="text-[#ffb547] font-bold">{current?.name}</span>
            , pick your number:
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div
              className="grid gap-2.5 max-w-2xl w-full"
              style={{
                gridTemplateColumns: `repeat(${max <= 10 ? 5 : 7}, minmax(0, 1fr))`,
              }}
            >
              {Array.from({ length: max }, (_, i) => i + 1).map((n) => {
                const selected = current?.startingNumber === n;
                return (
                  <button
                    key={n}
                    onClick={() => pick(n)}
                    className={`aro-number-btn ${selected ? "selected" : ""}`}
                    style={{ minHeight: 56, fontSize: "1.3rem" }}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="aro-panel rounded-2xl p-6 max-w-md w-full text-center aro-slide-up">
            <div className="text-2xl font-bold text-white mb-2">All players ready?</div>
            <div className="space-y-2 mb-5">
              {players.map((p) => (
                <div key={p.id} className="flex items-center justify-between bg-white/5 rounded-lg px-4 py-2">
                  <span className="font-semibold">{p.name}</span>
                  <span className="font-mono text-[#ffb547] font-bold">
                    Starting #{p.startingNumber}
                  </span>
                </div>
              ))}
            </div>
            <Button
              className="aro-btn-primary w-full"
              onClick={startMatch}
              style={{ minHeight: 56, fontSize: "1.1rem" }}
            >
              ▶ START MATCH
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
