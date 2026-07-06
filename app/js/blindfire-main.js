// blindfire-main.js — UI glue for the one-way blind-fire mode (Phase 3 closeout).
// Opt-in page (blindfire.html); the replica app (index.html/main.js) is untouched.

import { BlindFireSender } from './blindfire-tx.js';
import { BlindFireReceiver } from './blindfire-rx.js';

const $ = (id) => document.getElementById(id);
const META_EVERY = 32;

// --- send ---------------------------------------------------------------------
let qr = null, timer = null, sender = null, frames = 0;

function stopTx() {
  if (timer) { clearInterval(timer); timer = null; }
  $('btn-start-tx').disabled = false;
  $('btn-stop-tx').disabled = true;
}

async function startTx() {
  const file = $('file-input').files[0];
  if (!file) { $('tx-status').textContent = 'Pick a file first.'; return; }
  const blockSize = parseInt($('block-size').value, 10);
  const fps = parseInt($('fps').value, 10);
  const bytes = new Uint8Array(await file.arrayBuffer());
  sender = await BlindFireSender.create(bytes, { blockSize });
  const meta = { fileName: file.name, mimeType: file.type || 'application/octet-stream' };
  frames = 0;
  // eslint-disable-next-line no-undef
  if (!qr) qr = new QRious({ element: $('tx-canvas'), size: 640, level: 'L' });
  stopTx();
  $('btn-start-tx').disabled = true;
  $('btn-stop-tx').disabled = false;
  timer = setInterval(() => {
    const pkt = frames % META_EVERY === 0 ? sender.metaPacket(meta) : sender.nextPacket();
    frames++;
    let s = ''; for (const b of pkt) s += String.fromCharCode(b);   // Latin-1 (browser-verified v40-L)
    qr.value = s;
    $('tx-status').textContent =
      `broadcasting: k=${sender.k}, frame ${frames} (${16 + blockSize} B/frame, one-way — leave it running)`;
  }, 1000 / fps);
}

// --- receive ------------------------------------------------------------------
let receiver = null, resultBlob = null, resultName = 'file.bin';

async function onPacketBytes(bytes) {
  if (!receiver || receiver.done) return;
  const finished = receiver.onPacket(bytes);
  const pct = Math.round(receiver.progress * 100);
  $('rx-status').textContent = receiver.dec
    ? `receiving: ${receiver.dec.solved}/${receiver.dec.k} blocks (${pct}%), ${receiver.packetsSeen} pkts`
    : 'waiting for first frame…';
  if (finished) {
    const out = await receiver.result();
    const meta = receiver.meta || {};
    resultName = meta.fileName || 'file.bin';
    resultBlob = new Blob([out], { type: meta.mimeType || 'application/octet-stream' });
    $('rx-status').textContent = `DONE — ${resultName} (${out.length} bytes) reconstructed.`;
    $('btn-download').disabled = false;
  }
}

function download() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(resultBlob);
  a.download = resultName;
  a.click();
}

// --- init ---------------------------------------------------------------------
async function init() {
  $('btn-start-tx').addEventListener('click', startTx);
  $('btn-stop-tx').addEventListener('click', stopTx);
  $('btn-download').addEventListener('click', download);
  const { createScanner } = await import('./camera.js');
  receiver = new BlindFireReceiver();
  const scanner = createScanner({
    video: $('rx-video'), canvas: $('rx-canvas'),
    onDecode: () => {},                     // strings are foreign here
    onDecodeBinary: onPacketBytes,
    onStatus: (m) => { $('rx-status').textContent = m; },
    onError: (m) => { $('rx-status').textContent = 'Camera error: ' + m; },
  });
  $('btn-start-rx').addEventListener('click', () => scanner.start());
  $('btn-switch-cam').addEventListener('click', () => scanner.toggleFacing());
}
window.addEventListener('DOMContentLoaded', init);
