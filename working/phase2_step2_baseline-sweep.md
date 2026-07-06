# Phase 2 · Sub-step 2.2 — baseline sweep + B0

**Date**: 2026-07-06 · **Status**: PASS → Decision gate 1

## What ran
- `scripts/bench/sweep.mjs` → grid {text-10k, binary-10k} × chunk{100,250,500,800} ×
  drop{0,1%,5%} × fps{10,15,30}, seed 20260706. 72 rows.
- Output: `data/001-baseline/sweep.csv`, `data/001-baseline/b0.json`.

## Result
- **allShaExact = true** (72/72), **deterministic = true** (spot-check re-run identical).
- **B0 = 1350 B/s** (text-10k, cs250, drop0, fps15).
- Slots (fps-invariant): cs100=278, cs250=114, cs500=60, cs800=40. QR ver 8/12/18/23.
- Drop 5% adds only 1–5 retransmit slots at these file sizes.

## Notes
- ACK slots exactly equal DATA-attempt slots on a clean channel (stop-and-wait) → the ~2× that
  blind-fire removes is now explicit in the model.
- cs800 → QR v23 (≤ v40): feasible, informs Phase-3 capacity lever.

**Locked-in**: `B0 = 1350 B/s`; harness + assumptions frozen for apples-to-apples Phase 3/4.

## Report
- `reports/baseline/baseline.md` written (Key Finding / Method / Results / Discussion).
