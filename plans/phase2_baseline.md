# Phase 2 — Baseline benchmark — Phase Plan

## Goal

Build a headless, deterministic harness that drives the Phase-1 replica's encode/decode path
through a configurable **channel model** (frame rate, drop probability, bytes-per-frame from
real QR capacity) and reports throughput (effective bytes/s), frames-per-file, and success
rate. Sweep the four chunk sizes to establish the baseline number `B0` against which every
Phase-3/4 improvement is measured. Done = `B0` recorded and reproducible.

## Scope

- **In**: a Node harness that reuses `app/js/{protocol,tx,rx}.js` unchanged; a channel model
  (drop/fps/latency); a QR-capacity table so "bytes/frame" is realistic; a seeded RNG for
  determinism; SHA-256 assertion on reassembly; CSV/JSON output under `data/001-baseline/`.
- **Out**: any protocol change; compression; fountain; color. Phase 2 measures the *replica
  as built* — it must not "improve" anything, or `B0` is meaningless.

## Implementation spec

Detailed model + parameters in [`phase2_baseline_impl.md`](phase2_baseline_impl.md).

## Sub-steps (mirror `Plan.md` §2.1–2.2)

| # | Sub-step | Success criterion |
|---|----------|-------------------|
| 2.1 | Channel model + harness (`scripts/bench/`) | Deterministic (same seed → identical output); reassembly SHA-256-exact; emits throughput/frames/success. |
| 2.2 | Baseline sweep | Chunk {100,250,500,800} × drop {0,1%,5%} recorded to `data/001-baseline/`; `B0` computed. |

## Planned `data/` directories

- `data/001-baseline/` — sweep results (CSV + a JSON with the `B0` value and channel assumptions).

**Execution order**: 2.1 → (pause after 2.1, per first-sub-step rule) → 2.2 → Decision gate 1.

## Planned `working/` logs

- `working/phase2_step1_harness.md`
- `working/phase2_step2_baseline-sweep.md`

## Periodic summary locations

- `reports/baseline/baseline.md` — created/updated at Decision gate 1 (Key Finding = `B0`).

## Approval points

- **Before Phase 2 kickoff**: this pair approved. ← current gate.
- **After 2.1**: pause to confirm the channel model + determinism before running the full sweep.
- **Decision gate 1 (after 2.2)**: `B0` + reproducibility reviewed before Phase 3.

## Exit criterion

- Harness deterministic per seed AND reassembly SHA-256-exact.
- `B0` (bytes/s @ 0% drop, 250 B chunk) recorded in `reports/baseline/baseline.md`, with the
  channel-model assumptions stated alongside it.
