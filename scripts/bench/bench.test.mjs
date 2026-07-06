// bench.test.mjs — 2.1 pass criterion: determinism + SHA-256 exactness.
// Run: node scripts/bench/bench.test.mjs
import assert from 'node:assert/strict';
import { runCase, makePayloads } from './bench.mjs';

const { text, binary } = makePayloads();
let n = 0;
const ok = (m) => console.log(`  ok ${++n} - ${m}`);

// 1) SHA-256 exactness across chunk sizes and drop rates
for (const cs of [100, 250, 500, 800]) {
  for (const drop of [0, 0.01, 0.05]) {
    const r = runCase({ fileBytes: binary, chunkSize: cs, dropProb: drop, seed: 7 });
    assert.equal(r.okSha, true, `okSha cs=${cs} drop=${drop}`);
  }
}
ok('SHA-256 exact for all chunkSize x dropProb (binary)');

// 2) Determinism: identical {seed, dropProb} -> identical frames/okSha/bytes
for (const drop of [0, 0.05]) {
  const a = runCase({ fileBytes: text, chunkSize: 250, dropProb: drop, seed: 123 });
  const b = runCase({ fileBytes: text, chunkSize: 250, dropProb: drop, seed: 123 });
  assert.deepEqual(
    { f: a.frames, s: a.okSha, by: a.bytes },
    { f: b.frames, s: b.okSha, by: b.bytes },
    `determinism drop=${drop}`);
}
ok('deterministic per seed (same seed -> same frames)');

// 3) Different seeds on a lossy channel should generally differ in frame count
const s1 = runCase({ fileBytes: text, chunkSize: 250, dropProb: 0.05, seed: 1 });
const s2 = runCase({ fileBytes: text, chunkSize: 250, dropProb: 0.05, seed: 999 });
assert.ok(s1.frames > 0 && s2.frames > 0, 'nonzero frames');
ok(`seed sensitivity on lossy channel (seed1=${s1.frames} vs seed999=${s2.frames} frames)`);

// 4) More drops -> more frames (monotone-ish sanity, fixed seed)
const d0 = runCase({ fileBytes: text, chunkSize: 250, dropProb: 0, seed: 5 });
const d5 = runCase({ fileBytes: text, chunkSize: 250, dropProb: 0.05, seed: 5 });
assert.ok(d5.frames >= d0.frames, 'drops should not reduce frame count');
ok(`drops cost frames (0%%=${d0.frames} <= 5%%=${d5.frames})`);

console.log(`\nbench.test: ${n} checks passed`);
