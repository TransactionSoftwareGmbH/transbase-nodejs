const { TCI, Attribute, State, SqlType } = require("bindings")("tci");

/**********************************
 * RESULT SET
 * to fetch next rows sequentially or get all with toArray convenience
 *********************************/
class ResultSet {
  constructor(tci) {
    this.tci = tci;

    // retrieve column infos
    const colCount = Attributes.getColumnCount(this.tci);
    this.colInfos = [];
    for (let col = 1; col <= colCount; col++) {
      this.colInfos.push({
        col,
        name: Attributes.getColumnName(this.tci, col),
        type: Attributes.getColumnType(this.tci, col),
        get typeName() {
          return (Object.entries(SqlType).find(
            ([_, value]) => value === this.type
          ) || ["TYPE(" + this.type + ")"])[0];
        },
      });
    }
  }

  /** fetch and get data of next row. Returns undefined if no data is found */
  next() {
    if (this.tci.fetch()) {
      let row = {};
      for (let { col, name, type } of this.colInfos) {
        row[name] = this.tci.getValue(col, type);
      }
      return row;
    }
  }

  fetch() {
    return this.tci.fetch();
  }

  readValue(colNoOrName, typeCast = true) {
    const col = this.getColumn(colNoOrName);
    return this.tci.getValue(col.col, col.type, typeCast);
  }

  readValueAsString(colNoOrName) {
    return this.readValue(colNoOrName, false);
  }

  readValueAsBuffer(colNoOrName, size = 1024 * 1024) {
    const col = this.getColumn(colNoOrName);
    return {
      data: this.tci.getValueAsBuffer(col.col, size),
      hasMore: this.tci.getState() == State.DATA_TRUNCATION,
    };
  }

  /** false if there is no further row to fetch (NO_DATA_FOUND) */
  hasNext() {
    return this.tci.getState() == State.SUCCESS;
  }

  /** convenience to get all rows as object array */
  toArray() {
    const result = [];
    let nextRow = this.next();
    while (nextRow) {
      result.push(nextRow);
      nextRow = this.next();
    }
    return result;
  }

  getColumns() {
    return this.colInfos;
  }

  getColumn(colNoOrName) {
    return typeof colNoOrName === "number"
      ? this.colInfos[colNoOrName - 1]
      : this.colInfos.find((it) => it.name === colNoOrName);
  }
}

/**********************************
 * TRANSBASE CLIENT
 * connect and login to a database and run queries.
 * Always call close when the client is not needed anymore
 *
 * Example:
 * const transbase = new Transbase({url: "//localhost:2024/sample", user: "tbadmin", password: "admin"});
 * transbase.query("select * from cashbook");
 * transbase.close();
 *********************************/
class Transbase {
  /**
   * create a new transbase database client
   * @param config defining the database url connecting to, logging in with the given user and password
   **/
  constructor(config) {
    this._connectionUrl = config.url;
    this.tci = new TCI();
    if (config && config.typeCast != null) {
      this.setTypeCast(config.typeCast);
    }
    this.tci.connect(config);
  }

  getConnectionUrl() {
    return this._connectionUrl;
  }

  setTypeCast(value) {
    this.tci.setTypeCast(value);
  }

  /**
   * execute a query directly in auto-commit mode
   * @param sql the sql query to execute
   * @param params optional query paramters as an array of positional parameters or a key-value object for named parameters
   * @returns a ResetSet if the query has data to select or the number of affected records for insert,update statements
   **/
  query(sql, parameters) {
    if (!parameters) {
      this.tci.executeDirect(sql);
    } else {
      this.tci.prepare(sql); // TODO: can we call prepare everytime?

      if (Array.isArray(parameters)) {
        parameters.forEach((value, index) => this.tci.setParam(index, value));
      } else if (typeof parameters === "object") {
        Object.entries(parameters).forEach(([name, value]) =>
          this.tci.setParam(name, value)
        );
      } else {
        throw Error(
          "parametrized queries must either contain an array of positional parameters (?) or an key-value object of named parameters (:param) as second argument"
        );
      }
      this.tci.execute();
    }

    switch (this.tci.getQueryType()) {
      case "UPDATE":
        return Attributes.getRecordsTouched(this.tci);
      case "SELECT":
        return new ResultSet(this.tci);
      case "SCHEMA":
        return;
    }
  }

  /** close connection and free resources */
  close() {
    this.tci.close();
  }
}

/**********************************
 * TCI_RESULTSET_ATTRIBUTE Wrapper
 *********************************/
const Attributes = {
  getColumnCount: getAttribute(Attribute.TCI_ATTR_COLUMN_COUNT),
  getColumnType: getAttribute(Attribute.TCI_ATTR_COLUMN_TYPE),
  getColumnName: getAttribute(Attribute.TCI_ATTR_COLUMN_NAME, "string"),
  getRecordsTouched: getAttribute(Attribute.TCI_ATTR_RECORDS_TOUCHED),
};
function getAttribute(attr, as = "number") {
  return (tci, col = 1) =>
    as == "string"
      ? tci.getResultSetStringAttribute(attr, col)
      : tci.getResultSetAttribute(attr, col);
}

module.exports = {
  Transbase,
};
