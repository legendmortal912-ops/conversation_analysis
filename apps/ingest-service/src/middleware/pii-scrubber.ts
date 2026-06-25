/**
 * PII Scrubber Middleware
 * Detects and redacts personally identifiable information from turn content
 * before storage. Uses regex patterns for common PII types.
 */

/** PII detection patterns */
const PII_PATTERNS: Array<{ name: string; pattern: RegExp; replacement: string }> = [
  {
    name: 'email',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    replacement: '[EMAIL_REDACTED]',
  },
  {
    name: 'phone_us',
    pattern: /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/g,
    replacement: '[PHONE_REDACTED]',
  },
  {
    name: 'phone_intl',
    pattern: /\b\+\d{1,3}[-.\s]?\d{2,4}[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b/g,
    replacement: '[PHONE_REDACTED]',
  },
  {
    name: 'ssn',
    pattern: /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g,
    replacement: '[SSN_REDACTED]',
  },
  {
    name: 'credit_card',
    pattern: /\b(?:\d{4}[-.\s]?){3}\d{4}\b/g,
    replacement: '[CARD_REDACTED]',
  },
  {
    name: 'ip_address',
    pattern: /\b(?:25[0-5]|2[0-4]\d|[01]?\d\d?)(?:\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)){3}\b/g,
    replacement: '[IP_REDACTED]',
  },
  {
    name: 'date_of_birth',
    pattern: /\b(?:0?[1-9]|1[0-2])[/\-.](?:0?[1-9]|[12]\d|3[01])[/\-.](?:19|20)\d{2}\b/g,
    replacement: '[DOB_REDACTED]',
  },
];

export interface PIIScrubResult {
  /** The scrubbed content with PII replaced */
  scrubbed: string;
  /** Whether any PII was detected */
  piiDetected: boolean;
  /** Types of PII found */
  piiTypes: string[];
  /** Count of PII instances redacted */
  redactedCount: number;
}

/**
 * Scrub PII from text content.
 * Returns the scrubbed text and metadata about what was found.
 */
export function scrubPII(content: string): PIIScrubResult {
  let scrubbed = content;
  const piiTypes: string[] = [];
  let redactedCount = 0;

  for (const { name, pattern, replacement } of PII_PATTERNS) {
    const matches = scrubbed.match(pattern);
    if (matches && matches.length > 0) {
      piiTypes.push(name);
      redactedCount += matches.length;
      scrubbed = scrubbed.replace(pattern, replacement);
    }
  }

  return {
    scrubbed,
    piiDetected: piiTypes.length > 0,
    piiTypes,
    redactedCount,
  };
}
