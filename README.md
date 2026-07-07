---
title: "QR Optical Data Transfer — Replica & Performance Study"
status: active
people: [Seungwoo Shin]
created: 2026-07-06
---

# QR Optical Data Transfer — Replica & Performance Study

**Live app**: <https://twinace98.github.io/qr-transfer/app/index.html> (HTTPS — camera works)

## Idea

Faithfully reproduce the browser-based optical file-transfer app at
<https://charlielee206.github.io/QR_FTP/> (an "optical data diode": a file streamed
between two devices purely through on-screen QR codes and a webcam, no network), then
**measurably improve its throughput** while keeping byte-exact (SHA-256) reconstruction.

## Key Results

| Phase | Result |
|-------|--------|
| 1 — Replica | ✅ Modular replica, protocol-faithful; byte-exact round-trips (Node + browser). |
| 2 — Baseline | ✅ Deterministic loopback harness; **B0 = 1350 B/s** (text-10k, chunk 250, 0 % drop, 15 fps). Gate 1 PASS. |
| 3 — Blind-fire | ✅ One-way compress→LT-fountain→broadcast (zero back-channel): **5.2–16.3× B0 incompressible**, 57× on text; all SHA-exact. Gate 2 PASS. QRious byte-mode browser-verified to QR v40-L. |
| 4 — Color (engine) | ✅ 6 Gray-coded bit-planes/frame (4 levels/channel, pedestal-64 grid, SIC decode, per-frame strip calibration, EC-aware allocator): loopback 25 KB SHA-exact, 0 plane failures, fountain ε 0 %. Gate 3 PASS. **≈17.7× B0** at block 250 before capacity lever. |
| 5 — Live color UI | 🔄 Core done: strip-border frame layout, one-way color announce (meta 0xC0), live-layout loopback SHA-exact (warm-up 2 frames, 0 plane fails). **Pending**: app camera wiring (guide-box RX), replica-color window, real-device run (gate 4). |

Unified app: **two-way (ACK replica)** and **one-way (blind-fire)** selectable per transfer,
FPS 10/15/20; replica path stays byte-faithful to the original when blind-fire is off.

## Findings worth reading

- Vanilla LT peeling needs 25–55 % overhead at k ≤ 256 — a GF(2) elimination finish
  (inactivation) cuts it to 2–6 % (`working/phase3_step2_fountain.md`).
- Gamma × crosstalk compresses *dark* display-level gaps: naive 4-level color decoding
  loses 3–6 % of modules; SIC decoding + a pedestal-64 level grid fixes it
  (`working/phase4_step1_colorplane.md`).
- deflate beats LZMA only below ~10 KB on mixed content; LZMA (wasm) wins above —
  auto-select keeps both (`data/002-compression/crossover.json`).
- Modern high-res webcams make 4:2:0 chroma subsampling *more* certain, not less
  (USB bandwidth ⇒ MJPEG/NV12); at jsQR's ≥3–4 px/module it acts as per-channel σ/MTF,
  not an area tax (`references/webcam-chroma-transport-sources.md`).

## Reports

| Topic | Report |
|-------|--------|
| baseline throughput | `reports/baseline/baseline.md` |
| performance study (Phases 3–4) | `reports/performance/performance.md` |
