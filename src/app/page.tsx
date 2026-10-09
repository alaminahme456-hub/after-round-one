"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useMatchStore } from "@/hooks/game/useMatchStore";
import { sound } from "@/audio/soundManager";
import { MainMenu } from "@/components/game/MainMenu";
import { Lobby } from "@/components/game/Lobby";
import { StartingNumberSelect } from "@/components/game/StartingNumberSelect";
import { GameScreen } from "@/components/game/GameScreen";
import { RoundResultOverlay } from "@/components/game/RoundResultOverlay";
import { FinalResultsScreen } from "@/components/game/FinalResultsScreen";
import { SettingsModal } from "@/components/game/SettingsModal";
import { HowToPlayModal } from "@/components/game/HowToPlayModal";

// GameScreen mounts a WebGL canvas; load it client-side only.
const GameScreenLazy = dynamic(
  () => import("@/components/game/GameScreen").then((m) => m.GameScreen),
  { ssr: false },
);

export default function Home() {
  const snapshot = useMatchStore((s) => s.snapshot);
  const settings = useMatchStore((s) => s.settings);
  const initMatch = useMatchStore((s) => s.initMatch);

  const [showSettings, setShowSettings] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);

  // Initialize a default match on first mount (drives the MENU screen).
  useEffect(() => {
    initMatch({ mode: "local" });
  }, [initMatch]);

  // Sync sound manager settings.
  useEffect(() => {
    sound.soundEnabled = settings.soundEnabled;
    sound.masterVolume = settings.masterVolume;
    sound.musicEnabled = settings.musicEnabled;
  }, [settings]);

  const state = snapshot?.state ?? "MENU";

  // Helpers to actually drive the FSM transitions.
  const goSinglePlayerAi = () => {
    const m = initMatch({ mode: "ai" });
    m.startSinglePlayerAi("You", "AI Computer", { mode: "ai" });
  };
  const goLocalLobby = () => {
    const m = initMatch({ mode: "local" });
    m.enterLobby(["Player 1", "Player 2"], { mode: "local" });
  };
  const goOnlineLobby = () => {
    const m = initMatch({ mode: "online" });
    m.enterLobby(["You"], { mode: "online" });
  };

  return (
    <main className="aro-bg-grid min-h-screen w-full relative overflow-hidden">
      {/* Ambient floating particles / vignette */}
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute -top-32 -left-24 w-96 h-96 rounded-full blur-3xl bg-[#ff5a3c]/10" />
        <div className="absolute -bottom-32 -right-24 w-96 h-96 rounded-full blur-3xl bg-[#ffb547]/10" />
      </div>

      <div className="relative z-10">
        {state === "MENU" && (
          <MainMenu
            onPlay={() => {
              sound.click();
              goSinglePlayerAi();
            }}
            onCreateRoom={() => {
              sound.click();
              goOnlineLobby();
            }}
            onJoinRoom={() => {
              sound.click();
              goOnlineLobby();
            }}
            onLocalMultiplayer={() => {
              sound.click();
              goLocalLobby();
            }}
            onHowTo={() => {
              sound.click();
              setShowHowTo(true);
            }}
            onSettings={() => {
              sound.click();
              setShowSettings(true);
            }}
          />
        )}

        {(state === "LOBBY" || state === "READY_CHECK") && <Lobby />}

        {state === "STARTING_NUMBER_SELECTION" && <StartingNumberSelect />}

        {(state === "ROLLING" ||
          state === "NUMBER_SUBMISSION" ||
          state === "CALCULATING_RESULT" ||
          state === "DRAW_RESULTS" ||
          state === "ROUND_WINNER" ||
          state === "SPECTATOR") && (
          <>
            <GameScreenLazy />
            <RoundResultOverlay />
          </>
        )}

        {(state === "FINAL_RESULTS" || state === "PENALTY" || state === "MATCH_COMPLETE") && (
          <FinalResultsScreen />
        )}
      </div>

      <SettingsModal open={showSettings} onOpenChange={setShowSettings} />
      <HowToPlayModal open={showHowTo} onOpenChange={setShowHowTo} />
    </main>
  );
}
