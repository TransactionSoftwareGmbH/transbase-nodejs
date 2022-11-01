export class TransbaseLedger {
  static hashLedgerRecord(res) {
    return null;
  }

  static verifyAuditProof(
    transbase,
    { ledgerHash, ledgerIdx, recordId, recordHash }
  ) {
    return false;
  }

  static verifyConsistencyProof(
    transbase,
    { ledgerHashOld, ledgerIdxOld, ledgerHashNew, ledgerIdxNew }
  ) {
    return false;
  }

  /**
   * Hashes two intermediate nodes of the Merkle-Tree returning the hash of the
   * corresponding parent node
   *
   * @param first {Buffer} intermediate node
   * @param second {Buffer} intermediate node
   * @return Buffer the hash of the resulting parent node
   */
  static _hashLedgerNodes(first, second) {}
}
