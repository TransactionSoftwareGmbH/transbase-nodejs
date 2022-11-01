const assert = require("assert").strict;
const { Transbase } = require("../transbase");
const config = require("./config");

describe("TransbaseLedger", () => {
  const UID = String(Math.random()).substring(2, 12);
  let client;

  before(() => {
    client = new Transbase(config);
    client.query(`create table LEDGER_${UID} (
      a TINYINT,
      b SMALLINT,
      c INTEGER,
      d BIGINT,
      e NUMERIC(5,2),
      f DECIMAL(5,2),
      g BLOB,
      h CLOB,
      i VARCHAR(*),
      j CHAR(*) ,
      k STRING,
      l BINCHAR (*),
      m BITS (*),
      n BITS2 (*),
      o BOOL,
      p DATETIME[YY:MO],
      q DATE,
      r TIME,
      s TIMESTAMP,
      t TIMESPAN[YY:MO], 
      u INTERVAL HOUR TO SECOND
      )`);
  });

  after(() => {
    try {
      client.query(`DROP TABLE LEDGER_${UID}`);
    } finally {
      client.close();
    }
  });
});
