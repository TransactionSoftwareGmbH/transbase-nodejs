const assert = require("assert").strict;
const { Transbase } = require("../transbase");
const config = require("./config");
describe("Transbase.query", () => {
  const UID = String(Math.random()).substring(2, 12);
  let client;

  const TABLE = `cashbook_${UID}`;
  const TABLE_TX = `test_tx_${UID}`;

  before(() => {
    client = new Transbase(config);
    console.log();
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
      client.query(`DROP TABLE ${TABLE_TX}`);
    } finally {
      console.log("shutting down");
      client.close();
    }
  });

  it("can get client and server version", () => {
    const version = client.getVersionInfo();
    console.log(version);
    assert.ok(version.client.startsWith("8"));
    assert.ok(version.server.startsWith("8"));
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

    it("can pass named parameters as object", () => {
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
      const a = require("crypto").createHash("sha256");
      a.update(image);
      console.log(a.digest("hex"));
    });

    it("can read blob as buffer", () => {
      const blob = require("fs").readFileSync("./README.md");
      client.query(`insert into ${BLOB_TABLE} values (11, ?, null, null);`, [
        blob,
      ]);
      const rs = client.query(`select image from ${BLOB_TABLE} where id = 11`);
      rs.fetch();
      let text = "";
      let buffer = { hasMore: true };
      while (buffer.hasMore) {
        buffer = rs.readValueAsBuffer("image");
        text += buffer.data.toString();
      }
      assert.equal(
        blob.toString("utf8"),
        Buffer.from(text, "hex").toString("utf8")
      );
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

    it("can read clob as buffer", () => {
      const clob = require("fs").readFileSync("./README.md").toString();
      client.query(`insert into ${BLOB_TABLE} values (21, null, ?, null);`, [
        clob,
      ]);
      const rs = client.query(`select text from ${BLOB_TABLE} where id = 21`);
      rs.fetch();
      let text = "";
      let buffer = { hasMore: true };
      while (buffer.hasMore) {
        buffer = rs.readValueAsBuffer("text");
        text += buffer.data;
      }
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
          TIMESTAMP '2002-12-24 17:35:10.250',
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

    const expected = {
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
    };

    it("can select all values as plain strings (tci_c_char)", () => {
      try {
        client.setTypeCast(false);
        const resultSet = client.query(`select * from LEDGER_${UID}`);
        assert.deepEqual(resultSet.toArray()[0], expected);
      } finally {
        client.setTypeCast(true);
      }
    });

    it("can select all types with readValueAsString", () => {
      try {
        const resultSet = client.query(`select * from LEDGER_${UID}`);
        resultSet.fetch();
        Object.entries(expected).forEach(([col, value]) => {
          assert.equal(resultSet.readValueAsString(col), value);
        });
      } finally {
        client.setTypeCast(true);
      }
    });

    it("can select all types with readValueAsString with col number", () => {
      try {
        const resultSet = client.query(`select * from LEDGER_${UID}`);
        resultSet.fetch();
        Object.entries(expected).forEach(([_, value], index) => {
          assert.equal(resultSet.readValueAsString(index + 1), value);
        });
      } finally {
        client.setTypeCast(true);
      }
    });

    it("can get all types as buffers", () => {
      try {
        const resultSet = client.query(`select * from LEDGER_${UID}`);
        resultSet.fetch();
        Object.entries(expected).forEach(([col, value]) => {
          assert.deepEqual(
            resultSet.readValueAsBuffer(col).data,
            Buffer.from(value)
          );
        });
      } finally {
        client.setTypeCast(true);
      }
    });

    it("can compute hash of record for simple records, strings without overflow", () => {
      client.setTypeCast(false);
      const rs = client.query(`select * from LEDGER_${UID}`);
      assert.equal(
        hashSimple(rs),
        "e84b812c3d611dad03dbcf6d6954a2d618b1f11b748690fcf27b40d869acf68f"
      );
    });

    it("can compute hash of record using buffered chunk of data for large lobs", () => {
      client.setTypeCast(true);
      const rs = client.query(`select * from LEDGER_${UID}`);
      assert.equal(
        hashRecordBuffered(rs),
        "e84b812c3d611dad03dbcf6d6954a2d618b1f11b748690fcf27b40d869acf68f"
      );
    });
  });

  it("can create and call a persisted stored method", () => {
    const client = new Transbase(config);
    try {
      client.query("drop function hello");
    } catch (ignore) {}
    let result = client.query(`
    create function hello() returns string as
    begin
      return select tname from systable first(1);
    end;
    `);
    assert.equal(0, result);

    result = client.query("select hello();");
    assert.equal(1, result.toArray().length);
  });

  it("can run noop psm", () => {
    const client = new Transbase(config);

    try {
      client.query("drop procedure noop");
    } catch (ignore) {}

    let result = client.query(`
    create procedure noop() as
    begin
    end;
    `);
    assert.equal(0, result);

    result = client.query("call noop();");
    assert.ok(result);
  });

  it("can pass parameters to psm", () => {
    const client = new Transbase(config);

    try {
      client.query("drop procedure p");
    } catch (ignore) {}

    let result = client.query(`create procedure p(
      in    a integer,
      out   b integer,
      inout c integer,
      in    d integer,
      out   e integer,
      inout f integer) as
     begin
       b := a;
       c := c + c;
       e := d;
       f := f + f;
     end;
    `);
    assert.equal(0, result);

    result = client.query("call p(?, ?, ?, ?, ?, ?);", [1, 2, 3, 4, 5, 6]);
    assert.deepEqual(result.next(), { 1: 1, 2: 6, 3: 4, 4: 12 });

    result = client.query("call p(:a, :b, :c, :d, :e, :f);", {
      a: 1,
      b: 2,
      c: 3,
      d: 4,
      e: 5,
      f: 6,
    });
    assert.deepEqual(result.next(), { b: 1, c: 6, e: 4, f: 12 });
  });

  describe("transaction", () => {
    it("can rollback transaction", () => {
      const client = new Transbase(config);
      client.beginTransaction();
      client.query(`create table ${TABLE_TX} (nr integer);`);
      client.rollback();
      assert.ok(
        !client
          .query("select tname from systable")
          .toArray()
          .map((it) => it.tname)
          .includes(TABLE_TX)
      );
    });

    it("can commit transaction", () => {
      const client = new Transbase(config);
      client.beginTransaction();
      client.query(`create table ${TABLE_TX} (nr integer);`);
      client.commit();
      assert.ok(
        client
          .query("select tname from systable")
          .toArray()
          .map((it) => it.tname)
          .includes(TABLE_TX)
      );
    });
  });
});

function hashSimple(resultSet) {
  const hash = require("crypto").createHash("sha256");
  Object.values(resultSet.next()).forEach((value) => hash.update(value));
  return hash.digest("hex");
}

function hashRecordBuffered(resultSet) {
  resultSet.fetch();
  const hash = require("crypto").createHash("sha256");
  for (const { col, typeName } of resultSet.getColumns()) {
    if (typeName === "BLOB" || typeName === "CLOB") {
      let buffer = { hasMore: true };
      while (buffer.hasMore) {
        buffer = resultSet.readValueAsBuffer(col, 8);
        hash.update(buffer.data);
      }
    } else {
      hash.update(resultSet.readValueAsString(col));
    }
  }
  return hash.digest("hex");
}
