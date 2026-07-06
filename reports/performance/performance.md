# Performance Study — Phase 3 (one-way blind-fire transport)

*Periodic report; Phase-3 sweep complete 2026-07-07. Decision gate 2: PASS (user-approved).*

## Key Finding

Replacing the stop-and-wait ACK replica with **compress → LT-fountain → blind-fire** (zero
back-channel) reaches **5.2–16.3× B0 on incompressible data** and **57× B0 on text** at 0 %
drop on the unchanged Phase-2 harness (B0 = 1350 B/s; factors are fps-invariant). Every one
of the 36 sweep cases reconstructs **SHA-256-exact**, including 5 % frame drop and
late-joining receivers, with **no retransmit logic at all**.

## Method

- Pipeline: whole-file compression ({none, deflate-raw, LZMA-wasm}, smallest wins, 1-byte tag)
  → k fixed blocks → robust-soliton LT (c=0.1, δ=0.05; systematic pass then droplets;
  seed-only neighbor derivation) → 16 B header `[magic|file_id|k|file_len|seed|CRC16]` per
  frame. Decoder: peeling + GF(2)-elimination finish (inactivation). Preamble/metadata frame
  (seed 0) every 32 frames carries fileName/mime.
- Same Phase-2 channel model (fps 15 slots, seeded Bernoulli drop); all slots are Tx displays
  (one-way ⇒ zero ACK slots). QR version from EC-L byte capacity (CRC16 pre-gates corruption).
- Benches: `scripts/bench/{fountain-overhead,blindfire-bench,compress-*}.mjs`;
  data: `data/002-compression/`, `data/003-fountain/`, `data/004-blindfire/`.

## Results

| lever | result |
|---|---|
| Compression | deflate wins ≤10 KB simple payloads; **LZMA wins ≥~10 KB mixed content** (crossover.json) — auto-select keeps both |
| LT overhead ε (droplets-only worst case) | k=64: 5.6 %, k=128: 3.4 %, k=256: 2.0 % (mean; target <15 % met) |
| Blind-fire @0 % drop (binary-10k, incompressible) | block 500 (QR v15-L): **5.2× B0** · block 800 (v20): 8.1× · block 2000 (v33): 16.3× |
| Blind-fire @0 % drop (text-10k) | **57× B0** (compression 10 KB→107 B dominates) |
| Robustness | 5 % drop: completes one-way, SHA-exact; late join (systematic pass missed): decodes from droplets |

## Discussion

- The ACK-slot elimination alone doubles throughput; capacity (EC M→L + larger frames) and
  compression multiply it. The fountain makes loss a *rate* cost, not a *protocol* cost.
- **Open item carried to closeout**: QRious byte-mode at v25–40 is harness-assumed, not yet
  browser-verified (v15–20 results already clear the gate). Verify or swap encoder during app
  integration; bit-plane color multiplexing (Phase 4) reuses the same verification page.
