// compress-ratios.mjs — Phase 3.1 ratio report -> data/002-compression/ratios.json
// Run: node scripts/bench/compress-ratios.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { METHOD, ensureLzma } from '../../app/js/compress.js';
import { compress as wasmCompress } from '../../app/vendor/lzma-wasm.esm.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../../data/002-compression');
fs.mkdirSync(OUT, { recursive: true });

const deflate = async (b) => new Uint8Array(await new Response(
  new Blob([b]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
await ensureLzma();
const lzma = async (b) => Uint8Array.from(wasmCompress(b, 6));

// Payloads spanning best-case -> floor.
const repetitive = new Uint8Array(Buffer.from('The quick brown fox 0123456789. '.repeat(320)));      // ~10 KB, very compressible
const prose = new Uint8Array(Buffer.from(                                                            // ~natural varied text
  ('Optical data transfer over QR codes trades bandwidth for robustness; ' +
   'each frame is a self-contained packet, and the channel is a camera pointed at a screen. ')
    .repeat(60)));
const source = new Uint8Array(fs.readFileSync(path.resolve(__dirname, '../../app/js/tx.js')));        // real source file
const incompressible = new Uint8Array(crypto.randomBytes(10 * 1024));                                 // floor

const files = [
  { name: 'repetitive-text', bytes: repetitive },
  { name: 'prose-text', bytes: prose },
  { name: 'source-code (tx.js)', bytes: source },
  { name: 'incompressible', bytes: incompressible },
];

const rows = [];
for (const f of files) {
  const none = f.bytes.length;
  const d = (await deflate(f.bytes)).length;
  const l = (await lzma(f.bytes)).length;
  const best = Math.min(none, d, l);
  const method = best === none ? METHOD.NONE : (best === d ? METHOD.DEFLATE : METHOD.LZMA);
  rows.push({
    file: f.name, none, deflate: d, lzma: l,
    chosen: ['none', 'deflate', 'lzma'][method], chosenBytes: best,
    ratio: +(none / best).toFixed(2), savedPct: +(100 * (1 - best / none)).toFixed(1),
  });
}

fs.writeFileSync(path.join(OUT, 'ratios.json'), JSON.stringify({
  note: 'Whole-file compression; compress() ships the smallest. deflate=CompressionStream, lzma=lzma-js level6.',
  rows,
}, null, 2) + '\n');

console.log('wrote data/002-compression/ratios.json');
console.table(rows);
