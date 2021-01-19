const { TCI, Attribute, State } = require("bindings")("tci");

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
  /** {url,user,password} */
  constructor(config) {
    this.tci = new TCI();
    this.tci.connect(config);
  }

  /** execute a query directly. Returns a ResultSet if the query has data to select,
   * otherwise the number of affected records is returned (insert,update) */
  query(sql = "") {
    this.tci.executeDirect(sql);
    if (this.tci.isSelect()) return new ResultSet(this.tci);
    else return Attributes.getRecordsTouched(this.tci);
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
