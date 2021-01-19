const assert = require("assert").strict;
const { Transbase } = require("../transbase");

describe("Transbase.query", () => {
  let client;

  before(() => {
    client = new Transbase({
      url: "//localhost:2024/sample",
      user: "tbadmin",
      password: "",
    });
  });
  describe("select", () => {
    it("select *", () => {
      const result = client.query("select * from cashbook").toArray();
      //console.log(result);
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
      //console.log(result);
      assert.ok(result);
    });

    it("select columns", () => {
      const result = client
        .query("select nr, amount from cashbook where amount >= 0")
        .toArray();
      //console.log(result);
      assert.ok(result.length);
    });

    it("handles NULL columns", () => {
      const result = client
        .query("select comment from cashbook where comment is null")
        .toArray();
      //console.log(result);
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

  after(() => {
    client.close();
  });
});
