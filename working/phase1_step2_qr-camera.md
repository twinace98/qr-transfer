# Phase 1 · Sub-step 1.2 — qr.js + camera.js

**Date**: 2026-07-06 · **Status**: PASS

## What ran
- `app/js/qr.js` — `createDisplay(canvas, statusEl)` wrapping QRious (size 300, level `M`,
  initial value `QR_FTP_IDLE`); `.update(value, statusText)`.
- `app/js/camera.js` — `createScanner({video, canvas, onDecode, ...})`: `getUserMedia`
  (facingMode toggle), `requestAnimationFrame` scan loop, `jsQR(..., {inversionAttempts:'dontInvert'})`,
  green-flash hook, and `decodeImageFile(file)` upload fallback.

## Verification
- Headless Chrome load of `index.html`: QRious global resolved, display created, QR canvas
  rendered (qr-status → "Idle state."), no fatal JS console errors.
- Camera path (getUserMedia) is manual-only; in headless it correctly routes to the
  fallback/error branch without crashing.

**Locked in**: QRious size 300 / level M; jsQR `dontInvert`; front camera default.
