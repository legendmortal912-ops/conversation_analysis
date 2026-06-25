/**
 * @module hash-chain/chain
 * Hash-chain verification: genesis hashes, link validation, and full chain verification.
 */

import { sha256Hex, computeRecordHash, computeChainLinkHash } from './hash.js';
import type { ChainableRecord, VerificationResult } from './types.js';
import { ChainType } from './types.js';

/**
 * Well-known genesis hashes for each chain type.
 * The genesis hash is the `previousHash` of the first record (index 0).
 * Each is the SHA-256 of the chain type name prefixed with "CONVOGUARD:GENESIS:".
 */
export const GENESIS_HASHES: Readonly<Record<ChainType, string>> = {
  [ChainType.CONVERSATION]: sha256Hex('CONVOGUARD:GENESIS:CONVERSATION'),
  [ChainType.FLAG]: sha256Hex('CONVOGUARD:GENESIS:FLAG'),
  [ChainType.AUDIT]: sha256Hex('CONVOGUARD:GENESIS:AUDIT'),
} as const;

/**
 * Returns the genesis hash for a given chain type.
 *
 * @param chainType - The type of chain
 * @returns The well-known genesis hash string
 */
export function getGenesisHash(chainType: ChainType): string {
  return GENESIS_HASHES[chainType];
}

/**
 * Verifies that a single record's content hash is correct.
 *
 * @param record - The chainable record to verify
 * @param rawRecord - The original raw record object (before chain fields were added)
 * @returns true if the content hash matches the recomputed hash
 */
export function verifyRecordHash(
  record: ChainableRecord,
  rawRecord: Record<string, unknown>
): boolean {
  const recomputed = computeRecordHash(rawRecord);
  const chainLink = computeChainLinkHash(recomputed, record.previousHash);
  return chainLink === record.contentHash;
}

/**
 * Verifies the integrity of a complete hash chain.
 *
 * Checks performed:
 * 1. Records are sorted by index (0, 1, 2, ...)
 * 2. First record's `previousHash` matches the genesis hash
 * 3. Each record's `previousHash` matches the prior record's `contentHash`
 * 4. Indices are contiguous with no gaps
 *
 * Note: This does NOT re-verify content hashes against raw data —
 * use `verifyRecordHash()` for that. This only checks chain linkage.
 *
 * @param records - Ordered array of chainable records
 * @param chainType - The expected chain type (determines the genesis hash)
 * @returns Verification result with details on success or failure
 *
 * @example
 * ```ts
 * const result = verifyChain(turns, ChainType.CONVERSATION);
 * if (!result.valid) {
 *   console.error(`Chain broken at index ${result.brokenAtIndex}: ${result.error}`);
 * }
 * ```
 */
export function verifyChain(
  records: readonly ChainableRecord[],
  chainType: ChainType
): VerificationResult {
  if (records.length === 0) {
    return {
      valid: true,
      recordCount: 0,
      brokenAtIndex: -1,
      error: null,
    };
  }

  const genesisHash = GENESIS_HASHES[chainType];

  // Sort by index to ensure correct order
  const sorted = [...records].sort((a, b) => a.index - b.index);

  // Verify first record links to genesis
  const first = sorted[0]!;
  if (first.index !== 0) {
    return {
      valid: false,
      recordCount: sorted.length,
      brokenAtIndex: 0,
      error: `First record has index ${first.index}, expected 0`,
    };
  }

  if (first.previousHash !== genesisHash) {
    return {
      valid: false,
      recordCount: sorted.length,
      brokenAtIndex: 0,
      error: `First record's previousHash does not match genesis hash for chain type ${chainType}`,
    };
  }

  // Verify chain linkage
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i]!;
    const previous = sorted[i - 1]!;

    // Check index contiguity
    if (current.index !== previous.index + 1) {
      return {
        valid: false,
        recordCount: sorted.length,
        brokenAtIndex: i,
        error: `Non-contiguous indices: record at position ${i} has index ${current.index}, expected ${previous.index + 1}`,
      };
    }

    // Check previousHash linkage
    if (current.previousHash !== previous.contentHash) {
      return {
        valid: false,
        recordCount: sorted.length,
        brokenAtIndex: i,
        error: `Chain break at index ${current.index}: previousHash does not match preceding record's contentHash`,
      };
    }
  }

  return {
    valid: true,
    recordCount: sorted.length,
    brokenAtIndex: -1,
    error: null,
  };
}

/**
 * Builds chain fields for a new record being appended to a chain.
 *
 * @param rawRecord - The raw record data (without chain fields)
 * @param index - The zero-based index for this record
 * @param previousContentHash - The contentHash of the previous record, or null if this is the first
 * @param chainType - The chain type (used for genesis hash if index is 0)
 * @returns Object containing `contentHash`, `previousHash`, and `index`
 */
export function buildChainFields(
  rawRecord: Record<string, unknown>,
  index: number,
  previousContentHash: string | null,
  chainType: ChainType
): { contentHash: string; previousHash: string; index: number } {
  const previousHash = index === 0
    ? GENESIS_HASHES[chainType]
    : (previousContentHash ?? GENESIS_HASHES[chainType]);

  const recordHash = computeRecordHash(rawRecord);
  const contentHash = computeChainLinkHash(recordHash, previousHash);

  return {
    contentHash,
    previousHash,
    index,
  };
}
