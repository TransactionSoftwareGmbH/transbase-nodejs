const assert = require("assert").strict;
const { Transbase } = require("../transbase");
const config = require("./config");
describe("Transbase.query", () => {
  let client;

  before(() => {
    client = new Transbase(config);
    try {
      client.query(`DROP TABLE cashbook;`);
    } catch (ignore) {}
    const insert = (values) => `insert into cashbook ${values}`;
    client.query(`create table cashbook
      (
        nr 	integer not null primary key auto_increment,
        date 	timestamp not null default currentdate,
        amount 	numeric(10,2) not null,
        comment varchar(*)
      );`);
    client.query(insert`values (default, default, 100, 'Withdrawal')`);
    client.query(insert`values (default, currentdate, -9.50, 'Lunch🚀')`);
    client.query(insert`(amount, comment) values (-5.5, 'Drink');`);
    client.query(insert`values (default, '2021-02-20', 0, '');`);
    client.query(insert`(amount, comment) values (-2.5, null);`);
  });

  after(() => {
    try {
      client.query("DELETE FROM cashbook;");
    } finally {
      client.close();
    }
  });

  describe("select", () => {
    it("select *", () => {
      const result = client.query("select * from cashbook").toArray();
      assert.ok(result.length);
      assert.deepEqual(result[0], {
        nr: 1,
        date: result[0].date, // skip date
        amount: 100,
        comment: "Withdrawal",
      });
    });

    it("select aggregations", () => {
      const result = client.query("select count(*) from cashbook").toArray();
      assert.ok(result);
    });

    it("select columns", () => {
      const result = client
        .query("select nr, amount from cashbook where amount >= 0")
        .toArray();
      assert.ok(result.length);
    });

    it("handles NULL columns", () => {
      const result = client
        .query("select comment from cashbook where comment is null")
        .toArray();
      assert.equal(result[0].comment, null);
    });
  });

  describe("ResultSet", () => {
    it("can fetch rows one by one", () => {
      const rs = client.query("select * from cashbook");
      assert.equal(rs.next().nr, 1);
      assert.equal(rs.next().nr, 2);
    });

    it("can fetch all", () => {
      const rs = client.query("select * from cashbook where nr <= 3");
      let rows = 0;
      while (rs.hasNext()) {
        if (rs.next()) {
          rows++;
        }
      }
      assert.equal(rows, 3);
    });

    it("can fetch all with toArray convenience", () => {
      const rs = client.query("select * from cashbook where nr <= 3");
      assert.equal(rs.toArray().length, 3);
    });
  });

  describe("parametrized queries", () => {
    it("can pass positional (?) parameters as array", () => {
      assert.equal(
        client
          .query("select nr from cashbook where nr >= ? and comment = ?", [
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
            "select nr from cashbook where nr >= :nr and comment = :comment",
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
          .query("select nr from cashbook where nr = :nr", {
            nr: 1,
          })
          .next().nr,
        1
      );
      assert.equal(
        client
          .query("select nr from cashbook where nr = :nr", {
            nr: 2,
          })
          .next().nr,
        2
      );
    });
  });

  describe("insert/update/delete", () => {
    before(() => client.query("delete from cashbook where nr >= 9998"));
    it("returns number of added rows", () => {
      assert.equal(
        client.query(
          "insert into cashbook values (9998, default, 100, 'INSERTED');"
        ),
        1
      );
      client.query(
        "insert into cashbook values (9999, default, 100, 'INSERTED2')"
      );
    });

    it("returns number of updated rows", () => {
      assert.equal(
        client.query("update cashbook set amount = 0 where nr >= 9998"),
        2
      );
    });

    it("returns number of deleted rows", () => {
      assert.equal(client.query("delete from cashbook where nr >= 9998"), 2);
    });
  });
});
