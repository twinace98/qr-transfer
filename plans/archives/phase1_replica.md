# Phase 1 — Replica — Phase Plan

## Goal

Rebuild <https://charlielee206.github.io/QR_FTP/> as a modular, locally-vendored web
project whose behavior is faithful to the original: same wire protocol (6 frame types),
same stop-and-wait ARQ handshake with 2500 ms salt-retry, same base64 chunking with
selectable sizes (100/250/500/800), same QRious (size 300, level M) + jsQR (`dontInvert`)
setup, and the same UI states (Transmit/Receive tabs, progress bars, camera switch,
image-upload fallback, download). Done = a real file transferred between two browser
contexts reconstructs with an identical SHA-256.

## Scope

- **In**: faithful reimplementation split into ES modules; local vendoring of jsQR/QRious;
  local CSS reproducing the dark UI; a small in-browser loopback shim to verify end-to-end
  without pointing a camera at a screen.
- **Out** (later phases): binary/byte-mode payloads, windowed/rateless transport, any QR
  capacity tuning, the headless Node benchmark harness, throughput optimization. Phase 1
  must stay behaviorally identical to the original — no "improvements" sneak in here.

## Implementation spec

Detailed module contracts, frame grammar, and file paths live in
[`phase1_replica_impl.md`](phase1_replica_impl.md).

## Sub-steps (mirror `Plan.md` §1.1–1.5)

| # | Sub-step | Success criterion |
|---|----------|-------------------|
| 1.1 | `protocol.js` — frames + salt | All 6 frames build and parse back to equal fields; `generateSalt()` returns 6-char base36. |
| 1.2 | `qr.js` + `camera.js` | QR display updates on value change; jsQR scan loop with `dontInvert`; image-upload fallback decodes a QR image. |
| 1.3 | `tx.js` + `rx.js` | Stop-and-wait state machines reproduce INIT/SENDING/END and WAIT_INIT/RECEIVING/DONE with 2500 ms timeout + ACK-driven advance. |
| 1.4 | `index.html` + `css` + `main.js` | Tabs, file input, chunk-size dropdown, progress bars, download, camera switch wired; visually faithful. |
| 1.5 | End-to-end verification | Two-context loopback transfer → received SHA-256 == source SHA-256. |

## Planned `data/` directories

- None for Phase 1 (no benchmark runs yet). Source lives in `app/`. Verification artifacts
  (test file + hashes) recorded in the sub-step 1.5 `working/` log.

**Execution order**: 1.1 → 1.2 → 1.3 → 1.4 → 1.5 (linear; each module imports the prior).

## Planned `working/` logs

- `working/phase1_step1_protocol.md`
- `working/phase1_step2_qr-camera.md`
- `working/phase1_step3_tx-rx.md`
- `working/phase1_step4_ui.md`
- `working/phase1_step5_e2e-verify.md`

## Periodic summary locations

- None in Phase 1 (no `reports/` topic until Phase 2 baseline). Phase-1 completion is
  recorded in `STATUS.md` and the 1.5 working log.

## Approval points

- **Before Phase 1 kickoff**: this file + `phase1_replica_impl.md` approved. ← current gate.
- **At 1.3 lock-in**: confirm the ARQ state machine matches the original before wiring UI
  (a wrong protocol here invalidates all downstream benchmarking).
- **At Phase 1 completion**: 1.5 SHA-256 round-trip verified, then move plan pair to
  `plans/archives/`.

## Exit criterion

- File round-trips between two browser contexts with identical SHA-256.
- UI passes through the same state sequence as the original (Idle → INIT/ACK_INIT →
  DATA/ACK per chunk → END/ACK_END → download).
- `STATUS.md` updated; plan pair archived.
