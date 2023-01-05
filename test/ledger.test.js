const assert = require("assert").strict;
const { TransbaseLedger } = require("../example/transbase-ledger");

describe("TransbaseLedger", () => {
  it("can hash ledger nodes", () => {
    assert.equal(
      TransbaseLedger.hashLedgerNodes(
        Buffer.from("foo"),
        Buffer.from("baz")
      ).toString("hex"),
      "af795c55a14c0e3d527575c784c33cf500135b0b0f9f95c857e2af3d0f496db8"
    );
    assert.equal(
      TransbaseLedger.hashLedgerNodes(
        Buffer.from("baz"),
        Buffer.from("foo")
      ).toString("hex"),
      "939e85997006535c84b1ffb9a24eaffc542e946095771912c57c17b08c3b6c59"
    );
    assert.equal(
      TransbaseLedger.hashLedgerNodes(
        Buffer.from([]),
        Buffer.from([])
      ).toString("hex"),
      "4bf5122f344554c53bde2ebb8cd2b7e3d1600ad631c385a5d7cce23c7785459a"
    );
  });

  describe("hash ledger record", () => {
    it("can handle empty result", () => {
      assert.equal(
        TransbaseLedger.hashLedgerRecord({
          getColumns: () => [],
        }).toString("hex"),
        "6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d"
      );
    });

    it("can handle null values", () => {
      assert.equal(
        TransbaseLedger.hashLedgerRecord({
          getColumns: () => [{ name: "null", col: 0, typeName: "STRING" }],
          isNull: () => true,
        }).toString("hex"),
        "96a296d224f285c67bee93c30f8a309157f0daa35dc5b87e410b78630a09cfc7"
      );
    });

    it("can hash string values", () => {
      assert.equal(
        TransbaseLedger.hashLedgerRecord({
          getColumns: () => [{ name: "string", col: 0, typeName: "STRING" }],
          isNull: () => false,
          readValueAsString: () => "foo",
        }).toString("hex"),
        "052d4b43417fe7f8ad2eb908e6f686c2043297c984c77b7182cd27b9e4a03ddb"
      );
    });

    it("can hash blobs", () => {
      assert.equal(
        TransbaseLedger.hashLedgerRecord({
          getColumns: () => [{ name: "string", col: 0, typeName: "BLOB" }],
          isNull: () => false,
          readValueAsBuffer: () => ({
            hasMore: false,
            data: Buffer.from("foo"),
          }),
        }).toString("hex"),
        "052d4b43417fe7f8ad2eb908e6f686c2043297c984c77b7182cd27b9e4a03ddb"
      );
    });

    it("can hash clobs", () => {
      assert.equal(
        TransbaseLedger.hashLedgerRecord({
          getColumns: () => [{ name: "string", col: 0, typeName: "CLOB" }],
          isNull: () => false,
          readValueAsBuffer: () => ({
            hasMore: false,
            data: Buffer.from("foo"),
          }),
        }).toString("hex"),
        "052d4b43417fe7f8ad2eb908e6f686c2043297c984c77b7182cd27b9e4a03ddb"
      );
    });
  });

  describe("verifyConsistencyProof", () => {
    it("can verify", () => {
      assert.equal(
        TransbaseLedger.verifyConsistencyProof(
          {
            query: () => ({
              toArray: () => [
                {
                  hash: "052d4b43417fe7f8ad2eb908e6f686c2043297c984c77b7182cd27b9e4a03ddb",
                  first: true,
                  old: Buffer.from([0]),
                  new: Buffer.from([1]),
                },
              ],
            }),
          },
          {
            ledgerHashOld: Buffer.from([0]),
            ledgerIdxOld: 0,
            ledgerHashNew: Buffer.from([1]),
            ledgerIdxNew: 1,
          }
        ),
        false
      );
    });
  });

  describe("verifyAuditProof", () => {
    it("can verify", () => {
      assert.equal(
        TransbaseLedger.verifyAuditProof(
          {
            query: () => ({
              toArray: () => [
                {
                  hash: "052d4b43417fe7f8ad2eb908e6f686c2043297c984c77b7182cd27b9e4a03ddb",
                  first: true,
                },
              ],
            }),
          },
          {
            ledgerHash: Buffer.from([0]),
            ledgerIdx: 0,
            recordId: Buffer.from([1]),
            recordHash: Buffer.from([2]),
          }
        ),
        false
      );
    });
  });
});
