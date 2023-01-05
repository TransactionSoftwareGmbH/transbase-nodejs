type Value = string | number | boolean | Buffer | null | undefined;
type PositionedParamter = Value[];
type NamedParameter = { [parameterName: string]: Value };
type Params = PositionedParamter | NamedParameter;
type ColInfo = {
  /** column index starting from 1 */
  col: number;
  /** column name */
  name: string;
  /** sql column type code @see SqlType */
  type: number;
  /** readable sql column type name @see SqlTypeName */
  typeName: SqlTypeName;
};

export interface TransbaseConfig {
  /** database connection string e.g. "ssl://<host>:<port>/<dbname>" */
  url: string;
  user: string;
  password: string;
  /**
   * Determines if column values should be converted to native JavaScript types.
   * Set to false to get column values as plain strings.
   * options:
   * - true: convert values to native types (default)
   * - false: all column values as strings
   * @default true
   */
  typeCast?: boolean;
}

/**********************************
 * RESULT SET
 * to fetch next rows sequentially or get all with toArray convenience
 *********************************/
export declare interface ResultSet<T = unknown> {
  /** fetch and get data of next row. Returns undefined if no data is found */
  next(): T;
  /** false if there is no further row to fetch (NO_DATA_FOUND) */
  hasNext(): boolean;
  /** convenience to get all rows as object array */
  toArray(): T[];
  //-----------------
  // low-level api
  //-----------------
  /** get column meta information of this result set, e.g. column name, sql-type  */
  getColumns(): ColInfo[];
  /** fetch the next record, use getValue or getValueAsString to retrieve data  */
  fetch(): boolean;
  /** read value by column number starting with 1 or column name (respects typeCast option). NOT IDEMPOTENT! */
  readValue<R = Value>(colNumberOrName: number | string): R;
  /** read value as string by column number starting with 1 or column name. NOT IDEMPOTENT!*/
  readValueAsString(colNumberOrName: number | string): string | null;
  /** read value as buffer data chunk of given size by column number starting with 1 or column name. NOT IDEMPOTENT! */
  readValueAsBuffer(
    colNumberOrName: number | string,
    size: number
  ): { data: Buffer; hasMore: boolean } | null;
  /** return true if the given column number (starting with 1) or column name IS NULL */
  isNull(colNumberOrName: number | string): boolnea;
}

/**********************************
 * TRANSBASE CLIENT
 * connect and login to a database and run queries.
 * Always call close when the client is not needed anymore!
 *
 * Example:
 * const transbase = new Transbase({url: "//localhost:2024/sample", user: "tbadmin", password: "admin"});
 * transbase.query("select * from cashbook");
 * transbase.close();
 *********************************/
export declare class Transbase {
  /**
   * create a new transbase database client
   * @param config defining the database url connecting to, logging in with the given user and password
   **/
  constructor(config: TransbaseConfig);

  /**
   * execute a query directly in auto-commit mode
   * @param sql the sql query to execute
   * @param params optional query parameters as an array of positional parameters or a key-value object for named parameters
   * @param options optional query execute options (e.g. typeCast)
   * @returns a ResetSet if the query has data to select or the number of affected records for insert,update statements
   **/
  query<T = unknown>(
    sql: string,
    params?: Params,
    options?: { typeCast?: boolean }
  ): T extends number ? number : ResultSet<T>;

  /** close connection and free resources */
  close(): void;

  /** set typeCast conversion option @see TransbaseConfig.typeCast */
  setTypeCast(value: boolean): void;

  getConnectionUrl(): string;

  /** commit transaction */
  commit(): void;
  /** rollback transaction */
  rollback(): void;
  /**
   * begin a new transaction, which has to be explicitly committed.
   * calling this will leave auto commit mode */
  beginTransaction(): void;
}

export type SqlType = {
  BOOL: number;
  TINYINT: number;
  SMALLINT: number;
  INTEGER: number;
  NUMERIC: number;
  FLOAT: number;
  DOUBLE: number;
  CHAR: number;
  VARCHAR: number;
  BINARY: number;
  BIT: number;
  BLOB: number;
  BITSHORT: number;
  BIGINT: number;
  CLOB: number;
  DATE: number;
  TIME: number;
  TIMESTAMP: number;
};

export type SqlTypeName = keyof SqlType;
