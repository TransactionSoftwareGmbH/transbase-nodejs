const { Transbase } = require("@transaction/transbase-nodejs");

const transbase = new Transbase({
  url: "//localhost:2024/sample",
  user: "tbadmin",
  password: "",
});

const resultSet = transbase.query("select * from cashbook");

console.log(resultSet.toArray());

transbase.close();
