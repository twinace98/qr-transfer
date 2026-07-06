# Phase 3 — One-way blind-fire transport — Implementation Spec

Phase plan: [`phase3_blindfire.md`](phase3_blindfire.md)

> Living document — fill locked-in codec/params/overhead after each sub-step.

## Packet header (blind-fire, 16 bytes, from the perf design)

```
[ magic(2) | file_id(2) | k(2) | file_len(4) | seed(4) | CRC16(2) ] payload(sB)
```
- `magic` — protocol tag (reject foreign QR). `file_id` — so a receiver can ignore a second file.
- `k`, `file_len` on **every** packet → receiver bootstraps from any frame (no INIT needed).
- `seed` — PRNG seed; ≥ `SYSTEMATIC_BASE` means "raw block (seed−BASE)", else an LT droplet.
- `CRC16` over header+payload → drop corrupted packets before the decoder (lets QR EC drop to L).
- Encoded to the QR in **byte mode** (binary), not base64 — payload bytes go in raw.

---

## Sub-step 3.1 — Compression layer (`app/js/compress.js`)

**Target**: shrink the source before chunking; whole-file (not per-chunk) compression.

**Contract**:
- `async compress(bytes) -> { method: 0|1|2, data: Uint8Array }` where 0=none, 1=deflate-raw,
  2=LZMA; returns the **smallest**; already-compressed input naturally selects 0.
- `async decompress(method, data) -> Uint8Array`.
- `method` travels as a small header flag (2 bits is enough; store 1 byte for simplicity).

**Codecs**:
- deflate-raw: browser `CompressionStream('deflate-raw')`; Node `zlib.deflateRaw` — same bytes.
- LZMA: a portable codec usable in **both** browser and Node (vendored, no build step). Decision
  recorded here after the availability check in 3.1 (pure-JS LZMA vs WASM xz). WASM preferred for
  speed if it vendors cleanly; pure-JS acceptable for our ≤ tens-of-KB files.

**Pass criterion**: `decompress(compress(x)) === x` byte-exact for text, binary, and empty;
`method` picks the smaller output; incompressible input → method 0 (no inflation shipped).
Report ratio for text-10k and binary-10k → `data/002-compression/ratios.json`.

**Data location**: `data/002-compression/`. **Output log**: `working/phase3_step1_compression.md`.

**Locked-in**: LZMA codec = (pending 3.1); ratios = (pending).

---

## Sub-step 3.2 — LT fountain + blind-fire core (`app/js/fountain.js`, `blindfire-{tx,rx}.js`)

**Target**: rateless one-way transport.

**`fountain.js`** (from the perf design):
- `robustSolitonCDF(k, c, delta)`, `xorshift32(seed)`, `neighborsFromSeed(seed, k, cdf)`.
- `LTEncoder`: systematic first pass (seeds `SYSTEMATIC_BASE..+k-1` = raw blocks), then infinite
  random droplets (seed 1,2,3,…), each = XOR of `neighborsFromSeed`.
- `LTDecoder`: peeling — degree-1 resolves a block, substituted out of pending droplets, cascades;
  `.done` when `solved === k`.

**`blindfire-tx.js`**: compress → split into `k` fixed-size blocks → build 16 B header packets →
emit forever (systematic pass first). No ACK handling. `blindfire-rx.js`: parse header, CRC-check,
feed decoder, progress = `solved/k`; on `done`, `decompress` → Blob.

**Pass criterion**: over the harness with **no ACK channel**, decoder reconstructs SHA-256-exact;
measure droplets-received / k = overhead ε at k ∈ {realistic range}; target ε < ~15%. Sweep drop
rates to confirm one-way robustness (more drops → more droplets, still completes, no retransmit
logic).

**Data location**: `data/003-fountain/`. **Output log**: `working/phase3_step2_fountain.md`.

**Locked-in**: `c`, `delta`, `SYSTEMATIC_BASE`, block size = (pending 3.2).

---

## Sub-step 3.3 — Preamble + capacity + combine

**Target**: hit the ≥ 3× target and make it one-way-usable.

- **Self-calibrating preamble** (one-way): a fixed leading pattern the receiver locks onto —
  for B/W this is mainly a known sync/capability frame (carries k/file_len/version); the color
  calibration strip is Phase 4. Broadcast periodically so a late-joining receiver can start.
- **Capacity**: byte-mode payload (already in the header design) + **EC level L** + tune QR
  version for bytes/frame. **Confirm QRious supports the target version**; if not, swap encoder
  (candidate: a byte-mode QR encoder that reaches v25+). Record the encoder decision.
- **Combine**: best compression × capacity × fountain; full sweep on the harness vs `B0`.

**Pass criterion (Decision gate 2)**: throughput ≥ 3× `B0` (≥ 4050 B/s) at Phase-2 fps/chunk
basis AND all sweep cases SHA-256-exact.

**Data location**: `data/004-blindfire/`. **Output log**: `working/phase3_step3_preamble-capacity.md`.

**Locked-in**: encoder, QR version, EC level, achieved factor = (pending 3.3).
