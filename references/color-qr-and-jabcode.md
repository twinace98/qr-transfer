# Color QR capacity — Hackaday/rMQR, JAB Code, HCCB

**Why here**: background + physics for the Phase 4 color-multiplexing stretch.

## Sources
- Hackaday, "Color Can Triple QR Code Capacity" (2023-07-28), C. Lott —
  <https://hackaday.com/2023/07/28/color-can-triple-qr-code-capacity/>. [mit41301] tripled
  bits using color on the **rectangular micro QR (rMQR)** symbol.
- **JAB Code** — ISO/IEC 23634 (Just Another Bar Code): polychrome (8–64 color) 2D barcode;
  reference C implementation exists. The standards precedent for multi-level color modules.
- **Microsoft HCCB** (High Capacity Color Barcode) — early 4/8-color triangular-cell design.

## Physics ceiling (from perf discussion, 2026-07-06)
- **Noise budget**: after gamma linearization + calibration, display→webcam residual noise
  σ ≈ 5–10 on an 8-bit scale. Symbol error ≈ 2·Q(Δ/2σ), Δ = 255/(L−1).
  - L=2: Δ=255 → effectively error-free (today's black/white).
  - L=4: Δ=85 → ~4–8σ → negligible errors. **Safe → 2 bits/channel × 3 = 6 bits/module.**
  - L=8: Δ=36 → ~2σ → several % per module; risky on auto-exposure webcams.
- **Chroma subsampling is the real enemy**: webcams stream MJPEG 4:2:0 over USB → color
  spatial resolution is half of luma. Color modules need ≥ 2×2 camera pixels (4× area
  penalty), so 8-color is a *net loss* vs B/W; 64-color is only ~1.5×. Mitigations:
  request low-res uncompressed YUY2 (4:2:2) via `getUserMedia`; or split luma(Y)=high-res
  B/W QR + chroma(Cb/Cr)=low-res data (analog-color-TV band allocation).

## Implementation trick — bit-plane decomposition (reuse jsQR)
- channel value = 170·b₁ + 85·b₀ → two binary QR planes per channel → **6 planes/frame**.
- Decode: gamma-inverse → crosstalk M⁻¹ → 4-level quantize → split planes → jsQR ×6.
- **Gray-code the levels** (00→01→11→10): an adjacent-level misread flips only one plane,
  which the LT fountain absorbs. Finder patterns stay B/W (luma-only detection, like JAB/HCCB).
- **Calibration**: fixed corner patch strip (all used levels) every frame; receiver updates
  M⁻¹ + per-channel thresholds per frame to track auto-exposure/white-balance drift.
  `applyConstraints({advanced:[{exposureMode:'manual',whiteBalanceMode:'manual'}]})` is a
  bonus where supported (desktop support is spotty) — per-frame calibration is the primary.

## Feasibility flag for us
- Confirm the QR *encoder* can emit the needed versions / rMQR. QRious is standard-QR only;
  color + rMQR + high versions may need a different encoder (checked in Phase 3.1 / 4.2).
