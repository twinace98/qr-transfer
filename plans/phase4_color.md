# Phase 4 — Color multiplexing (bit-plane PAM) — Phase Plan

## Goal

Multiply bytes/frame by superimposing **6 independent binary QR planes** in one color frame
(3 channels × 2 bit-planes, 4 levels/channel = 64 colors, Gray-coded), decoded by **stock
jsQR after plane separation** — no custom color decoder. Carried payload = the Phase-3
blind-fire packet stream; the fountain absorbs plane losses. Gate 3 decides whether the
color lever ships or the project stops at the Phase-3 gain.

Design source: `references/color-multiplexing-design.md` (user-provided; noise budget
2Q(Δ/2σ) ⇒ 4 levels/channel is the sweet spot; chroma-subsampling physics; per-frame
calibration strip with 3×3 crosstalk inverse).

## Scope

- **In**: `colorplane.js` (encode: 6-plane compose, value = 170·b₁ + 85·b₀ per channel,
  Gray-coded; decode: gamma linearization → crosstalk inverse → 4-level quantize → plane
  re-render → jsQR ×6); per-frame calibration strip + estimator; synthetic-channel tests
  (noise σ, crosstalk, gamma) in Node; browser loopback page (canvas→canvas) + headless
  verification; blind-fire integration (6 planes carry 6 packets/frame); gate-3 measurement.
- **Out**: luma/chroma split design (Y high-res + Cb/Cr low-res — fallback if 4:2:0 kills
  flat 6-plane); manual exposure locking (bonus, not mainline); real-optics tuning beyond a
  manual smoke test.

## Sub-steps

| # | Sub-step | Success criterion |
|---|----------|-------------------|
| 4.1 | Bit-plane codec core (`colorplane.js`) | 6 planes composed/decomposed **synthetically** (no camera): byte-exact recovery of all 6 QR payloads after gamma + Gaussian noise σ = 10 (8-bit scale). Gray-coded levels verified (adjacent-level error corrupts exactly one plane). |
| 4.2 | Per-frame calibration | Reference strip rendered each frame; Rx estimates M⁻¹ + thresholds per frame; synthetic sweep over crosstalk matrices / offsets / drifting exposure still decodes. |
| 4.3 | Blind-fire integration + browser E2E | 6 blind-fire packets per frame through the color loopback (canvas→canvas, headless Chrome): SHA-256-exact file transfer; measured levels/channel and fountain overhead → gate 3. |

**Decision gate 3 (after 4.3, from `Plan.md`)**: ≥ 4 levels/channel decode with fountain
overhead < ~15%. On fail: stop at Phase 3's gain and document why.

## Planned data / logs / report

- `data/005-color/` — noise-budget sweeps, calibration sweeps, loopback E2E metrics
- `working/phase4_step{1,2,3}_*.md`
- `reports/performance/performance.md` — updated at gate 3

## Approval points

- **Phase kickoff**: this pair. ← current gate.
- After 4.1 (first-sub-step rule): confirm synthetic noise-budget behavior before calibration.
- Decision gate 3 after 4.3 — never self-approved.

## Exit criterion

Color loopback transfers a file SHA-256-exact at 6 planes/frame with gate-3 numbers
recorded, or a documented stop-at-Phase-3 decision.
