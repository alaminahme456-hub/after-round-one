/**
 * Tests for roundTimer.ts — timer math + tension tiers.
 */
import { describe, it, expect } from "vitest";
import { computeTimer, tensionTier } from "@/game/roundTimer";

describe("computeTimer", () => {
  it("returns full duration at start", () => {
    const snap = computeTimer(0, 10000, 0);
    expect(snap.remainingSeconds).toBe(10);
    expect(snap.elapsedMs).toBe(0);
    expect(snap.expired).toBe(false);
    expect(snap.progress).toBe(0);
  });

  it("computes remaining seconds correctly (ceil)", () => {
    // 10s duration, 3.4s elapsed → 6.6s left → ceil = 7
    const snap = computeTimer(0, 10000, 3400);
    expect(snap.remainingSeconds).toBe(7);
    expect(snap.elapsedMs).toBe(3400);
    expect(snap.expired).toBe(false);
  });

  it("expires when now >= start + duration", () => {
    const snap = computeTimer(1000, 5000, 6000);
    expect(snap.expired).toBe(true);
    expect(snap.remainingSeconds).toBe(0);
    expect(snap.progress).toBe(1);
  });

  it("handles 0-duration edge", () => {
    const snap = computeTimer(0, 0, 0);
    expect(snap.expired).toBe(true);
    expect(snap.progress).toBe(1);
  });

  it("never returns negative remaining seconds", () => {
    const snap = computeTimer(0, 1000, 5000);
    expect(snap.remainingSeconds).toBe(0);
  });
});

describe("tensionTier", () => {
  const dur = 10000;
  it("calm at >50% remaining", () => {
    const snap = computeTimer(0, dur, 1000); // 10% elapsed → 90% remaining
    expect(tensionTier(snap)).toBe("calm");
  });
  it("warn at 25-50%", () => {
    const snap = computeTimer(0, dur, 5500); // 55% elapsed → 45% remaining
    expect(tensionTier(snap)).toBe("warn");
  });
  it("urgent at 5-25%", () => {
    const snap = computeTimer(0, dur, 8000); // 80% → 20% remaining
    expect(tensionTier(snap)).toBe("urgent");
  });
  it("final under 5%", () => {
    const snap = computeTimer(0, dur, 9800); // 98% → 2% remaining
    expect(tensionTier(snap)).toBe("final");
  });
});
