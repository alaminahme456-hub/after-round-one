"use client";

import { useEffect, useState } from "react";
import { sound } from "@/audio/soundManager";

interface MainMenuProps {
  onPlay: () => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  onLocalMultiplayer: () => void;
  onHowTo: () => void;
  onSettings: () => void;
}

export function MainMenu({
  onPlay,
  onCreateRoom,
  onJoinRoom,
  onLocalMultiplayer,
  onHowTo,
  onSettings,
}: MainMenuProps) {
  const [focusIdx, setFocusIdx] = useState(0);
  const buttons: { label: string; action: () => void; primary?: boolean }[] = [
    { label: "Play", action: onPlay, primary: true },
    { label: "Local Multiplayer", action: onLocalMultiplayer },
    { label: "Create Room", action: onCreateRoom },
    { label: "Join Room", action: onJoinRoom },
    { label: "How to Play", action: onHowTo },
    { label: "Settings", action: onSettings },
  ];

  // Keyboard navigation for the menu.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
        setFocusIdx((i) => (i + 1) % buttons.length);
        sound.click();
      } else if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
        setFocusIdx((i) => (i - 1 + buttons.length) % buttons.length);
        sound.click();
      } else if (e.key === "Enter" || e.key === " ") {
        buttons[focusIdx].action();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [focusIdx, buttons]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10 aro-fade-in">
      <div className="text-center mb-8 sm:mb-12">
        <div className="text-xs sm:text-sm tracking-[0.4em] text-[#ffb547]/80 mb-3 font-semibold">
          3D MULTIPLAYER PARTY GAME
        </div>
        <h1
          className="font-black tracking-tight aro-text-glow text-white"
          style={{ fontSize: "clamp(2.5rem, 9vw, 6.5rem)", lineHeight: 0.95 }}
        >
          AFTER
          <br />
          <span style={{ color: "var(--aro-accent)" }}>ROUND ONE</span>
        </h1>
        <p className="mt-5 max-w-xl text-white/60 text-sm sm:text-base mx-auto">
          Pick a starting number. Roll the hands. Submit 0–5 when the timer stops.
          Match the sum to win the round.
        </p>
      </div>

      <div className="w-full max-w-md flex flex-col gap-3 aro-slide-up">
        {buttons.map((b, i) => (
          <button
            key={b.label}
            onClick={b.action}
            onMouseEnter={() => setFocusIdx(i)}
            className={
              b.primary
                ? `aro-btn-primary rounded-xl px-6 py-4 text-lg sm:text-xl ${focusIdx === i ? "ring-2 ring-white/40" : ""}`
                : `aro-btn-secondary rounded-xl px-6 py-3.5 text-base sm:text-lg ${focusIdx === i ? "ring-2 ring-[#ff5a3c]/60" : ""}`
            }
            style={{ minHeight: 56 }}
          >
            {b.label}
          </button>
        ))}
      </div>

      <div className="mt-10 text-xs text-white/40 text-center max-w-md">
        Use arrow keys + Enter to navigate. Touch on mobile. Gamepad supported.
        <br />
        2–5 players · Local & Online
      </div>
    </div>
  );
}
