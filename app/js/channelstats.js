// channelstats.js — display→camera channel characterization math (Phase 4.0).
//
// Pure module (no DOM): pattern geometry shared by the display painter and the camera
// sampler, gamma linearization, per-frame linear calibration per channel, residual-σ
// estimation, and a chroma-MTF proxy from checkerboard contrast. Browser page:
// app/channel-check.html. Node test: channelstats.test.mjs.

export const GAMMA = 2.2;
export const LEVELS = [0, 85, 170, 255];

/** sRGB-ish display value (0..255) -> linear light (0..1). */
export const linearize = (v) => Math.pow(v / 255, GAMMA);
/** linear light -> display value. */
export const delinearize = (x) => Math.round(255 * Math.pow(Math.max(0, Math.min(1, x)), 1 / GAMMA));

/**
 * Test-pattern geometry, in fractions of the pattern rectangle.
 * Rows: 0 = K/W anchors, 1..3 = R/G/B level patches, 4 = checker strips (MTF).
 * Each patch: {x, y, w, h, kind, ch?, level?}  ch: 0=R 1=G 2=B, level index into LEVELS.
 */
export function patternLayout() {
  const patches = [];
  const rowH = 1 / 5;
  // row 0: black, white anchors
  patches.push({ x: 0.0, y: 0, w: 0.5, h: rowH, kind: 'anchor', value: 0 });
  patches.push({ x: 0.5, y: 0, w: 0.5, h: rowH, kind: 'anchor', value: 255 });
  // rows 1..3: 4 levels per channel
  for (let ch = 0; ch < 3; ch++) {
    for (let li = 0; li < LEVELS.length; li++) {
      patches.push({ x: li / 4, y: (ch + 1) * rowH, w: 1 / 4, h: rowH, kind: 'level', ch, level: li });
    }
  }
  // row 4: per-channel checker strips (module-scale contrast for the MTF proxy) + luma checker
  for (let ch = 0; ch < 3; ch++) {
    patches.push({ x: ch / 4, y: 4 * rowH, w: 1 / 4, h: rowH, kind: 'checker', ch });
  }
  patches.push({ x: 3 / 4, y: 4 * rowH, w: 1 / 4, h: rowH, kind: 'checker', ch: -1 }); // luma (K/W)
  return patches;
}

/** RGB triple a patch should display. */
export function patchRGB(p, checkerPhase = 0) {
  if (p.kind === 'anchor') return [p.value, p.value, p.value];
  if (p.kind === 'level') { const rgb = [0, 0, 0]; rgb[p.ch] = LEVELS[p.level]; return rgb; }
  // checker: alternate 0 / 255 on the channel (or luma), phase decided by the painter per cell
  if (p.ch === -1) return checkerPhase ? [255, 255, 255] : [0, 0, 0];
  const rgb = [0, 0, 0]; rgb[p.ch] = checkerPhase ? 255 : 0; return rgb;
}

/**
 * Per-frame, per-channel linear calibration from the 4 level patches:
 * fit observed_linear = a·displayed_linear + b (least squares over the 4 levels),
 * then return residual std IN 8-BIT DISPLAY UNITS (comparable to the design's σ scale).
 * @param {number[][]} samplesByLevel  for one channel: [level0Samples[], ..., level3Samples[]]
 *        each sample = observed 8-bit value of that channel at a pixel inside the patch.
 * @returns {{a:number,b:number,sigma8:number}}
 */
export function calibrateChannel(samplesByLevel) {
  const xs = [], ys = [];
  for (let li = 0; li < LEVELS.length; li++) {
    const X = linearize(LEVELS[li]);
    for (const s of samplesByLevel[li]) { xs.push(X); ys.push(linearize(s)); }
  }
  const n = xs.length;
  const mx = xs.reduce((s, v) => s + v, 0) / n, my = ys.reduce((s, v) => s + v, 0) / n;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  const a = sxy / sxx, b = my - a * mx;
  // residuals in linear space -> convert to 8-bit units via the local slope of delinearize
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const rLin = ys[i] - (a * xs[i] + b);
    // d(display)/d(linear) at this operating point (avoid the singular slope at 0)
    const disp = Math.max(8, delinearize(ys[i]));
    const slope = (255 / GAMMA) * Math.pow(disp / 255, 1 - GAMMA); // d display / d linear
    acc += (rLin * slope) ** 2;
  }
  return { a, b, sigma8: Math.sqrt(acc / n) };
}

/**
 * Chroma-MTF proxy: modulation at module scale / modulation at patch scale.
 * checkerSamples: observed 8-bit channel values sampled at checker cell centers, labeled
 * by phase. flatDark/flatLight: mean observed values of the SAME channel's full patches.
 * ~1 = channel resolves modules fully; ≪1 = subsampling/blur is eating module contrast.
 */
export function mtfProxy(checkerSamples, flatDark, flatLight) {
  const d = checkerSamples.filter((s) => s.phase === 0).map((s) => s.v);
  const l = checkerSamples.filter((s) => s.phase === 1).map((s) => s.v);
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const modChecker = mean(l) - mean(d);
  const modFlat = flatLight - flatDark;
  return modFlat > 0 ? modChecker / modFlat : 0;
}

/**
 * Locked fallback channel model for 4.1–4.3 synthetic tests (until a real measurement
 * replaces it — see data/005-color/channel-model.json). Literature-guided:
 * G benefits from Bayer 2× sampling + dominant luma weight; R/B ride 4:2:0 chroma.
 */
export const FALLBACK_MODEL = {
  sigma8: { R: 8, G: 5, B: 10 },
  mtf: { R: 0.75, G: 0.9, B: 0.7 },
  gamma: GAMMA,
  crosstalk: [ // observed = M·displayed (linear space), mild desaturation
    [0.90, 0.06, 0.04],
    [0.05, 0.90, 0.05],
    [0.04, 0.08, 0.88],
  ],
  offset: [0.02, 0.02, 0.03],
  source: 'fallback (Bayer + MJPEG 4:2:0 literature); replace with channel-check.html measurement',
};
