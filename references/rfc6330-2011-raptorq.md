# RFC 6330 (2011) — RaptorQ Forward Error Correction

**Source**: M. Luby et al., "RaptorQ Forward Error Correction Scheme for Object Delivery,"
RFC 6330, IETF, 2011. <https://www.rfc-editor.org/rfc/rfc6330>

**Why here**: the "optimal but heavy" alternative to plain LT for Phase 3.2. Recorded so the
choice to use LT is deliberate, not ignorant.

## Key points
- Systematic fountain code with **near-zero overhead** (recovers from ~`k`+2 symbols with
  overwhelming probability) and **linear-time** encode/decode via an LDPC/HDPC precode.
- Standardized (also 3GPP MBMS, DVB); mature, but the spec is large and a correct JS
  implementation is substantial (~thousands of lines / WASM).

## Decision (2026-07-06)
- **Use plain LT, not RaptorQ.** For QR transfer `k` is at most a few hundred, where LT's
  5–15% overhead is acceptable and the decoder is ~100 lines. Revisit only if 3.2 shows the
  overhead is the binding bottleneck. See [luby-2002-lt-codes](luby-2002-lt-codes.md).
