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

## Refinement analysis (2026-07-07, pre-kickoff) — the two open questions

### Q1. Is the 4:2:0 penalty real on modern high-res cameras? — YES but it bites differently
- Transport reality: 1080p+ uncompressed (YUY2 4:2:2) exceeds USB bandwidth -> HD/4K webcams
  ship MJPEG or NV12, BOTH 4:2:0. Higher resolution makes subsampling MORE certain, not less.
  Chromium may even pick lower-res YUY2 over MJPEG to avoid decode cost (w3c/mediacapture-
  extensions #13). Also the Bayer CFA already halves R/B sampling AT THE SENSOR.
- BUT the "4x area tax" framing assumed modules could otherwise be ~1 camera px. jsQR needs
  >=3-4 camera px/module for reliable binary decode ANYWAY, which already satisfies the 2x2
  chroma footprint at realistic operating points. So at sane module sizes the penalty
  manifests NOT as area, but as (a) higher effective sigma on chroma-carried channels and
  (b) chroma edge blur (MTF) at module boundaries -> it is a NOISE-BUDGET question.
- Consequence: measure, don't assume -> new sub-step 4.0 (channel characterization).

### Q2. Optimal split — channels are fixed (3 RGB primaries); the variable is LEVELS per channel
- Error chain per plane: module SER = 2(1-1/L)Q(Delta/2sigma) -> QR EC-L absorbs ~1-2%
  module SER per plane -> fountain absorbs whole-plane deaths. So the budget is generous.
- SER table (linearized): L=4 @ sigma<=10 -> ~1e-5 (safe everywhere).
  L=8 @ sigma=5 -> ~0.02% (fine); L=8 @ sigma=10 -> ~6% (plane dies).
  => L=8 is viable ONLY on channels that calibrate down to sigma~5. Candidate: G (Bayer 2x
  sampling + dominant luma weight in MJPEG). R/B on 4:2:0 chroma likely sigma 8-12.
- Allocation candidates: 4/4/4 = 6 b/module (floor, safe);  G8/R4/B4 = 7 b (+17%, if
  sigma_G<=5 measured);  8/8/8 = 9 b (only if all sigma<=5 — unlikely over MJPEG).
  Y-hires/C-lores split remains the 4b fallback architecture (different module sizes).
- Bit-plane trick generalizes: L=8 = 3 Gray-coded planes; planes total = sum(log2 L_i).
- DECISION RULE (replaces fixed 4/4/4): 4.0 measures per-channel sigma + chroma MTF ->
  allocator picks max sum(log2 L_i) s.t. per-plane module SER < 1% (QR-EC-L margin).
