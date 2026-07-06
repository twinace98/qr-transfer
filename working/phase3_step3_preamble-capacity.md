# Phase 3 · Sub-step 3.3 — preamble + capacity + combine

**Date**: 2026-07-07 · **Status**: complete → Decision gate 2 pending user judgment

## What ran
- **Preamble/metadata packet** (seed = 0 reserved): carries fileName/mime, zero-padded to
  blockSize (QR version constant); broadcast every 32 frames (cost charged in the sweep).
  Receiver stores `meta` from any preamble frame; decode is unaffected.
- **Capacity lever**: EC-L byte-capacity table + `qrVersionForBytesL` added to
  `scripts/bench/capacity.mjs` (CRC16 pre-gates corruption → EC M→L). Block-size sweep up
  to 2000 B/frame (QR v33-L).
- **Combined sweep** `scripts/bench/blindfire-bench.mjs` → `data/004-blindfire/sweep.json`:
  compress × fountain × capacity on the unchanged Phase-2 channel model (fps 15, seeded
  drops, all slots Tx displays — zero ACK slots). 36 cases: {text-10k, binary-10k} ×
  block {100..2000} × drop {0, 1 %, 5 %}.

## Results
- **All 36 cases SHA-256-exact; deterministic** (same seed → same slots).
- @ 0 % drop, fps 15 (B0 = 1350 B/s):
  | file | block | QR v (EC-L) | B/s | × B0 |
  |---|--:|--:|--:|--:|
  | text-10k (compresses 10 KB→107 B) | 250 | 10 | 76 950 | **57×** |
  | binary-10k (incompressible) | 500 | 15 | 6 982 | **5.2×** |
  | binary-10k | 800 | 20 | 10 971 | **8.1×** |
  | binary-10k | 2000 | 33 | 21 943 | **16.3×** |
- Drop robustness: 5 % drop still completes one-way, SHA-exact (e.g. binary/100: 107→177 slots).

## Assumptions / flags
- **QR encoder capability at high versions is NOT yet browser-verified** (impl-spec item):
  the sweep uses the standard EC-L capacity table; QRious byte-mode encode + jsQR decode of
  v25–40 binary payloads needs a real-browser check (Phase-1 loopback page can host it).
  Even at conservative v15–20 (QRious-safe), incompressible binary = 5–8× B0.
- Absolute B/s scales with fps; factors vs B0 are fps-invariant (same slot model).
