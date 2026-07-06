---
title: "QR Optical Data Transfer — Replica & Performance Study"
status: planning
people: [Seungwoo Shin]
created: 2026-07-06
---

# QR Optical Data Transfer — Replica & Performance Study

## Idea

Faithfully reproduce the browser-based optical file-transfer app at
<https://charlielee206.github.io/QR_FTP/> (an "optical data diode": a file is
streamed between two devices purely through on-screen QR codes and a webcam, no
network), then **measurably improve its throughput** while keeping byte-exact
reconstruction. Success is two-fold: (1) a modular replica whose behavior matches
the original protocol-for-protocol, and (2) an improved version with a documented,
reproducible throughput gain over the replicated baseline (target ≥ 3×), verified
by SHA-256-identical round-trips.

## Plan

1. **Phase 1 — Replica**: rebuild the original app as a modular, dependency-vendored
   web project with identical protocol, handshake, and UI behavior.
2. **Phase 2 — Baseline benchmark**: build a reproducible loopback harness that
   measures the replica's throughput and reliability, establishing the numbers all
   improvements are judged against.
3. **Phase 3 — Performance improvements**: implement and A/B-measure the highest-leverage
   levers (QR capacity / binary encoding, pipelined or rateless transport) until the
   throughput target is met with byte-exact reconstruction.

## Key Results

_(empty — populated as phases complete)_

## Reports

| Topic | Report |
|-------|--------|
| baseline throughput | `reports/baseline/baseline.md` _(pending Phase 2)_ |
| performance study | `reports/performance/performance.md` _(pending Phase 3)_ |
