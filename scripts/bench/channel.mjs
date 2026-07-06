// channel.mjs — deterministic optical-channel model for the benchmark harness.
//
// The model is intentionally simple and *stated*, not a claim about real optics:
//   - discrete frames displayed at `fps` (frame period T = 1/fps seconds)
//   - each displayed Tx frame is independently lost with probability `dropProb`
//     (seeded Bernoulli), forcing the replica's timeout + re-show behavior
//   - the reverse ACK channel is reliable in the baseline (symmetric reverse QR);
//     a lossy-ACK variant is a later sensitivity check, not baseline.

/** mulberry32 — small, fast, seedable PRNG. Deterministic given the seed. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A seeded drop channel. `.lost()` returns true when the current frame is dropped. */
export function makeChannel({ dropProb = 0, seed = 1 } = {}) {
  const rnd = mulberry32(seed);
  return {
    dropProb,
    lost() { return dropProb > 0 && rnd() < dropProb; },
  };
}
