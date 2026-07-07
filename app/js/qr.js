// qr.js — QR display wrapper around QRious (loaded as a global from app/vendor/).
// Faithful to the original: canvas size 300, error-correction level 'M', idle sentinel.

import { IDLE_VALUE } from './protocol.js';

/**
 * Create a QR display bound to a <canvas>. Returns { update(value, statusText) }.
 * `statusEl` is optional; if given, its textContent is set to statusText.
 */
export function createDisplay(canvasEl, statusEl = null) {
  // eslint-disable-next-line no-undef
  const qr = new QRious({
    element: canvasEl,
    size: 560,
    level: 'M',       // Medium error correction (~15%): original's density/durability balance.
    value: IDLE_VALUE,
  });

  return {
    update(value, statusText) {
      qr.value = value;
      if (statusEl && statusText != null) statusEl.textContent = statusText;
    },
    /** Blind-fire uses EC 'L' (CRC16 pre-gates corruption); replica stays 'M'. */
    setLevel(level) { qr.level = level; },
  };
}
