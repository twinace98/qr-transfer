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
