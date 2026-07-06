// compress.test.mjs — 3.1 pass criterion: byte-exact round-trip + smallest-method selection.
// Run: node app/js/compress.test.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { compress, decompress, METHOD, ensureLzma } from './compress.js';
import { compress as wasmCompress } from '../vendor/lzma-wasm.esm.js';

let n = 0;
const ok = (m) => console.log(`  ok ${++n} - ${m}`);
const eq = (a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0;

await ensureLzma();
ok('lzma-wasm initialized');

// --- auto-select round-trips: text, incompressible, empty ---
const text = new Uint8Array(Buffer.from('The quick brown fox 0123456789. '.repeat(300)));
const incompressible = new Uint8Array(crypto.randomBytes(4096));
const empty = new Uint8Array(0);
for (const [name, input] of [['text', text], ['incompressible', incompressible], ['empty', empty]]) {
  const { method, data } = await compress(input);
  const out = await decompress(method, data);
  assert.ok(eq(out, input), `${name} round-trip byte-exact`);
  ok(`${name} round-trip byte-exact (method=${method}, ${input.length}->${data.length})`);
}

// --- each codec explicitly, including hostile binary (surrogate-like UTF-8 bytes) ---
const hostile = new Uint8Array([0xED, 0xA0, 0x80, 0xED, 0xA0, 0x80, 0, 0, 1, 2, 3, 0xFF, 0xFE]);
for (const [name, input] of [['text', text], ['hostile-utf8', hostile], ['random', incompressible]]) {
  for (const m of [METHOD.DEFLATE, METHOD.LZMA]) {
    let blob;
    if (m === METHOD.DEFLATE) {
      const cs = new Blob([input]).stream().pipeThrough(new CompressionStream('deflate-raw'));
      blob = new Uint8Array(await new Response(cs).arrayBuffer());
    } else {
      blob = Uint8Array.from(wasmCompress(input, 6));
    }
    const out = await decompress(m, blob);
    assert.ok(eq(out, input), `${name} via codec ${m}`);
  }
}
ok('both codecs byte-exact incl. hostile binary (lzma-wasm)');

// --- selection rules ---
{
  const t = await compress(text);
  assert.notEqual(t.method, METHOD.NONE, 'text should compress');
  assert.ok(t.data.length < text.length, 'text should shrink');
  ok(`text compresses (${text.length}->${t.data.length}, method=${t.method})`);

  const r = await compress(incompressible);
  assert.equal(r.method, METHOD.NONE, 'incompressible -> NONE (never ship inflation)');
  assert.ok(r.data.length <= incompressible.length, 'no inflation shipped');
  ok(`incompressible falls back to NONE (${incompressible.length}->${r.data.length})`);
}

console.log(`\ncompress.test: ${n} checks passed`);
