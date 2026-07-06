// colorplane.js — variable-level bit-plane color codec (Phase 4.1).
//
// Each RGB channel carries log2(L) Gray-coded bit-planes (L ∈ {2,4,8} levels/channel);
// every plane is an ordinary BINARY module bitmap (a QR matrix), so the decoder can hand
// each recovered plane to stock jsQR. Levels are equally spaced in DISPLAY space
// (design: L=4 → {0,85,170,255}, value = 170·b₁ + 85·b₀ with Gray order 00→01→11→10).
// An adjacent-level misread therefore corrupts exactly ONE plane — QR EC absorbs module
// errors per plane, the fountain absorbs whole-plane deaths.
//
// Pure module (no DOM). Camera simulation for synthetic tests mirrors the 4.0 channel
// model: display → gamma-linearize → 3×3 crosstalk + offset → delinearize → +σ₈ noise.

import { linearize, delinearize } from './channelstats.js';

// --- Gray code -------------------------------------------------------------------
export const binToGray = (i) => i ^ (i >> 1);
export function grayToBin(g) { let b = 0; for (; g; g >>= 1) b ^= g; return b; }

/** Display values for L equally spaced levels (L−1 divides 255 for L ∈ {2,4,8}… close enough). */
export function levelValues(L) {
  const out = new Array(L);
  for (let i = 0; i < L; i++) out[i] = Math.round((255 * i) / (L - 1));
  return out;
}
/** Decision thresholds (midpoints) for quantizing a display value to a level index. */
export function levelThresholds(L) {
  const v = levelValues(L), t = [];
  for (let i = 0; i < L - 1; i++) t.push((v[i] + v[i + 1]) / 2);
  return t;
}
export function quantize(value, thresholds) {
  let i = 0; while (i < thresholds.length && value > thresholds[i]) i++;
  return i;
}

// --- compose / decompose (module level) --------------------------------------------
// allocation = {R:bitsR, G:bitsG, B:bitsB}, bits ∈ {1,2,3} (L = 2^bits).
// planes: array of Uint8Array bitmaps (0/1), length Σbits, ordered R-MSB..R-LSB, G…, B…

export function planesPerChannel(allocation) { return [allocation.R, allocation.G, allocation.B]; }

/** planes → per-module RGB display values. All planes must share the same length. */
export function composeModules(planes, allocation) {
  const nMod = planes[0].length;
  const bits = planesPerChannel(allocation);
  const out = { R: new Uint8Array(nMod), G: new Uint8Array(nMod), B: new Uint8Array(nMod) };
  let p = 0;
  ['R', 'G', 'B'].forEach((ch, ci) => {
    const n = bits[ci], L = 1 << n, vals = levelValues(L);
    if (n === 0) { p += 0; return; }
    for (let m = 0; m < nMod; m++) {
      let g = 0;
      for (let b = 0; b < n; b++) g = (g << 1) | planes[p + b][m];  // MSB first = gray code
      out[ch][m] = vals[grayToBin(g)];
    }
    p += n;
  });
  return out;
}

/** observed per-module RGB (display space, calibrated) → planes bits. */
export function decomposeModules(observed, allocation) {
  const nMod = observed.R.length;
  const bits = planesPerChannel(allocation);
  const planes = [];
  ['R', 'G', 'B'].forEach((ch, ci) => {
    const n = bits[ci];
    if (n === 0) return;
    const L = 1 << n, thr = levelThresholds(L);
    const chPlanes = Array.from({ length: n }, () => new Uint8Array(nMod));
    for (let m = 0; m < nMod; m++) {
      const g = binToGray(quantize(observed[ch][m], thr));
      for (let b = 0; b < n; b++) chPlanes[b][m] = (g >> (n - 1 - b)) & 1;
    }
    planes.push(...chPlanes);
  });
  return planes;
}

// --- synthetic camera channel (mirrors 4.0 model) -----------------------------------

/**
 * Simulate display→camera for per-module RGB display values.
 * model: {gamma-implied via channelstats, crosstalk 3×3, offset[3], sigma8:{R,G,B}}
 * rng: () => float in [0,1). Deterministic when seeded (tests).
 */
export function simulateChannel(rgb, model, rng) {
  const gauss = () => { let u = 0, v = 0; while (!u) u = rng(); while (!v) v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const M = model.crosstalk, off = model.offset;
  const sig = [model.sigma8.R, model.sigma8.G, model.sigma8.B];
  const nMod = rgb.R.length;
  const out = { R: new Float64Array(nMod), G: new Float64Array(nMod), B: new Float64Array(nMod) };
  for (let m = 0; m < nMod; m++) {
    const lin = [linearize(rgb.R[m]), linearize(rgb.G[m]), linearize(rgb.B[m])];
    ['R', 'G', 'B'].forEach((ch, i) => {
      const mixed = M[i][0] * lin[0] + M[i][1] * lin[1] + M[i][2] * lin[2] + off[i];
      const disp = delinearize(mixed) + sig[i] * gauss();
      out[ch][m] = Math.max(0, Math.min(255, disp));
    });
  }
  return out;
}

/**
 * Invert the (known or 4.2-estimated) crosstalk on observed display values → calibrated
 * display values ready for `decomposeModules`. inv = 3×3 inverse of model.crosstalk.
 */
export function invertChannel(observed, model) {
  const inv = invert3(model.crosstalk), off = model.offset;
  const nMod = observed.R.length;
  const out = { R: new Float64Array(nMod), G: new Float64Array(nMod), B: new Float64Array(nMod) };
  for (let m = 0; m < nMod; m++) {
    const y0 = [linearize(observed.R[m]) - off[0], linearize(observed.G[m]) - off[1], linearize(observed.B[m]) - off[2]];
    ['R', 'G', 'B'].forEach((ch, i) => {
      const x = inv[i][0] * y0[0] + inv[i][1] * y0[1] + inv[i][2] * y0[2];
      out[ch][m] = delinearize(x);
    });
  }
  return out;
}

export function invert3(M) {
  const [a, b, c] = M[0], [d, e, f] = M[1], [g, h, i] = M[2];
  const A = e * i - f * h, B = c * h - b * i, C = b * f - c * e;
  const D = f * g - d * i, E = a * i - c * g, F = c * d - a * f;
  const G = d * h - e * g, H = b * g - a * h, I = a * e - b * d;
  const det = a * A + b * D + c * G;
  return [[A / det, B / det, C / det], [D / det, E / det, F / det], [G / det, H / det, I / det]];
}

// --- SIC decoding + pedestal grid (4.1 finding) --------------------------------------
// Gamma compresses DARK display-space level gaps once linear-space interference
// (crosstalk + offset) is present: naive display-uniform grids lose the level-0/1 gap
// (85 -> ~26 under the fallback model) and per-channel threshold decoding shows ~3% SER.
// Fix: (1) decide by nearest PREDICTED response with successive interference cancellation
// (noise is uniform in display space, so this is ML-ish); (2) encode on a PEDESTAL grid —
// keep level 0 off display black. Pedestal locked by the 4.1 sweep (see test).

export const PEDESTAL = 64;

/** L levels from `pedestal`..255, uniform in display space. */
export function levelGrid(L, pedestal = PEDESTAL) {
  const out = new Array(L);
  for (let i = 0; i < L; i++) out[i] = Math.round(pedestal + ((255 - pedestal) * i) / (L - 1));
  return out;
}

/** Compose with an explicit grid (pedestal-aware variant of composeModules). */
export function composeModulesGrid(planes, allocation, pedestal = PEDESTAL) {
  const nMod = planes[0].length;
  const bits = planesPerChannel(allocation);
  const out = { R: new Uint8Array(nMod), G: new Uint8Array(nMod), B: new Uint8Array(nMod) };
  let p = 0;
  ['R', 'G', 'B'].forEach((ch, ci) => {
    const n = bits[ci]; if (n === 0) return;
    const vals = levelGrid(1 << n, pedestal);
    for (let m = 0; m < nMod; m++) {
      let g = 0;
      for (let b = 0; b < n; b++) g = (g << 1) | planes[p + b][m];
      out[ch][m] = vals[grayToBin(g)];
    }
    p += n;
  });
  return out;
}

/**
 * SIC decoder: per module, iteratively decide each channel's level by nearest predicted
 * observed response p_c = delin( Σ M[c][c']·lin(v_{ℓc'}) + b_c ), holding the other
 * channels at their current decisions. 2 iterations suffice at ≤10% crosstalk.
 * Returns planes (Gray bit-planes), like decomposeModules.
 */
export function decodeSIC(observed, allocation, model, pedestal = PEDESTAL, iters = 2) {
  const bits = planesPerChannel(allocation);
  const L = bits.map((n) => 1 << n);
  const grids = bits.map((n) => levelGrid(1 << n, pedestal));
  const gridsLin = grids.map((g) => g.map(linearize));
  const M = model.crosstalk, off = model.offset;
  const nMod = observed.R.length;
  const obs = [observed.R, observed.G, observed.B];
  const lvl = [new Uint8Array(nMod), new Uint8Array(nMod), new Uint8Array(nMod)];
  lvl.forEach((a, c) => a.fill(L[c] >> 1));                      // init mid-level
  for (let it = 0; it < iters; it++) {
    for (let c = 0; c < 3; c++) {
      for (let m = 0; m < nMod; m++) {
        // interference from the other channels at their current decisions
        let X = off[c];
        for (let c2 = 0; c2 < 3; c2++) if (c2 !== c) X += M[c][c2] * gridsLin[c2][lvl[c2][m]];
        let best = 0, bestD = Infinity;
        for (let li = 0; li < L[c]; li++) {
          const pred = delinearize(M[c][c] * gridsLin[c][li] + X);
          const d = Math.abs(obs[c][m] - pred);
          if (d < bestD) { bestD = d; best = li; }
        }
        lvl[c][m] = best;
      }
    }
  }
  const planes = [];
  for (let c = 0; c < 3; c++) {
    const n = bits[c]; if (n === 0) continue;
    const chP = Array.from({ length: n }, () => new Uint8Array(nMod));
    for (let m = 0; m < nMod; m++) {
      const g = binToGray(lvl[c][m]);
      for (let b = 0; b < n; b++) chP[b][m] = (g >> (n - 1 - b)) & 1;
    }
    planes.push(...chP);
  }
  return planes;
}
