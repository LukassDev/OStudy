const SQLITE_HEADER = 'SQLite format 3\0';

/** Prepare a complete SQLite snapshot for an in-memory connection. */
export function prepareDatabaseSnapshot(bytes: Uint8Array): Uint8Array {
  if (bytes.byteLength < 100
    || ![...SQLITE_HEADER].every((character, index) => bytes[index] === character.charCodeAt(0))) {
    throw new Error('O ficheiro não tem o formato de uma base SQLite completa. Selecione o ficheiro .db original, não um ZIP nem uma cópia incompleta.');
  }

  // sqlite3_deserialize cannot read WAL snapshots, even when all pages are present.
  // SQLite documents switching these two header bytes to rollback journal mode:
  // https://www.sqlite.org/c3ref/deserialize.html
  if ((bytes[18] === 1 || bytes[18] === 2) && (bytes[19] === 1 || bytes[19] === 2)
    && (bytes[18] === 2 || bytes[19] === 2)) {
    const snapshot = Uint8Array.from(bytes);
    snapshot[18] = 1;
    snapshot[19] = 1;
    return snapshot;
  }
  return bytes;
}
