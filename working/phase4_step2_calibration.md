# Phase 4 · Sub-step 4.2 — per-frame calibration + level allocator

**Date**: 2026-07-07 · **Status**: PASS (calibrate 5/5; colorplane 10/10, channelstats 9/9 regressions green)

## What ran
- `app/js/calibrate.js` — strip (26 patches: K/W + 3ch×8-level grid), per-frame LSQ of
  {M̂, b̂} in linear space + σ̂₈; `allocateLevels` picks max-bits allocation with per-plane
  EC assignment (EC-L < 0.9 % SER < EC-M < 1.5 %; 3-seed conservative evaluation).
- Fixes en route (all measured): patch means taken **in linear space** (Jensen bias of
  gamma convexity), **saturation-aware fit** (clamped white patch alone cost ~0.5 pp SER),
  serM margin 1.9 → 1.5 % (scattered-error heuristic is optimistic; G8 straddled 1.9 %).

## Results
- Estimated-model decode ≈ truth: worst-plane SER 0.97 % vs 0.94 % (cost 0.03 pp).
- Drift ±20 %: per-frame tracking cost ≤ 0.06 pp; 4/4/4 holds for gain ≥ 0.95;
  dimming response = EC escalation, then bit derating (gain 0.8 → 5 b, 0.6 → 5 b).
- Allocator: clean σ3 → 9 b (8/8/8!), fallback → **6 b (4/4/4, B-LSB on EC-M)**, noisy → 3 b.

**Locked-in**: strip layout, mean-in-linear + saturation-aware estimator, serL/serM =
0.9 %/1.5 %, allocator = 3-seed max. Fallback-model operating point: 4/4/4, EC LLLLLM.
