# Transbase NodeJS Driver

<p align="center">
    <a href="https://badge.fury.io/js/%40transaction%2Ftransbase-nodejs"><img src="https://badge.fury.io/js/%40transaction%2Ftransbase-nodejs.svg" alt="npm version" height="18"></a>
    <a href="https://github.com/TransactionSoftwareGmbH/transbase-nodejs/actions/workflows/test.yml"><img src="https://github.com/TransactionSoftwareGmbH/transbase-nodejs/actions/workflows/test.yml/badge.svg " alt="npm version" height="18"></a>
</p>

This is a nodejs [transbase](https://www.transaction.de/loesungen/transbase-ressourcenoptimierte-hochleistungsdatenbank) client based on tci.

## Install

```
npm install @transaction/transbase-nodejs
```

or if you are using yarn

```
yarn add @transaction/transbase-nodejs
```

> If prebuild binaries are not available for you system you need to install [node-gyp](https://github.com/nodejs/node-gyp/blob/master/README.md) first to make sure that the native adddon can be build on your system.

## Example

```js
const { Transbase } = require("@transaction/transbase-nodejs");
// Typescript
// import {Transbase} from "@transaction/transbase-nodejs"

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
transbase.query("insert into cashbook values (42, default, 100, 'INSERT');"); // = 1
```

Query parameters can be passed as second argument

```js
// pass parameters as object matching named parameters
transbase.query(
  "select * from cashbook where nr >= :nr and comment like :startsWith",
  { nr: 1, startsWith: "Lu%" }
); // object
// or as an array for positional parameters
transbase.query("select * from cashbook where nr >= ? and comment like ?", [
  1,
  "Lu%",
]);
```

## Api Reference

#### `class Transbase(options:{url:string,user:string,password:string, typeCast?:boolean})`

Creates a new Transbase Client, connects and login to the database given by the url authenticated by the given user and password.
Set typeCast option to false if column values should be fetched as strings.
Don't forget to invoke [`close`](#close) when your done.

#### `query(statement:string, parameters?: array|object, options?: {typeCast?: boolean}): ResultSet|number`

executes the given statement. In case of a "select" statement a [ResultSet](#ResultSet) object is returned, otherwise the number of affected rows. Query parameters are passed as second argument as object `{[param]:value}` in case of named paramters _:param_ or
as an value array in case of positional paramters _?_.

#### <a id="#close"></a>`close(): void`

closes the transbase clients and clean up allocated resources

#### <a id="#ResultSet"></a> `class ResultSet`

#### `next(): object`

fetches the next row as object or undefined if no more data is found. The object keys are the column names.

#### `toArray(): object[]`

convenience method to get all rows as object array.

#### `getColumns(): ColInfo[]`

get meta information of columns in this result set

#### `isNull(colNumberOrName: number | string): boolean`

#### `readValue(colNumberOrName: number|string): any`

#### `readValueAsString(colNumberOrName: number|string): string | null`

#### `readValueAsBuffer(colNumberOrName: number|string, size?: number): {data:Buffer, hasMore: boolean}`

low level api methods to get column value as string or buffered data chunk.
Column numbers start with 1! Use readValueAsBuffer when working with large BLOBS or CLOBS.

### `getVersionInfo(): { client: string; server: string }`

retrieve version information of transbase tci client and database server

## Type Mapping

By default sql types are mapped to native js types wherever possible.
Set `typeCast` option to false in config object, or use `setTypeCast(value)` to get column values as plain strings.

| SQL Type       | JS Type           |
| :------------- | :---------------- |
| BOOL (BOOLEAN) | boolean           |
| TINYINT        | number            |
| SMALLINT       | number            |
| INTEGER        | number            |
| BIGINT         | number            |
| NUMERIC        | number            |
| FLOAT (REAL)   | number            |
| DOUBLE         | number            |
| CHAR           | string            |
| VARCHAR        | string            |
| DATE           | string (iso-8601) |
| TIME           | string (iso-8601) |
| TIMESTAMP      | string (iso-8601) |
| CLOB           | string            |
| BINCHAR        | Buffer            |
| VARBINARY      | Buffer            |
| BLOB           | Buffer            |
| BITS           | string (bits)     |

## Contribution

VS-Code Editor with c++ extension and prettier is recommended.

The only relevant source files are:

- tci.cpp - TCI node api wrapper
- transbase.js - Transbase Api Client (more high level than just tci)

## Build

run `npm run rebuild` which will also download the required tci sdk.

## Test

test directory contains some unit tests that can be execute with
`npm test`
wich uses the url `//localhost:2024/sample` (user=tbadmin,password="") by default.
You can pass another connection with command line arguments:

```
npm test -- --url=<db_url> --user=<user> --password=<password>
```

## Playground

run.js contains a sample demo assuming a running transbase db "sample" at localhost:2024 with an existing table "cashbook".

execute:
`node run` to run a query example executed from nodejs

you can pass different connect parameters via command line arguments (--url or -H, user or -U, password or -P) similar to npm test.
