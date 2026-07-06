# Phase 4 · Sub-step 4.0 — channel characterization

**Date**: 2026-07-07 · **Status**: PASS (synthetic); real-camera measurement = user-run
(pausing per first-sub-step rule)

## What ran
- `app/js/channelstats.js` — pure module: shared pattern geometry (2 anchors + 3ch×4-level
  patches + 4 checker strips), gamma 2.2 linearization, **per-frame per-channel linear
  calibration** (LSQ over 4 levels) with residual σ reported in 8-bit units, chroma-MTF
  proxy (checker/flat modulation ratio).
- `app/js/channelstats.test.mjs` — **9/9 PASS**: σ recovery within 25 % at true σ ∈
  {3,5,10} under gain 0.92 + offset (σ=10 estimate biased +20 % by 0/255 clipping —
  acceptable for characterization, noted); MTF proxy exact to ±0.05 at {1.0, 0.7, 0.4};
  gamma grid round-trip exact.
- `app/channel-check.html` — display+measure page: pattern painter and camera sampler use
  the SAME layout module; guide-box alignment; 60-frame median σ/MTF per channel; reports
  `track.getSettings()`; JSON download → `data/005-color/measured-channel.json`.
  Headless smoke: page loads and renders controls over http (ES modules need a server).
- `data/005-color/channel-model.json` — **LOCKED fallback model** for 4.1–4.3 synthetic
  tests: σ₈ = {G 5, R 8, B 10}, MTF = {G .9, R .75, B .7}, gamma 2.2, mild 3×3 crosstalk.
  Literature-guided (Bayer 2× G; MJPEG 4:2:0 chroma); replaced by measurement when run.

## Q1 disposition (from `references/webcam-chroma-transport-sources.md`)
4:2:0 is the transport default at HD+ (USB bandwidth ⇒ MJPEG/NV12; no 4:4:4 exists) but at
jsQR's ≥3–4 px/module operating point it acts through per-channel σ and MTF — which this
sub-step measures — not as a 4× area tax.

## Assumptions / flags
- **Real display→camera numbers require hardware I don't have**: run
  `python3 -m http.server` in `app/`, open `channel-check.html` (pattern on one screen,
  camera device measuring), save JSON to `data/005-color/measured-channel.json`. Until
  then 4.1–4.3 run against the locked fallback model — the 4.2 allocator re-runs
  automatically on measured numbers.
- Guide-box alignment (no automatic pattern detection) — adequate for characterization.

**Locked-in**: estimator math (test-verified), pattern geometry, fallback model above.
