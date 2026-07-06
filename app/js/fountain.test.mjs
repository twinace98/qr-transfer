// fountain.test.mjs — 3.2 pass criterion: SHA-256-exact reconstruction with ZERO back-channel,
// systematic + droplet paths, CRC gate, drop-rate robustness, overhead sanity.
// Run: node app/js/fountain.test.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { xorshift32, robustSolitonCDF, neighborsFromSeed, splitBlocks, LTEncoder, LTDecoder, SYSTEMATIC_BASE }
  from './fountain.js';
import { BlindFireSender, buildPacket, crcOverPacket } from './blindfire-tx.js';
import { BlindFireReceiver, parsePacket } from './blindfire-rx.js';
import { mulberry32 } from '../../scripts/bench/channel.mjs';

let n = 0;
const ok = (m) => console.log(`  ok ${++n} - ${m}`);
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

// --- determinism: same seed -> same neighbor set (tx/rx symmetry) ---
{
  const k = 128, cdf = robustSolitonCDF(k);
  for (const seed of [1, 2, 1000, 0xDEADBEEF]) {
    const a = neighborsFromSeed(seed, k, cdf);
    const b = neighborsFromSeed(seed, k, cdf);
    assert.deepEqual(a, b, `seed ${seed} deterministic`);
    assert.ok(a.length >= 1 && a.every((i) => i >= 0 && i < k), 'indices in range');
    assert.equal(new Set(a).size, a.length, 'indices distinct');
  }
  const r = xorshift32(0)(); // zero seed must not degenerate
  assert.ok(r >= 0 && r < 1);
  ok('neighborsFromSeed deterministic, distinct, in-range (incl. seed edge cases)');
}

// --- CDF sanity ---
{
  const cdf = robustSolitonCDF(64);
  assert.equal(cdf.length, 64);
  for (let i = 1; i < 64; i++) assert.ok(cdf[i] >= cdf[i - 1], 'monotone');
  assert.ok(Math.abs(cdf[63] - 1) < 1e-12, 'sums to 1');
  ok('robust-soliton CDF monotone, normalized');
}

// --- systematic pass alone decodes at 0% drop (exactly k packets) ---
{
  const data = new Uint8Array(crypto.randomBytes(100 * 64));
  const blocks = splitBlocks(data, 100);
  const enc = new LTEncoder(blocks);
  const dec = new LTDecoder(blocks.length, 100);
  for (let i = 0; i < blocks.length; i++) {
    const { seed, data: d } = enc.next();
    assert.ok(seed >= SYSTEMATIC_BASE, 'systematic pass first');
    dec.addPacket(seed, d);
  }
  assert.ok(dec.done, 'done after exactly k systematic packets');
  assert.equal(sha(dec.join(data.length)), sha(data), 'byte-exact');
  ok(`systematic pass: k=${blocks.length} packets -> done, SHA exact (overhead 0)`);
}

// --- droplets only (entire systematic pass lost — worst-case late join) ---
{
  const data = new Uint8Array(crypto.randomBytes(100 * 64));
  const blocks = splitBlocks(data, 100);
  const enc = new LTEncoder(blocks);
  for (let i = 0; i < blocks.length; i++) enc.next();      // burn the systematic pass
  const dec = new LTDecoder(blocks.length, 100);
  let sent = 0;
  while (!dec.done && sent < blocks.length * 4) { const { seed, data: d } = enc.next(); dec.addPacket(seed, d); sent++; }
  assert.ok(dec.done, 'droplets-only decode completes');
  assert.equal(sha(dec.join(data.length)), sha(data), 'byte-exact');
  ok(`droplets-only: k=${blocks.length}, received ${sent} droplets (eps=${((sent / blocks.length - 1) * 100).toFixed(1)}%)`);
}

// --- packet layer: build/parse round-trip, CRC gate, foreign magic ---
{
  const payload = new Uint8Array(crypto.randomBytes(100));
  const pkt = buildPacket({ fileId: 0xABCD, k: 64, fileLen: 6400, seed: 12345, payload });
  const p = parsePacket(pkt);
  assert.ok(p && p.fileId === 0xABCD && p.k === 64 && p.fileLen === 6400 && p.seed === 12345);
  assert.equal(Buffer.compare(Buffer.from(p.payload), Buffer.from(payload)), 0);
  const bad = pkt.slice(); bad[20] ^= 0x01;
  assert.equal(parsePacket(bad), null, 'corrupted payload rejected by CRC');
  const badHdr = pkt.slice(); badHdr[5] ^= 0x01;
  assert.equal(parsePacket(badHdr), null, 'corrupted header rejected by CRC');
  const foreign = pkt.slice(); foreign[0] = 0x00;
  assert.equal(parsePacket(foreign), null, 'foreign magic rejected');
  assert.equal(crcOverPacket(pkt), new DataView(pkt.buffer).getUint16(14), 'stored CRC matches');
  ok('packet build/parse round-trip; CRC gates corruption; magic gates foreign QR');
}

// --- blind-fire end-to-end, ZERO back-channel, drop sweep (seeded channel) ---
{
  const text = new Uint8Array(Buffer.from('Blind-fire fountain transport test. '.repeat(400))); // ~14.8 KB
  const bin = new Uint8Array(crypto.randomBytes(8 * 1024));
  for (const [name, file] of [['text', text], ['binary', bin]]) {
    for (const drop of [0, 0.05, 0.2]) {
      const tx = await BlindFireSender.create(file, { blockSize: 100, fileId: 0x0F0F });
      const rx = new BlindFireReceiver();
      const rnd = mulberry32(1234 + drop * 1000);
      let displayed = 0;
      const cap = tx.k * 10;
      while (!rx.done && displayed < cap) {
        const pkt = tx.nextPacket();
        displayed++;
        if (drop > 0 && rnd() < drop) continue;          // frame lost in the channel
        rx.onPacket(pkt);
      }
      assert.ok(rx.done, `${name} drop=${drop} completes (one-way, no retransmit logic)`);
      const out = await rx.result();
      assert.equal(sha(out), sha(file), `${name} drop=${drop} SHA-256-exact`);
      const eps = rx.packetsSeen / tx.k - 1;
      ok(`blind-fire ${name} drop=${(drop * 100).toFixed(0)}%: k=${tx.k}, displayed=${displayed}, received=${rx.packetsSeen} (eps=${(eps * 100).toFixed(1)}%), SHA exact`);
    }
  }
}

// --- late join: receiver misses the whole systematic pass, still completes ---
{
  const file = new Uint8Array(crypto.randomBytes(6 * 1024));
  const tx = await BlindFireSender.create(file, { blockSize: 100, fileId: 1 });
  for (let i = 0; i < tx.k; i++) tx.nextPacket();        // rx not listening yet
  const rx = new BlindFireReceiver();
  let fed = 0;
  while (!rx.done && fed < tx.k * 5) { rx.onPacket(tx.nextPacket()); fed++; }
  assert.ok(rx.done, 'late-join completes from droplets alone');
  assert.equal(sha(await rx.result()), sha(file), 'late-join SHA exact');
  ok(`late join (systematic pass missed): k=${tx.k}, droplets fed=${fed}`);
}

console.log(`\nfountain.test: ${n} checks passed`);
