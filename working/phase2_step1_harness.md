# Phase 2 · Sub-step 2.1 — bench harness (channel model + determinism)

**Date**: 2026-07-06 · **Status**: PASS (pausing per first-sub-step rule)

## What ran
- `scripts/bench/channel.mjs` — `mulberry32` seeded PRNG + `makeChannel({dropProb,seed})`.
- `scripts/bench/capacity.mjs` — QR byte-mode capacity table (EC-M, V1–40) + `qrVersionForBytes`.
- `scripts/bench/bench.mjs` — `runCase({fileBytes,chunkSize,fps,dropProb,seed})` driving the
  **unmodified** `app/js/{protocol,tx,rx}.js` via a virtual clock + drop channel; `makePayloads()`.
- `scripts/bench/bench.test.mjs` — determinism + SHA-256 checks.

## Channel model (as implemented — needs sign-off before the sweep)
- **Slot model**: a "slot" = one QR display on *either* screen (the two devices alternate).
  Wall-clock = `totalSlots / fps`, `totalSlots = txSlots + ackSlots`. **Stop-and-wait costs a
  DATA slot + an ACK slot per chunk** — so a one-way (blind-fire) transport, emitting no ACK
  slots, gets ~2× for free here. (Fix vs first draft, which counted only Tx frames and hid the
  handshake cost.)
- Discrete slots at `fps` (default **15**, raised from 5; swept in 2.2).
- Each **displayed Tx frame** lost with prob `dropProb` (seeded Bernoulli) → replica times out
  (2500 ms) and re-shows. **ACK channel reliable** in baseline.
- Reported `maxQrVersion` = smallest byte-mode EC-M QR version holding the largest frame.

## Result
- `bench.test`: 4/4 — SHA-256 exact across {100,250,500,800} × {0,1%,5%}; deterministic per
  seed (same seed → identical slots); seed-sensitive on lossy channel; drops cost slots.
- Demo (text 10260 B, cs=250, drop=0): **57 txSlots + 57 ackSlots = 114 slots**, QR v12, sha
  match. bytesPerSec scales with fps (10→900, 15→1350, 30→2700, 60→5400); slot count fps-invariant.
- `node scripts/bench/bench.mjs` exits 0 (determinism + sha self-check).

## Pass criterion — MET
- Two runs, identical `{seed,dropProb}` → identical `{frames,okSha,bytes}`; `okSha === true`. ✅

## Assumptions (flagged for confirmation)
- `fps = 5` default (conservative scan-decode rate; a tunable, not a claim).
- Baseline ACK channel reliable (lossy-ACK is a later sensitivity check).
- Sweep payloads: ~10 KB compressible text + ~10 KB incompressible binary (deterministic),
  to be reused by Phase 3 so compression/fountain gains are comparable.

**Locked-in (pending sweep)**: fps default, seed default, payload set — confirm before 2.2.
