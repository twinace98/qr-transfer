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
- **Out**: luma/chroma split design (Y high-res + Cb/Cr low-res — becomes Phase-4b only if
  4.0 measures chroma σ too high for even L=4); manual exposure locking (bonus, not
  mainline); real-optics tuning beyond the 4.0 measurement + one manual smoke test.

**Q1/Q2 resolution built in** (analysis in `references/color-multiplexing-design.md`):
4:2:0 is *more* certain on modern high-res cameras (USB bandwidth ⇒ MJPEG/NV12), but at
jsQR's ≥3–4 px/module operating point it manifests as **per-channel σ and chroma-MTF**, not
a 4× area tax — so 4.0 measures it. Channel count is fixed at 3 (display primaries); the
design variable is **levels per channel**, chosen by the 4.2 allocator from measured σ
(floor 4/4/4 = 6 b/module; stretch G8/R4/B4 = 7 b if σ_G ≤ ~5).

## Sub-steps

| # | Sub-step | Success criterion |
|---|----------|-------------------|
| 4.0 | **Channel characterization** (display→camera) | Measurement page + report: per-channel effective σ (after per-frame calibration), chroma edge MTF at module boundaries, delivered transport format. Answers Q1 (does 4:2:0 bite at our module size?) with numbers; feeds the level allocator. Synthetic-channel fallback model locked for 4.1–4.3 tests. |
| 4.1 | Bit-plane codec core (`colorplane.js`), **variable levels/channel** | N planes (Σlog₂Lᵢ) composed/decomposed **synthetically**: byte-exact at the 4.0-modeled σ per channel; Gray-coded (adjacent-level error corrupts exactly one plane). Supports L ∈ {2,4,8} per channel. |
| 4.2 | Per-frame calibration + **level allocator** | Reference strip → M⁻¹ + thresholds per frame; ±20% exposure drift tracked. Allocator picks max Σlog₂Lᵢ s.t. per-plane module SER < 1% (QR EC-L margin) from measured σ — 4/4/4 (6 b) is the floor, G8/R4/B4 (7 b) the expected stretch. |
| 4.3 | Blind-fire integration + browser E2E | Allocated planes carry blind-fire packets through the color loopback (canvas→canvas + 4.0 noise model, headless Chrome): SHA-256-exact; measured levels/channel + fountain overhead → gate 3. |

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
