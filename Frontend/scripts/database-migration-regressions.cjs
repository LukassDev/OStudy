const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const schemaSource = fs.readFileSync(path.resolve(__dirname, '..', 'src/db/schema.ts'), 'utf8');
const schema = ts.transpileModule(schemaSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const schemaModule = { exports: {} };
new Function('require', 'module', 'exports', schema)(() => {
  throw new Error('Schema should not import runtime modules.');
}, schemaModule, schemaModule.exports);

const migrationSource = fs.readFileSync(path.resolve(__dirname, '..', 'src/db/migrations.ts'), 'utf8');
const migration = ts.transpileModule(migrationSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const migrationModule = { exports: {} };
new Function('require', 'module', 'exports', migration)(name => {
  if (name === './schema') return schemaModule.exports;
  throw new Error(`Unexpected import: ${name}`);
}, migrationModule, migrationModule.exports);

const schemaNames = [...schemaModule.exports.INITIAL_SCHEMA.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)]
  .map(match => match[1]);

function fakeDatabase(initialTables, version) {
  const tables = new Set(initialTables);
  const execCalls = [];
  let currentVersion = version;
  return {
    tables,
    execCalls,
    getFirstAsync: async () => ({ user_version: currentVersion }),
    getAllAsync: async () => [...tables].map(name => ({ name })),
    withTransactionAsync: async callback => callback(),
    execAsync: async sql => {
      execCalls.push(sql);
      for (const match of sql.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)) tables.add(match[1]);
      const version = sql.match(/PRAGMA user_version = (\d+)/);
      if (version) currentVersion = Number(version[1]);
    },
  };
}

async function main() {
  const { migrateDatabase, } = migrationModule.exports;
  const missingChats = fakeDatabase(schemaNames.filter(name => name !== 'chats'), 1);
  await migrateDatabase(missingChats);
  assert.ok(missingChats.tables.has('chats'), 'An existing version-1 DB missing chats is repaired.');
  assert.equal(missingChats.execCalls.length, 2);
  assert.match(missingChats.execCalls[0], /CREATE TABLE IF NOT EXISTS chats/);

  const currentDb = fakeDatabase(schemaNames, 1);
  await migrateDatabase(currentDb);
  assert.equal(currentDb.execCalls.length, 0, 'Complete current databases are not rewritten.');

  const newerDb = fakeDatabase(schemaNames, 2);
  await assert.rejects(migrateDatabase(newerDb), /mais recente/);
  console.log('Passed: missing-table database repair, no-op current migration, and future-version rejection.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
