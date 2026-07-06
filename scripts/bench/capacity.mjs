// capacity.mjs — QR byte-mode data capacity per version at EC level M.
//
// The replica encodes the full frame string "TX|DATA|seq|nChunks|salt|payload" as a QR.
// That string contains lowercase letters and '|', which are outside the QR *alphanumeric*
// charset, so QRious encodes it in *byte* mode. These are the standard byte-mode capacities
// (bytes) at EC level M for versions 1..40. Used only to *report* which QR version each
// chunk size implies — a comparison column, not a gate.

// index = version (1..40); [0] is a placeholder.
export const BYTE_CAPACITY_M = [
  0,
  14, 26, 42, 62, 84, 106, 122, 152, 180, 213,     // 1..10
  251, 287, 331, 362, 412, 450, 504, 560, 624, 666, // 11..20
  711, 779, 857, 911, 997, 1059, 1125, 1190, 1264, 1370, // 21..30
  1452, 1538, 1628, 1722, 1809, 1911, 1989, 2099, 2213, 2331, // 31..40
];

/** Smallest QR version (EC-M, byte mode) that holds `nBytes`, or null if it exceeds V40. */
export function qrVersionForBytes(nBytes) {
  for (let v = 1; v <= 40; v++) if (BYTE_CAPACITY_M[v] >= nBytes) return v;
  return null;
}

// Byte-mode capacities at EC level L (blind-fire uses L: CRC16 pre-gates corrupt frames,
// so we trade QR redundancy for payload). index = version 1..40.
export const BYTE_CAPACITY_L = [
  0,
  17, 32, 53, 78, 106, 134, 154, 192, 230, 271,      // 1..10
  321, 367, 425, 458, 520, 586, 644, 718, 792, 858,   // 11..20
  929, 1003, 1091, 1171, 1273, 1367, 1465, 1528, 1628, 1732, // 21..30
  1840, 1952, 2068, 2188, 2303, 2431, 2563, 2699, 2809, 2953, // 31..40
];

/** Smallest QR version (EC-L, byte mode) that holds `nBytes`, or null if it exceeds V40. */
export function qrVersionForBytesL(nBytes) {
  for (let v = 1; v <= 40; v++) if (BYTE_CAPACITY_L[v] >= nBytes) return v;
  return null;
}
