/**
 * @module utils/id
 * ID generation utilities using nanoid.
 */

import { nanoid } from 'nanoid';

/**
 * Default ID length for all ConvoGuard entities.
 * 21 characters provides ~124 bits of entropy.
 */
const DEFAULT_ID_LENGTH = 21;

/**
 * Prefix-to-length mapping for typed identifiers.
 * The prefix is prepended to the nanoid for human readability.
 */
const ID_PREFIXES = {
  org: 'org',
  usr: 'usr',
  prj: 'prj',
  cnv: 'cnv',
  trn: 'trn',
  flg: 'flg',
  rev: 'rev',
  key: 'key',
  alt: 'alt',
  acf: 'acf',
  evt: 'evt',
  rpt: 'rpt',
  ssn: 'ssn',
  inv: 'inv',
  mtr: 'mtr',
} as const;

/** Valid entity prefixes. */
export type IdPrefix = keyof typeof ID_PREFIXES;

/**
 * Generates a globally unique ID with an optional entity-type prefix.
 *
 * @param prefix - Optional entity-type prefix (e.g. 'org', 'usr', 'cnv')
 * @param length - Length of the random portion (default: 21)
 * @returns A unique identifier string, e.g. "org_V1StGXR8_Z5jdHi6B-myT"
 *
 * @example
 * ```ts
 * const orgId = generateId('org');    // "org_V1StGXR8_Z5jdHi6B-my"
 * const rawId = generateId();          // "V1StGXR8_Z5jdHi6B-myT"
 * ```
 */
export function generateId(prefix?: IdPrefix, length: number = DEFAULT_ID_LENGTH): string {
  const id = nanoid(length);
  if (prefix) {
    return `${ID_PREFIXES[prefix]}_${id}`;
  }
  return id;
}

/**
 * Extracts the prefix from a typed ID.
 *
 * @param id - A prefixed ID string
 * @returns The prefix portion, or null if the ID has no recognized prefix
 *
 * @example
 * ```ts
 * extractPrefix('org_V1StGXR8_Z5jdHi6B');  // 'org'
 * extractPrefix('V1StGXR8_Z5jdHi6B');      // null
 * ```
 */
export function extractPrefix(id: string): IdPrefix | null {
  const underscoreIdx = id.indexOf('_');
  if (underscoreIdx === -1) {
    return null;
  }
  const prefix = id.slice(0, underscoreIdx);
  if (prefix in ID_PREFIXES) {
    return prefix as IdPrefix;
  }
  return null;
}
