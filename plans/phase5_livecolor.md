# Phase 5 — Live color UI (both modes) — Phase Plan

## Goal
Bring the Phase-4 color engine (6 Gray-coded planes, pedestal-64, SIC + per-frame strip
calibration) from loopback to the LIVE app: a color toggle in the unified UI that works for
**both** transports — blind-fire (6 packets/frame) and the replica (windowed ×6 chunks/frame,
flag-gated protocol variant; plain replica stays faithful when color is off).

## Sub-steps
| # | Sub-step | Success criterion |
|---|----------|-------------------|
| 5.1 | Color TX composer in the app | Shared canvas renders: calibration strip border + 6-plane color QR. Blind-fire: 6 packets/frame. Replica-color: 6-chunk window per frame (ACK-advanced). Headless smoke: frame renders, strip patches at spec'd positions. |
| 5.2 | Live RX: alignment + calibrated decode | Guide-box region → strip sample → estimateModel per frame → decodeSIC → majority filter → jsQR ×6 → transport. Headless loopback (canvas→canvas + synthetic channel) SHA-exact for BOTH modes. |
| 5.3 | Real-device validation | User-run: phone/laptop pair over the Pages deploy; record achieved fps/planes/σ̂; adjust pedestal/EC from measured σ if needed. |

**Gate 4 (after 5.3)**: live color transfer SHA-256-exact on real hardware for at least one
mode; measured σ̂ recorded in `data/005-color/measured-channel.json`. On fail at 5.3 with
loopback green: document the real-optics gap (chroma MTF / alignment) and keep color as an
experimental flag.

## Data / logs
`data/006-livecolor/` · `working/phase5_step{1,2,3}_*.md` · report → `reports/performance/`.

## Approval
Kickoff = user-directed 2026-07-07 ("Phase 5로 plan pair를 만들어 진행"). Gate 4 = user.
