// blindfire-bench.mjs — Phase 3.3: blind-fire throughput vs baseline B0 on the SAME
// Phase-2 channel model (fps slots, seeded Bernoulli drop). -> data/004-blindfire/sweep.json
// Run: node scripts/bench/blindfire-bench.mjs
//
// Slot model: one QR display per slot, ALL slots are Tx displays (one-way -> zero ACK slots).
// A metadata/preamble packet is broadcast every META_EVERY frames (its cost is charged).
// bytes/frame = 16 B header + blockSize; QR version reported from the EC-L byte table
// (CRC16 pre-gates corruption, so EC drops M->L vs the baseline).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BlindFireSender } from '../../app/js/blindfire-tx.js';
import { BlindFireReceiver } from '../../app/js/blindfire-rx.js';
import { makeChannel } from './channel.mjs';
import { qrVersionForBytesL } from './capacity.mjs';
import { makePayloads } from './bench.mjs';

const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');
const META_EVERY = 32;
const B0 = 1350; // B/s — Phase-2 anchor (text-10k, chunk 250, 0% drop, fps 15)

/** One blind-fire transfer through the seeded drop channel. */
export async function runBlindfireCase({ fileBytes, blockSize, fps = 15, dropProb = 0, seed = 1 }) {
  const src = new Uint8Array(fileBytes);
  const tx = await BlindFireSender.create(src, { blockSize, fileId: 0x1234 });
  const rx = new BlindFireReceiver();
  const channel = makeChannel({ dropProb, seed });

  let displayed = 0;
  const cap = Math.max(tx.k * 20, 500);
  while (!rx.done && displayed < cap) {
    const pkt = displayed % META_EVERY === 0 ? tx.metaPacket({ fileName: 'bench.bin' }) : tx.nextPacket();
    displayed++;
    if (channel.lost()) continue;
    rx.onPacket(pkt);
  }
  const okSha = rx.done && sha256(await rx.result()) === sha256(src);
  const seconds = displayed / fps;                    // NO ack slots — one-way
  return {
    okSha, k: tx.k, fileLen: tx.fileLen, displayed,
    received: rx.packetsSeen, seconds,
    bytesPerSec: src.length / seconds,
    frameBytes: 16 + blockSize,
    qrVersionL: qrVersionForBytesL(16 + blockSize),
  };
}

// --- sweep ---------------------------------------------------------------------
const { text, binary } = makePayloads();
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data/004-blindfire');
fs.mkdirSync(OUT, { recursive: true });

const rows = [];
for (const [name, file] of [['text-10k', text], ['binary-10k', binary]]) {
  for (const blockSize of [100, 250, 500, 800, 1200, 2000]) {
    for (const dropProb of [0, 0.01, 0.05]) {
      const r = await runBlindfireCase({ fileBytes: file, blockSize, dropProb, seed: 7 });
      rows.push({
        file: name, blockSize, drop: dropProb, okSha: r.okSha,
        k: r.k, compLen: r.fileLen, slots: r.displayed,
        Bps: Math.round(r.bytesPerSec), xB0: +(r.bytesPerSec / B0).toFixed(2),
        qrV: r.qrVersionL,
      });
    }
  }
}
console.table(rows);

// determinism: same seed -> identical result
const a = await runBlindfireCase({ fileBytes: binary, blockSize: 500, dropProb: 0.05, seed: 42 });
const b = await runBlindfireCase({ fileBytes: binary, blockSize: 500, dropProb: 0.05, seed: 42 });
const deterministic = a.displayed === b.displayed && a.okSha === b.okSha;
console.log(`determinism (seed 42, drop 5%): slots ${a.displayed} == ${b.displayed} -> ${deterministic ? 'OK' : 'FAIL'}`);

const allSha = rows.every((r) => r.okSha);
const gate = rows.filter((r) => r.drop === 0).sort((x, y) => y.xB0 - x.xB0);
console.log(`all SHA-exact: ${allSha ? 'OK' : 'FAIL'}`);
console.log(`best @0% drop: ${gate[0].file} block=${gate[0].blockSize} -> ${gate[0].Bps} B/s = ${gate[0].xB0}x B0 (QR v${gate[0].qrV})`);
console.log(`binary (incompressible) best @0%: ${gate.find((r) => r.file === 'binary-10k').Bps} B/s = ${gate.find((r) => r.file === 'binary-10k').xB0}x B0`);

fs.writeFileSync(path.join(OUT, 'sweep.json'), JSON.stringify({
  note: `Blind-fire sweep on the Phase-2 channel model (fps 15, seeded drops). B0=${B0} B/s. ` +
        `Slots are ALL Tx displays (no ACK); metadata preamble every ${META_EVERY} frames charged. ` +
        'frameBytes = 16 B header + blockSize; QR version from EC-L byte capacity.',
  B0, rows, deterministic,
}, null, 2) + '\n');
console.log('wrote data/004-blindfire/sweep.json');
process.exit(allSha && deterministic ? 0 : 1);
