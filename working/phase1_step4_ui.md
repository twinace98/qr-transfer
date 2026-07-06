# Phase 1 · Sub-step 1.4 — index.html + css + main.js

**Date**: 2026-07-06 · **Status**: PASS

## What ran
- `app/index.html` — Transmit/Receive tabs, webcam preview + Switch Camera, file input,
  chunk-size `<select>` (100/250/500/800 with original labels), Start button, shared QR
  canvas + status, Tx/Rx progress bars, Download button, manual-upload fallback input.
- `app/css/style.css` — local dark theme reproducing the original slate palette (replaces
  Tailwind CDN).
- `app/js/main.js` — wires modules; routes scans to Tx (`RX` ACKs) or Rx (`TX` data) by
  active tab; `switchMode` resets both machines; download via object URL.

## Verification
- Headless Chrome (`--dump-dom`) of `index.html`: init() completed (qr-status "Idle state."),
  all controls present, no fatal JS errors (camera errors expected/handled in headless).

## Deviations from original (intentional, non-behavioral)
- Tailwind CDN → local CSS; CDN `<script>` → vendored `app/vendor/`. Protocol/UI wording/states
  unchanged.

**Locked in**: chunk-size options + default 250; dual-mode shared QR surface.
