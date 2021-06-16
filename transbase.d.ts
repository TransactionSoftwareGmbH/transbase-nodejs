type Value = string | number | boolean | Buffer | null | undefined;
type PositionedParamter = Value[];
type NamedParameter = { [parameterName: string]: Value };
type Params = PositionedParamter | NamedParameter;

interface TransbaseConfig {
  /** database connection string e.g. "ssl://<host>:<port>/<dbname>" */
  url: string;
  user: string;
  password: string;
  /**
   * Determines if column values should be converted to native JavaScript types.
   * Set to false to get column values as plain strings.
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
  new(config: TransbaseConfig): Transbase;

  /**
   * execute a query directly in auto-commit mode
   * @param sql the sql query to execute
   * @param params optional query paramters as an array of positional parameters or a key-value object for named parameters
   * @returns a ResetSet if the query has data to select or the number of affected records for insert,update statements
   **/
  query<T = unknown, R = ResultSet<T> | number>(
    sql: string,
    params?: Params
  ): R | undefined;

  /** close connection and free resources */
  close(): void;

  /** set typeCast conversion option @see TransbaseConfig.typeCast */
  setTypeCast(value: boolean): void;
}
