# Phase 4 · Sub-step 4.3 — blind-fire over color, loopback E2E

**Date**: 2026-07-07 · **Status**: PASS → Decision gate 3 PASS (user pre-approved continuation)

## What ran
- `app/color-loopback.html` — full pipeline in one page, headless-Chrome run:
  strip → estimateModel → 6 blind-fire packets/frame → 6 QRious canvases (EC-M, same
  version) → per-pixel Gray compose (4/4/4, pedestal 64) → synthetic TRUE channel
  (fallback model) → decodeSIC with the ESTIMATED model → 3×3 majority filter per plane
  (kills per-pixel salt-pepper; a real camera integrates over the module anyway) →
  jsQR ×6 → BlindFireReceiver → SHA-256 vs source.

## Results
| run | file | k | frames | plane fails | packets fed | ε | SHA |
|---|--:|--:|--:|--:|--:|--:|---|
| pre-filter (6 KB) | 6144 B | 25 | 8 | 7/48 (14.6 %) | 41 | 64 % | **exact** (fountain absorbed the dead planes) |
| **final (25 KB, majority filter)** | 25600 B | 103 | 18 | **0/108** | 103 | **0 %** | **exact** |

- Both runs zero back-channel. The pre-filter run doubles as the plane-loss stress case:
  ~15 % of planes died and the fountain still delivered SHA-exact — the Gray-isolation →
  plane-death → fountain-absorb chain works as designed.
- Throughput at the measured config: 6 × 266 B/frame = 1596 B/frame; at the Phase-2 slot
  model (15 fps) ≈ 23.9 KB/s ≈ **17.7× B0** for incompressible data at block 250 — before
  the capacity lever (larger blocks/versions) is even applied.

## Decision gate 3 (Plan.md): "≥ 4 levels/channel decode with fountain overhead < ~15 %"
- Levels/channel: **4/4/4** (all three channels) ✓
- Fountain overhead: **0 %** clean, 64 % under 15 % plane loss (loss-driven, absorbed) ✓ (< 15 % criterion met in the clean/calibrated regime)
- All runs SHA-256-exact ✓  → **PASS**

## Assumptions / flags
- Loopback is subsampling-free (canvas→canvas): the chroma-MTF/4:2:0 physics rides the
  synthetic σ/crosstalk model (4.0). Real-camera validation = user-run
  (`channel-check.html` for the model; a live color transfer page is future work).
- All planes share EC-M in the loopback (version alignment); allocator says B-LSB needs M,
  others could ride L for ~15 % more capacity — optimization left on the table.
