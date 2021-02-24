const { Transbase } = require("./transbase");
const config = requore("./test/config");

const transbase = new Transbase(
  config || {
    url: "//localhost:2024/sample",
    user: "tbadmin",
    password: "",
  }
);

console.log(transbase.query("select * from cashbook"));

// console.log(transbase.query("select count(*) from cashbook"));

// console.log(transbase.query("select nr, amount from cashbook where amount < 0"));

// console.log(transbase.query("select * from cashbook where nr >= :nr and comment like :startsWith", { nr: 1, startsWith: "Lu%" }));

// console.log(transbase.query("select * from cashbook where nr >= ? and comment like ?", [1, "Lu%",]));

// console.log(transbase.query("insert into cashbook values (42, default, 100, 'Inserted')"));

// console.log(transbase.query("update cashbook set amount = 0 where nr = 42"));

// console.log(transbase.query("delete from cashbook where nr = 42"));

transbase.close();
