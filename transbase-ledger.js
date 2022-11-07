const crypto = require("crypto");

class TransbaseLedger {
  static hashLedgerRecord(resultSet) {
    const hash = crypto.createHash("sha256");
    hash.update(Buffer.from([0]));

    for (const { col, name, typeName } of resultSet.getColumns()) {
      if ("record_id" === name.toLowerCase()) {
        continue;
      }
      if (resultSet.isNull(col)) {
        hash.update(Buffer.from([0]));
      } else {
        hash.update(Buffer.from([1]));
        if (typeName === "BLOB" || typeName === "CLOB") {
          let buffer = { hasMore: true };
          while (buffer.hasMore) {
            buffer = resultSet.readValueAsBuffer(col, 8);
            hash.update(buffer.data);
          }
        } else {
          hash.update(resultSet.readValueAsString(col));
        }
      }
    }

    return hash.digest();
  }

  static verifyAuditProof(
    transbase,
    { ledgerHash, ledgerIdx, recordId, recordHash }
  ) {
    let hashProof = recordHash;

    const res = transbase.query(
      "select hash, first from ledger_audit_proof(?, ?) order by level asc",
      [ledgerIdx, recordId],
      { typeCast: true }
    );

    res.toArray().forEach(({ first, hash: hashString }) => {
      const hash = Buffer.from(hashString, "hex");
      hashProof = first
        ? TransbaseLedger.hashLedgerNodes(hash, hashProof)
        : TransbaseLedger.hashLedgerNodes(hashProof, hash);
    });
    return isBufferEqual(hashProof, ledgerHash);
  }

  static verifyConsistencyProof(
    transbase,
    { ledgerHashOld, ledgerIdxOld, ledgerHashNew, ledgerIdxNew }
  ) {
    let hashOld = null,
      hashNew = null;
    const res = transbase.query(
      "select hash, first, old, new from ledger_consistency_proof(?, ?) order by new asc",
      [ledgerIdxOld, ledgerIdxNew],
      { typeCast: true }
    );

    function calcHash(index, first, currentHash, hash) {
      if (index != null) {
        if (currentHash == null) {
          return hash;
        }
        return first
          ? TransbaseLedger.hashLedgerNodes(hash, currentHash)
          : TransbaseLedger.hashLedgerNodes(currentHash, hash);
      }
      return currentHash;
    }

    res.toArray().forEach((row) => {
      const hash = Buffer.from(row.hash, "hex");
      hashOld = calcHash(res.old, row.first, hashOld, hash);
      hashNew = calcHash(res.new, row.first, hashNew, hash);
    });

    return (
      isBufferEqual(hashOld, ledgerHashOld) &&
      isBufferEqual(hashNew, ledgerHashNew)
    );
  }

  /**
   * Hashes two intermediate nodes of the Merkle-Tree returning the hash of the
   * corresponding parent node
   *
   * @param first {Buffer} intermediate node
   * @param second {Buffer} intermediate node
   * @return Buffer the hash of the resulting parent node
   */
  static hashLedgerNodes(first, second) {
    const hash = crypto.createHash("sha256");
    hash.update(Buffer.from([1]));
    hash.update(first);
    hash.update(second);
    return hash.digest();
  }
}

function isBufferEqual(a, b) {
  return a != null && b != null ? a.equals(b) : a === b;
}

module.exports = { TransbaseLedger };
