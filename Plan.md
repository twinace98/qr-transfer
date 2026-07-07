# QR Optical Data Transfer — Master Plan

## Context

Replicate the optical QR file-transfer app at <https://charlielee206.github.io/QR_FTP/>
and then substantially improve its throughput. The original is a single self-contained HTML
page using Tailwind (CDN), `jsQR` (decode) and `QRious` (encode). It streams a file between
two screen+webcam devices as a sequence of QR codes, coordinated by a **stop-and-wait ARQ**
handshake on a *reverse* QR channel (each device both shows and scans QR).

Reference protocol (decoded from source, 2026-07-06):
- Encoding: file → `readAsDataURL` → base64 → fixed-size char chunks (100/250/500/800).
- Tx frames: `TX|INIT|name|mime|nChunks|chunkSize|salt`, `TX|DATA|seq|nChunks|salt|payload`,
  `TX|END|nChunks|salt`. Rx frames: `RX|ACK_INIT|salt`, `RX|ACK|seq|salt`, `RX|ACK_END|salt`.
- Flow control: stop-and-wait; `salt` re-roll + re-show on `TX_TIMEOUT_MS = 2500`. QRious size
  300, EC level `M`.

**Decisions locked in**:
- **Modular web project**, libs vendored locally (`app/vendor/`), Tailwind→local CSS
  (2026-07-06).
- **Phase-3 architecture = one-way "blind-fire" by default** (2026-07-06): fountain-coded,
  no ACK, sender needs no camera. The original bidirectional ACK app is preserved as the
  benchmark baseline, not extended.
- **Adaptation = one-way self-calibrating preamble only** (2026-07-06): a fixed training
  pattern + capability header broadcast forward; the receiver auto-configures. No back-channel
  "negotiation" (that would require a reverse link, which blind-fire lacks by definition).
- **Lever order**: compression + fountain first; **color multiplexing is a later gated
  stretch** (2026-07-06).
- **Compression = LZMA (WASM) from the start**, with native `deflate-raw` as comparison and a
  skip-if-larger flag for already-compressed inputs (2026-07-06).

**Critical caveats / assumptions**:
- **"Negotiation" ⊥ "blind-fire"**: ADSL-style link training needs a reverse channel;
  blind-fire has none. What is buildable one-way is *receiver-side rate adaptation* driven by
  a broadcast preamble — not a handshake. True negotiation is possible only in the optional
  two-camera handshake mode (out of the default path).
- Browser-only loopback benches cannot capture optics (autofocus, refresh, chroma
  subsampling). Every throughput number is a **model** with stated assumptions (frame rate,
  drop rate, bytes/frame), never an absolute field rate.
- **Byte-exact reconstruction (SHA-256) is a hard gate** for every variant. Faster-but-
  corrupting = failure, not trade-off.
- **Chroma subsampling is the binding physics for color** (webcam MJPEG 4:2:0 halves color
  resolution). Realistic ceiling ≈ 2 bits/channel × 3 = 6 bits/module; per-frame calibration
  is mandatory. This is why color is a gated stretch, not a core lever.
- **Encoder capability risk**: QRious may not support the high versions / rMQR / color needed
  for the capacity lever; may require a different encoder. Verified in Phase 3.1.

## Phase-level goals

| Phase | Top-line goal |
|-------|---------------|
| 1 | Modular replica byte-identical in behavior to the original app. ✅ done 2026-07-06 |
| 2 | Reproducible benchmark harness + quantified baseline throughput `B0`. |
| 3 | One-way blind-fire transport (compression + LT fountain) at ≥ 3× `B0`, SHA-256-exact. |
| 4 | (Stretch, gated) color multiplexing for additional bytes/frame. ✅ done 2026-07-07 (gate 3 PASS, loopback) |
| 5 | Live color UI in the unified app (both transports) + real-device validation (gate 4). |

---

## Phase 1 — Replica ✅ COMPLETE (2026-07-06)

Modular replica in `app/`. All 5 sub-steps PASS; Node + headless-browser loopback confirm
SHA-256-exact round-trip for text/binary at all chunk sizes and a lossy channel. See
`working/phase1_step*.md`. Plan pair to be archived at Phase-2 kickoff.

---

## Phase 2 — Baseline benchmark

**Goal**: A headless, deterministic harness that drives the replica encode/decode path
through a configurable channel model (frame rate, drop probability, bytes/frame from real QR
capacity) and reports throughput (effective bytes/s), frames-per-file, and success rate.
Establish `B0` for all four chunk sizes. This same harness measures every Phase-3/4 variant.

| # | Sub-step | Sub-goal |
|---|----------|----------|
| 2.1 | Channel model + harness (`scripts/bench/`) | Deterministic (seeded) run of a file through chunk→QR-capacity→ACK-model→reassemble, no camera; SHA-256-exact. |
| 2.2 | Baseline sweep | Throughput + reliability for chunk sizes {100,250,500,800} × drop {0,1%,5%} → `data/001-baseline/`; record `B0`. |

**Decision gate 1 (after 2.2)**: harness deterministic (same seed → same result) AND
reassembly SHA-256-exact; `B0` recorded (bytes/s @ 0% drop, 250 B chunk). On fail: fix
harness before Phase 3 — never benchmark improvements against a non-reproducible baseline.

---

## Phase 3 — One-way blind-fire transport (compression + fountain)

**Goal**: Replace the ACK-gated replica with a one-way, rateless pipeline —
**compress → chunk → LT-encode → broadcast** — decoded by a peeling decoder with no reverse
channel. Each lever is measured against `B0` on the Phase-2 harness; combined result must hit
≥ 3× `B0` with every run SHA-256-exact.

| # | Sub-step | Sub-goal |
|---|----------|----------|
| 3.1 | Compression layer | LZMA (WASM) + native `deflate-raw`; pick smaller, 1-bit `compressed?` flag; skip already-compressed. Report ratio by file type; whole-file (not per-chunk) compression. |
| 3.2 | LT fountain + blind-fire core | Robust-soliton LT (systematic first pass → infinite droplets), seed-only neighbor derivation (shared PRNG), 16 B packet header `[magic|file_id|k|file_len|seed|CRC16|payload]`, peeling decoder, QR EC → **L**. Receiver bootstraps from any frame; UI shows progress only. |
| 3.3 | Self-calibrating preamble + capacity | Broadcast training/capability preamble (one-way); tune QR version/bytes-per-frame (verify encoder supports it or swap). Combine best compression × capacity × fountain; full sweep vs `B0`. |

**Decision gate 2 (after 3.3)**: throughput ≥ 3 × `B0` @ 0% drop **and** all sweep cases
SHA-256-exact. On fail: report achieved factor + binding bottleneck; ask whether to proceed
to Phase 4 (color) or accept the gain.

---

## Phase 4 — Color multiplexing (stretch, gated)

**Goal**: Lift bytes/frame beyond black-and-white via per-channel multi-level (PAM) color,
implemented as **bit-plane decomposition** so jsQR is reused (channel = 170·b₁ + 85·b₀ →
6 binary QR planes/frame), with Gray-coded levels so a mis-quantized plane costs one plane
(absorbed by the fountain code). Per-frame corner calibration patches track exposure/white-
balance drift; finder patterns stay black-and-white.

| # | Sub-step | Sub-goal |
|---|----------|----------|
| 4.1 | Color feasibility | Measure display→webcam channel noise σ and chroma-subsampling penalty; confirm ≥ 4 levels/channel decode reliably after calibration. |
| 4.2 | Bit-plane encode/decode | 6-plane compose (encode) + gamma-inverse → crosstalk M⁻¹ → 4-level quantize → plane split → jsQR×6 (decode). |
| 4.3 | Integrate + verify | Color × fountain × compression end-to-end; measure net bytes/frame gain; SHA-256-exact. |

**Decision gate 3 (after 4.1)**: ≥ 4 levels/channel (≥ 6 bits/module) decode with per-module
error rate low enough that the fountain overhead stays < ~15%. On fail: color is not viable
on the target hardware — stop at Phase 3's gain and document why.

---

## Repository layout

Source code (primary deliverable) lives at `app/`; `data/` holds **benchmark runs/results**:

- `app/` — web app: `js/` (`protocol.js`, `camera.js`, `qr.js`, `tx.js`, `rx.js`, `main.js`;
  Phase 3 adds `compress.js`, `fountain.js`, `blindfire-tx.js`, `blindfire-rx.js`; Phase 4
  adds `color.js`), `vendor/`, `css/`.
- `scripts/bench/` — headless benchmark harness (Phase 2), reused by 3/4.
- `data/001-baseline/` — Phase 2 baseline sweep
- `data/002-compression/` — Phase 3.1 · `data/003-fountain/` — Phase 3.2 ·
  `data/004-blindfire/` — Phase 3.3 · `data/005-color/` — Phase 4
- `reports/baseline/` — Phase 2 summary · `reports/performance/` — Phase 3/4 study

---

## Critical decision gates

1. **After 2.2 (baseline reproducibility)** — deterministic per seed AND SHA-256-exact;
   `B0` recorded. On fail: fix harness before Phase 3.
2. **After 3.3 (throughput target)** — ≥ 3 × `B0` @ 0% drop AND all sweep SHA-256-exact.
   On fail: report factor + bottleneck, ask direction.
3. **After 4.1 (color viability)** — ≥ 4 levels/channel decode with fountain overhead
   < ~15%. On fail: stop at Phase 3, document.

---

## Verification strategy

- **Phase 1**: byte-exact two-context round-trip (done). ✅
- **Phase 2**: determinism (seed → identical output) + reassembly SHA-256-exact; `B0`
  reproducible across two runs.
- **Phase 3**: every variant SHA-256-exact; decoder recovers from any k(1+ε) received
  droplets with zero back-channel; throughput via the *same* Phase-2 harness (apples-to-apples).
- **Phase 4**: SHA-256-exact; measured per-module error rate consistent with the noise budget;
  net bytes/frame gain reported with the chroma-subsampling assumption stated.
