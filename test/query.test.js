const assert = require("assert").strict;
const { Transbase } = require("../transbase");
const config = require("./config");

describe("Transbase.query", () => {
  const UID = String(Math.random()).substring(2, 12);
  let client;

  const TABLE = `cashbook_${UID}`;
  before(() => {
    client = new Transbase(config);
    const insert = (values) => `insert into ${TABLE} ${values}`;
    client.query(`create table ${TABLE}
      (
        nr 	integer not null primary key auto_increment,
        date 	timestamp not null default currentdate,
        amount 	numeric(10,2) not null,
        comment varchar(*),
      );`);
    client.query(insert`values (default, default, 100, 'Withdrawal')`);
    client.query(insert`values (default, currentdate, -9.50, 'Lunch🚀')`);
    client.query(insert`(amount, comment) values (-5.5, 'Drink');`);
    client.query(insert`values (default, '2021-02-20', 0, '');`);
    client.query(insert`(amount, comment) values (-2.5, null);`);

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
      client.query(`DROP TABLE ${TABLE};`);
      client.query(`DROP TABLE LEDGER_${UID}`);
    } finally {
      console.log("shutting down");
      client.close();
    }
  });

  describe("select", () => {
    it("select *", () => {
      const result = client.query(`select * from ${TABLE}`).toArray();
      assert.ok(result.length);
      assert.deepEqual(result[0], {
        nr: 1,
        date: result[0].date, // skip date
        amount: 100,
        comment: "Withdrawal",
      });
    });

    it("select aggregations", () => {
      const result = client.query(`select count(*) from ${TABLE}`).toArray();
      assert.ok(result);
    });

    it("select columns", () => {
      const result = client
        .query(`select nr, amount from ${TABLE} where amount >= 0`)
        .toArray();
      assert.ok(result.length);
    });

    it("handles NULL columns", () => {
      const result = client
        .query(`select comment from ${TABLE} where comment is null`)
        .toArray();
      assert.equal(result[0].comment, null);
    });
  });

  describe("ResultSet", () => {
    it("can fetch rows one by one", () => {
      const rs = client.query(`select * from ${TABLE}`);
      assert.equal(rs.next().nr, 1);
      assert.equal(rs.next().nr, 2);
    });

    it("can fetch all", () => {
      const rs = client.query(`select * from ${TABLE} where nr <= 3`);
      let rows = 0;
      while (rs.hasNext()) {
        if (rs.next()) {
          rows++;
        }
      }
      assert.equal(rows, 3);
    });

    it("can fetch all with toArray convenience", () => {
      const rs = client.query(`select * from ${TABLE} where nr <= 3`);
      assert.equal(rs.toArray().length, 3);
    });
  });

  describe("parametrized queries", () => {
    it("can pass positional (?) parameters as array", () => {
      assert.equal(
        client
          .query(`select nr from ${TABLE} where nr >= ? and comment = ?`, [
            1,
            "Drink",
          ])
          .toArray().length,
        1
      );
    });

    it("can pass named paramters as object", () => {
      assert.equal(
        client
          .query(
            `select nr from ${TABLE} where nr >= :nr and comment = :comment`,
            {
              nr: 1,
              comment: "Drink",
            }
          )
          .toArray().length,
        1
      );
    });

    it("can update parameters", () => {
      assert.equal(
        client
          .query(`select nr from ${TABLE} where nr = :nr`, {
            nr: 1,
          })
          .next().nr,
        1
      );
      assert.equal(
        client
          .query(`select nr from ${TABLE} where nr = :nr`, {
            nr: 2,
          })
          .next().nr,
        2
      );
    });
  });

  describe(`insert/update/delete`, () => {
    before(() => client.query(`delete from ${TABLE} where nr >= 9998`));
    it("returns number of added rows", () => {
      assert.equal(
        client.query(
          `insert into ${TABLE} values (9998, default, 100, 'INSERTED');`
        ),
        1
      );
      client.query(
        `insert into ${TABLE} values (9999, default, 100, 'INSERTED2')`
      );
    });

    it("returns number of updated rows", () => {
      assert.equal(
        client.query(`update ${TABLE} set amount = 0 where nr >= 9998`),
        2
      );
    });

    it("returns number of deleted rows", () => {
      assert.equal(client.query(`delete from ${TABLE} where nr >= 9998`), 2);
    });
  });

  describe("blobs clobs and binaries", () => {
    const BLOB_TABLE = "BLOB_" + UID;

    before(() => {
      client.query(`create table ${BLOB_TABLE}
      (
        id 	integer not null primary key auto_increment,
        image blob,
        text clob,
        byte BINCHAR(*)
      );`);
    });

    after(() => {
      try {
        client.query(`DROP TABLE ${BLOB_TABLE};`);
      } catch (e) {}
    });

    it("can insert and select blob values as buffer", () => {
      const blob = require("fs").readFileSync("./README.md");
      client.query(`insert into ${BLOB_TABLE} values (1, ?, null, null);`, [
        blob,
      ]);
      const { image } = client
        .query(`select image from ${BLOB_TABLE} where id = 1`)
        .next();
      assert.ok(image);
      assert.ok(blob.equals(image));
    });

    it("can insert and select clob values as string", () => {
      const clob = require("fs").readFileSync("./README.md").toString();
      client.query(`insert into ${BLOB_TABLE} values (2, null, ?, null);`, [
        clob,
      ]);
      const { text } = client
        .query(`select text from ${BLOB_TABLE} where id = 2`)
        .next();
      assert.ok(clob);
      assert.equal(clob, text);
    });

    it("can insert and select binary values as buffer", () => {
      const binary = Buffer.from([1, 2, 3]);
      client.query(`insert into ${BLOB_TABLE} values (3, null, null, ?);`, [
        binary,
      ]);
      const { byte } = client
        .query(`select byte from ${BLOB_TABLE} where id = 3`)
        .next();
      assert.ok(byte);
      assert.ok(binary.equals(byte));
    });
  });

  describe("transbase values/literals", () => {
    before(() => {
      client.query(`
        insert into LEDGER_${UID} values (
          120,
          32000,
          2000111222,
          4000111222333,
          5.2,
          555.22,
          0x0110,
          'Clob',
          'Varchar(*)',
          'Char(*)' ,
          'String',
          0x0110,
          0b0110110,
          0b0110,
          TRUE,
          DATETIME(2002-12),
          DATE '2002-12-24',
          TIME '17:35:10',
          TIMESTAMP '2002-12-24 17:35:10.025',
          TIMESPAN[YY:MO](2-6), 
          INTERVAL '2:12:35' HOUR TO SECOND
          );
        `);
    });

    it("can select all datatypes as js values", () => {
      const resultSet = client.query(`select * from LEDGER_${UID}`);
      assert.deepEqual(resultSet.toArray()[0], {
        a: 120,
        b: 32000,
        c: 2000111222,
        d: 4000111222333,
        e: 5.2,
        f: 555.22,
        g: Buffer.from([1, 16]),
        h: "Clob",
        i: "Varchar(*)",
        j: "Char(*)",
        k: "String",
        l: Buffer.from([1, 16]),
        m: "0110110",
        n: "0110",
        o: true,
        p: "2002-12",
        q: "2002-12-24",
        r: "17:35:10",
        s: "2002-12-24 17:35:10.250",
        t: "2-06",
        u: "2:12:35",
      });
    });

    it("can select all values as plain strings (tci_c_char)", () => {
      try {
        client.setTypeCast(false);
        const resultSet = client.query(`select * from LEDGER_${UID}`);
        assert.deepEqual(resultSet.toArray()[0], {
          a: "120",
          b: "32000",
          c: "2000111222",
          d: "4000111222333",
          e: "5.20",
          f: "555.22",
          g: "0110",
          h: "Clob",
          i: "Varchar(*)",
          j: "Char(*)",
          k: "String",
          l: "0110",
          m: "0110110",
          n: "0110",
          o: "true",
          p: "2002-12",
          q: "2002-12-24",
          r: "17:35:10",
          s: "2002-12-24 17:35:10.250",
          t: "2-06",
          u: "2:12:35",
        });
      } finally {
        client.setTypeCast(true);
      }
    });
  });
});
