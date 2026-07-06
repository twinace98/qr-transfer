// compress-crossover.mjs — deflate vs LZMA winner as a function of file size.
// -> data/002-compression/crossover.json
// Run: node scripts/bench/compress-crossover.mjs
//
// Context (2026-07-07): 3.1 first measured only ≤10 KB payloads, where deflate won, and
// proposed dropping LZMA. This sweep on a realistic mixed corpus (project md + js) shows the
// crossover: LZMA ties/wins by ~10 KB and dominates from ~50 KB, where deflate's 32 KB window
// stops seeing long-range redundancy. Decision: KEEP LZMA (lzma-wasm) in the auto-select.
// Caveat: sizes above the base corpus (~40 KB) are built by repetition, which flatters LZMA;
// the ≤40 KB points are repetition-free and already show the tie/crossover.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureLzma } from '../../app/js/compress.js';
import { compress as wasmCompress } from '../../app/vendor/lzma-wasm.esm.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.resolve(ROOT, 'data/002-compression');
fs.mkdirSync(OUT, { recursive: true });

const deflate = async (b) => new Uint8Array(await new Response(
  new Blob([b]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
await ensureLzma();
const lzma = (b) => Uint8Array.from(wasmCompress(b, 6));

// Realistic mixed corpus: project docs + source files.
let corpus = '';
for (const f of ['Plan.md', 'CLAUDE.md', 'STATUS.md',
  'app/js/protocol.js', 'app/js/tx.js', 'app/js/rx.js', 'app/js/main.js']) {
  corpus += fs.readFileSync(path.join(ROOT, f), 'utf8') + '\n';
}
const base = Buffer.from(corpus, 'utf8');

const sizes = [10, 25, 40, 50, 100, 250, 500, 1000, 2000].map((k) => k * 1024);
const rows = [];
for (const S of sizes) {
  const reps = Math.ceil(S / base.length);
  const blob = new Uint8Array(Buffer.concat(Array(reps).fill(base)).subarray(0, S));
  const d = (await deflate(blob)).length;
  const l = lzma(blob).length;
  rows.push({
    KB: S / 1024, repetitionFree: S <= base.length,
    deflate: d, lzma: l, winner: l < d ? 'lzma' : 'deflate',
    lzmaVsDeflatePct: +((100 * (l - d)) / d).toFixed(1),
  });
}

fs.writeFileSync(path.join(OUT, 'crossover.json'), JSON.stringify({
  note: 'deflate-raw (CompressionStream) vs LZMA (lzma-wasm level 6) on mixed md+js corpus; ' +
        `base corpus ${base.length} B, sizes above it are repeated (flatters LZMA).`,
  baseCorpusBytes: base.length,
  rows,
}, null, 2) + '\n');

console.log(`base corpus ${base.length} B -> wrote data/002-compression/crossover.json`);
console.table(rows);
