# Phase 1 · Sub-step 1.5 — End-to-end SHA-256 verification

**Date**: 2026-07-06 · **Status**: PASS — **Phase 1 exit criterion met**

## Harnesses
1. `app/js/e2e.test.mjs` (Node) — Transmitter↔Receiver via `parseFrame`, virtual clock,
   optional frame-drop channel. `node app/js/e2e.test.mjs`.
2. `app/loopback.html` (browser) — same wiring in-page, SHA-256 via `crypto.subtle`.
   Verified under headless Chrome.

## Results
- **Node**: 6/6 — text byte-exact; binary byte-exact @cs∈{100,250,500,800}; lossy(1-in-3)
  channel recovers via retransmit (clean 12 → lossy 18 frames), still byte-exact.
- **Browser (headless Chrome)**: 6/6 PASS, `sha256(received) === sha256(source)` for text,
  binary at all 4 chunk sizes, and lossy channel.

## Conclusion
- Received SHA-256 == source SHA-256 across text + binary + lossy cases in both Node and the
  browser. Stop-and-wait ARQ + reassembly is correct and faithful to the original.

**Frame counts** (baseline intuition for Phase 2): 3000 B binary → 42/18/10/7 frames at
chunk size 100/250/500/800. These are exactly the numbers the Phase-2 harness will convert
into throughput once a channel model (frame rate, drop rate) is applied.
