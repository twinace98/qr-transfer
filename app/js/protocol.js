// protocol.js — QR optical FTP wire protocol (faithful replica of the original app).
//
// Frame grammar (fields are '|'-separated; payload is always the LAST field so it may
// safely contain no '|' — the base64 alphabet has none):
//
//   TX|INIT|<fileName>|<mimeType>|<nChunks>|<chunkSize>|<salt>
//   TX|DATA|<seq>|<nChunks>|<salt>|<payloadBase64>
//   TX|END|<nChunks>|<salt>
//   RX|ACK_INIT|<salt>
//   RX|ACK|<seq>|<salt>
//   RX|ACK_END|<salt>
//
// Pure module: no DOM, no timers. Works in the browser and under Node (for tests).

export const IDLE_VALUE = 'QR_FTP_IDLE';

/** Random 6-char base36 salt — matches original `Math.random().toString(36).substring(2,8)`.
 *  The salt only forces a visual change between otherwise-identical frames so the scanner
 *  re-triggers; it carries no data. */
export function generateSalt() {
  return Math.random().toString(36).substring(2, 8);
}

// --- Frame builders ---------------------------------------------------------

export function buildTxInit({ fileName, mimeType, nChunks, chunkSize, salt }) {
  return `TX|INIT|${fileName}|${mimeType}|${nChunks}|${chunkSize}|${salt}`;
}

export function buildTxData({ seq, nChunks, salt, payload }) {
  return `TX|DATA|${seq}|${nChunks}|${salt}|${payload}`;
}

export function buildTxEnd({ nChunks, salt }) {
  return `TX|END|${nChunks}|${salt}`;
}

export function buildRxAckInit(salt) {
  return `RX|ACK_INIT|${salt}`;
}

export function buildRxAck(seq, salt) {
  return `RX|ACK|${seq}|${salt}`;
}

export function buildRxAckEnd(salt) {
  return `RX|ACK_END|${salt}`;
}

// --- Frame parser -----------------------------------------------------------

/**
 * Parse a scanned string into a typed frame object, or `null` if it is not a
 * recognizable protocol frame. Numeric fields are coerced to Number.
 *
 * Note: DATA payload is rejoined with '|' in the unlikely event the encoder ever
 * produced one, mirroring `parts[5]` semantics but robust to stray separators.
 */
export function parseFrame(str) {
  if (typeof str !== 'string') return null;
  const parts = str.split('|');
  if (parts.length < 2) return null;

  const dir = parts[0];
  const type = parts[1];

  if (dir === 'TX') {
    if (type === 'INIT' && parts.length >= 7) {
      return {
        dir, type,
        fileName: parts[2],
        mimeType: parts[3],
        nChunks: Number(parts[4]),
        chunkSize: Number(parts[5]),
        salt: parts[6],
      };
    }
    if (type === 'DATA' && parts.length >= 6) {
      return {
        dir, type,
        seq: Number(parts[2]),
        nChunks: Number(parts[3]),
        salt: parts[4],
        payload: parts.slice(5).join('|'),
      };
    }
    if (type === 'END' && parts.length >= 4) {
      return { dir, type, nChunks: Number(parts[2]), salt: parts[3] };
    }
  } else if (dir === 'RX') {
    if (type === 'ACK_INIT' && parts.length >= 3) {
      return { dir, type, salt: parts[2] };
    }
    if (type === 'ACK' && parts.length >= 4) {
      return { dir, type, seq: Number(parts[2]), salt: parts[3] };
    }
    if (type === 'ACK_END' && parts.length >= 3) {
      return { dir, type, salt: parts[2] };
    }
  }
  return null;
}
