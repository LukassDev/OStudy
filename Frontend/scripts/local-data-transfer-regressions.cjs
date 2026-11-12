const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const ts = require('typescript');

function load(relativePath, imports = {}, logger = console) {
  const source = fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const result = { exports: {} };
  new Function('require', 'module', 'exports', 'console', code)(name => {
    if (name in imports) return imports[name];
    throw new Error(`Unexpected import: ${name}`);
  }, result, result.exports, logger);
  return result.exports;
}

async function main() {
  // Use the exact WASM SQLite engine shipped by Expo, including deserialize.
  const wasmDirectory = path.resolve(__dirname, '../node_modules/expo-sqlite/web/wa-sqlite');
  const factory = require(path.join(wasmDirectory, 'wa-sqlite.js'));
  const module = await factory({ wasmBinary: fs.readFileSync(path.join(wasmDirectory, 'wa-sqlite.wasm')) });
  const api = await import(pathToFileURL(path.join(wasmDirectory, 'sqlite-api.js')).href);
  const { MemoryVFS } = await import(pathToFileURL(path.join(wasmDirectory, 'MemoryVFS.js')).href);
  const sqlite = api.Factory(module);
  sqlite.vfs_register(await MemoryVFS.create('import-regressions', module), true);

  async function open(snapshot) {
    const pointer = await sqlite.open_v2(':memory:', api.SQLITE_OPEN_READWRITE | api.SQLITE_OPEN_CREATE, 'import-regressions');
    if (snapshot) sqlite.deserialize(pointer, 'main', snapshot);
    const query = async (sql, params) => {
      const rows = [];
      try {
        for await (const statement of sqlite.statements(pointer, sql)) {
          if (params.length) sqlite.bind_collection(statement, params);
          while (await sqlite.step(statement) === api.SQLITE_ROW) {
            rows.push(Object.fromEntries(sqlite.column_names(statement).map((name, i) => [name, sqlite.column(statement, i)])));
          }
        }
      } catch (error) { throw new Error(`${sql.slice(0, 100)}: ${error.message}`); }
      return rows;
    };
    return {
      getAllAsync: (sql, ...params) => query(sql, params),
      getFirstAsync: async (sql, ...params) => (await query(sql, params))[0] ?? null,
      runAsync: async (sql, ...params) => { await query(sql, params); },
      execAsync: async sql => {
        try { await sqlite.exec(pointer, sql); }
        catch (error) { throw new Error(`${sql.slice(0, 100)}: ${error.message}`); }
      },
      serializeAsync: async () => sqlite.serialize(pointer, 'main'),
      closeAsync: () => sqlite.close(pointer),
      withTransactionAsync: async callback => {
        await sqlite.exec(pointer, 'BEGIN');
        try { await callback(); await sqlite.exec(pointer, 'COMMIT'); }
        catch (error) { await sqlite.exec(pointer, 'ROLLBACK'); throw error; }
      },
    };
  }

  const schema = load('src/db/schema.ts');
  const migrations = load('src/db/migrations.ts', { './schema': schema });
  const serialization = load('src/db/serialization.ts');
  const { prepareDatabaseSnapshot } = serialization;
  const criteria = JSON.stringify({ test: 60, worksheet: 10, presentation: 10, other: 0, behavior: 10, participation: 10 });

  async function fixture(version) {
    let sql = schema.INITIAL_SCHEMA;
    if (version < 3) {
      sql = sql.replace(/CREATE TABLE IF NOT EXISTS grade_modules \([\s\S]*?CREATE INDEX IF NOT EXISTS grade_modules_space_idx[^;]*;/, '')
        .replace('  module_id TEXT REFERENCES grade_modules(id) ON DELETE SET NULL,\n', '')
        .replace('  category_id TEXT,\n', '');
    }
    if (version < 4) {
      for (const column of ['qualitative_value', 'behavior_qualitative', 'participation_qualitative']) {
        sql = sql.replace(`  ${column} TEXT,\n`, '');
      }
    }
    if (version < 2) sql = sql.replace('  google_classroom_course_id TEXT,\n', '');
    const database = await open();
    await database.execAsync(sql);
    await database.execAsync(`PRAGMA user_version = ${version}`);
    await database.runAsync("INSERT INTO profile (id, name, language, created_at, updated_at) VALUES ('local', 'Aluno de teste', 'pt-BR', 'now', 'now')");
    await database.runAsync("INSERT INTO spaces (id, name, created_at, updated_at) VALUES ('s1', 'Matemática', 'now', 'now')");
    await database.runAsync("INSERT INTO content_topics (id, space_id, title, created_at, updated_at) VALUES ('t1', 's1', 'Álgebra', 'now', 'now')");
    await database.runAsync("INSERT INTO chats (id, space_id, title, created_at, updated_at) VALUES ('c1', 's1', 'Estudo', 'now', 'now')");
    await database.runAsync("INSERT INTO messages (id, chat_id, role, content, created_at) VALUES ('msg1', 'c1', 'user', 'Mensagem preservada', 'now')");
    await database.runAsync("INSERT INTO resources (id, space_id, title, type, topic_id, created_at, updated_at) VALUES ('r1', 's1', 'Resumo', 'text', 't1', 'now', 'now')");
    await database.runAsync("INSERT INTO grades (id, space_id, title, score, max_score, weight, topic_id, graded_at, created_at, updated_at) VALUES ('g1', 's1', 'Teste antigo', 17, 20, 2, 't1', '2026-11-01', 'now', 'now')");
    await database.runAsync("INSERT INTO settings (key, value, updated_at) VALUES ('study.preferences', '{\"show_grades\":true}', 'now')");
    await database.runAsync("INSERT INTO settings (key, value, updated_at) VALUES ('backup.automatic.enabled', 'true', 'now')");
    if (version >= 3) {
      await database.runAsync("INSERT INTO grade_modules (id, space_id, name, criteria, behavior_score, participation_score, created_at, updated_at) VALUES ('m1', 's1', 'Módulo 1', ?, 18, 16, 'now', 'now')", criteria);
      await database.runAsync("UPDATE grades SET module_id = 'm1', category_id = 'test' WHERE id = 'g1'");
    }
    if (version >= 4) {
      await database.runAsync("INSERT INTO grades (id, space_id, title, score, max_score, weight, module_id, category_id, qualitative_value, graded_at, created_at, updated_at) VALUES ('q1', 's1', 'Estimativa', ?, 100, 1, 'm1', 'test', 'good', '2026-11-02', 'now', 'now')", version < 5 ? 62.5 : 80);
    }
    assert.equal((await database.getFirstAsync('PRAGMA integrity_check')).integrity_check, 'ok');
    const snapshot = await database.serializeAsync();
    await database.closeAsync();
    return snapshot;
  }

  function transfer(target, snapshot, { failClose = false, failInsert = false } = {}) {
    let confirmations = 0;
    let deserializations = 0;
    let cleanupErrors = 0;
    const sourceBytes = Uint8Array.from(snapshot);
    const service = load('src/services/localDataTransfer.ts', {
      'react-native': { Platform: { OS: 'web' } },
      'expo-document-picker': { getDocumentAsync: async () => ({ canceled: false, assets: [{ file: { arrayBuffer: async () => sourceBytes.buffer } }] }) },
      'expo-file-system/legacy': {}, 'expo-sharing': {},
      'expo-sqlite': { openDatabaseAsync: async () => open(), deserializeDatabaseAsync: async bytes => {
        deserializations++;
        assert.equal(bytes[18], 1); assert.equal(bytes[19], 1);
        const imported = await open(bytes);
        return { ...imported, closeAsync: async () => {
          await imported.closeAsync();
          if (failClose) throw new Error('cleanup finalizing statement');
        } };
      } },
      '../db/client': { getDatabase: async () => failInsert ? {
        ...target,
        runAsync: async (sql, ...params) => {
          if (sql.startsWith('INSERT INTO "grades"')) throw new Error('simulated insert failure');
          await target.runAsync(sql, ...params);
        },
      } : target },
      '../db/schema': schema, '../db/migrations': migrations, '../db/serialization': serialization,
    }, { ...console, error: () => cleanupErrors++ });
    return {
      service, sourceBytes,
      import: (confirm = true) => service.pickAndImportLocalDatabase(async () => { confirmations++; return confirm; }),
      counts: () => ({ confirmations, deserializations, cleanupErrors }),
    };
  }

  const target = await open();
  await target.execAsync('PRAGMA foreign_keys = ON');
  await migrations.migrateDatabase(target);
  const walSnapshot = Uint8Array.from(await fixture(2));
  walSnapshot[18] = walSnapshot[19] = 2;
  const unsupported = await open(walSnapshot);
  await assert.rejects(unsupported.getFirstAsync('PRAGMA user_version'), /unable to open database file/);
  await unsupported.closeAsync();
  const normalized = prepareDatabaseSnapshot(walSnapshot);
  assert.equal(walSnapshot[18], 2, 'The original backup is unchanged.');
  assert.equal(normalized[18], 1); assert.equal(normalized[19], 1);
  assert.deepEqual(normalized.subarray(20), walSnapshot.subarray(20), 'Only the WAL mode bytes are changed.');

  for (const version of [1, 2, 3, 4, 5]) {
    for (const wal of [false, true]) {
      const snapshot = await fixture(version);
      if (wal) snapshot[18] = snapshot[19] = 2;
      const attempt = transfer(target, snapshot);
      assert.equal(await attempt.import(), true, `Version ${version}, WAL=${wal} imports.`);
      assert.equal((await target.getFirstAsync('PRAGMA user_version')).user_version, schema.DATABASE_VERSION);
      const grade = await target.getFirstAsync("SELECT * FROM grades WHERE id = 'g1'");
      assert.equal(grade.score, 17); assert.equal(grade.weight, 2); assert.equal(grade.topic_id, 't1');
      assert.equal(grade.module_id, version < 3 ? null : 'm1');
      assert.equal((await target.getFirstAsync("SELECT name FROM profile WHERE id = 'local'")).name, 'Aluno de teste');
      assert.equal((await target.getFirstAsync("SELECT content FROM messages WHERE id = 'msg1'")).content, 'Mensagem preservada');
      assert.equal((await target.getFirstAsync("SELECT topic_id FROM resources WHERE id = 'r1'")).topic_id, 't1');
      assert.equal((await target.getFirstAsync("SELECT value FROM settings WHERE key = 'backup.automatic.enabled'")).value, 'false');
      if (version >= 4) assert.equal((await target.getFirstAsync("SELECT score FROM grades WHERE id = 'q1'")).score, 80);
      assert.deepEqual(await target.getAllAsync('PRAGMA foreign_key_check'), []);
      assert.equal(attempt.sourceBytes[18], wal ? 2 : 1);
    }
  }

  const before = await target.getAllAsync('SELECT * FROM grades ORDER BY id');
  assert.equal(await transfer(target, walSnapshot).import(false), false);
  assert.deepEqual(await target.getAllAsync('SELECT * FROM grades ORDER BY id'), before);
  const failedInsert = transfer(target, walSnapshot, { failInsert: true, failClose: true });
  await assert.rejects(failedInsert.import(), /Falha ao importar a tabela "grades".*simulated insert failure/);
  assert.deepEqual(await target.getAllAsync('SELECT * FROM grades ORDER BY id'), before, 'Failed imports roll back the replacement.');
  assert.equal(failedInsert.counts().cleanupErrors, 1);

  const futureSnapshot = await fixture(5);
  new DataView(futureSnapshot.buffer, futureSnapshot.byteOffset).setUint32(60, schema.DATABASE_VERSION + 1, false);
  const rejectedFuture = transfer(target, futureSnapshot, { failClose: true });
  await assert.rejects(rejectedFuture.import(), /versão de dados mais recente/);
  assert.equal(rejectedFuture.counts().confirmations, 0);
  assert.deepEqual(await target.getAllAsync('SELECT * FROM grades ORDER BY id'), before);
  const truncated = transfer(target, new TextEncoder().encode('SQLite format 3\0'));
  await assert.rejects(truncated.import(), /cópia incompleta/);
  assert.equal(truncated.counts().deserializations, 0);

  const exportSource = await open();
  await exportSource.execAsync(schema.INITIAL_SCHEMA);
  const exportService = transfer({ ...exportSource, serializeAsync: async () => Uint8Array.from(walSnapshot) }, walSnapshot).service;
  const exported = await exportService.serializeLocalDatabase();
  assert.equal(exported[18], 1); assert.equal(exported[19], 1);
  const reopened = await open(exported);
  assert.equal((await reopened.getFirstAsync("SELECT score FROM grades WHERE id = 'g1'")).score, 17);
  await reopened.closeAsync(); await exportSource.closeAsync(); await target.closeAsync();
  console.log('Passed: reproduced WAL deserialize failure; imported v1–v5 backups in WAL/rollback modes; preserved grades, modules, profile, chats, resources and relations; verified cancellation, rollback, diagnostics and portable exports.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
