# Phase 1 · Sub-step 1.1 — protocol.js (frames + salt)

**Date**: 2026-07-06 · **Status**: PASS

## What ran
- Implemented `app/js/protocol.js` (pure ESM): `generateSalt`, 6 frame builders, `parseFrame`, `IDLE_VALUE`.
- Unit test `app/js/protocol.test.mjs` → `node app/js/protocol.test.mjs`.

## Result
- 6/6 test groups pass: salt format `^[0-9a-z]{1,6}$`; all 6 frame types build→parse to equal fields (incl. DATA payload containing `+ / =`); junk strings rejected → `null`.

## Notes
- Payload kept as the last field; DATA parser rejoins any stray `|` via `parts.slice(5).join('|')` (defensive; base64 has no `|`).

**Locked in**: grammar transcribed verbatim from original (see `plans/phase1_replica_impl.md`).
