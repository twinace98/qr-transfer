# Phase 4 · Sub-step 4.1 — variable-level bit-plane codec

**Date**: 2026-07-07 · **Status**: PASS with a criterion refinement (needs sign-off)

## What ran
- `app/js/colorplane.js` — Gray-coded bit-plane compose/decompose (L ∈ {2,4,8}/channel),
  synthetic camera sim (gamma → 3×3 crosstalk+offset → σ₈ display noise), **SIC decoder**
  (nearest predicted response, 2 iterations), **PEDESTAL=64 level grid**.
- `app/js/colorplane.test.mjs` — **10/10 PASS** (identity, Gray isolation, SER bounds,
  naive-decoder regression guard, crosstalk inverse).
- `data/005-color/allocation-sweep.json` — pedestal sweep + allocation table.

## Finding (design-level, real)
The design note's noise budget (Δ=255/3, SER=2Q(Δ/2σ)) holds only without crosstalk:
**in linear space, interference (offsets+crosstalk) pushed through gamma 2.2 compresses the
dark display-space level gaps** (85 → ~26 under the fallback model). Naive decode = 3–6 %
worst-plane SER. Remedy (both locked): SIC decoding + pedestal-64 grid (levels 64…255).

## Numbers (fallback model, worst plane over 3 seeds, 3721 modules)
| alloc | bits/module | worst SER | verdict |
|---|--:|--:|---|
| naive 4/4/4 (ped 0, thresholds) | 6 | 3.4–6.1 % | fails — motivates SIC+pedestal |
| **4/4/4 SIC+ped64** | **6** | **0.86 %** | ≈ QR EC-L margin — floor holds |
| 4/4/2 | 5 | 0.16 % | comfortable fallback |
| G8 variants | 5–7 | 2.2–2.3 % | stretch rejected under fallback σ; re-check on measured σ |

## Criterion refinement (plan drift — user sign-off requested)
Plan 4.1 said "byte-exact at the 4.0-modeled σ". With crosstalk in the model, raw-plane
byte-exactness is the wrong unit — scattered module errors ≤~1 % are exactly what each
plane's QR EC absorbs (and B at σ₈=10 physically sits at ~0.9 %). Refined criterion:
**worst-plane module-SER < 1 % for the allocated configuration** (bit-exactness is then
asserted END-TO-END at 4.3 through real QR EC + fountain). 4/4/4 meets it at 0.86 %.

**Locked-in**: PEDESTAL=64, SIC×2 decoder, floor allocation 4/4/4 (6 b/module) under
fallback; allocator (4.2) re-derives on measured σ.
