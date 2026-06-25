/**
 * @module @convoguard/hash-chain
 * Cryptographic hash chain library for tamper-evident record storage.
 *
 * Provides:
 * - SHA-256 hashing with canonical JSON serialization
 * - Hash-chain construction and verification
 * - Merkle tree for batch inclusion proofs
 * - Ed25519 digital signatures for checkpoint signing
 *
 * @example
 * ```ts
 * import {
 *   computeRecordHash,
 *   verifyChain,
 *   MerkleTree,
 *   generateKeyPair,
 *   createCheckpoint,
 *   ChainType,
 * } from '@convoguard/hash-chain';
 * ```
 */

// Types
export { ChainType } from './types.js';
export type {
  ChainableRecord,
  VerificationResult,
  MerkleProof,
  MerkleProofNode,
  SignedCheckpoint,
} from './types.js';

// Hashing
export {
  canonicalize,
  sha256Hex,
  sha256BytesHex,
  computeRecordHash,
  computeChainLinkHash,
} from './hash.js';

// Chain
export {
  GENESIS_HASHES,
  getGenesisHash,
  verifyRecordHash,
  verifyChain,
  buildChainFields,
} from './chain.js';

// Merkle
export { MerkleTree } from './merkle.js';

// Signing
export type { KeyPair } from './signing.js';
export {
  generateKeyPair,
  sign,
  verify,
  createCheckpoint,
  verifyCheckpoint,
} from './signing.js';
