# Color multiplexing design notes (user-provided, 2026-07-07) — Phase 4 spec basis

## Level budget: 4 levels/channel = 64 colors = 6 bits/module is the sweet spot
- Per-channel PAM instead of binary on/off. Precedent: JAB Code (ISO/IEC 23634), Microsoft HCCB (8-64 colors).
- Noise budget: after gamma linearization + calibration, display->webcam residual noise
  sigma ~ 5-10 (8-bit scale). L levels -> decision gap Delta = 255/(L-1), SER ~ 2Q(Delta/2sigma):
  - L=2: Delta=255 -> error-free
  - L=4: Delta=85 -> 4-8 sigma -> negligible errors. SAFE
  - L=8: Delta=36 -> ~2 sigma -> few % module errors; risky on auto-exposure webcams
- => 2 bits/channel x 3 channels = 6 bits/module realistic ceiling (6x over B/W QR).

## The real trap: chroma subsampling
- Webcams mostly ship MJPEG 4:2:0 at 1080p (USB bandwidth) -> chroma spatial resolution is
  HALF of luma. Color modules must span >= 2x2 camera pixels -> 4x area penalty.
- With that penalty: 8 colors (3 bits) is a net LOSS (3/4 of B/W); 64 colors only ~1.5x.
- Mitigations:
  1. getUserMedia at lower resolution to get uncompressed YUY2 (4:2:2), or
  2. design to the physics: high-res binary QR on luma (Y) + low-res data on chroma (Cb/Cr)
     — same band allocation as analog color TV; optimal because the subsampling structure matches.

## Implementation trick: bit-plane decomposition, reuse jsQR (FULL version, 2026-07-07)
- Do NOT write a 64-color custom decoder. Per channel: value = 170*b1 + 85*b0
  (b1 = MSB QR bitmap, b0 = LSB QR bitmap) -> 3 channels x 2 planes = 6 independent
  binary QRs superimposed in ONE frame.
- Rx pipeline: (1) gamma de-correction, (2) crosstalk inverse matrix, (3) per-channel
  4-level quantization -> MSB/LSB plane extraction, (4) re-render each plane as a B/W
  image -> jsQR x6.
- **Gray-code the levels** (00->01->11->10): an adjacent-level misread corrupts only ONE
  plane; 5/6 QRs survive and the fountain absorbs the dead one — the three techniques mesh.

## Calibration (display->camera crosstalk)
- In linearized space: observed = M*displayed + b (3x3 matrix + offset).
- (1) Fixed reference strip at frame corners every frame: white/black + all 4 levels per
  channel. (2) Rx updates M^-1 + per-channel thresholds EVERY frame (tracks auto-exposure/
  white-balance drift). (3) Finder patterns stay B/W (luma-only detection; JAB/HCCB same).
- `applyConstraints({advanced:[{exposureMode:'manual', whiteBalanceMode:'manual'}]})` is a
  bonus, not the mainline (desktop support is spotty); per-frame calibration is primary.

## Expected total
- QR v25 (EC-L ~1.3 KB) x 6 planes x 10 fps ~ 78 KB/s theoretical; with chroma penalty +
  fountain overhead -> effective 20-40 KB/s.

## Gate 3 tie-in (Plan.md)
- Pass: >= 4 levels/channel decoded with fountain overhead < ~15%; else stop at Phase-3 gain.
