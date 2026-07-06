// fountain.js — LT fountain code (robust soliton) for the blind-fire transport (Phase 3.2).
//
// One-way rateless transport: the sender first emits every raw block once (systematic pass,
// seeds SYSTEMATIC_BASE+i), then infinite random droplets (seeds 1,2,3,…), each the XOR of a
// pseudo-random neighbor set. The receiver derives the SAME neighbor set from the 4-byte seed
// alone (shared xorshift32 + robust-soliton CDF), so a peeling decoder can reconstruct the k
// blocks from ANY k(1+ε) received packets — no ACK, no retransmit, no reverse channel.
//
// Pure module: no DOM, no timers. Works in the browser and under Node (for tests/bench).

/** Systematic seeds: seed >= SYSTEMATIC_BASE means "raw block (seed - SYSTEMATIC_BASE)". */
export const SYSTEMATIC_BASE = 0x80000000;

/** Robust-soliton parameters — LOCKED 3.2 (scan in data/003-fountain/overhead.json):
 *  c=0.1, delta=0.05 minimizes GE-finished overhead (mean eps k64=5.6%, k128=3.4%, k256=2.0%). */
export const LT_C = 0.1;
export const LT_DELTA = 0.05;

// --- deterministic PRNG (identical tx/rx) -----------------------------------

/** xorshift32 — tiny deterministic PRNG. Returns fn -> float in [0,1).
 *  The raw seed is avalanched (murmur fmix32) first: consecutive seeds (1,2,3,…) would
 *  otherwise share nearly identical first outputs, collapsing the degree distribution
 *  (observed in 3.2: every droplet came out degree-2 and the peeler never started). */
export function xorshift32(seed) {
  let s = seed >>> 0;
  s = Math.imul(s ^ (s >>> 16), 0x45D9F3B) >>> 0;
  s = Math.imul(s ^ (s >>> 16), 0x45D9F3B) >>> 0;
  s ^= s >>> 16;
  if (s === 0) s = 0x1F123BB5;
  return function () {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

// --- robust soliton degree distribution --------------------------------------

/**
 * Robust-soliton CDF over degrees 1..k (Luby 2002).
 *   rho(1)=1/k, rho(i)=1/(i(i-1));  tau spikes at i = k/R with R = c*ln(k/delta)*sqrt(k).
 * @returns {Float64Array} cdf where cdf[i-1] = P(degree <= i).
 */
export function robustSolitonCDF(k, c = LT_C, delta = LT_DELTA) {
  const R = c * Math.log(k / delta) * Math.sqrt(k);
  const spike = Math.max(1, Math.min(k, Math.floor(k / R)));
  const p = new Float64Array(k);
  for (let i = 1; i <= k; i++) {
    const rho = i === 1 ? 1 / k : 1 / (i * (i - 1));
    let tau = 0;
    if (R > 1) {
      if (i < spike) tau = R / (i * k);
      else if (i === spike) tau = (R * Math.log(R / delta)) / k;
    }
    p[i - 1] = rho + tau;
  }
  let sum = 0;
  for (let i = 0; i < k; i++) sum += p[i];
  const cdf = new Float64Array(k);
  let acc = 0;
  for (let i = 0; i < k; i++) { acc += p[i] / sum; cdf[i] = acc; }
  cdf[k - 1] = 1; // guard against fp round-off
  return cdf;
}

/**
 * Derive the droplet's neighbor set from its seed — the ONLY thing that travels is the seed.
 * Sender and receiver call this with the same (seed, k, cdf) and get the same sorted indices.
 * @returns {number[]} sorted distinct block indices in [0, k).
 */
export function neighborsFromSeed(seed, k, cdf) {
  const rnd = xorshift32(seed);
  const r = rnd();
  let deg = 1;
  while (deg < k && cdf[deg - 1] < r) deg++;
  const set = new Set();
  while (set.size < deg) set.add(Math.floor(rnd() * k) % k);
  return [...set].sort((a, b) => a - b);
}

// --- helpers ------------------------------------------------------------------

function xorInto(dst, src) {
  for (let i = 0; i < dst.length; i++) dst[i] ^= src[i];
}

/** Split `bytes` into k equal blocks of `blockSize` (last block zero-padded). */
export function splitBlocks(bytes, blockSize) {
  const k = Math.max(1, Math.ceil(bytes.length / blockSize));
  const blocks = [];
  for (let i = 0; i < k; i++) {
    const b = new Uint8Array(blockSize);
    b.set(bytes.subarray(i * blockSize, (i + 1) * blockSize));
    blocks.push(b);
  }
  return blocks;
}

// --- encoder --------------------------------------------------------------------

export class LTEncoder {
  /**
   * @param {Uint8Array[]} blocks  k equal-size source blocks
   * @param {{c?:number, delta?:number}} [opts]
   */
  constructor(blocks, { c = LT_C, delta = LT_DELTA } = {}) {
    this.blocks = blocks;
    this.k = blocks.length;
    this.blockSize = blocks[0].length;
    this.cdf = robustSolitonCDF(this.k, c, delta);
    this._sysNext = 0;   // systematic pass cursor
    this._dropSeed = 0;  // droplet seed cursor (first droplet seed = 1)
  }

  /** Next packet: systematic pass first (each raw block once), then infinite droplets.
   *  @returns {{seed:number, data:Uint8Array}} */
  next() {
    if (this._sysNext < this.k) {
      const i = this._sysNext++;
      return { seed: SYSTEMATIC_BASE + i, data: this.blocks[i].slice() };
    }
    const seed = ++this._dropSeed;
    return { seed, data: this.encodeSeed(seed) };
  }

  /** XOR of the neighbor set for `seed` (droplet payload). Deterministic. */
  encodeSeed(seed) {
    const nbrs = neighborsFromSeed(seed, this.k, this.cdf);
    const out = new Uint8Array(this.blockSize);
    for (const i of nbrs) xorInto(out, this.blocks[i]);
    return out;
  }
}

// --- decoder --------------------------------------------------------------------

export class LTDecoder {
  /**
   * @param {number} k          number of source blocks
   * @param {number} blockSize  bytes per block
   * @param {{c?:number, delta?:number}} [opts]
   */
  constructor(k, blockSize, { c = LT_C, delta = LT_DELTA } = {}) {
    this.k = k;
    this.blockSize = blockSize;
    this.cdf = robustSolitonCDF(k, c, delta);
    this.blocks = new Array(k).fill(null);   // solved source blocks
    this.solved = 0;
    this.received = 0;                        // packets fed (for overhead accounting)
    this._pending = [];                       // {nbrs:Set<number>, data:Uint8Array}
    this._seen = new Set();                   // seeds already fed (duplicates are free)
    this._nextGE = k;                         // earliest received-count to attempt GE finish
  }

  get done() { return this.solved === this.k; }

  /** Feed one packet {seed, data}. Returns true if it advanced the decode. */
  addPacket(seed, data) {
    if (this.done || this._seen.has(seed)) return false;
    this._seen.add(seed);
    this.received++;

    let nbrs;
    if (seed >= SYSTEMATIC_BASE) {
      nbrs = new Set([seed - SYSTEMATIC_BASE]);
    } else {
      nbrs = new Set(neighborsFromSeed(seed, this.k, this.cdf));
    }
    const d = { nbrs, data: data.slice() };
    // substitute already-solved blocks out of the new droplet
    for (const i of [...d.nbrs]) {
      if (this.blocks[i] !== null) { xorInto(d.data, this.blocks[i]); d.nbrs.delete(i); }
    }
    if (d.nbrs.size === 0) return false;      // pure duplicate information
    this._pending.push(d);
    this._peel();
    // Peeling alone needs ~25-50% overhead at our k (measured 3.2). Once we hold >= as many
    // equations as unknowns, finish with GF(2) elimination (inactivation decoding) — this is
    // the standard LT/Raptor trick and cuts eps to a few %. Amortized: retry every few packets.
    if (!this.done && this._pending.length >= this.k - this.solved &&
        this.received >= this._nextGE) {
      this._nextGE = this.received + Math.max(2, Math.ceil(this.k * 0.01));
      this._gaussianFinish();
    }
    return true;
  }

  /**
   * GF(2) Gaussian elimination over the residual system (unsolved blocks x pending droplets).
   * Solves whatever the current equations determine (all of it if rank == unknowns), then
   * hands newly-solved blocks back to the peeler. One-way: uses only received packets.
   */
  _gaussianFinish() {
    const unknowns = [];
    const col = new Int32Array(this.k).fill(-1);
    for (let i = 0; i < this.k; i++) if (this.blocks[i] === null) { col[i] = unknowns.length; unknowns.push(i); }
    const m = unknowns.length;
    if (m === 0 || this._pending.length < m) return;

    const W = m + this.blockSize;               // row = [coeff bits as bytes | payload]
    const rows = [];
    for (const d of this._pending) {
      const r = new Uint8Array(W);
      for (const i of d.nbrs) r[col[i]] = 1;
      r.set(d.data, m);
      rows.push(r);
    }
    // forward elimination
    let rank = 0;
    for (let c = 0; c < m && rank < rows.length; c++) {
      let piv = -1;
      for (let r = rank; r < rows.length; r++) if (rows[r][c]) { piv = r; break; }
      if (piv === -1) continue;
      [rows[rank], rows[piv]] = [rows[piv], rows[rank]];
      const pr = rows[rank];
      for (let r = 0; r < rows.length; r++) {
        if (r !== rank && rows[r][c]) xorInto(rows[r], pr);
      }
      rank++;
    }
    // extract rows that became single-unknown (after full reduction, any row with exactly
    // one coefficient bit set determines that block)
    let solvedAny = false;
    for (const r of rows) {
      let one = -1, deg = 0;
      for (let c = 0; c < m; c++) if (r[c]) { one = c; if (++deg > 1) break; }
      if (deg !== 1) continue;
      const blockIdx = unknowns[one];
      if (this.blocks[blockIdx] !== null) continue;
      this.blocks[blockIdx] = r.slice(m);
      this.solved++;
      solvedAny = true;
    }
    if (!solvedAny) return;
    // substitute solved blocks into pending and let the peeler cascade the rest
    for (const d of this._pending) {
      for (const i of [...d.nbrs]) {
        if (this.blocks[i] !== null) { xorInto(d.data, this.blocks[i]); d.nbrs.delete(i); }
      }
    }
    this._pending = this._pending.filter((d) => d.nbrs.size > 0);
    this._peel();
  }

  /** Peeling cascade: resolve degree-1 droplets, substitute, repeat. */
  _peel() {
    let progressed = true;
    while (progressed) {
      progressed = false;
      for (let p = this._pending.length - 1; p >= 0; p--) {
        const d = this._pending[p];
        if (d.nbrs.size !== 1) continue;
        const i = d.nbrs.values().next().value;
        this._pending.splice(p, 1);
        if (this.blocks[i] !== null) continue;          // already solved meanwhile
        this.blocks[i] = d.data;
        this.solved++;
        for (const q of this._pending) {                // substitute into the rest
          if (q.nbrs.has(i)) { xorInto(q.data, this.blocks[i]); q.nbrs.delete(i); }
        }
        progressed = true;
      }
    }
  }

  /** Reassembled bytes (first `fileLen` of the concatenated blocks). Throws if not done. */
  join(fileLen) {
    if (!this.done) throw new Error('decoder not done');
    const out = new Uint8Array(this.k * this.blockSize);
    for (let i = 0; i < this.k; i++) out.set(this.blocks[i], i * this.blockSize);
    return out.subarray(0, fileLen);
  }
}
