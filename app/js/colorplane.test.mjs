// colorplane.test.mjs — 4.1 pass criteria:
//  (a) Gray properties; (b) compose→decompose identity (no noise) for mixed allocations;
//  (c) under the LOCKED 4.0 fallback model with SIC+pedestal: floor 4/4/4 worst-plane
//      module-SER ≈1% (QR EC-L margin), derated 4/4/2 ≪1%, naive decoder regression-guarded;
//  (d) Gray isolation: an adjacent-level error corrupts exactly one plane.
// Run: node app/js/colorplane.test.mjs
import assert from 'node:assert/strict';
import { binToGray, grayToBin, levelValues, levelThresholds, quantize,
  composeModules, decomposeModules, simulateChannel, invertChannel, invert3,
  composeModulesGrid, decodeSIC, PEDESTAL } from './colorplane.js';
import { FALLBACK_MODEL } from './channelstats.js';
import { mulberry32 } from '../../scripts/bench/channel.mjs';

let n = 0;
const ok = (m) => console.log(`  ok ${++n} - ${m}`);
const eqPlane = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const serOf = (a, b) => a.reduce((s, v, i) => s + (v !== b[i] ? 1 : 0), 0) / a.length;

// --- (a) Gray code properties ---
{
  for (const bits of [1, 2, 3]) {
    const L = 1 << bits;
    for (let i = 0; i < L; i++) assert.equal(grayToBin(binToGray(i)), i);
    for (let i = 0; i + 1 < L; i++) {
      const diff = binToGray(i) ^ binToGray(i + 1);
      assert.equal(diff & (diff - 1), 0, 'adjacent levels differ by exactly one bit');
    }
  }
  assert.deepEqual(levelValues(4), [0, 85, 170, 255]);
  assert.deepEqual(levelThresholds(4), [42.5, 127.5, 212.5]);
  ok('Gray round-trip + one-bit adjacency (L=2,4,8); design level grid {0,85,170,255}');
}

// --- helpers: random plane set ---
function randomPlanes(nPlanes, nMod, seed) {
  const rnd = mulberry32(seed);
  return Array.from({ length: nPlanes }, () => Uint8Array.from({ length: nMod }, () => (rnd() < 0.5 ? 0 : 1)));
}

// --- (b) noiseless identity across allocations ---
{
  const nMod = 61 * 61;
  for (const alloc of [{ R: 2, G: 2, B: 2 }, { R: 2, G: 3, B: 2 }, { R: 1, G: 2, B: 3 }]) {
    const nP = alloc.R + alloc.G + alloc.B;
    const planes = randomPlanes(nP, nMod, 42 + nP);
    const rgb = composeModules(planes, alloc);
    const back = decomposeModules(rgb, alloc);
    back.forEach((pl, i) => assert.ok(eqPlane(pl, planes[i]), `plane ${i} identity`));
    ok(`noiseless identity: alloc R${alloc.R}/G${alloc.G}/B${alloc.B} (${nP} planes, ${nMod} modules)`);
  }
}

// --- (c) under the locked fallback model: SIC decoder + pedestal grid (4.1 finding) ---
// Naive display-uniform grid + per-channel thresholds FAILS here (~3% SER on dark
// boundaries): gamma compresses dark display gaps once linear-space interference
// (crosstalk+offset) exists. decodeSIC + PEDESTAL=64 is the locked remedy; per-plane
// module-SER < 1% is the criterion QR EC-L can absorb (bit-exact planes are the QR
// layer's job, not the raw channel's).
{
  const model = FALLBACK_MODEL;
  const nMod = 61 * 61;
  const run = (alloc, seeds) => {
    let worst = 0;
    for (const sd of seeds) {
      const nP = alloc.R + alloc.G + alloc.B;
      const planes = randomPlanes(nP, nMod, sd);
      const rgb = composeModulesGrid(planes, alloc, PEDESTAL);
      const obs = simulateChannel(rgb, model, mulberry32(1000 + sd));
      const back = decodeSIC(obs, alloc, model, PEDESTAL);
      back.forEach((pl, i) => { worst = Math.max(worst, serOf(pl, planes[i])); });
    }
    return worst;
  };
  const floor = run({ R: 2, G: 2, B: 2 }, [7, 17, 27]);
  assert.ok(floor < 0.012, `floor 4/4/4 worst-plane SER ${(floor * 100).toFixed(2)}% < 1.2%`);
  ok(`floor 4/4/4 (6 b/module, ped ${PEDESTAL}): worst-plane SER ${(floor * 100).toFixed(2)}% (~QR EC-L margin)`);

  const derated = run({ R: 2, G: 2, B: 1 }, [7, 17, 27]);
  assert.ok(derated < 0.005, `derated 4/4/2 worst ${(derated * 100).toFixed(2)}% < 0.5%`);
  ok(`derated 4/4/2 (5 b/module): worst-plane SER ${(derated * 100).toFixed(2)}% (comfortable)`);

  const stretch = run({ R: 2, G: 3, B: 2 }, [7]);
  assert.ok(stretch > 0.012, 'G8 stretch exceeds the 1% margin under the fallback model (expected)');
  ok(`stretch G8 rejected under fallback model: worst ${(stretch * 100).toFixed(2)}% > 1% (allocator will re-check on measured σ)`);

  // naive decoder is genuinely worse (regression guard for the finding)
  {
    const alloc = { R: 2, G: 2, B: 2 };
    const planes = randomPlanes(6, nMod, 7);
    const rgb = composeModules(planes, alloc);          // ped 0 grid
    const obs = simulateChannel(rgb, model, mulberry32(1007));
    const naive = decomposeModules(invertChannel(obs, model), alloc);
    const worstNaive = Math.max(...naive.map((pl, i) => serOf(pl, planes[i])));
    assert.ok(worstNaive > 0.02, `naive path worst ${(worstNaive * 100).toFixed(2)}% > 2%`);
    ok(`naive (no pedestal, threshold decode) worst-plane SER ${(worstNaive * 100).toFixed(2)}% — motivates SIC+pedestal`);
  }
}

// --- (d) Gray isolation: forced adjacent-level error corrupts exactly one plane ---
{
  const alloc = { R: 2, G: 2, B: 2 };
  const nMod = 100;
  const planes = randomPlanes(6, nMod, 5);
  const rgb = composeModules(planes, alloc);
  // push module 0 of G exactly one level up (or down at the top)
  const vals = levelValues(4);
  const idx = vals.indexOf(rgb.G[0]);
  rgb.G[0] = vals[idx === 3 ? 2 : idx + 1];
  const back = decomposeModules(rgb, alloc);
  let flipped = 0;
  back.forEach((pl, i) => { if (!eqPlane(pl, planes[i])) flipped++; });
  assert.equal(flipped, 1, 'exactly one plane corrupted by an adjacent-level error');
  ok('Gray isolation: adjacent-level error -> exactly 1 of 6 planes corrupted');
}

// --- invert3 sanity ---
{
  const M = FALLBACK_MODEL.crosstalk, inv = invert3(M);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    const e = M[i][0] * inv[0][j] + M[i][1] * inv[1][j] + M[i][2] * inv[2][j];
    assert.ok(Math.abs(e - (i === j ? 1 : 0)) < 1e-12);
  }
  ok('3x3 crosstalk inverse exact');
}

console.log(`\ncolorplane.test: ${n} checks passed`);
