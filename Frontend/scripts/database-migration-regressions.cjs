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
  const spaceColumns = new Set(version < 2 ? ['id'] : ['id', 'google_classroom_course_id']);
  const gradeColumns = new Set(version < 3 ? ['id', 'score'] : ['id', 'score', 'module_id', 'category_id']);
  if (version >= 4) gradeColumns.add('qualitative_value');
  const moduleColumns = new Set(['id', 'space_id', 'name', 'criteria', 'behavior_score', 'participation_score']);
  if (version >= 4) ['behavior_qualitative', 'participation_qualitative'].forEach(column => moduleColumns.add(column));
  const execCalls = [];
  let currentVersion = version;
  return {
    tables,
    execCalls,
    getFirstAsync: async () => ({ user_version: currentVersion }),
    getAllAsync: async sql => sql.startsWith('PRAGMA table_info("spaces")')
      ? [...spaceColumns].map(name => ({ name }))
      : sql.startsWith('PRAGMA table_info("grades")') ? [...gradeColumns].map(name => ({ name }))
      : sql.startsWith('PRAGMA table_info("grade_modules")') ? [...moduleColumns].map(name => ({ name }))
      : [...tables].map(name => ({ name })),
    withTransactionAsync: async callback => callback(),
    execAsync: async sql => {
      execCalls.push(sql);
      for (const match of sql.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)) {
        if (match[1] === 'grade_modules' && !tables.has('grade_modules')) {
          ['behavior_qualitative', 'participation_qualitative'].forEach(column => moduleColumns.add(column));
        }
        tables.add(match[1]);
      }
      if (sql.includes('ALTER TABLE spaces ADD COLUMN google_classroom_course_id')) {
        spaceColumns.add('google_classroom_course_id');
      }
      for (const column of ['module_id', 'category_id', 'qualitative_value']) {
        if (sql.includes(`ALTER TABLE grades ADD COLUMN ${column}`)) gradeColumns.add(column);
      }
      for (const column of ['behavior_qualitative', 'participation_qualitative']) {
        if (sql.includes(`ALTER TABLE grade_modules ADD COLUMN ${column}`)) moduleColumns.add(column);
      }
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
  assert.ok(missingChats.tables.has('classroom_ignored_events'), 'An existing version-1 DB gets Classroom event exclusions.');
  assert.ok(missingChats.execCalls.includes('ALTER TABLE spaces ADD COLUMN google_classroom_course_id TEXT'),
    'An existing version-1 DB gets the new Classroom course ID column.');
  assert.equal(missingChats.execCalls.length, 11);
  assert.match(missingChats.execCalls[0], /CREATE TABLE IF NOT EXISTS chats/);
  const version2 = fakeDatabase(schemaNames.filter(name => name !== 'grade_modules'), 2);
  await migrateDatabase(version2);
  assert.ok(version2.tables.has('grade_modules'));
  assert.ok(version2.execCalls.some(sql => sql.startsWith('ALTER TABLE grades ADD COLUMN module_id')));
  assert.ok(version2.execCalls.some(sql => sql.startsWith('ALTER TABLE grades ADD COLUMN category_id')));
  const callsAfterMigration = version2.execCalls.length;
  await migrateDatabase(version2);
  assert.equal(version2.execCalls.length, callsAfterMigration, 'Reopening an upgraded database is a no-op.');
  const version3 = fakeDatabase(schemaNames, 3);
  await migrateDatabase(version3);
  assert.ok(version3.execCalls.includes('ALTER TABLE grades ADD COLUMN qualitative_value TEXT'));
  assert.ok(version3.execCalls.includes('ALTER TABLE grade_modules ADD COLUMN behavior_qualitative TEXT'));
  assert.ok(version3.execCalls.includes('ALTER TABLE grade_modules ADD COLUMN participation_qualitative TEXT'));
  const version4 = fakeDatabase(schemaNames, 4);
  await migrateDatabase(version4);
  assert.ok(version4.execCalls.some(sql => sql.startsWith('UPDATE grades SET score =')));
  assert.ok(version4.execCalls.some(sql => sql.startsWith('UPDATE grade_modules SET behavior_score =')));
  const callsAfterVersion4 = version4.execCalls.length;
  await migrateDatabase(version4);
  assert.equal(version4.execCalls.length, callsAfterVersion4);

  const currentDb = fakeDatabase(schemaNames, schemaModule.exports.DATABASE_VERSION);
  await migrateDatabase(currentDb);
  assert.equal(currentDb.execCalls.length, 0, 'Complete current databases are not rewritten.');

  const newerDb = fakeDatabase(schemaNames, schemaModule.exports.DATABASE_VERSION + 1);
  await assert.rejects(migrateDatabase(newerDb), /mais recente/);
  console.log('Passed: missing-table database repair, no-op current migration, and future-version rejection.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
