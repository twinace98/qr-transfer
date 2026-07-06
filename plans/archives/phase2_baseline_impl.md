# Phase 2 — Baseline benchmark — Implementation Spec

Phase plan: [`phase2_baseline.md`](phase2_baseline.md)

> Living document — fill locked-in values (esp. `B0`) after the sweep runs.

## Channel model (shared by all phases)

A transfer's wall-clock is modeled, not measured on real optics. Per displayed frame:
- **Frame period** `T = 1/fps` (default `fps = 5`, matching a conservative
  scan-decode-per-frame rate; a tunable, not a claim).
- **Drop**: each displayed frame is lost with probability `p` (seeded Bernoulli). A dropped
  Tx frame → no ACK → Tx times out after `TX_TIMEOUT_MS` and re-shows (the replica's real
  behavior). ACK channel assumed reliable in the baseline (the reverse QR is symmetric; a
  lossy-ACK variant is a later sensitivity check, not baseline).
- **Effective throughput** = `file_bytes / (total_displayed_frames × T)`.
- Stop-and-wait means each successful chunk costs ≥ 1 round of `T` plus any timeout waits on
  drops; the harness counts displayed frames exactly as the Phase-1 loopback already does.

**Determinism**: single seed drives both the drop RNG and any salt-independent choices;
`generateSalt` is irrelevant to correctness so it may stay random, but the frame *count* and
reassembly must be identical across runs with the same seed and `p`. Verify by running twice.

## QR capacity note (bytes/frame realism)

The replica sends base64 *characters* per frame (chunkSize ∈ {100,250,500,800}). Alphanumeric
QR at EC-M: chunkSize 800 ≈ QR version ~16–17. Record the QR version each chunkSize implies
(via QRious or a capacity table) so Phase 3's "bytes/frame" gains (binary byte-mode, EC-L,
higher version) are comparable. This is a *reported column*, not a gate.

---

## Sub-step 2.1 — Channel model + harness

**Target**: `scripts/bench/bench.mjs` (+ `channel.mjs`, `capacity.mjs`).

**Contract**:
- `runCase({fileBytes, chunkSize, fps, dropProb, seed})` → `{ okSha, bytes, frames, seconds,
  bytesPerSec, retransmits, qrVersion }`.
- Reuses `app/js/{protocol,tx,rx}.js` verbatim; drives them with a virtual clock + seeded drop
  channel (generalize the existing `e2e.test.mjs` loopback).
- Asserts `sha256(reassembled) === sha256(source)`; sets `okSha`.

**Pass criterion**: two runs with identical `{seed, dropProb}` produce identical
`{frames, okSha, bytes}`; `okSha === true`. (Determinism + correctness.)

**Data location**: `scripts/bench/` (code); no data yet.

**Output log**: `working/phase2_step1_harness.md`.

**Locked-in value**: (pending) — fps default, seed default.

---

## Sub-step 2.2 — Baseline sweep

**Target**: run the grid and record `B0`.

**Sweep**: chunkSize ∈ {100,250,500,800} × dropProb ∈ {0, 0.01, 0.05}, fixed seed, a fixed
representative payload set (e.g. a ~10 KB text and a ~10 KB pre-compressed binary — same files
Phase 3 will reuse).

**Pass criterion**: all cases `okSha === true`; `B0` = bytesPerSec at `{chunkSize:250,
dropProb:0}` recorded. Determinism re-confirmed on one spot-check case.

**Data location**: `data/001-baseline/sweep.csv` + `data/001-baseline/b0.json`
(`{B0, fps, seed, files, assumptions}`).

**Output log**: `working/phase2_step2_baseline-sweep.md`.

**Locked-in value**: `B0 = (pending)` bytes/s.
