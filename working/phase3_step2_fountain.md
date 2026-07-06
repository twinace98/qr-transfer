# Phase 3 · Sub-step 3.2 — LT fountain + blind-fire core

**Date**: 2026-07-07 · **Status**: PASS

## What ran
- `app/js/fountain.js` — `xorshift32` (seed avalanched via murmur fmix32), `robustSolitonCDF`,
  `neighborsFromSeed` (seed-only neighbor derivation, tx/rx symmetric), `LTEncoder`
  (systematic pass `SYSTEMATIC_BASE+i` → infinite droplets seed 1,2,…), `LTDecoder`
  (peeling + **GF(2) Gaussian-elimination finish** = inactivation decoding).
- `app/js/blindfire-tx.js` — 16 B header `[magic|file_id|k|file_len|seed|CRC16]` + payload,
  CRC16-CCITT over header+payload (skipping the CRC field); `BlindFireSender.create()` =
  compress → 1-byte method tag → split k blocks → LT. Compression method byte travels as
  byte 0 of the transmitted stream (header stays 16 B).
- `app/js/blindfire-rx.js` — `parsePacket` (magic + CRC gate), `BlindFireReceiver`
  bootstraps from ANY frame (k/file_len on every packet), ignores foreign file_ids,
  `result()` = join → strip method byte → decompress.
- Tests `app/js/fountain.test.mjs` (12/12); bench `scripts/bench/fountain-overhead.mjs`
  → `data/003-fountain/overhead.json`.

## Bugs found & fixed
1. **Weak PRNG seeding collapsed the degree distribution** — consecutive droplet seeds
   (1,2,3,…) gave nearly identical first xorshift32 outputs → every droplet degree-2 →
   peeler never started (0/64 solved at 8× overhead). Fix: murmur-fmix32 avalanche of the
   seed before xorshift; degree histogram matches robust soliton afterwards.
2. **Vanilla peeling misses the ε target at our k** — measured mean ε 24–55 % (k 16–256,
   droplets-only), consistent with LT theory (ε→0 only for k in the thousands). Fix:
   GF(2) elimination over the residual system once received ≥ unknowns (standard
   LT/Raptor "inactivation decoding"), retried every ~1 % of k packets.

## Results
- **Tests 12/12 PASS**: determinism/symmetry of seed→neighbors; CDF sanity; systematic pass
  decodes with exactly k packets (ε = 0); droplets-only decode; CRC gates corrupted
  header/payload and foreign magic; end-to-end blind-fire (text+binary × drop {0, 5, 20 %})
  **SHA-256-exact with zero back-channel**; late-join (whole systematic pass missed) decodes.
- **LT parameter scan** (droplets-only, GE finish, 100 trials/case): best **c = 0.1, δ = 0.05**.
- **Overhead ε at locked params** (droplets-only = late-join worst case, 200 trials):

  | k | mean ε | p95 ε | fails |
  |--:|-------:|------:|------:|
  | 16 | 15.8 % | 43.8 % | 0 |
  | 32 | 10.2 % | 28.1 % | 0 |
  | 64 | 5.6 % | 17.2 % | 0 |
  | 128 | 3.4 % | 8.6 % | 0 |
  | 256 | 2.0 % | 3.9 % | 0 |

  → **target ε < ~15 % met** for the realistic k range (k ≥ 32; a ≤ 10 KB file at 100 B
  blocks is k ≤ 103, and 3.3's capacity lever pushes block size up, not down). Receivers
  that catch the systematic pass see ε ≈ 0 at low drop.

## Assumptions / flags
- Block size for tests/bench = 100 B (protocol supports any; 3.3 tunes it with QR capacity).
- Compression method tag = byte 0 of the transmitted stream (not in the 16 B header).
- GE finish is O(m³) bitwise at stall time — instant at our k (≤ a few hundred).

**Locked-in**: `c = 0.1`, `δ = 0.05`, `SYSTEMATIC_BASE = 0x80000000`, header = 16 B as spec'd,
CRC16-CCITT (0x1021/0xFFFF), decoder = peeling + GE finish. → 3.3 (preamble + capacity + combine).
