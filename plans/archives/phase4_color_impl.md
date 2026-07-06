# Phase 4 — Color multiplexing — Implementation Spec

Phase plan: [`phase4_color.md`](phase4_color.md) · Design: `references/color-multiplexing-design.md`

> Living document — lock levels/λ/thresholds after each sub-step.

## Constants (from the design note)

- Levels/channel: **4**, values {0, 85, 170, 255}; channel value = 170·b₁ + 85·b₀.
- **Gray code** the (b₁,b₀) pairs across levels: 00→01→11→10 so an adjacent-level misread
  flips exactly one plane bit.
- Planes: R-MSB, R-LSB, G-MSB, G-LSB, B-MSB, B-LSB = 6 binary QRs per frame.
- Finder/timing patterns: **B/W on all channels** (luma detection); only data modules are colored.
- Noise model for synthetic tests: gamma 2.2 round-trip + Gaussian σ ∈ {5, 10} on 8-bit,
  optional crosstalk `observed = M·displayed + b` with M diag ≈ 0.85–0.95, off-diag ≈ 0.02–0.10.

## 4.1 — `app/js/colorplane.js` (+ `colorplane.test.mjs`)

- `composeFrame(planes[6], moduleGrid)` → RGBA ImageData-like {data, width, height}:
  6 same-size binary module matrices → per-module RGB via bit-plane formula. Use the QR
  matrix from QRious's internal model or re-render: simplest = draw 6 QRious canvases
  offscreen, read them as binary grids (already-verified byte-mode path), then compose.
- `decomposeFrame(imageData)` → 6 B/W ImageData for jsQR: linearize (inverse gamma LUT) →
  (4.2: crosstalk inverse; 4.1: identity) → per-channel quantize to 4 levels (thresholds
  {42, 127, 212} in 4.1) → Gray-decode to (b₁,b₀) → paint two planes per channel.
- Node tests (no DOM): synthesize module grids directly (skip QRious in Node), compose →
  gamma + noise → decompose → compare grids bit-exact; then adjacent-level fault injection
  → assert exactly one plane corrupted.
- **Pass**: all-6-planes bit-exact at σ=10; Gray-code isolation property holds.

## 4.2 — calibration

- Strip: 2-module-wide border row at top/bottom: [K, W, R1..R3, G1..G3, B1..B3] patches
  (known positions after QR finder lock).
- Estimator: least-squares 3×3 M + offset b from strip patches in linearized space, per
  frame; per-channel decision thresholds = midpoints of the calibrated level responses.
- Tests: sweep M/b + slow exposure drift (gain ramp over frames) → decode holds.
- **Pass**: decode intact across the sweep grid; thresholds track a ±20 % gain ramp.

## 4.3 — blind-fire over color + loopback E2E

- Tx page (`app/color.html`): 6 `BlindFireSender.nextPacket()` per tick → 6 QR planes →
  `composeFrame` → visible canvas. Rx: `decomposeFrame` → jsQR ×6 → `BlindFireReceiver`.
- Headless loopback (no camera): Tx canvas → ImageData (+ synthetic noise) → Rx path in the
  same page; verified via headless Chrome like `blindfire-check.html`.
- Metrics → `data/005-color/`: effective planes decoded/frame, per-plane jsQR failure rate,
  fountain overhead, bytes/s vs the B/W blind-fire best.
- **Gate 3**: ≥ 4 levels/channel (i.e., both bit-planes of every channel decodable) AND
  fountain overhead < ~15 %.

## Deferred / fallbacks

- Chroma 4:2:0 penalty is a REAL-camera concern; loopback E2E is subsampling-free. If a
  manual camera test fails on chroma, fall back to the Y-high-res + Cb/Cr-low-res split
  (design note §subsampling) as a Phase-4b decision — do not silently absorb it into 4.3.
- RaptorQ upgrade, manual exposure locking: out of scope.
