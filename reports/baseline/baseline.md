# Baseline Throughput — Phase 2

## Key Finding

The replicated original app (stop-and-wait ACK) has a modeled headline throughput of
**`B0` = 1350 B/s** (text-10k, chunkSize 250, 0% drop, fps 15). All 72 sweep cases reconstruct
**SHA-256-exact** and the harness is **deterministic** per seed. Because the model is relative,
the Phase-3 ≥ 3× target is **fps-invariant** — raising fps scales `B0` and every variant
equally.

## Method

- Harness `scripts/bench/` drives the unmodified `app/js/{protocol,tx,rx}.js` through a virtual
  clock + seeded Bernoulli drop channel. No optics.
- **Slot model**: wall-clock = `(txSlots + ackSlots) / fps`. Stop-and-wait spends a DATA slot +
  an ACK slot per chunk (both screens alternate showing QRs). A one-way transport will emit no
  ACK slots — this is where blind-fire earns ~2×.
- Grid: file {text-10k, binary-10k} × chunk {100,250,500,800} × drop {0,1%,5%} × fps {10,15,30};
  seed 20260706. Raw: `data/001-baseline/sweep.csv`; headline: `data/001-baseline/b0.json`.

## Results (text-10k, fps 15)

| chunk | drop | total slots | retx | B/s | QR ver |
|------:|-----:|------------:|-----:|----:|-------:|
| 100 | 0% | 278 | 0 | 554 | 8 |
| 250 | 0% | 114 | 0 | **1350** | 12 |
| 500 | 0% | 60 | 0 | 2565 | 18 |
| 800 | 0% | 40 | 0 | 3848 | 23 |
| 250 | 5% | 115 | 1 | 1338 | 12 |
| 800 | 5% | 41 | 1 | 3754 | 23 |

- Larger chunks → fewer slots → higher throughput (fewer per-frame overheads), at the cost of a
  denser QR (v8→v23). v23 is well within v40, so cs=800 is feasible in principle.
- Drop rate barely moves throughput at these small file sizes (a handful of retransmits over
  ~40–280 slots). Loss matters more for large files / high drop — a later sensitivity axis.

## Discussion

- **`B0` anchor = 1350 B/s.** Phase-3 gate: ≥ 3× → **≥ 4050 B/s** at the same fps/chunk basis.
- Where the Phase-3 gains come from, against this baseline:
  1. **Remove ACK slots** (blind-fire): halves slot count → ~2× immediately (114 → ~57).
  2. **Compression**: fewer source bytes to send (text compresses well; incompressible binary
     is the control that shows the floor).
  3. **Capacity** (binary byte-mode instead of base64 chars, EC-L instead of M): more payload
     bytes per QR/slot.
  4. **Fountain**: removes retransmit/timeout waste on lossy channels; enables (1).
- Absolute B/s here is only as real as `fps` and the reliable-ACK assumption; the **factor** is
  the trustworthy number. All Phase-3 variants will be measured on this exact harness.
