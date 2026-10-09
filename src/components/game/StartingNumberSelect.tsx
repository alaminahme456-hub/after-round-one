"use client";

import { useEffect, useState } from "react";
import { useMatchStore } from "@/hooks/game/useMatchStore";
import { sound } from "@/audio/soundManager";
import { startingNumberMax, SKIN_TONE_DEFS } from "@/game/types";
import { Button } from "@/components/ui/button";

export function StartingNumberSelect() {
  const snapshot = useMatchStore((s) => s.snapshot)!;
  const _match = useMatchStore((s) => s._match);
  const setStartingNumber = useMatchStore((s) => s.setStartingNumber);
  const setPlayerSkinTone = useMatchStore((s) => s.setPlayerSkinTone);
  const setReady = useMatchStore((s) => s.setReady);

  const [activePlayer, setActivePlayer] = useState(1);

  const cfg = snapshot.config;
  const max = startingNumberMax(cfg.playerCount);
  const players = snapshot.players;
  const current = players.find((p) => p.id === activePlayer);
  const allPicked = players.every((p) => p.startingNumber !== null);
  const [wantsChange, setWantsChange] = useState(false);
  const showReady = allPicked && !wantsChange;

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
    setWantsChange(false);
    // Auto-advance to next human player who hasn't picked.
    const next = players.find((p) => p.id !== activePlayer && p.startingNumber === null && !p.isAi);
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
          Pick your target sum (Range 1–{max}). Each player must select a unique starting number.
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
                if (!p.isAi) {
                  setActivePlayer(p.id);
                  sound.click();
                }
              }}
              disabled={p.isAi}
              className={`rounded-lg px-3 py-2 text-sm font-bold transition ${
                p.isAi
                  ? "border border-[#3cd2a5]/30 bg-[#3cd2a5]/10 text-white/80 cursor-default"
                  : isActive
                  ? "aro-btn-primary"
                  : "aro-btn-secondary"
              }`}
              style={{ minHeight: 44 }}
            >
              <span className="opacity-70 mr-1">{p.isAi ? "AI" : `P${p.id}`}</span>
              {p.name}
              {p.startingNumber !== null && (
                <span className="ml-2 rounded bg-black/40 px-1.5 py-0.5 text-xs text-[#ffb547]">
                  #{p.startingNumber}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {!showReady ? (
        <>
          <div className="text-center mb-2 text-white/80">
            <span className="text-[#ffb547] font-bold text-base">{current?.name}</span>
            , pick your starting number:
          </div>

          {/* 3D Hand Skin Tone Quick-Select */}
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="text-xs text-white/60 font-medium">
              Hand Skin:{" "}
              <span className="text-white font-semibold">
                {SKIN_TONE_DEFS[current?.skinTone ?? 0]?.name}
              </span>
            </span>
            <div className="flex items-center gap-1.5">
              {SKIN_TONE_DEFS.map((def) => {
                const isSelected = (current?.skinTone ?? 0) === def.id;
                return (
                  <button
                    key={def.id}
                    type="button"
                    onClick={() => {
                      sound.click();
                      setPlayerSkinTone(activePlayer, def.id);
                    }}
                    title={`${def.name} (${def.description})`}
                    className={`w-6 h-6 rounded-full transition-all relative flex items-center justify-center cursor-pointer ${
                      isSelected
                        ? "ring-2 ring-[#ff5a3c] ring-offset-2 ring-offset-[#07090d] scale-110 shadow-md"
                        : "opacity-75 hover:opacity-100 hover:scale-105"
                    }`}
                    style={{ backgroundColor: def.hex }}
                  >
                    {isSelected && (
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          backgroundColor: def.id === 0 ? "#2b1a14" : "#ffffff",
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
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
                const takenBy = players.find(
                  (p) => p.id !== activePlayer && p.startingNumber === n,
                );
                const isTaken = Boolean(takenBy);

                return (
                  <button
                    key={n}
                    onClick={() => {
                      if (!isTaken) pick(n);
                    }}
                    disabled={isTaken}
                    title={
                      isTaken
                        ? `Taken by ${takenBy?.name} (all players must select unique numbers)`
                        : undefined
                    }
                    className={`aro-number-btn relative transition-all ${
                      selected
                        ? "selected ring-2 ring-[#ff5a3c]"
                        : isTaken
                        ? "opacity-35 cursor-not-allowed bg-white/5 border-dashed border-white/20 line-through text-white/40 hover:scale-100"
                        : "hover:scale-105"
                    }`}
                    style={{ minHeight: 56, fontSize: "1.3rem" }}
                  >
                    <span>{n}</span>
                    {isTaken && (
                      <span className="absolute -bottom-1.5 text-[9px] font-black tracking-tight text-[#ffb547] bg-[#07090d]/90 px-1 py-0.5 rounded border border-white/10 no-underline leading-none">
                        {takenBy?.isAi ? "AI" : `P${takenBy?.id}`}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="aro-panel rounded-2xl p-6 max-w-md w-full text-center aro-slide-up">
            <div className="text-2xl font-bold text-white mb-2">Ready to Roll?</div>
            <p className="text-xs text-white/60 mb-4">
              All starting numbers are unique and locked in.
            </p>
            <div className="space-y-2 mb-5">
              {players.map((p) => (
                <div key={p.id} className="flex items-center justify-between bg-white/5 rounded-lg px-4 py-2 border border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{p.name}</span>
                    {p.isAi && (
                      <span className="text-[10px] uppercase font-bold text-[#3cd2a5] bg-[#3cd2a5]/15 px-1.5 py-0.5 rounded">
                        AI
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-[#ffb547] font-bold">
                    Target #{p.startingNumber}
                  </span>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Button
                className="aro-btn-primary w-full"
                onClick={startMatch}
                style={{ minHeight: 56, fontSize: "1.1rem" }}
              >
                ▶ START MATCH
              </Button>
              <button
                type="button"
                onClick={() => {
                  sound.click();
                  setWantsChange(true);
                }}
                className="w-full text-xs text-white/50 hover:text-white/80 py-2 transition"
              >
                ← Change Numbers
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
