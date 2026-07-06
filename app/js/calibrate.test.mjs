// calibrate.test.mjs — 4.2 pass criteria: strip estimator recovers the channel model;
// decode with the ESTIMATED model stays within the SER margin; a ±20% exposure ramp is
// tracked frame-by-frame; the allocator picks sane allocations per σ regime.
// Run: node app/js/calibrate.test.mjs
import assert from 'node:assert/strict';
import { stripPatches, estimateModel, allocateLevels } from './calibrate.js';
import { FALLBACK_MODEL, linearize, delinearize } from './channelstats.js';
import { composeModulesGrid, decodeSIC, simulateChannel, PEDESTAL } from './colorplane.js';
import { mulberry32 } from '../../scripts/bench/channel.mjs';

let n = 0;
const ok = (m) => console.log(`  ok ${++n} - ${m}`);
const serOf = (a, b) => a.reduce((s, v, i) => s + (v !== b[i] ? 1 : 0), 0) / a.length;

// simulate observing the strip: each patch sampled SAMPLES times through the channel
function observeStrip(displayed, model, rng, gain = 1) {
  const SAMPLES = 256;   // a real strip patch spans hundreds of camera px; 256 is conservative
  return displayed.map((rgbDisp) => {
    const rgb = { R: Uint8Array.of(...Array(SAMPLES).fill(rgbDisp[0])),
                  G: Uint8Array.of(...Array(SAMPLES).fill(rgbDisp[1])),
                  B: Uint8Array.of(...Array(SAMPLES).fill(rgbDisp[2])) };
    const scaled = { ...model, crosstalk: model.crosstalk.map((row) => row.map((v) => v * gain)) };
    const obs = simulateChannel(rgb, scaled, rng);
    const meanLin = [], std = [];
    ['R', 'G', 'B'].forEach((ch) => {
      const a = obs[ch];
      const muL = a.reduce((s, v) => s + linearize(v), 0) / a.length;   // mean IN LINEAR space
      const mu = a.reduce((s, v) => s + v, 0) / a.length;
      meanLin.push(muL);
      std.push(Math.sqrt(a.reduce((s, v) => s + (v - mu) ** 2, 0) / a.length));
    });
    return { meanLin, std };
  });
}

// --- estimator recovers M, b, sigma ---
{
  const disp = stripPatches();
  const obs = observeStrip(disp, FALLBACK_MODEL, mulberry32(11));
  const est = estimateModel(disp, obs);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    assert.ok(Math.abs(est.crosstalk[i][j] - FALLBACK_MODEL.crosstalk[i][j]) < 0.03,
      `M[${i}][${j}] ${est.crosstalk[i][j].toFixed(3)} ~ ${FALLBACK_MODEL.crosstalk[i][j]}`);
  }
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(est.offset[i] - FALLBACK_MODEL.offset[i]) < 0.02);
  for (const ch of 'RGB') {
    assert.ok(Math.abs(est.sigma8[ch] - FALLBACK_MODEL.sigma8[ch]) / FALLBACK_MODEL.sigma8[ch] < 0.5,
      `sigma ${ch} ${est.sigma8[ch].toFixed(1)} ~ ${FALLBACK_MODEL.sigma8[ch]}`);
  }
  ok(`strip estimator: M within ±0.03, offset ±0.02, sigma within 50% (26 patches × 256 samples)`);
}

// --- decode with the ESTIMATED model (not the truth) ---
{
  const disp = stripPatches();
  const est = estimateModel(disp, observeStrip(disp, FALLBACK_MODEL, mulberry32(12)));
  const alloc = { R: 2, G: 2, B: 2 }, nMod = 3721;
  const rnd = mulberry32(21);
  const planes = Array.from({ length: 6 }, () => Uint8Array.from({ length: nMod }, () => (rnd() < 0.5 ? 0 : 1)));
  const rgb = composeModulesGrid(planes, alloc, PEDESTAL);
  const obs = simulateChannel(rgb, FALLBACK_MODEL, mulberry32(22));   // TRUE channel
  const back = decodeSIC(obs, alloc, est, PEDESTAL);                  // ESTIMATED model
  const worst = Math.max(...back.map((pl, i) => serOf(pl, planes[i])));
  assert.ok(worst < 0.012, `estimated-model decode worst SER ${(worst * 100).toFixed(2)}% < 1.2%`);
  ok(`decode with estimated model: worst-plane SER ${(worst * 100).toFixed(2)}% (≈ true-model performance)`);
}

// --- exposure drift 0.8 → 1.2: calibration must TRACK (est ≈ truth); dimming genuinely
//     costs margin — that is the allocator's job, not the calibrator's (checked below).
{
  const disp = stripPatches();
  const alloc = { R: 2, G: 2, B: 2 }, nMod = 1600;
  let maxTrackCost = 0, dimWorst = 0, brightWorst = 0;
  for (let f = 0; f <= 10; f++) {
    const gain = 0.8 + 0.04 * f;
    const truth = { ...FALLBACK_MODEL, crosstalk: FALLBACK_MODEL.crosstalk.map((r) => r.map((v) => v * gain)) };
    const est = estimateModel(disp, observeStrip(disp, FALLBACK_MODEL, mulberry32(100 + f), gain));
    const rnd = mulberry32(200 + f);
    const planes = Array.from({ length: 6 }, () => Uint8Array.from({ length: nMod }, () => (rnd() < 0.5 ? 0 : 1)));
    const rgb = composeModulesGrid(planes, alloc, PEDESTAL);
    const obs = simulateChannel(rgb, truth, mulberry32(300 + f));
    const wEst = Math.max(...decodeSIC(obs, alloc, est, PEDESTAL).map((pl, i) => serOf(pl, planes[i])));
    const wTru = Math.max(...decodeSIC(obs, alloc, truth, PEDESTAL).map((pl, i) => serOf(pl, planes[i])));
    maxTrackCost = Math.max(maxTrackCost, wEst - wTru);
    if (gain <= 0.85) dimWorst = Math.max(dimWorst, wEst);
    if (gain >= 0.95) brightWorst = Math.max(brightWorst, wEst);
  }
  assert.ok(maxTrackCost < 0.005, `tracking cost ${(maxTrackCost * 100).toFixed(2)}pp < 0.5pp`);
  assert.ok(brightWorst < 0.015, `gain ≥ 0.95 keeps 4/4/4 under 1.5% (${(brightWorst * 100).toFixed(2)}%)`);
  ok(`drift tracking: est-vs-truth cost ${(maxTrackCost * 100).toFixed(2)}pp; 4/4/4 holds for gain ≥ 0.95 ` +
     `(${(brightWorst * 100).toFixed(2)}%); dim 0.8 → ${(dimWorst * 100).toFixed(2)}% = allocator territory`);

  // dimming response: EC escalation first (gain 0.8 → planes ride EC-M), then bit derating
  const estDim = estimateModel(disp, observeStrip(disp, FALLBACK_MODEL, mulberry32(999), 0.8));
  const aDim = allocateLevels(estDim, mulberry32);
  assert.ok(aDim.bits >= 5, `gain 0.8: still viable at ≥5 bits (${aDim.bits}b, EC ${aDim.ec.join('')})`);
  const estDim2 = estimateModel(disp, observeStrip(disp, FALLBACK_MODEL, mulberry32(998), 0.6));
  const aDim2 = allocateLevels(estDim2, mulberry32);
  assert.ok(aDim2.bits < 6, `gain 0.6 derates bits (picked ${aDim2.bits})`);
  ok(`dimming response: gain 0.8 -> ${aDim.bits}b (EC ${aDim.ec.join('')}); gain 0.6 -> ${aDim2.bits}b (derated)`);
}

// --- allocator behavior across σ regimes ---
{
  const clean = { ...FALLBACK_MODEL, sigma8: { R: 3, G: 3, B: 3 } };
  const fallback = FALLBACK_MODEL;
  const noisy = { ...FALLBACK_MODEL, sigma8: { R: 16, G: 12, B: 20 } };
  const a1 = allocateLevels(clean, mulberry32);
  const a2 = allocateLevels(fallback, mulberry32);
  const a3 = allocateLevels(noisy, mulberry32);
  assert.ok(a1.bits >= a2.bits && a2.bits >= a3.bits, 'monotone: cleaner channel -> more bits');
  assert.equal(a2.bits, 6, 'fallback model -> 6 bits (4/4/4 floor, borderline planes on EC-M)');
  assert.ok(a2.ec.includes('M'), 'fallback: at least one borderline plane rides EC-M');
  assert.ok(a3.bits <= 4, 'very noisy -> derated');
  ok(`allocator: clean=${a1.bits}b(EC ${a1.ec.join('')}), fallback=${a2.bits}b(EC ${a2.ec.join('')}), noisy=${a3.bits}b`);
}

console.log(`\ncalibrate.test: ${n} checks passed`);
