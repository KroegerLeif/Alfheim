/**
 * Utility functions for W3C Distributed Tracing header generation.
 */

/**
 * Converts a Uint8Array byte array into a lowercase hex string.
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generates a standard W3C traceparent header string.
 * Format: 00-{trace_id}-{span_id}-01
 * - version: "00"
 * - trace_id: 32 hex characters (16 bytes, non-zero)
 * - span_id: 16 hex characters (8 bytes, non-zero)
 * - trace_flags: "01" (sampled)
 */
export function generateW3CTraceparent(): string {
  const cryptoObj =
    typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function'
      ? crypto
      : typeof window !== 'undefined' && window.crypto && typeof window.crypto.getRandomValues === 'function'
        ? window.crypto
        : null;

  if (!cryptoObj) {
    throw new Error('Native crypto.getRandomValues is not available in this environment.');
  }

  const traceIdBytes = new Uint8Array(16);
  const spanIdBytes = new Uint8Array(8);

  // W3C spec requires trace_id and span_id to be non-zero
  do {
    cryptoObj.getRandomValues(traceIdBytes);
  } while (traceIdBytes.every((b) => b === 0));

  do {
    cryptoObj.getRandomValues(spanIdBytes);
  } while (spanIdBytes.every((b) => b === 0));

  const traceId = bytesToHex(traceIdBytes);
  const spanId = bytesToHex(spanIdBytes);

  return `00-${traceId}-${spanId}-01`;
}
