// main.js — wires the modules to the DOM. Faithful to the original app's behavior:
// both modes share one QR output surface and one webcam scanner; on scan, frames are
// routed to Tx (reads RX ACKs) or Rx (reads TX data) depending on the active tab.

import { parseFrame, IDLE_VALUE } from './protocol.js';
import { createDisplay } from './qr.js';
import { createScanner } from './camera.js';
import { Transmitter, fileToBase64 } from './tx.js';
import { Receiver, base64ToBlob } from './rx.js';

const $ = (id) => document.getElementById(id);

let mode = 'send';           // 'send' | 'recv'
let display;                 // QR display
let scanner;                 // webcam scanner
let tx = null;               // active Transmitter
let rx = null;               // active Receiver
let downloadUrl = null;

function flashOverlay() {
  const o = $('camera-overlay');
  o.classList.add('hit');
  setTimeout(() => o.classList.remove('hit'), 200);
}

// --- Scan routing -----------------------------------------------------------

function handleScannedData(data) {
  const frame = parseFrame(data);
  if (!frame) return;
  if (mode === 'send' && frame.dir === 'RX' && tx) {
    tx.onAck(frame);
  } else if (mode === 'recv' && frame.dir === 'TX' && rx) {
    rx.onTxFrame(frame);
  }
}

// --- Transmit ---------------------------------------------------------------

function resetTx() {
  if (tx) tx.stop();
  tx = null;
  $('file-input').value = '';
  $('file-input').disabled = false;
  $('chunk-size-select').disabled = false;
  $('btn-start-tx').disabled = true;
  $('tx-progress-container').classList.add('hidden');
  $('tx-progress-bar').style.width = '0%';
  $('tx-progress-text').textContent = '0 / 0 chunks';
}

async function startTransmission() {
  const file = $('file-input').files[0];
  if (!file) return;
  $('btn-start-tx').disabled = true;
  $('file-input').disabled = true;
  $('chunk-size-select').disabled = true;
  $('tx-progress-container').classList.remove('hidden');

  const chunkSize = parseInt($('chunk-size-select').value, 10);
  const base64 = await fileToBase64(file);

  tx = new Transmitter({ chunkSize });
  tx.onFrame = (value, statusText) => display.update(value, statusText);
  tx.onProgress = (cur, total) => {
    $('tx-progress-text').textContent = `${cur} / ${total} chunks`;
    $('tx-progress-bar').style.width = total ? `${Math.round((cur / total) * 100)}%` : '0%';
  };
  tx.onDone = () => {
    $('file-input').disabled = false;
    $('chunk-size-select').disabled = false;
    $('tx-progress-text').textContent = 'Done!';
  };
  tx.loadBase64(base64, { fileName: file.name, mimeType: file.type });
  tx.start();
}

// --- Receive ----------------------------------------------------------------

function resetRx() {
  rx = new Receiver();
  rx.onProgress = (cur, total) => {
    $('rx-progress-container').classList.remove('hidden');
    $('rx-progress-text').textContent = `${cur} / ${total} chunks`;
    $('rx-progress-bar').style.width = total ? `${Math.round((cur / total) * 100)}%` : '0%';
  };
  rx.onFrame = (value, statusText) => display.update(value, statusText);
  rx.onComplete = (b64, meta) => {
    try {
      const blob = base64ToBlob(b64, meta.mimeType);
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
      downloadUrl = URL.createObjectURL(blob);
      rx._fileName = meta.fileName;
      $('rx-status-text').textContent = 'Transfer Complete!';
      $('rx-status-text').classList.add('good');
      $('btn-download').classList.remove('hidden');
    } catch (e) {
      $('rx-status-text').innerHTML = '<span class="err">File Reconstruction Failed.</span>';
    }
  };
  $('rx-status-text').textContent = "Point the camera at the sender's QR codes.";
  $('rx-status-text').classList.remove('good');
  $('rx-progress-container').classList.add('hidden');
  $('rx-progress-bar').style.width = '0%';
  $('btn-download').classList.add('hidden');
}

function triggerDownload() {
  if (!downloadUrl) return;
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = (rx && rx._fileName) || 'received_file.bin';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// --- Mode switch ------------------------------------------------------------

function switchMode(next) {
  mode = next;
  $('tab-send').classList.toggle('active', mode === 'send');
  $('tab-recv').classList.toggle('active', mode === 'recv');
  $('ui-send').classList.toggle('hidden', mode === 'recv');
  $('ui-recv').classList.toggle('hidden', mode === 'send');
  resetTx();
  resetRx();
  display.update(IDLE_VALUE, 'Idle state.');
}

// --- Camera fallback (upload a QR image when the webcam is blocked) ----------

function showCameraError(msg) {
  $('scan-status').innerHTML =
    `<span class="err">Camera blocked: ${msg}</span><br/>` +
    `<button id="btn-manual-scan" class="btn btn-sm" style="margin-top:.5rem;">Manual Scan (Upload QR Image)</button>`;
  $('btn-manual-scan').addEventListener('click', () => $('fallback-camera-input').click());
}

async function handleFallbackImage(e) {
  if (!e.target.files.length) return;
  const result = await scanner.decodeImageFile(e.target.files[0]);
  if (result) {
    $('scan-status').innerHTML =
      '<span class="good">Manual scan successful!</span><br/>' +
      '<button id="btn-manual-scan" class="btn btn-sm" style="margin-top:.5rem;">Scan Next Image</button>';
  } else {
    $('scan-status').innerHTML =
      '<span class="err">No QR code found in image.</span><br/>' +
      '<button id="btn-manual-scan" class="btn btn-sm" style="margin-top:.5rem;">Try Again</button>';
  }
  const b = $('btn-manual-scan');
  if (b) b.addEventListener('click', () => $('fallback-camera-input').click());
  e.target.value = '';
}

// --- Init -------------------------------------------------------------------

function init() {
  display = createDisplay($('qr-canvas'), $('qr-status'));

  scanner = createScanner({
    video: $('camera-preview'),
    canvas: $('camera-canvas'),
    onDecode: handleScannedData,
    onStatus: (m) => { $('scan-status').textContent = m; $('scan-status').classList.remove('err'); },
    onError: showCameraError,
    onHit: flashOverlay,
  });

  $('tab-send').addEventListener('click', () => switchMode('send'));
  $('tab-recv').addEventListener('click', () => switchMode('recv'));
  $('btn-switch-cam').addEventListener('click', () => scanner.toggleFacing());
  $('file-input').addEventListener('change', (e) => {
    $('btn-start-tx').disabled = e.target.files.length === 0;
  });
  $('btn-start-tx').addEventListener('click', startTransmission);
  $('btn-download').addEventListener('click', triggerDownload);
  $('fallback-camera-input').addEventListener('change', handleFallbackImage);

  resetTx();
  resetRx();
  display.update(IDLE_VALUE, 'Idle state.');
  scanner.start();
}

window.addEventListener('DOMContentLoaded', init);
