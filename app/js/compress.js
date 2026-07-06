// compress.js — whole-file compression layer for blind-fire (Phase 3.1).
//
// Picks the SMALLEST of {none, deflate-raw, LZMA} and returns a 1-byte method tag so the
// receiver knows how to inflate. Already-compressed inputs naturally select `none` (no
// inflation is ever shipped). Portable across browser and Node 18+:
//   - deflate-raw: Web `CompressionStream` (native in both)
//   - LZMA: `lzma-wasm` (Rust→WASM, inlined; clean Uint8Array API; loads in both)
//
// Note (measured 3.1, crossover sweep 2026-07-07): on realistic mixed content LZMA ties/wins
// from ~10 KB and dominates ≥50 KB (deflate's 32 KB window misses long-range redundancy);
// deflate only wins tiny/trivially-repetitive payloads. Decision: KEEP LZMA (lzma-wasm) in the
// auto-select. See data/002-compression/crossover.json. Correctness is codec-independent
// (SHA-256 gate).

import { compress as wasmCompress, decompress as wasmDecompress, initWasm }
  from '../vendor/lzma-wasm.esm.js';

export const METHOD = { NONE: 0, DEFLATE: 1, LZMA: 2 };
const LZMA_LEVEL = 6; // 0..9

// --- deflate-raw (Web Streams, portable) ---
async function deflateRaw(bytes) {
  const cs = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(cs).arrayBuffer());
}
async function inflateRaw(bytes) {
  const ds = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(ds).arrayBuffer());
}

// --- LZMA (lzma-wasm) — init once, then synchronous calls ---
let _wasmReady = null;
export function ensureLzma() {
  if (!_wasmReady) _wasmReady = initWasm();
  return _wasmReady;
}
async function lzmaCompress(bytes) {
  await ensureLzma();
  return Uint8Array.from(wasmCompress(bytes, LZMA_LEVEL));
}
async function lzmaDecompress(bytes) {
  await ensureLzma();
  return Uint8Array.from(wasmDecompress(bytes));
}

/**
 * Compress `bytes` (Uint8Array) with every codec; return the smallest with its method tag.
 * @returns {Promise<{method:number, data:Uint8Array}>}
 */
export async function compress(bytes) {
  const candidates = [{ method: METHOD.NONE, data: bytes }];
  try { candidates.push({ method: METHOD.DEFLATE, data: await deflateRaw(bytes) }); } catch { /* skip */ }
  try { candidates.push({ method: METHOD.LZMA, data: await lzmaCompress(bytes) }); } catch { /* skip */ }
  candidates.sort((a, b) => a.data.length - b.data.length);
  return candidates[0];
}

/** Inverse of `compress`. */
export async function decompress(method, data) {
  if (method === METHOD.NONE) return data instanceof Uint8Array ? data : new Uint8Array(data);
  if (method === METHOD.DEFLATE) return inflateRaw(data);
  if (method === METHOD.LZMA) return lzmaDecompress(data);
  throw new Error(`unknown compression method ${method}`);
}
