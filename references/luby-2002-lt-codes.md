# Luby (2002) — LT Codes

**Source**: M. Luby, "LT Codes," Proc. 43rd FOCS, 2002. (PDF: pending — add if we need proofs.)

**Why here**: the fountain code chosen for Phase 3.2 (one-way blind-fire transport).

## Key points (for our use)
- **Rateless erasure code**: from `k` source blocks, generate *unlimited* encoded droplets.
  Any `k(1+ε)` received droplets reconstruct the file — no per-block ACK/retransmit needed.
  This is exactly what enables **one-way blind-fire** (no reverse channel).
- **Encoding**: pick degree `d` from a distribution; XOR `d` randomly-chosen source blocks.
- **Decoding (peeling)**: a degree-1 droplet fixes one block; substitute it out of all
  droplets that include it; repeat. Cascades to completion.
- **Robust Soliton distribution** μ(d) = (ρ(d)+τ(d))/Z with spike near `k/R`,
  `R = c·ln(k/δ)·√k`. For `k` in the low hundreds (our case), overhead ε ≈ 5–15%.
- **Seed-only signalling**: sender transmits a PRNG seed, not the neighbor list; receiver
  replays the same PRNG (xorshift32) to recover degree + neighbor indices. Header stays tiny.

## Our design choices (from the perf discussion, 2026-07-06)
- **Systematic first pass**: send the `k` raw blocks first (seed = SYSTEMATIC_BASE+i); on a
  clean channel the transfer finishes with zero coding overhead, droplets only fill gaps.
- **16-byte packet header**: `[magic(2) | file_id(2) | k(2) | file_len(4) | seed(4) | CRC16(2)]`
  — carries `k`/`file_len` on *every* packet so the receiver bootstraps from any frame.
- **CRC16 per packet**: drop corrupted droplets before the decoder → lets us lower QR EC to L.

## Open questions
- Exact `c`, `δ` for our `k` range — tune empirically in 3.2 against the Phase-2 harness.
- Precoding (LDPC) for RaptorQ-style linear-time decode — not needed at our `k`; see
  [gauthier-2011-raptorq](gauthier-2011-raptorq.md) for the heavier alternative.
