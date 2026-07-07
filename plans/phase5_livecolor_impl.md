# Phase 5 — Live color UI — Implementation Spec

> Living document.

## 5.1 TX composer (`app/js/colorframe.js`)
- Layout: outer border = strip patches (26, from `stripPatches()`, 2-module thickness,
  fixed order clockwise from top-left; corners = K/W anchors), inner region = 6-plane QR
  (same version: identical packet length + same EC per plane batch).
- Blind-fire: packets from `BlindFireSender.nextPacket()` ×6 (+ meta cadence).
- Replica-color (flag `replica-color`, protocol variant — NOT the faithful path):
  window of 6 consecutive DATA frames rendered as planes; TX advances the window on ACKs
  (rx ACKs each recovered chunk via the existing RX|ACK frame, B/W).
- Compose per pixel via `composeModulesGrid` (alloc 4/4/4, PEDESTAL) onto the shared canvas.

## 5.2 RX (`app/js/colorframe.js` decode side + main.js wiring)
- Guide-box (as channel-check.html): user aligns sender screen into the box; sample strip
  patches at known relative positions → `estimateModel` (mean-in-linear, saturation-aware)
  → `decodeSIC` on the inner region → 3×3 majority filter → jsQR ×6 (binaryData) → route
  to BlindFireReceiver or replica Receiver (parse string frames from plane bytes).
- Headless loopback: `app/color-live-loopback.html` runs TX composer → synthetic channel →
  RX path in one page for both modes; CI-able via headless Chrome (like 4.3).

## 5.3 Real device
- Pages deploy; phone camera → laptop screen. Record: σ̂ per channel, plane failure rate,
  effective fps, end-to-end B/s. Save JSON → `data/005-color/measured-channel.json` +
  `data/006-livecolor/live-run.json`.

## Locked (from Phase 4): alloc 4/4/4, PEDESTAL=64, SIC×2, serL/serM 0.9/1.5 %, EC per
allocator (loopback planes share EC-M for version alignment).
