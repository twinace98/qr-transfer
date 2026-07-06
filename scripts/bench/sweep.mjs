// sweep.mjs — Phase 2.2 baseline sweep. Writes data/001-baseline/{sweep.csv, b0.json}.
// Run: node scripts/bench/sweep.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCase, makePayloads } from './bench.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../../data/001-baseline');
fs.mkdirSync(OUT, { recursive: true });

const CHUNK = [100, 250, 500, 800];
const DROP = [0, 0.01, 0.05];
const FPS = [10, 15, 30];
const SEED = 20260706;
const { text, binary } = makePayloads();
const FILES = [
  { name: 'text-10k', bytes: text },
  { name: 'binary-10k', bytes: binary },
];

const rows = [];
let allSha = true;
for (const f of FILES) {
  for (const cs of CHUNK) {
    for (const drop of DROP) {
      for (const fps of FPS) {
        const r = runCase({ fileBytes: f.bytes, chunkSize: cs, fps, dropProb: drop, seed: SEED });
        allSha = allSha && r.okSha;
        rows.push({
          file: f.name, bytes: r.bytes, chunkSize: cs, dropProb: drop, fps,
          txSlots: r.txSlots, ackSlots: r.ackSlots, totalSlots: r.frames,
          retransmits: r.retransmits, seconds: +r.seconds.toFixed(3),
          bytesPerSec: +r.bytesPerSec.toFixed(1), maxQrVersion: r.maxQrVersion, okSha: r.okSha,
        });
      }
    }
  }
}

// CSV
const cols = Object.keys(rows[0]);
const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => r[c]).join(','))].join('\n') + '\n';
fs.writeFileSync(path.join(OUT, 'sweep.csv'), csv);

// Determinism spot-check: re-run one case, compare slot count.
const spec = { fileBytes: text, chunkSize: 250, fps: 15, dropProb: 0.05, seed: SEED };
const d1 = runCase(spec), d2 = runCase(spec);
const deterministic = d1.frames === d2.frames && d1.okSha && d2.okSha;

// B0 = headline: text-10k, cs=250, drop=0, fps=15
const b0row = rows.find((r) => r.file === 'text-10k' && r.chunkSize === 250 && r.dropProb === 0 && r.fps === 15);
const b0 = {
  B0_bytesPerSec: b0row.bytesPerSec,
  definition: 'text-10k, chunkSize=250, dropProb=0, fps=15 (headline baseline)',
  assumptions: {
    model: 'slot model: wall-clock = (txSlots+ackSlots)/fps; stop-and-wait = DATA slot + ACK slot per chunk',
    fps_swept: FPS, ack_channel: 'reliable (baseline)', seed: SEED,
    note: 'bytesPerSec scales linearly with fps; the >=3x Phase-3 target is fps-invariant (relative).',
  },
  allShaExact: allSha,
  deterministic,
  files: FILES.map((f) => ({ name: f.name, bytes: f.bytes.length })),
};
fs.writeFileSync(path.join(OUT, 'b0.json'), JSON.stringify(b0, null, 2) + '\n');

console.log(`wrote ${rows.length} rows -> data/001-baseline/sweep.csv`);
console.log(`allShaExact=${allSha}  deterministic=${deterministic}`);
console.log(`B0 = ${b0.B0_bytesPerSec} B/s  (${b0.definition})`);
console.log('\nB0-anchored slice (text-10k, fps=15):');
console.table(rows.filter((r) => r.file === 'text-10k' && r.fps === 15)
  .map((r) => ({ chunkSize: r.chunkSize, drop: r.dropProb, totalSlots: r.totalSlots, retx: r.retransmits, B_per_s: r.bytesPerSec, qrV: r.maxQrVersion })));
