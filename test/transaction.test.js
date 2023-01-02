const assert = require("assert").strict;
const { Transbase } = require("../transbase");
const config = require("./config");

describe("Transbase.transaction", () => {
  const UID = String(Math.random()).substring(2, 12);

  const TABLE = `test_tx_${UID}`;

  after(() => {
    const client = new Transbase(config);
    try {
      client.query(`drop table ${TABLE}`);
    } catch (e) {
    } finally {
      client.close();
    }
  });

  it("can rollback transaction", () => {
    const client = new Transbase(config);
    client.beginTransaction();
    client.query(`create table ${TABLE} (nr integer);`);
    client.rollback();
    assert.ok(
      !client
        .query("select tname from systable")
        .toArray()
        .map((it) => it.tname)
        .includes(TABLE)
    );
    client.close();
  });

  it("can commit transaction", () => {
    const client = new Transbase(config);
    client.beginTransaction();
    client.query(`create table ${TABLE} (nr integer);`);
    client.commit();
    assert.ok(
      client
        .query("select tname from systable")
        .toArray()
        .map((it) => it.tname)
        .includes(TABLE)
    );
    client.close();
  });
});
