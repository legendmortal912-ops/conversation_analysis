/**
 * @module database/immudb
 * ImmuDB client that calls the immugw REST gateway via HTTP (fetch).
 *
 * immugw runs on port 3323 and exposes REST endpoints for key-value
 * and SQL operations with cryptographic verification.
 *
 * Uses the native `fetch` API (Node 18+).
 */

/** Configuration for the ImmuDB client. */
export interface ImmudbConfig {
  /** immugw base URL (default: "http://localhost:3323"). */
  baseUrl: string;
  /** Database name (default: "defaultdb"). */
  database: string;
  /** Username for authentication (default: "immudb"). */
  username: string;
  /** Password for authentication (default: "immudb"). */
  password: string;
}

/** Response from a verified set/get operation. */
export interface VerifiedResponse {
  /** Whether the server-provided proof verified successfully. */
  verified: boolean;
  /** The transaction ID. */
  txId: number;
}

/** Key-value pair returned from immudb. */
export interface ImmudbKeyValue {
  /** The key (base64-decoded). */
  key: string;
  /** The value (base64-decoded). */
  value: string;
  /** Transaction ID when this was written. */
  txId: number;
}

/** Result of a SQL query operation. */
export interface SqlQueryResult {
  /** Column names. */
  columns: string[];
  /** Row data — each row is an array of values matching column order. */
  rows: unknown[][];
}

/** Default configuration values. */
const DEFAULT_CONFIG: ImmudbConfig = {
  baseUrl: 'http://localhost:3323',
  database: 'defaultdb',
  username: 'immudb',
  password: 'immudb',
};

/**
 * HTTP-based client for ImmuDB via the immugw REST gateway.
 *
 * @example
 * ```ts
 * const immudb = new ImmudbClient({ baseUrl: 'http://localhost:3323' });
 * await immudb.connect();
 * await immudb.set('myKey', 'myValue');
 * const val = await immudb.get('myKey');
 * ```
 */
export class ImmudbClient {
  private readonly config: ImmudbConfig;
  private authToken: string | null = null;

  constructor(config: Partial<ImmudbConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ── Private Helpers ──────────────────────────────────────────────────

  /**
   * Builds the full URL for an API endpoint.
   */
  private url(path: string): string {
    return `${this.config.baseUrl}${path}`;
  }

  /**
   * Returns the Authorization header value.
   */
  private authHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }
    return headers;
  }

  /**
   * Makes an authenticated HTTP request to immugw.
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const response = await fetch(this.url(path), {
      method,
      headers: this.authHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(
        `ImmuDB request failed: ${method} ${path} → ${response.status} ${response.statusText}: ${errorText}`
      );
    }

    const text = await response.text();
    if (!text) {
      return {} as T;
    }
    return JSON.parse(text) as T;
  }

  /**
   * Encodes a string to base64 for immugw payloads.
   */
  private toBase64(input: string): string {
    return Buffer.from(input, 'utf-8').toString('base64');
  }

  /**
   * Decodes a base64 string from immugw responses.
   */
  private fromBase64(input: string): string {
    return Buffer.from(input, 'base64').toString('utf-8');
  }

  // ── Connection ───────────────────────────────────────────────────────

  /**
   * Authenticates with immugw and selects the target database.
   * Must be called before any other operations.
   *
   * @throws Error if authentication fails
   */
  async connect(): Promise<void> {
    // Login
    const loginResponse = await this.request<{ token: string }>(
      'POST',
      '/login',
      {
        user: this.toBase64(this.config.username),
        password: this.toBase64(this.config.password),
      }
    );

    this.authToken = loginResponse.token;

    // Select database
    await this.request('GET', `/db/use/${this.config.database}`);
  }

  // ── Key-Value Operations ─────────────────────────────────────────────

  /**
   * Sets a key-value pair.
   *
   * @param key - The key
   * @param value - The value (will be stored as UTF-8 bytes)
   */
  async set(key: string, value: string): Promise<void> {
    await this.request('POST', '/db/set', {
      KVs: [
        {
          key: this.toBase64(key),
          value: this.toBase64(value),
        },
      ],
    });
  }

  /**
   * Gets a value by key.
   *
   * @param key - The key to look up
   * @returns The value, or null if not found
   */
  async get(key: string): Promise<string | null> {
    try {
      const response = await this.request<{
        key: string;
        value: string;
        tx: number;
      }>('POST', '/db/get', {
        key: this.toBase64(key),
      });

      return this.fromBase64(response.value);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('404') || msg.includes('key not found')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Sets a key-value pair with cryptographic verification.
   * The server returns a proof that can be verified against the Merkle tree.
   *
   * @param key - The key
   * @param value - The value
   * @returns Verification result including transaction ID
   */
  async verifiedSet(key: string, value: string): Promise<VerifiedResponse> {
    const response = await this.request<{
      verified: boolean;
      tx: { header: { id: number } };
    }>('POST', '/db/verified/set', {
      KVs: [
        {
          key: this.toBase64(key),
          value: this.toBase64(value),
        },
      ],
    });

    return {
      verified: response.verified,
      txId: response.tx?.header?.id ?? 0,
    };
  }

  /**
   * Gets a value by key with cryptographic verification.
   *
   * @param key - The key to look up
   * @returns The value and verification result, or null if not found
   */
  async verifiedGet(
    key: string
  ): Promise<(ImmudbKeyValue & { verified: boolean }) | null> {
    try {
      const response = await this.request<{
        verified: boolean;
        entry: {
          key: string;
          value: string;
          tx: number;
        };
      }>('POST', '/db/verified/get', {
        key: this.toBase64(key),
      });

      return {
        key: this.fromBase64(response.entry.key),
        value: this.fromBase64(response.entry.value),
        txId: response.entry.tx,
        verified: response.verified,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('404') || msg.includes('key not found')) {
        return null;
      }
      throw error;
    }
  }

  // ── SQL Operations ───────────────────────────────────────────────────

  /**
   * Executes a SQL write statement (CREATE TABLE, INSERT, UPDATE, DELETE).
   *
   * @param sql - The SQL statement to execute
   * @param params - Optional positional parameters
   */
  async sqlExec(sql: string, params: unknown[] = []): Promise<void> {
    await this.request('POST', '/db/sql/exec', {
      sql,
      params: params.map((p) => this.wrapSqlParam(p)),
    });
  }

  /**
   * Executes a SQL read query (SELECT).
   *
   * @param sql - The SQL query
   * @param params - Optional positional parameters
   * @returns Query result with columns and rows
   */
  async sqlQuery(sql: string, params: unknown[] = []): Promise<SqlQueryResult> {
    const response = await this.request<{
      columns: Array<{ name: string }>;
      rows: Array<{ values: Array<{ value: unknown }> }>;
    }>('POST', '/db/sql/query', {
      sql,
      params: params.map((p) => this.wrapSqlParam(p)),
    });

    const columns = (response.columns ?? []).map((c) => c.name);
    const rows = (response.rows ?? []).map((r) =>
      (r.values ?? []).map((v) => v.value)
    );

    return { columns, rows };
  }

  /**
   * Creates a table in immudb using SQL.
   *
   * @param tableName - Name of the table to create
   * @param columns - Column definitions as SQL fragments (e.g. "id VARCHAR[256]")
   * @param primaryKey - Primary key column name
   */
  async createTable(
    tableName: string,
    columns: string[],
    primaryKey: string
  ): Promise<void> {
    const columnDefs = columns.join(', ');
    const sql = `CREATE TABLE IF NOT EXISTS ${tableName} (${columnDefs}, PRIMARY KEY (${primaryKey}))`;
    await this.sqlExec(sql);
  }

  /**
   * Inserts a row into a table.
   *
   * @param tableName - Target table
   * @param data - Key-value pairs of column name → value
   */
  async insertRow(
    tableName: string,
    data: Record<string, unknown>
  ): Promise<void> {
    const keys = Object.keys(data);
    const placeholders = keys.map((_, i) => `@p${i}`).join(', ');
    const values = Object.values(data);
    const sql = `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders})`;
    await this.sqlExec(sql, values);
  }

  /**
   * Queries rows from a table with an optional WHERE clause.
   *
   * @param tableName - Source table
   * @param where - Optional WHERE clause (without "WHERE" keyword)
   * @param params - Parameters for the WHERE clause
   * @returns Query result
   */
  async queryRows(
    tableName: string,
    where?: string,
    params: unknown[] = []
  ): Promise<SqlQueryResult> {
    let sql = `SELECT * FROM ${tableName}`;
    if (where) {
      sql += ` WHERE ${where}`;
    }
    return this.sqlQuery(sql, params);
  }

  // ── Health Check ─────────────────────────────────────────────────────

  /**
   * Checks whether immugw is reachable and healthy.
   *
   * @returns true if the health check passes
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(this.url('/health'), {
        method: 'GET',
        headers: this.authHeaders(),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  // ── Private Utility ──────────────────────────────────────────────────

  /**
   * Wraps a JS value into the immugw SQL parameter format.
   */
  private wrapSqlParam(value: unknown): Record<string, unknown> {
    if (value === null || value === undefined) {
      return { null: {} };
    }
    if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        return { n: value };
      }
      return { f: value };
    }
    if (typeof value === 'boolean') {
      return { b: value };
    }
    if (typeof value === 'string') {
      return { s: value };
    }
    if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
      return { bs: Buffer.from(value).toString('base64') };
    }
    // Fallback: serialize to string
    return { s: String(value) };
  }
}

/**
 * Creates an ImmuDB client from environment variables.
 *
 * Environment variables:
 * - `IMMUDB_URL` — immugw base URL (default: "http://localhost:3323")
 * - `IMMUDB_DATABASE` — database name (default: "defaultdb")
 * - `IMMUDB_USERNAME` — username (default: "immudb")
 * - `IMMUDB_PASSWORD` — password (default: "immudb")
 *
 * @returns A configured (but not yet connected) ImmudbClient
 */
export function createImmudbClient(): ImmudbClient {
  return new ImmudbClient({
    baseUrl: process.env['IMMUDB_URL'] ?? DEFAULT_CONFIG.baseUrl,
    database: process.env['IMMUDB_DATABASE'] ?? DEFAULT_CONFIG.database,
    username: process.env['IMMUDB_USERNAME'] ?? DEFAULT_CONFIG.username,
    password: process.env['IMMUDB_PASSWORD'] ?? DEFAULT_CONFIG.password,
  });
}
