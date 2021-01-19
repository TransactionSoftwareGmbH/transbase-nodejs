const assert = require("assert").strict;
const { Transbase } = require("../transbase");

describe("connect", () => {
  it("config object is required", () => {
    assert.throws(() => new Transbase(), /connect is missing config argument/);
  });

  it("url is required", () => {
    assert.throws(() => new Transbase({}), /connect requires a string url/);
    assert.throws(
      () => new Transbase({ url: 42 }),
      /connect requires a string url/
    );
  });

  it("user is required", () => {
    assert.throws(
      () => new Transbase({ url: "//localhost:2024/sample" }),
      /connect requires a string user/
    );
  });

  it("password is required", () => {
    assert.throws(
      () => new Transbase({ url: "//localhost:2024/sample", user: "user" }),
      /connect requires a string password/
    );
  });

  it("malformed url", () => {
    assert.throws(
      () =>
        new Transbase({
          url: "hello world",
          user: "user",
          password: "geheim",
        }),
      /Invalid connection string/
    );
  });

  it("wrong url", (done) => {
    assert.throws(
      () =>
        new Transbase({
          url: "//develop:2024/sample",
          user: "user",
          password: "geheim",
        }),
      /11001|System Error/
    );
    done();
  }, 5000);

  it("db does not exist", () => {
    assert.throws(
      () =>
        new Transbase({
          url: "//localhost:2024/what",
          user: "tbadmin",
          password: "",
        }),
      /database <what> does not exist/
    );
  });

  it("wrong user", () => {
    assert.throws(
      () =>
        new Transbase({
          url: "//localhost:2024/sample",
          user: "sneaky",
          password: "",
        }),
      /login failed/
    );
  });

  it("wrong password", () => {
    assert.throws(
      () =>
        new Transbase({
          url: "//localhost:2024/sample",
          user: "tbadmin",
          password: "wrong",
        }),
      /login failed/
    );
  });

  it("connect success", () => {
    const client = new Transbase({
      url: "//localhost:2024/sample",
      user: "tbadmin",
      password: "",
    });
    assert.equal(client != null, true);
    client.close();
  });
});
