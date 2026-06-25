/**
 * @module hash-chain/types
 * Type definitions for the hash-chain library.
 */

/**
 * Identifies the type of hash chain.
 * Different chain types may have different genesis hashes or rules.
 */
export enum ChainType {
  /** Chain for conversation turns. */
  CONVERSATION = 'CONVERSATION',
  /** Chain for flag records. */
  FLAG = 'FLAG',
  /** Chain for audit log entries. */
  AUDIT = 'AUDIT',
}

/**
 * Any record that can be inserted into a hash chain.
 * Implementations must provide the chain-linkage fields.
 */
export interface ChainableRecord {
  /** Unique identifier for this record. */
  id: string;
  /** Zero-based index in the chain. */
  index: number;
  /** SHA-256 hash of this record's canonical content. */
  contentHash: string;
  /** Hash of the previous record in the chain (or the genesis hash for index 0). */
  previousHash: string;
  /** ISO-8601 timestamp. */
  createdAt: string;
}

/**
 * Result of verifying a single link or an entire chain.
 */
export interface VerificationResult {
  /** Whether the verification passed. */
  valid: boolean;
  /** Number of records verified. */
  recordCount: number;
  /** Index of the first broken link, or -1 if all valid. */
  brokenAtIndex: number;
  /** Human-readable error message if verification failed. */
  error: string | null;
}

/**
 * A single node in a Merkle proof (sibling hash + direction).
 */
export interface MerkleProofNode {
  /** The sibling hash at this level. */
  hash: string;
  /** Whether this sibling is on the left ('left') or right ('right'). */
  position: 'left' | 'right';
}

/**
 * A Merkle inclusion proof for a single leaf.
 */
export interface MerkleProof {
  /** The leaf hash being proved. */
  leaf: string;
  /** The Merkle root at the time of proof generation. */
  root: string;
  /** Ordered list of sibling nodes from leaf to root. */
  proof: MerkleProofNode[];
}

/**
 * A signed checkpoint anchoring the state of a chain at a point in time.
 * Combines a Merkle root with an Ed25519 signature.
 */
export interface SignedCheckpoint {
  /** The chain type this checkpoint covers. */
  chainType: ChainType;
  /** The Merkle root hash at checkpoint time. */
  merkleRoot: string;
  /** Total number of records in the chain at checkpoint time. */
  recordCount: number;
  /** ISO-8601 timestamp of the checkpoint. */
  timestamp: string;
  /** Ed25519 signature over the canonical checkpoint payload. */
  signature: string;
  /** Hex-encoded Ed25519 public key of the signer. */
  publicKey: string;
}
