# Phase 1 · Sub-step 1.3 — tx.js + rx.js (stop-and-wait ARQ)

**Date**: 2026-07-06 · **Status**: PASS (1.3 lock-in point)

## What ran
- `app/js/tx.js` — `Transmitter`: IDLE→INIT→SENDING→END; `tick()` = original `txLoop` body
  (salt re-roll + emit iff `now-lastTxTime ≥ timeoutMs`); `onAck()` advances on matching ACK,
  forces immediate re-send via `lastTxTime=0`. Clock injectable (`now`) for deterministic tests.
  Browser helpers: `start()` (100 ms `setInterval`), `fileToBase64()`.
- `app/js/rx.js` — `Receiver`: WAIT_INIT→RECEIVING→DONE; idempotent ACK replies; stores
  `chunks[seq]` only when `seq===expectedSeq`; reassembles on END when all chunks present.
  Browser helper: `base64ToBlob()`.

## Design note (faithfulness vs testability)
- Cores are DOM/timer-free. Browser drives via a real 100 ms timer; tests/loopback step a
  virtual clock and relay frames directly — same code path, no optics.

## Verification
- Covered by the 1.5 loopback (`e2e.test.mjs`): byte-exact at all chunk sizes + lossy channel
  recovers by retransmit. ARQ state transitions match the transcribed original.

**Locked in**: `TX_TIMEOUT_MS=2500`, tick 100 ms, stop-and-wait single-outstanding-frame.
