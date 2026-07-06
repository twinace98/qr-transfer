// fountain-overhead.mjs — LT overhead ε vs k, and (c, δ) parameter scan (Phase 3.2).
// -> data/003-fountain/overhead.json
// Run: node scripts/bench/fountain-overhead.mjs
//
// ε = droplets_received / k − 1, measured droplets-only (worst case: receiver joins after the
// systematic pass, so EVERY packet is a random droplet). The systematic-pass-received case has
// ε = 0 by construction at 0% drop; real transfers sit between the two.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { robustSolitonCDF, neighborsFromSeed, SYSTEMATIC_BASE } from '../../app/js/fountain.js';
import { LTEncoder, LTDecoder, splitBlocks } from '../../app/js/fountain.js';
import { mulberry32 } from './channel.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../../data/003-fountain');
fs.mkdirSync(OUT, { recursive: true });

const BLOCK = 100;

/** One droplets-only decode; returns ε. Droplet seeds offset per trial for independence. */
function trial(k, lt, seedBase) {
  const bytes = new Uint8Array(k * BLOCK);
  const rnd = mulberry32(seedBase);
  for (let i = 0; i < bytes.length; i++) bytes[i] = (rnd() * 256) | 0;
  const enc = new LTEncoder(splitBlocks(bytes, BLOCK), lt);
  enc._dropSeed = seedBase * 100_000;          // decorrelate droplet seed streams across trials
  for (let i = 0; i < k; i++) enc.next();      // burn systematic pass (late join)
  const dec = new LTDecoder(k, BLOCK, lt);
  let fed = 0;
  while (!dec.done && fed < k * 10) { const { seed, data } = enc.next(); dec.addPacket(seed, data); fed++; }
  if (!dec.done) return null;                  // decode failure within 10k budget
  return fed / k - 1;
}

function stats(k, lt, trials) {
  const eps = [];
  let fails = 0;
  for (let t = 1; t <= trials; t++) {
    const e = trial(k, lt, t);
    if (e === null) fails++; else eps.push(e);
  }
  eps.sort((a, b) => a - b);
  const mean = eps.reduce((s, x) => s + x, 0) / eps.length;
  const p95 = eps[Math.min(eps.length - 1, Math.floor(0.95 * eps.length))];
  return { meanEps: +(mean * 100).toFixed(1), p95Eps: +(p95 * 100).toFixed(1), fails, trials };
}

// --- (c, δ) scan at k=64/128 (droplets-only, 100 trials) ---
console.log('LT parameter scan (droplets-only, eps %):');
const scan = [];
for (const c of [0.03, 0.1, 0.2]) {
  for (const delta of [0.05, 0.5]) {
    const s64 = stats(64, { c, delta }, 100);
    const s128 = stats(128, { c, delta }, 100);
    scan.push({ c, delta, 'k64_mean%': s64.meanEps, 'k64_p95%': s64.p95Eps, 'k128_mean%': s128.meanEps, 'k128_p95%': s128.p95Eps, fails: s64.fails + s128.fails });
  }
}
console.table(scan);
const best = [...scan].sort((a, b) => (a['k128_mean%'] + a['k64_mean%']) - (b['k128_mean%'] + b['k64_mean%']))[0];
console.log(`best (by mean eps): c=${best.c}, delta=${best.delta}`);

// --- ε vs k at the best params (200 trials) ---
const lt = { c: best.c, delta: best.delta };
const byK = [];
for (const k of [16, 32, 64, 128, 256]) {
  const s = stats(k, lt, 200);
  byK.push({ k, ...s });
}
console.log(`\neps vs k at c=${lt.c}, delta=${lt.delta} (droplets-only, 200 trials):`);
console.table(byK);

fs.writeFileSync(path.join(OUT, 'overhead.json'), JSON.stringify({
  note: 'LT overhead eps = droplets/k - 1, droplets-only (late-join worst case). ' +
        'Systematic-pass path has eps=0 at 0% drop by construction. block=100 B.',
  scan, locked: lt, byK,
}, null, 2) + '\n');
console.log('\nwrote data/003-fountain/overhead.json');
