// channelstats.test.mjs — 4.0 pass criterion (synthetic): the estimator recovers a KNOWN
// injected σ and MTF from simulated camera samples. Run: node app/js/channelstats.test.mjs
import assert from 'node:assert/strict';
import { LEVELS, GAMMA, linearize, delinearize, calibrateChannel, mtfProxy, patternLayout, FALLBACK_MODEL }
  from './channelstats.js';
import { mulberry32 } from '../../scripts/bench/channel.mjs';

let n = 0;
const ok = (m) => console.log(`  ok ${++n} - ${m}`);

// deterministic gaussian
function gauss(rnd) { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

// --- layout sanity ---
{
  const L = patternLayout();
  assert.equal(L.filter((p) => p.kind === 'level').length, 12, '3ch x 4 levels');
  assert.equal(L.filter((p) => p.kind === 'checker').length, 4, '3ch + luma checkers');
  assert.ok(L.every((p) => p.x >= 0 && p.x + p.w <= 1.0001 && p.y >= 0 && p.y + p.h <= 1.0001));
  ok('pattern layout: 2 anchors + 12 level patches + 4 checkers, in bounds');
}

// --- gamma round-trip ---
{
  for (const v of [0, 17, 85, 170, 255]) assert.equal(delinearize(linearize(v)), v);
  ok('gamma linearize/delinearize round-trip exact on grid values');
}

// --- sigma recovery: simulate camera samples with known sigma8, gain, offset ---
{
  const rnd = mulberry32(2026);
  for (const sigmaTrue of [3, 5, 10]) {
    const gain = 0.92, off = 0.015; // linear-space channel response
    const samplesByLevel = LEVELS.map((lv) => {
      const clean = gain * linearize(lv) + off;
      const arr = [];
      for (let i = 0; i < 4000; i++) {
        // noise is ~gaussian in DISPLAY units around the clean response
        const disp = delinearize(clean) + sigmaTrue * gauss(rnd);
        arr.push(Math.max(0, Math.min(255, disp)));
      }
      return arr;
    });
    const { a, sigma8 } = calibrateChannel(samplesByLevel);
    assert.ok(Math.abs(a - gain) < 0.05, `gain recovered (${a.toFixed(3)} vs ${gain})`);
    assert.ok(Math.abs(sigma8 - sigmaTrue) / sigmaTrue < 0.25,
      `sigma8 ${sigma8.toFixed(2)} within 25% of true ${sigmaTrue}`);
    ok(`sigma recovery: true=${sigmaTrue} -> est=${sigma8.toFixed(2)} (gain ${a.toFixed(3)})`);
  }
}

// --- MTF proxy: attenuated checker modulation is measured as such ---
{
  const rnd = mulberry32(7);
  for (const mtfTrue of [1.0, 0.7, 0.4]) {
    const dark = 20, light = 220;                       // flat-patch observed means
    const mid = (dark + light) / 2, amp = (light - dark) / 2;
    const samples = [];
    for (let i = 0; i < 2000; i++) {
      const phase = i % 2;
      const clean = mid + (phase ? 1 : -1) * amp * mtfTrue;
      samples.push({ phase, v: clean + 4 * gauss(rnd) });
    }
    const m = mtfProxy(samples, dark, light);
    assert.ok(Math.abs(m - mtfTrue) < 0.05, `mtf ${m.toFixed(3)} ~ ${mtfTrue}`);
    ok(`mtf proxy: true=${mtfTrue} -> est=${m.toFixed(3)}`);
  }
}

// --- fallback model shape (what 4.1-4.3 consume) ---
{
  assert.ok(FALLBACK_MODEL.sigma8.G < FALLBACK_MODEL.sigma8.R, 'G cleaner than R');
  assert.ok(FALLBACK_MODEL.sigma8.G < FALLBACK_MODEL.sigma8.B, 'G cleaner than B');
  assert.equal(FALLBACK_MODEL.crosstalk.length, 3);
  assert.equal(FALLBACK_MODEL.gamma, GAMMA);
  ok('fallback channel model well-formed (G-favored, 3x3 crosstalk, gamma locked)');
}

console.log(`\nchannelstats.test: ${n} checks passed`);
