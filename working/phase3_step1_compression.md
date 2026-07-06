# Phase 3 · Sub-step 3.1 — compression layer

**Date**: 2026-07-07 · **Status**: PASS (pausing per first-sub-step rule)

## What ran
- `app/js/compress.js` — `compress(bytes)` picks smallest of {none, deflate-raw, LZMA} + 1-byte
  method tag; `decompress(method, data)`. deflate = Web `CompressionStream` (browser + Node 18+);
  LZMA = vendored lzma-js via global `LZMA_WORKER`.
- `app/js/lzma-node.mjs` — Node loader (mirrors a browser `<script>` tag).
- Vendored `app/vendor/lzma_worker.js` (lzma-js 2.3.2), **patched**: `decompress` returns raw
  bytes (skips `decode()`'s UTF-8 string coercion) → guarantees lossless `Uint8Array` round-trip.
- Tests `app/js/compress.test.mjs` (7/7); ratios `scripts/bench/compress-ratios.mjs`.

## Result — tests
- 7/7 PASS. Byte-exact round-trip for text / incompressible / empty; **both codecs correct on a
  hostile input** (`ED A0 80…`, the surrogate-like UTF-8 bytes that failed pre-patch). Selection
  rules hold: text→compressed, incompressible→NONE (no inflation ever shipped).

## Result — ratios (`data/002-compression/ratios.json`)
| file | none | deflate | lzma | chosen | saved |
|---|--:|--:|--:|:--|--:|
| repetitive-text | 10240 | **78** | 98 | deflate | 99.2% |
| prose-text | 9420 | **170** | 189 | deflate | 98.2% |
| source-code (tx.js) | 5140 | **1931** | 1952 | deflate | 62.4% |
| incompressible | 10240 | 10245 | 10390 | none | 0% |

## Key finding (needs sign-off)
- **deflate beats LZMA on every ≤10 KB payload tested.** LZMA's larger header/dictionary
  overhead loses at our file sizes; it would only pay off for much larger inputs (≫100 KB),
  which the QR channel never sends (≤ ~50 KB). `compress()` auto-picks the smaller, so LZMA is
  *harmless* but currently *never wins* — it's a 112 KB vendored dependency earning nothing here.

## Assumptions / flags
- LZMA level 6. deflate-raw (no zlib header) for minimal overhead.
- Correctness is guaranteed regardless of codec (SHA-256 gate); this is purely a size/dep call.

**Locked-in (pending sign-off)**: keep LZMA in the auto-select vs drop it to shave the dep.
