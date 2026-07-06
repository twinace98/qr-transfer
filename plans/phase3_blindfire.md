# Phase 3 — One-way blind-fire transport — Phase Plan

## Goal

Replace the ACK-gated replica with a **one-way, rateless** pipeline —
**compress → chunk → LT-encode → broadcast** — decoded by a peeling decoder with no reverse
channel (sender needs no camera). Each lever is measured against `B0 = 1350 B/s` on the
**unchanged Phase-2 harness**; the combined result must reach **≥ 3× B0 (≥ 4050 B/s)** at the
same fps/chunk basis, with every run **SHA-256-exact**.

## Scope

- **In**: `compress.js` (LZMA + deflate-raw + none, pick smallest); `fountain.js` (robust-soliton
  LT: systematic pass → droplets, seed-only neighbors, peeling decoder); a blind-fire transport
  (`blindfire-tx.js` / `blindfire-rx.js`) with the 16-byte packet header and QR EC→L; a
  one-way self-calibrating preamble; capacity tuning (byte-mode payload, higher QR version);
  a `--mode` flag so the app runs replica **or** blind-fire; harness extension to measure the
  new mode (no ACK slots).
- **Out**: color multiplexing (Phase 4); the optional two-camera handshake mode (deferred);
  changing the Phase-2 baseline numbers.

## Implementation spec

Concrete params, header layout, and codecs in [`phase3_blindfire_impl.md`](phase3_blindfire_impl.md).

## Sub-steps (mirror `Plan.md` §3.1–3.3)

| # | Sub-step | Success criterion |
|---|----------|-------------------|
| 3.1 | Compression layer | `compress`/`decompress` round-trip byte-exact; picks smaller of {none, deflate-raw, LZMA}; 1-bit flag; already-compressed input falls back to none. Ratio reported per file type. |
| 3.2 | LT fountain + blind-fire core | Decoder reconstructs from any `k(1+ε)` droplets, **zero back-channel**; overhead ε measured (target < ~15% at our k); SHA-256-exact; harness measures blind-fire mode (no ACK slots). |
| 3.3 | Preamble + capacity + combine | One-way self-calibrating preamble broadcast; byte-mode payload + EC-L + tuned QR version (encoder capability confirmed/swapped); best compression × capacity × fountain combined. |

## Planned `data/` directories

- `data/002-compression/` — 3.1 ratios (deflate vs LZMA vs none, per file type)
- `data/003-fountain/` — 3.2 overhead ε vs k, decode success
- `data/004-blindfire/` — 3.3 combined sweep vs `B0`

**Execution order**: 3.1 → (pause after 3.1, first-sub-step rule) → 3.2 → 3.3 → Decision gate 2.

## Planned `working/` logs

- `working/phase3_step1_compression.md`
- `working/phase3_step2_fountain.md`
- `working/phase3_step3_preamble-capacity.md`

## Periodic summary locations

- `reports/performance/performance.md` — created at 3.2, updated at 3.3 / Decision gate 2.

## Approval points

- **Before Phase 3 kickoff**: this pair approved. ← current gate.
- **After 3.1**: pause to confirm codec choice + measured ratios before building the fountain.
- **After 3.2 lock-in**: confirm the LT parameters (c, δ) + overhead before capacity tuning.
- **Decision gate 2 (after 3.3)**: ≥ 3× `B0` AND SHA-256-exact — never self-approve.

## Exit criterion

- Blind-fire transfer reconstructs SHA-256-exact from a one-way stream (no back-channel).
- Combined throughput ≥ 3× `B0` (≥ 4050 B/s) at the fps/chunk basis of Phase 2.
- `reports/performance/performance.md` up to date; plan pair archived.
