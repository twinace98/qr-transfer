# Project Status

- **Phase**: Phase 3 — 3.1 ✅ (LZMA kept, lzma-wasm) · **3.2 ✅ PASS** (LT fountain + blind-fire core; peeling + GF(2)-finish decoder, ε mean 2–6 % at k 64–256, locked c=0.1 δ=0.05). **3.3 complete** — combined sweep 36/36 SHA-exact; binary(incompressible) 5.2–16.3× B0, text 57× B0 @0% drop. **Decision gate 2 pending user judgment** (encoder high-version browser check flagged).
- **Target**: Browser optical QR file-transfer app — replica of charlielee206.github.io/QR_FTP, then performance study.
- **Methods**: Vanilla JS (ES modules), `jsQR` (decode), `QRious` (encode); headless Node bench harness in later phases.
- **Infrastructure**: None (client-side web app; runs in browser + local static server).
- **People**: Seungwoo Shin

## How to resume next session

1. Read in order: `CLAUDE.md` (workflow rules) → `Plan.md` (master plan) → this file (`STATUS.md`) → `plans/phase2_baseline.md` + `_impl.md`. (Phase 1 pair archived in `plans/archives/`.)
2. Auto-memory (if any) loads from `~/.claude/projects/-home-swshin-test-qr-transfer/memory/`.
3. **Next action**: Decision gate 2 judgment (posted; awaiting user). If PASS: browser-verify QRious byte-mode at v25+ (or swap encoder), wire blind-fire mode into app UI, phase summary + archive. To run the app: `python3 -m http.server` in `app/`, open `index.html` (transfer) or `loopback.html` (self-test). Tests: `node app/js/protocol.test.mjs && node app/js/e2e.test.mjs && node app/js/compress.test.mjs`.

## Completed

- 2026-07-06: Project bootstrapped from skeleton; reference app protocol decoded into `Plan.md`; `jsQR` + `QRious` vendored to `app/vendor/`.
- 2026-07-07: **Phase 3.2 complete (PASS)** — `fountain.js` + `blindfire-{tx,rx}.js`, 12/12 tests, zero back-channel SHA-exact at drop ≤20 %; ε(k=64/128/256)=5.6/3.4/2.0 % (droplets-only); locked c=0.1 δ=0.05; two bugs fixed (PRNG seeding collapse, peeling-only overhead → GE finish). `data/003-fountain/overhead.json`.
- 2026-07-07: **Phase 3.1 complete (PASS)** — compress layer {none, deflate-raw, LZMA(wasm)}, 7/7 tests, ratios + crossover in `data/002-compression/`. LZMA kept (wins ≥~10 KB mixed content).
- 2026-07-06: **Phase 1 complete** — modular replica (`app/`), all 5 sub-steps PASS. Node + headless-browser loopback confirm SHA-256-exact round-trip for text/binary at chunk sizes 100/250/500/800 and a lossy channel. See `working/phase1_step*.md`.

## Pending (high-level, from `Plan.md`)

- [x] **Phase 1** — modular replica, behavior-faithful to original.
- [ ] **Phase 2** — reproducible benchmark harness + baseline throughput `B0`.
- [ ] **Phase 3** — ≥ 3× throughput over baseline, SHA-256-exact.

## Decisions locked in

- **Code structure** (locked 2026-07-06): modular web project, not single file — enables Phase 3 A/B instrumentation.
- **Dependencies** (locked 2026-07-06): `jsQR` 1.4.0 + `QRious` 4.0.2 vendored locally; Tailwind CDN replaced by local CSS.
- **Phase-3 architecture** (locked 2026-07-06): one-way blind-fire (fountain/LT) as default; original ACK app kept only as baseline.
- **Adaptation** (locked 2026-07-06): one-way self-calibrating preamble; no back-channel negotiation (impossible without a reverse link). Optional two-camera handshake deferred.
- **Levers** (locked 2026-07-06): compression + fountain first; color multiplexing is a gated Phase-4 stretch.
- **Compression** (locked 2026-07-06): LZMA (WASM) from the start, `deflate-raw` as comparison, skip-if-larger flag.

## Open questions (carried forward)

- LT parameters `c`, `δ` for our `k` range — tune empirically in Phase 3.2 vs the harness.
- QR encoder capability (high versions / rMQR / color) — verify in Phase 3.1; may need a non-QRious encoder for the capacity/color levers.
- Optional two-camera ADSL-style handshake mode — deferred; revisit after Phase 3.

## Data Layout

| Directory | Contents |
|-----------|----------|
| `app/` | web application source (Phase 1 deliverable) |
| `data/001-baseline/` | Phase 2 baseline sweep (pending) |
| `data/002…005` | Phase 3/4 runs (compression / fountain / blindfire / color) — pending |

## File index

- `README.md` — human-facing summary
- `Plan.md` — master plan (single source of truth for phase structure)
- `STATUS.md` — this file
- `CLAUDE.md` — workflow rules for the assistant
- `plans/` — phase plan + implementation spec pairs
- `working/` — per-sub-step completion logs
- `data/` — benchmark runs/results (not calculations, in this project)
- `reports/` — periodic topic summaries
- `app/` — web application source
