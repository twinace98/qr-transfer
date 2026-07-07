# Phase 5 · 5.1(core)+5.2(loopback) — live color frame pipeline

**Date**: 2026-07-07 · **Status**: loopback PASS (blind-fire mode); app camera wiring + replica-color pending

## What ran
- `colorframe.js` (5.1): strip-border(26 patches, clockwise) + 6-plane body layout;
  `frameLayout`/`composeFrameRGBA`(TX)/`sampleFrame`(RX) share one geometry.
- Meta color announce (0xC0): {alloc,pedestal,bodyPx} broadcast in the meta packet;
  RX auto-configures; backward compatible (marker absent = B/W). Round-trip tested.
- `color-live-loopback.html` (5.2): TX compose → synthetic channel over the WHOLE frame
  (strip included) → sampleFrame → per-frame estimateModel (mean-in-linear) → 2-frame
  warm-up → decodeSIC → 3×3 majority → jsQR ×6 → BlindFireReceiver. Headless Chrome.

## Result (20 KB, block 250, fallback channel)
done ✓ · **SHA-256-exact ✓** · k=82 · 20 frames · plane failures **0/108** ·
ε = 25.6 % (= the 12 systematic packets skipped during warm-up, absorbed by droplets) ·
**metaColor received** {4/4/4, pedestal 64} ✓

## Remaining (5.1/5.2 app wiring, 5.3)
- Unified-app color toggle: TX putImageData path (composeFrameRGBA on qr-canvas),
  RX camera guide-box → sampleFrame coordinates mapping.
- Replica-color (windowed ×6) variant.
- 5.3 real-device run (user) → gate 4.
