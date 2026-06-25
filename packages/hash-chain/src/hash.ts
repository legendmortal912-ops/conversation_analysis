/**
 * @module hash-chain/hash
 * SHA-256 hashing and canonical JSON serialization for tamper-evident records.
 */

import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';

/**
 * Converts a value to a canonical JSON string suitable for hashing.
 * Keys are sorted alphabetically at every nesting level to ensure
 * deterministic output regardless of property insertion order.
 *
 * @param value - Any JSON-serializable value
 * @returns A deterministic JSON string
 *
 * @example
 * ```ts
 * canonicalize({ b: 2, a: 1 }); // '{"a":1,"b":2}'
 * ```
 */
export function canonicalize(value: unknown): string {
  if (value === null || value === undefined) {
    return JSON.stringify(value);
  }

  if (typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    const items = value.map((item) => canonicalize(item));
    return `[${items.join(',')}]`;
  }

  // Sort keys and recurse
  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys.map((key) => `${JSON.stringify(key)}:${canonicalize(obj[key])}`);
  return `{${pairs.join(',')}}`;
}

/**
 * Computes the SHA-256 hash of a UTF-8 string.
 *
 * @param input - The string to hash
 * @returns Lowercase hex-encoded SHA-256 hash (64 characters)
 *
 * @example
 * ```ts
 * sha256Hex('hello'); // "2cf24dba5fb0a30e..."
 * ```
 */
export function sha256Hex(input: string): string {
  const hash = sha256(new TextEncoder().encode(input));
  return bytesToHex(hash);
}

/**
 * Computes the SHA-256 hash of raw bytes.
 *
 * @param input - The bytes to hash
 * @returns Lowercase hex-encoded SHA-256 hash (64 characters)
 */
export function sha256BytesHex(input: Uint8Array): string {
  return bytesToHex(sha256(input));
}

/**
 * Computes the content hash for a chain record.
 * The record is canonicalized (keys sorted) and then SHA-256 hashed.
 * The `contentHash` and `previousHash` fields are excluded from the
 * input to avoid circular dependencies.
 *
 * @param record - The record to hash (any object with serializable fields)
 * @param excludeFields - Additional field names to exclude from hashing
 * @returns Lowercase hex-encoded SHA-256 hash
 *
 * @example
 * ```ts
 * const hash = computeRecordHash({
 *   id: 'trn_abc123',
 *   index: 0,
 *   role: 'user',
 *   content: 'Hello',
 *   createdAt: '2024-01-15T10:00:00.000Z',
 * });
 * ```
 */
export function computeRecordHash(
  record: Record<string, unknown>,
  excludeFields: readonly string[] = ['contentHash', 'previousHash']
): string {
  // Build a clean copy without excluded fields
  const clean: Record<string, unknown> = {};
  const excludeSet = new Set(excludeFields);

  for (const key of Object.keys(record)) {
    if (!excludeSet.has(key)) {
      clean[key] = record[key];
    }
  }

  const canonical = canonicalize(clean);
  return sha256Hex(canonical);
}

/**
 * Computes the chain link hash that binds a record to its predecessor.
 * This is the hash stored as `contentHash` on the record itself.
 *
 * @param recordHash - The content hash of the current record
 * @param previousHash - The content hash of the previous record (or genesis hash)
 * @returns The chain link hash
 */
export function computeChainLinkHash(recordHash: string, previousHash: string): string {
  return sha256Hex(`${previousHash}:${recordHash}`);
}
