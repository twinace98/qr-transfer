// calibrate.js — per-frame calibration strip estimator + level allocator (Phase 4.2).
//
// The frame carries a reference strip of KNOWN patches (K/W + per-channel level patches).
// From the observed strip the receiver estimates, EVERY frame:
//   observed_lin = M̂·displayed_lin + b̂   (3×3 crosstalk + offset, linear space, LSQ)
//   σ̂₈ per channel (residual std of strip samples, display units)
// so the SIC decoder tracks auto-exposure / white-balance drift with no back-channel.
// The allocator picks the max-bits {R,G,B} level allocation whose worst-plane module-SER
// stays under the QR EC-L margin, evaluated by a quick synthetic run on the estimate.

import { linearize } from './channelstats.js';
import { composeModulesGrid, decodeSIC, simulateChannel, PEDESTAL, levelGrid } from './colorplane.js';

/** Strip definition: displayed RGB per patch. Covers K/W + each channel's level grid. */
export function stripPatches(bitsMax = 3) {
  const patches = [[0, 0, 0], [255, 255, 255]];
  const grid = levelGrid(1 << bitsMax, PEDESTAL);         // superset grid; L=8 covers L=4/2 points-ish
  for (let ch = 0; ch < 3; ch++) {
    for (const v of grid) { const rgb = [0, 0, 0]; rgb[ch] = v; patches.push(rgb); }
  }
  return patches; // 2 + 3*8 = 26 patches
}

/**
 * LSQ estimate of {crosstalk M̂, offset b̂, sigma8} from observed strip patch samples.
 * @param {number[][]} displayed  patch displayed RGB (from stripPatches)
 * @param {{meanLin:number[], std:number[]}[]} observed  per patch: mean of LINEARIZED
 *        samples (mean-in-linear kills the Jensen bias of gamma's convexity — measured:
 *        display-space patch means shift dark decision boundaries by ~10 display units)
 *        and std of raw samples (display units)
 * @returns {{crosstalk:number[][], offset:number[], sigma8:{R,G,B}}}
 */
export function estimateModel(displayed, observed) {
  // per channel c: y = a0·xR + a1·xG + a2·xB + b  (all linear-space)
  const M = [], off = [];
  for (let c = 0; c < 3; c++) {
    // normal equations for 4 params over n patches
    const A = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
    const rhs = [0, 0, 0, 0];
    for (let p = 0; p < displayed.length; p++) {
      const y = observed[p].meanLin[c];
      // saturation-aware: a TOP-clamped response (sensor/display headroom) breaks the
      // affine model (measured: the white patch alone cost ~0.5 pp SER). Do NOT drop
      // low/zero responses — dark patches are exactly the crosstalk anchors; dropping
      // them makes the normal equations singular on clean frames (bug found in 5.x
      // self-test: est off-diagonals went garbage -> 48 % plane SER).
      if (y > linearize(250)) continue;
      const x = [linearize(displayed[p][0]), linearize(displayed[p][1]), linearize(displayed[p][2]), 1];
      for (let i = 0; i < 4; i++) { rhs[i] += x[i] * y; for (let j = 0; j < 4; j++) A[i][j] += x[i] * x[j]; }
    }
    for (let i = 0; i < 4; i++) A[i][i] += 1e-9;   // ridge: keep degenerate strips solvable
    const sol = solve4(A, rhs);
    M.push([sol[0], sol[1], sol[2]]);
    off.push(sol[3]);
  }
  // sigma8 per channel: median of observed per-patch stds (display units)
  const med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
  const sigma8 = {};
  ['R', 'G', 'B'].forEach((ch, c) => { sigma8[ch] = med(observed.map((o) => o.std[c])); });
  return { crosstalk: M, offset: off, sigma8 };
}

function solve4(A, b) {   // Gaussian elimination, 4x4
  const m = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < 4; c++) {
    let piv = c;
    for (let r = c + 1; r < 4; r++) if (Math.abs(m[r][c]) > Math.abs(m[piv][c])) piv = r;
    [m[c], m[piv]] = [m[piv], m[c]];
    for (let r = 0; r < 4; r++) {
      if (r === c || !m[r][c]) continue;
      const f = m[r][c] / m[c][c];
      for (let k = c; k < 5; k++) m[r][k] -= f * m[c][k];
    }
  }
  return m.map((row, i) => row[4] / m[i][i]);
}

/** Candidate allocations, highest bits first. */
export const CANDIDATES = [
  { R: 3, G: 3, B: 3 }, { R: 2, G: 3, B: 2 }, { R: 2, G: 2, B: 2 },
  { R: 2, G: 2, B: 1 }, { R: 1, G: 2, B: 1 }, { R: 1, G: 1, B: 1 },
];

/**
 * Pick the max-bits allocation viable under `model`, via a quick synthetic evaluation.
 * Per-plane QR EC is part of the budget: planes under SER_L ride EC-L; planes between
 * SER_L and SER_M get EC-M (≈20 % capacity cost on that plane, still ≥4 levels/channel);
 * any plane above SER_M kills the allocation. Scattered-module heuristic: EC-x corrects
 * ~{7,15}% of codewords ≈ 8·SER of codewords touched ⇒ raw limits ≈ {0.9 %, 1.9 %};
 * serM carries a 20 % engineering margin (heuristic is optimistic) ⇒ default 1.5 %.
 * @returns {{alloc, bits, worstSER, ec: ('L'|'M')[]}}  ec per plane (R-MSB..B-LSB order)
 */
export function allocateLevels(model, rngFactory, { serL = 0.009, serM = 0.015, nMod = 3000 } = {}) {
  for (const alloc of CANDIDATES) {
    const nP = alloc.R + alloc.G + alloc.B;
    // conservative: worst per plane over 3 independent seeds (borderline allocations
    // flicker around the EC limits on a single draw)
    const sers = new Array(nP).fill(0);
    for (const sd of [101, 211, 307]) {
      const rnd = rngFactory(sd);
      const planes = Array.from({ length: nP }, () => Uint8Array.from({ length: nMod }, () => (rnd() < 0.5 ? 0 : 1)));
      const rgb = composeModulesGrid(planes, alloc, PEDESTAL);
      const obs = simulateChannel(rgb, model, rngFactory(sd * 7));
      const back = decodeSIC(obs, alloc, model, PEDESTAL);
      back.forEach((pl, i) => {
        let e = 0; for (let m = 0; m < nMod; m++) if (pl[m] !== planes[i][m]) e++;
        sers[i] = Math.max(sers[i], e / nMod);
      });
    }
    if (sers.every((s) => s < serM)) {
      return { alloc, bits: nP, worstSER: Math.max(...sers), ec: sers.map((s) => (s < serL ? 'L' : 'M')) };
    }
  }
  const last = CANDIDATES.at(-1);
  return { alloc: last, bits: 3, worstSER: NaN, ec: ['M', 'M', 'M'] };
}
