"use client";

import { useMatchStore } from "@/hooks/game/useMatchStore";
import { sound } from "@/audio/soundManager";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function SettingsModal({ open, onOpenChange }: Props) {
  const settings = useMatchStore((s) => s.settings);
  const setSettings = useMatchStore((s) => s.setSettings);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="aro-panel text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl">Settings</DialogTitle>
          <DialogDescription className="text-white/60">
            Adjust audio, accessibility, and graphics.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-4">
          <div className="flex items-center justify-between">
            <Label>Sound Effects</Label>
            <Switch
              checked={settings.soundEnabled}
              onCheckedChange={(v) => {
                setSettings({ soundEnabled: v });
                sound.soundEnabled = v;
                if (v) sound.click();
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>Background Music</Label>
            <Switch
              checked={settings.musicEnabled}
              onCheckedChange={(v) => setSettings({ musicEnabled: v })}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Master Volume</Label>
              <span className="text-sm text-white/60 font-mono">
                {Math.round(settings.masterVolume * 100)}%
              </span>
            </div>
            <Slider
              value={[settings.masterVolume]}
              onValueChange={([v]) => {
                setSettings({ masterVolume: v });
                sound.masterVolume = v;
              }}
              min={0}
              max={1}
              step={0.05}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Reduced Motion</Label>
              <p className="text-xs text-white/50">
                Lower animation amplitude for accessibility.
              </p>
            </div>
            <Switch
              checked={settings.reducedMotion}
              onCheckedChange={(v) => setSettings({ reducedMotion: v })}
            />
          </div>

          <div>
            <Label className="block mb-2">Graphics Quality</Label>
            <div className="grid grid-cols-3 gap-2">
              {(["low", "medium", "high"] as const).map((q) => (
                <button
                  key={q}
                  onClick={() => setSettings({ graphicsQuality: q })}
                  className={`rounded-lg px-3 py-2 text-sm font-bold capitalize ${
                    settings.graphicsQuality === q ? "aro-btn-primary" : "aro-btn-secondary"
                  }`}
                  style={{ minHeight: 44 }}
                >
                  {q}
                </button>
              ))}
            </div>
            <p className="text-xs text-white/50 mt-2">
              Low disables shadows + post-processing for slower devices.
            </p>
          </div>

          <div className="bg-white/5 rounded-lg p-3 text-xs text-white/70">
            <div className="font-bold mb-1">Controls</div>
            <ul className="space-y-1">
              <li>· Keyboard: arrows / WASD to navigate, Enter/Space to confirm, 0–5 to submit</li>
              <li>· Touch: tap any button</li>
              <li>· Gamepad: D-pad / left-stick to navigate, A=confirm, B=cancel, face buttons=0–5</li>
              <li>· Color is never the only player identifier — names + numbers always shown</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
