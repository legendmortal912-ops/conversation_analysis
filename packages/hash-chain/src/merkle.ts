/**
 * @module hash-chain/merkle
 * Merkle tree implementation for batch verification of hash chains.
 * Uses SHA-256 for internal node computation.
 */

import { sha256Hex } from './hash.js';
import type { MerkleProof, MerkleProofNode } from './types.js';

/**
 * A binary Merkle tree built from an array of leaf hashes.
 *
 * The tree is constructed bottom-up. If the number of leaves at any level
 * is odd, the last leaf is duplicated to maintain a complete binary tree.
 *
 * @example
 * ```ts
 * const tree = new MerkleTree(['aabb...', 'ccdd...', 'eeff...']);
 * console.log(tree.root);          // the Merkle root hash
 * const proof = tree.getProof(1);  // inclusion proof for leaf at index 1
 * MerkleTree.verify(proof);        // true
 * ```
 */
export class MerkleTree {
  /** All levels of the tree, from leaves (index 0) to root (last index). */
  private readonly levels: string[][];

  /** The original leaf hashes. */
  public readonly leaves: readonly string[];

  /**
   * Constructs a Merkle tree from an array of leaf hashes.
   *
   * @param leaves - Array of hex-encoded leaf hashes
   * @throws Error if the leaves array is empty
   */
  constructor(leaves: readonly string[]) {
    if (leaves.length === 0) {
      throw new Error('Cannot create a MerkleTree with zero leaves');
    }

    this.leaves = leaves;
    this.levels = [Array.from(leaves)];
    this.buildTree();
  }

  /**
   * Builds the tree levels bottom-up from the leaves.
   */
  private buildTree(): void {
    let currentLevel = this.levels[0]!;

    while (currentLevel.length > 1) {
      const nextLevel: string[] = [];

      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i]!;
        // If odd number of nodes, duplicate the last one
        const right = i + 1 < currentLevel.length ? currentLevel[i + 1]! : left;
        nextLevel.push(sha256Hex(left + right));
      }

      this.levels.push(nextLevel);
      currentLevel = nextLevel;
    }
  }

  /**
   * The Merkle root hash — a single hash representing all leaves.
   */
  public get root(): string {
    const topLevel = this.levels[this.levels.length - 1];
    if (!topLevel || topLevel.length === 0) {
      throw new Error('Tree is in invalid state');
    }
    return topLevel[0]!;
  }

  /**
   * Returns the depth (number of levels) of the tree.
   */
  public get depth(): number {
    return this.levels.length - 1;
  }

  /**
   * Generates a Merkle inclusion proof for the leaf at the given index.
   *
   * @param leafIndex - Zero-based index of the leaf
   * @returns A MerkleProof object containing the leaf, root, and proof path
   * @throws Error if the leaf index is out of bounds
   */
  public getProof(leafIndex: number): MerkleProof {
    if (leafIndex < 0 || leafIndex >= this.leaves.length) {
      throw new Error(
        `Leaf index ${leafIndex} is out of bounds [0, ${this.leaves.length - 1}]`
      );
    }

    const proof: MerkleProofNode[] = [];
    let currentIndex = leafIndex;

    for (let level = 0; level < this.levels.length - 1; level++) {
      const currentLevel = this.levels[level]!;
      const isRightNode = currentIndex % 2 === 1;
      const siblingIndex = isRightNode ? currentIndex - 1 : currentIndex + 1;

      // If sibling exists, add it to proof; otherwise use current (duplicate case)
      const siblingHash =
        siblingIndex < currentLevel.length
          ? currentLevel[siblingIndex]!
          : currentLevel[currentIndex]!;

      proof.push({
        hash: siblingHash,
        position: isRightNode ? 'left' : 'right',
      });

      // Move to parent index
      currentIndex = Math.floor(currentIndex / 2);
    }

    return {
      leaf: this.leaves[leafIndex]!,
      root: this.root,
      proof,
    };
  }

  /**
   * Statically verifies a Merkle inclusion proof.
   *
   * @param proof - The proof to verify
   * @returns true if the proof is valid (the leaf is included in the root)
   *
   * @example
   * ```ts
   * const tree = new MerkleTree(hashes);
   * const proof = tree.getProof(2);
   * console.log(MerkleTree.verify(proof)); // true
   * ```
   */
  public static verify(proof: MerkleProof): boolean {
    let computedHash = proof.leaf;

    for (const node of proof.proof) {
      if (node.position === 'left') {
        computedHash = sha256Hex(node.hash + computedHash);
      } else {
        computedHash = sha256Hex(computedHash + node.hash);
      }
    }

    return computedHash === proof.root;
  }

  /**
   * Creates a MerkleTree from an array of raw data items.
   * Each item is serialized to a canonical JSON string and hashed.
   *
   * @param items - Array of serializable objects
   * @returns A new MerkleTree instance
   */
  public static fromRecords(items: readonly Record<string, unknown>[]): MerkleTree {
    if (items.length === 0) {
      throw new Error('Cannot create a MerkleTree from zero records');
    }

    const leaves = items.map((item) => {
      const sorted = Object.keys(item)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = item[key];
          return acc;
        }, {});
      return sha256Hex(JSON.stringify(sorted));
    });

    return new MerkleTree(leaves);
  }
}
