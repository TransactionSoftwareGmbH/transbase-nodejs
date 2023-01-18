const assert = require("assert").strict;
const { Transbase } = require("../transbase");
const config = require("./config");

describe("Transbase.psm", () => {
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
    client.close();
  });
});
