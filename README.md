# Transbase NodeJS Driver

This is a nodejs [transbase](https://www.transaction.de/loesungen/transbase-ressourcenoptimierte-hochleistungsdatenbank) client based on tci.

## Install

```
npm install @transaction/transbase-nodejs
```
or if you are using yarn
```
yarn add @transaction/transbase-nodejs
```

> If prebuild binaries are not available for you system, you need to install [node-gyp](https://github.com/nodejs/node-gyp/blob/master/README.md) first to make sure that native adddon can be build on your system.

## Example 

```js
const { Transbase } = require("@transaction/transbase-nodejs");

const transbase = new Transbase({
  url: "//localhost:2024/sample",
  user: "tbadmin",
  password: "",
});

transbase.query("select * from cashbook").toArray(); //all rows as object array

transbase.close();
```

insert, update and delete are executed similar but the number of affected rows is returned instead:
```js
transbase.query("insert into cashbook values (42, default, 100, 'INSERT');") // = 1
```

Query parameters can be passed as second argument
```js
// pass parameters as object matching named parameters
transbase.query("select * from cashbook where nr >= :nr and comment like :startsWith", { nr: 1, startsWith: "Lu%" }); // object 
// or as an array for positional parameters
transbase.query("select * from cashbook where nr >= ? and comment like ?", [1, "Lu%",]);
```
## Api Reference

#### `class Transbase(options:{url:string,user:string,password:string})`
Creates a new Transbase Client, connects and login to the database given by the url authenticated by the given user and password. Don't forget to invoke [`close`](#close) when your done.
#### `query(statement:string, parameters?: array|object): ResultSet|number`
executes the given statement. In case of a "select" statement a  [ResultSet](#ResultSet) object is returned, otherwise the number of affected rows. Query parameters are passed as second argument as object `{[param]:value}` in case of named paramters *:param* or 
as an value array in case of positional paramters *?*.
#### <a id="#close"></a>`close(): void`
closes the transbase clients and clean up allocated resources

#### <a id="#ResultSet"></a> `class ResultSet`
#### `next(): object`
fetches the next row as object or undefined if no more data is found. The object keys are the column names.
#### `toArray(): object[]`
convenience method to get all rows as object array.


## Contribution
VS-Code Editor with c++ extension and prettier is recommended.

The only relevant source files are:

- tci.cpp - more or less direct TCI node api wrapper
- transbase.js - Transbase Api Client (A bit more high level than just tci)

## Build

run `npm run rebuild` which will also download the required tci sdk. 
## Test

test directory contains some unit tests that can be execute with
`npm test`
wich uses the url //localhost:2024/sample (tbadmin,"") be default.
You can pass another connection with 
```
npm test -- --url=<db_url> --user=<user> --password=<password>
```
## Playground

run.js contains a sample demo assuming a running transbase db "sample" at localhost:2024 with an existing table "cashbook".

execute:
`node run` to run a query example executed from nodejs

you can pass different connect parameters via command line arguments (url,user,password)

