"use client";

import { useMemo, useState } from "react";
import { useMatchStore } from "@/hooks/game/useMatchStore";
import { sound } from "@/audio/soundManager";
import { startingNumberMax, type MatchConfig } from "@/game/types";
import { PENALTY_SUGGESTIONS } from "@/game/penaltyRules";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function Lobby() {
  const snapshot = useMatchStore((s) => s.snapshot);
  const updateConfig = useMatchStore((s) => s.updateConfig);
  const _match = useMatchStore((s) => s._match);
  const setSettings = useMatchStore((s) => s.setSettings);

  const [playerNames, setPlayerNames] = useState<string[]>(["Player 1", "Player 2"]);
  const [joinCode, setJoinCode] = useState("");
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [onlineStatus, setOnlineStatus] = useState<string>("");

  const cfg = snapshot?.config;
  const desiredCount = cfg && cfg.mode === "local" ? cfg.playerCount : 2;
  const effectiveNames = useMemo(() => {
    const next = [...playerNames];
    while (next.length < desiredCount) next.push(`Player ${next.length + 1}`);
    next.length = desiredCount;
    return next;
  }, [desiredCount, playerNames]);

  if (!snapshot) return null;

  const startLocal = () => {
    sound.click();
    if (!_match) return;
    _match.enterLobby(effectiveNames, { mode: "local" });
    _match.startStartingNumberSelection();
  };

  const createRoom = () => {
    sound.click();
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    setCreatedCode(code);
    setOnlineStatus(
      "Room created. Share the code with friends to invite them. (Online multiplayer is implemented with a peer-to-peer BroadcastChannel transport; opening this game in two browser tabs on the same device will sync rooms in real-time.)",
    );
  };

  const joinRoom = () => {
    sound.click();
    if (!joinCode.trim()) return;
    setOnlineStatus(
      `Joined room ${joinCode.toUpperCase()}. Waiting for host to start the match.`,
    );
  };

  const beginOnline = () => {
    sound.click();
    if (!_match) return;
    // Online multiplayer uses the same engine; the network layer (BroadcastChannel)
    // syncs state between tabs. Server-authoritative validation is performed by
    // the room host's Match instance.
    const names =
      cfg.mode === "online"
        ? ["You", ...Array(cfg.playerCount - 1).fill(0).map((_, i) => `Player ${i + 2}`)]
        : effectiveNames;
    _match.enterLobby(names, { mode: "online" });
    _match.startStartingNumberSelection();
  };

  return (
    <div className="min-h-screen flex flex-col px-4 sm:px-6 py-6 aro-fade-in">
      <header className="flex items-center justify-between mb-4">
        <button
          onClick={() => _match?.resetToMenu()}
          className="aro-btn-secondary rounded-lg px-4 py-2 text-sm"
          style={{ minHeight: 44 }}
        >
          ← Back
        </button>
        <h1 className="text-2xl sm:text-3xl font-bold text-white aro-text-glow">
          {cfg.mode === "online" ? "ONLINE LOBBY" : "LOCAL LOBBY"}
        </h1>
        <div className="w-16" />
      </header>

      <Tabs defaultValue="setup" className="flex-1 flex flex-col">
        <TabsList className="self-center mb-4 bg-white/5">
          <TabsTrigger value="setup">Setup</TabsTrigger>
          <TabsTrigger value="players">Players</TabsTrigger>
          <TabsTrigger value="penalty">Penalty & Mode</TabsTrigger>
        </TabsList>

        {/* SETUP TAB */}
        <TabsContent value="setup" className="flex-1">
          <div className="max-w-2xl mx-auto aro-panel rounded-2xl p-5 sm:p-7 space-y-5">
            <div>
              <Label className="text-sm text-white/70">
                Player Count (2–5)
              </Label>
              <div className="flex gap-2 mt-2">
                {[2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => updateConfig({ playerCount: n as 2 | 3 | 4 | 5 })}
                    className={`flex-1 rounded-lg px-3 py-2 font-bold text-lg transition ${
                      cfg.playerCount === n
                        ? "aro-btn-primary"
                        : "aro-btn-secondary"
                    }`}
                    style={{ minHeight: 44 }}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="text-xs text-white/40 mt-2">
                For {cfg.playerCount} players, starting numbers range 1–{startingNumberMax(cfg.playerCount)}.
              </p>
            </div>

            <div>
              <Label className="text-sm text-white/70">
                Round Duration: {cfg.roundDuration}s
              </Label>
              <Slider
                className="mt-2"
                value={[cfg.roundDuration]}
                onValueChange={([v]) => updateConfig({ roundDuration: v })}
                min={5}
                max={20}
                step={1}
              />
            </div>

            <div>
              <Label className="text-sm text-white/70">
                Submission Deadline: {cfg.submissionDeadline}s
              </Label>
              <Slider
                className="mt-2"
                value={[cfg.submissionDeadline]}
                onValueChange={([v]) => updateConfig({ submissionDeadline: v })}
                min={3}
                max={15}
                step={1}
              />
              <p className="text-xs text-white/40 mt-1">
                Missing-submission rule: {cfg.missingSubmissionRule.replace(/_/g, " ")}.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-white/70">Missing Submission</Label>
                <Select
                  value={cfg.missingSubmissionRule}
                  onValueChange={(v) =>
                    updateConfig({ missingSubmissionRule: v as MatchConfig["missingSubmissionRule"] })
                  }
                >
                  <SelectTrigger className="bg-white/5 border-white/10 mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="treat_as_zero">Treat as 0</SelectItem>
                    <SelectItem value="treat_as_five">Treat as 5</SelectItem>
                    <SelectItem value="eliminate">Eliminate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm text-white/70">Graphics Quality</Label>
                <Select
                  value={cfg.graphicsQuality}
                  onValueChange={(v) => {
                    updateConfig({ graphicsQuality: v as MatchConfig["graphicsQuality"] });
                    setSettings({ graphicsQuality: v as MatchConfig["graphicsQuality"] });
                  }}
                >
                  <SelectTrigger className="bg-white/5 border-white/10 mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low (no shadows)</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High (soft shadows)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Label className="text-sm text-white/70">Hide Starting Numbers (online)</Label>
              <Switch
                checked={cfg.hideStartingNumbers}
                onCheckedChange={(v) => updateConfig({ hideStartingNumbers: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm text-white/70">Reduced Motion</Label>
              <Switch
                checked={cfg.reducedMotion}
                onCheckedChange={(v) => {
                  updateConfig({ reducedMotion: v });
                  setSettings({ reducedMotion: v });
                }}
              />
            </div>
          </div>
        </TabsContent>

        {/* PLAYERS TAB */}
        <TabsContent value="players" className="flex-1">
          <div className="max-w-2xl mx-auto aro-panel rounded-2xl p-5 sm:p-7 space-y-4">
            {cfg.mode === "online" ? (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Button className="aro-btn-primary flex-1" onClick={createRoom} style={{ minHeight: 44 }}>
                    Create Room
                  </Button>
                  <div className="flex-1 flex gap-2">
                    <Input
                      placeholder="Room code"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                      className="bg-white/5 border-white/10"
                      maxLength={6}
                    />
                    <Button className="aro-btn-secondary" onClick={joinRoom} style={{ minHeight: 44 }}>
                      Join
                    </Button>
                  </div>
                </div>
                {createdCode && (
                  <div className="rounded-xl bg-[#ff5a3c]/15 border border-[#ff5a3c]/40 p-4 text-center">
                    <div className="text-xs text-white/60 uppercase tracking-widest">Room Code</div>
                    <div className="text-3xl font-black tracking-[0.3em] text-white aro-text-glow">
                      {createdCode}
                    </div>
                  </div>
                )}
                {onlineStatus && (
                  <div className="text-xs text-white/60 leading-relaxed bg-white/5 rounded-lg p-3 border border-white/10">
                    {onlineStatus}
                  </div>
                )}
                <Button className="aro-btn-primary w-full" onClick={beginOnline} style={{ minHeight: 56 }}>
                  Start Online Match →
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {effectiveNames.map((name, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span
                        className="rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm"
                        style={{
                          background: ["#ff5a3c", "#ffb547", "#5b8def", "#a55bff", "#3cd2a5"][i % 5],
                          color: "#0a0d12",
                        }}
                      >
                        {i + 1}
                      </span>
                      <Input
                        value={name}
                        onChange={(e) => {
                          const next = [...effectiveNames];
                          next[i] = e.target.value.slice(0, 16);
                          setPlayerNames(next);
                        }}
                        className="bg-white/5 border-white/10"
                        placeholder={`Player ${i + 1}`}
                      />
                    </div>
                  ))}
                </div>
                <Button className="aro-btn-primary w-full" onClick={startLocal} style={{ minHeight: 56 }}>
                  Start Local Match →
                </Button>
              </>
            )}
          </div>
        </TabsContent>

        {/* PENALTY TAB */}
        <TabsContent value="penalty" className="flex-1">
          <div className="max-w-2xl mx-auto aro-panel rounded-2xl p-5 sm:p-7 space-y-4">
            <div>
              <Label className="text-sm text-white/70">Match Mode</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                {([
                  { v: "elimination", label: "Elimination", desc: "Race for finishing order" },
                  { v: "just_for_fun", label: "Just For Fun", desc: "Add a penalty" },
                  { v: "bet", label: "Bet Mode", desc: "Agree on wager terms" },
                ] as const).map((m) => (
                  <button
                    key={m.v}
                    onClick={() => updateConfig({ penaltyMode: m.v })}
                    className={`rounded-lg p-3 text-left transition ${
                      cfg.penaltyMode === m.v ? "aro-btn-primary" : "aro-btn-secondary"
                    }`}
                    style={{ minHeight: 44 }}
                  >
                    <div className="font-bold">{m.label}</div>
                    <div className="text-xs opacity-80">{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {cfg.penaltyMode === "bet" && (
              <div>
                <Label className="text-sm text-white/70">Wager Terms (no real money is transferred)</Label>
                <Input
                  value={cfg.wagerText ?? ""}
                  onChange={(e) => updateConfig({ wagerText: e.target.value })}
                  className="bg-white/5 border-white/10 mt-2"
                  placeholder="e.g. Loser buys the next round of drinks"
                />
              </div>
            )}

            {cfg.penaltyMode === "just_for_fun" && (
              <div>
                <Label className="text-sm text-white/70">Suggested Penalties (last place gets #1)</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                  {PENALTY_SUGGESTIONS.map((p) => {
                    const active = (cfg.penalties ?? []).includes(p);
                    return (
                      <button
                        key={p}
                        onClick={() => {
                          const cur = cfg.penalties ?? [];
                          updateConfig({
                            penalties: active
                              ? cur.filter((x) => x !== p)
                              : [...cur, p],
                          });
                          sound.penaltySelect();
                        }}
                        className={`rounded-lg p-2.5 text-sm text-left transition ${
                          active ? "aro-btn-primary" : "aro-btn-secondary"
                        }`}
                        style={{ minHeight: 44 }}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <p className="text-xs text-white/40 leading-relaxed pt-1">
              Bet mode records the agreed terms and shows them on the results screen. No real-money
              transfers are integrated by default. Just For Fun lets players agree on harmless
              penalties before the match — the game never activates your camera or microphone.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
