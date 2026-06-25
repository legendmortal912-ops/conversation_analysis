/**
 * @module hash-chain/signing
 * Ed25519 digital signature utilities for checkpoint signing and verification.
 * Uses @noble/ed25519 for pure-JS Ed25519 operations.
 */

import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha512';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { canonicalize, sha256Hex } from './hash.js';
import type { SignedCheckpoint } from './types.js';
import { ChainType } from './types.js';

// Configure @noble/ed25519 to use SHA-512 from @noble/hashes
// (required since @noble/ed25519 v2.x does not bundle a hash implementation)
ed.etc.sha512Sync = (...messages: Uint8Array[]): Uint8Array => {
  const merged = concatBytes(...messages);
  return sha512(merged);
};

/**
 * Concatenates multiple Uint8Array instances.
 */
function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  let totalLength = 0;
  for (const arr of arrays) {
    totalLength += arr.length;
  }
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

/**
 * An Ed25519 key pair for signing and verification.
 */
export interface KeyPair {
  /** 32-byte private key, hex-encoded. */
  privateKey: string;
  /** 32-byte public key, hex-encoded. */
  publicKey: string;
}

/**
 * Generates a new Ed25519 key pair.
 *
 * @returns A key pair with hex-encoded private and public keys
 *
 * @example
 * ```ts
 * const keyPair = generateKeyPair();
 * console.log(keyPair.publicKey);  // "a1b2c3d4..."
 * console.log(keyPair.privateKey); // "e5f6a7b8..."
 * ```
 */
export function generateKeyPair(): KeyPair {
  const privateKeyBytes = ed.utils.randomPrivateKey();
  const publicKeyBytes = ed.getPublicKey(privateKeyBytes);

  return {
    privateKey: bytesToHex(privateKeyBytes),
    publicKey: bytesToHex(publicKeyBytes),
  };
}

/**
 * Signs a message with an Ed25519 private key.
 *
 * @param message - The message string to sign
 * @param privateKeyHex - Hex-encoded 32-byte private key
 * @returns Hex-encoded 64-byte Ed25519 signature
 *
 * @example
 * ```ts
 * const sig = sign('hello world', keyPair.privateKey);
 * ```
 */
export function sign(message: string, privateKeyHex: string): string {
  const messageBytes = new TextEncoder().encode(message);
  const privateKeyBytes = hexToBytes(privateKeyHex);
  const signatureBytes = ed.sign(messageBytes, privateKeyBytes);
  return bytesToHex(signatureBytes);
}

/**
 * Verifies an Ed25519 signature against a message and public key.
 *
 * @param message - The original message string
 * @param signatureHex - Hex-encoded 64-byte signature
 * @param publicKeyHex - Hex-encoded 32-byte public key
 * @returns true if the signature is valid
 *
 * @example
 * ```ts
 * const valid = verify('hello world', signature, keyPair.publicKey);
 * ```
 */
export function verify(message: string, signatureHex: string, publicKeyHex: string): boolean {
  try {
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = hexToBytes(signatureHex);
    const publicKeyBytes = hexToBytes(publicKeyHex);
    return ed.verify(signatureBytes, messageBytes, publicKeyBytes);
  } catch {
    return false;
  }
}

/**
 * Creates a signed checkpoint for a hash chain.
 * The checkpoint payload is canonicalized before signing for determinism.
 *
 * @param chainType - The chain type this checkpoint covers
 * @param merkleRoot - The current Merkle root hash
 * @param recordCount - Number of records in the chain
 * @param privateKeyHex - Hex-encoded private key for signing
 * @returns A complete SignedCheckpoint with signature and public key
 *
 * @example
 * ```ts
 * const checkpoint = createCheckpoint(
 *   ChainType.CONVERSATION,
 *   tree.root,
 *   turns.length,
 *   keyPair.privateKey
 * );
 * ```
 */
export function createCheckpoint(
  chainType: ChainType,
  merkleRoot: string,
  recordCount: number,
  privateKeyHex: string
): SignedCheckpoint {
  const timestamp = new Date().toISOString();
  const publicKeyHex = bytesToHex(ed.getPublicKey(hexToBytes(privateKeyHex)));

  // Build the canonical payload to sign
  const payload = {
    chainType,
    merkleRoot,
    recordCount,
    timestamp,
  };

  const canonical = canonicalize(payload);
  const payloadHash = sha256Hex(canonical);
  const signature = sign(payloadHash, privateKeyHex);

  return {
    chainType,
    merkleRoot,
    recordCount,
    timestamp,
    signature,
    publicKey: publicKeyHex,
  };
}

/**
 * Verifies a signed checkpoint's signature.
 *
 * @param checkpoint - The signed checkpoint to verify
 * @returns true if the signature is valid for the checkpoint payload
 *
 * @example
 * ```ts
 * const valid = verifyCheckpoint(checkpoint);
 * ```
 */
export function verifyCheckpoint(checkpoint: SignedCheckpoint): boolean {
  const payload = {
    chainType: checkpoint.chainType,
    merkleRoot: checkpoint.merkleRoot,
    recordCount: checkpoint.recordCount,
    timestamp: checkpoint.timestamp,
  };

  const canonical = canonicalize(payload);
  const payloadHash = sha256Hex(canonical);
  return verify(payloadHash, checkpoint.signature, checkpoint.publicKey);
}
