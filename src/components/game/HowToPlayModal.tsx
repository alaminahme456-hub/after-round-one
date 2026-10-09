"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function HowToPlayModal({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="aro-panel text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-3xl aro-text-glow">How to Play</DialogTitle>
          <DialogDescription className="text-white/60">
            AFTER ROUND ONE — the rules.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4 text-white/90 leading-relaxed">
          <section>
            <h3 className="text-lg font-bold text-[#ffb547] mb-1">Goal</h3>
            <p>
              Be the first to win a round and earn the best finishing position.
              The last player left without a position takes last place.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-[#ffb547] mb-1">1. Pick a starting number</h3>
            <p>
              Before the match, each player picks a starting number (1–10 for 2 players,
              1–25 for 3–5 players). Multiple players may pick the same number.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-[#ffb547] mb-1">2. Roll the hands</h3>
            <p>
              When the round starts, every active player&apos;s hands roll rapidly left-to-right
              while the countdown runs. The hands stop the instant the timer hits zero.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-[#ffb547] mb-1">3. Submit a number (0–5)</h3>
            <p>
              When the timer stops, every active player picks a number from <strong>0, 1, 2, 3, 4, 5</strong>.
              Multiple players may pick the same number. You don&apos;t have to match your starting number.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-[#ffb547] mb-1">4. Total & winner</h3>
            <p>
              The game sums every active player&apos;s submission. If the total equals an active
              player&apos;s starting number, that player wins the round. If no one matches, it&apos;s a DRAW
              and the round replays.
            </p>
            <div className="bg-black/30 rounded-lg p-3 mt-2 text-sm font-mono">
              Example: A starts 5, B starts 7. A submits 0, B submits 5. Total = 5 → A wins.
            </div>
          </section>

          <section>
            <h3 className="text-lg font-bold text-[#ffb547] mb-1">5. Finishing order</h3>
            <p>
              Each round winner earns the next finishing position (1st, 2nd, …) and becomes a
              spectator. The last active player remaining takes the final position.
              Spectators never contribute to the total.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-[#ffb547] mb-1">Match modes</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Elimination:</strong> race for the best finishing order.</li>
              <li><strong>Just For Fun:</strong> agree on harmless penalties for the loser before starting.</li>
              <li><strong>Bet Mode:</strong> record agreed wager terms (no real money is transferred).</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-bold text-[#ffb547] mb-1">Missing submissions</h3>
            <p>
              If the submission deadline expires before you pick, the configured rule applies
              (default: treat as 0). Configure this in the lobby.
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
