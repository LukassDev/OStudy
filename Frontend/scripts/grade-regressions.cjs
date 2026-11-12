const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { DatabaseSync } = require('node:sqlite');

function load(relativePath, imports = {}) {
  const source = fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const result = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => {
    if (name in imports) return imports[name];
    throw new Error(`Unexpected import: ${name}`);
  }, result, result.exports);
  return result.exports;
}

const math = load('src/utils/gradeAverages.ts');
const criteria = { test: 60, worksheet: 10, presentation: 10, other: 0, behavior: 10, participation: 10 };
const module1 = { id: 'm1', space_id: 's1', name: 'M1', criteria, behavior_score: 18, participation_score: 16 };
const grade = (score, type, moduleId = 'm1', max = 20) => ({ space_id: 's1', score, max_score: max, weight: 1, module_id: moduleId, category_id: type });
const close = (actual, expected) => {
  assert.equal(typeof actual, 'number');
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} should equal ${expected}`);
};

async function main() {
  // Grouped estimate: 55% tests/worksheets, 25% work, 20% attitudes.
  assert.equal(math.validGradeCriteria(math.defaultGradeCriteria), true);
  assert.equal(math.assessmentTypes.reduce((sum, type) => sum + math.defaultGradeCriteria[type], 0), 80);
  assert.equal(math.defaultGradeCriteria.behavior + math.defaultGradeCriteria.participation, 20);
  assert.equal(math.defaultGradeCriteria.grouped, true);
  assert.equal(math.validGradeCriteria({ ...math.defaultGradeCriteria, worksheet: 5, test: 50 }), false);
  const defaultModule = { ...module1, criteria: math.defaultGradeCriteria, behavior_score: 18, participation_score: null };
  const groupedRows = [grade(10, 'test'), { ...grade(20, 'test'), weight: 9 }, grade(15, 'worksheet'),
    grade(10, 'presentation'), grade(20, 'other'), grade(6, 'other')];
  // Pool all rows: 15 for tests/worksheets and 12 for work, irrespective of category counts.
  close(math.calculateModuleAverage(groupedRows, defaultModule).average, 14.85);
  close(math.calculateModuleAverage(groupedRows, defaultModule, 100).average, 74.25);
  const noAttitudes = { ...defaultModule, behavior_score: null };
  const missing = math.calculateModuleAverage(groupedRows, noAttitudes);
  close(missing.average, 14.0625);
  assert.equal(missing.coveredWeight, 80);
  assert.equal(missing.complete, false);
  close(math.calculateModuleAverage([grade(0, 'test')], noAttitudes).average, 0);
  assert.equal(math.calculateModuleAverage([], noAttitudes).average, null);
  close(math.calculateModuleAverage([grade(16, 'test')], defaultModule).average, (16 * 55 + 18 * 20) / 75);
  assert.equal(math.calculateModuleAverage([{ ...grade(12, 'worksheet'), qualitative_value: 'sufficient' }], noAttitudes).estimated, true);
  const grades = [grade(10, 'test'), grade(20, 'test'), grade(100, 'worksheet', 'm1', 100), grade(12, 'presentation')];
  const result = math.calculateModuleAverage(grades, module1);
  close(result.average, 15.6); // 15*.60 + 20*.10 + 12*.10 + 18*.10 + 16*.10
  assert.equal(result.complete, true);
  close(math.calculateModuleAverage([...grades, grade(15, 'test')], module1).average, 15.6);
  close(math.calculateModuleAverage(grades, module1, 100).average, 78);
  const provisional = math.calculateModuleAverage([grade(16, 'test')], { ...module1, behavior_score: null, participation_score: null });
  close(provisional.average, 16);
  assert.equal(provisional.coveredWeight, 60);
  assert.equal(provisional.complete, false);
  close(math.calculateModuleAverage([], { ...module1, behavior_score: 0, participation_score: null }).average, 0);
  assert.equal(math.calculateModuleAverage([], { ...module1, behavior_score: null, participation_score: null }).average, null);
  const module2 = { ...module1, id: 'm2', name: 'M2', behavior_score: null, participation_score: null, criteria: { ...criteria, test: 100, worksheet: 0, presentation: 0, behavior: 0, participation: 0 } };
  close(math.subjectAverage([...grades, grade(10, 'test', 'm2')], [module1, module2], 's1'), 12.8);
  close(math.subjectAverage([grade(10, 'test', null), { ...grade(20, 'test', null), weight: 3 }], [], 's1'), 17.5);
  close(math.subjectAverage([...grades, grade(10, 'test', null)], [module1], 's1'), 12.8);
  assert.equal(math.subjectAverage(grades, [module1], 'another-subject'), null);
  assert.equal(math.weightedGradeAverage([{ ...grade(10, 'test'), max_score: 0 }, { ...grade(10, 'test'), weight: Infinity }]), null);
  assert.equal(math.validGradeCriteria({ ...criteria, test: 61 }), false);
  assert.equal(math.validGradeCriteria({ ...criteria, test: -1 }), false);
  for (const [type, score] of Object.entries({ very_insufficient: 2, insufficient: 7, sufficient: 12, good: 16, very_good: 19 })) {
    close(math.qualitativeScore(type), score);
    close(math.qualitativeScore(type, 100), score * 5);
  }
  const estimatedModule = { ...module1, behavior_score: math.qualitativeScore('good'), behavior_qualitative: 'good' };
  assert.equal(math.calculateModuleAverage(grades, estimatedModule).estimated, true);
  assert.equal(math.subjectIncludesEstimates(grades, [estimatedModule], 's1'), true);
  assert.equal(math.subjectIncludesEstimates(grades, [estimatedModule], 's2'), false);
  assert.equal(math.subjectIncludesEstimates([{ ...grade(12, 'test', null), qualitative_value: 'sufficient' }], [], 's1'), true);
  const qualitativeResult = math.calculateModuleAverage([
    { ...grade(math.qualitativeScore('sufficient'), 'test', 'm2'), qualitative_value: 'sufficient' },
    grade(16, 'test', 'm2'),
  ], module2);
  close(qualitativeResult.average, 14);
  assert.equal(qualitativeResult.estimated, true);
  close(math.calculateModuleAverage([...grades, grade(20, 'other')], module1).average, 15.6);
  const study = load('src/stores/studyStore.ts', {
    zustand: { create: () => ({}) },
    '../db/repositories/calendar.repo': {}, '../db/repositories/grades.repo': {},
    '../db/repositories/study.repo': {}, '../services/studyNotifications': {},
    '../utils/gradeAverages': math,
  });
  const anotherSubject = { ...module2, id: 'm3', space_id: 's2' };
  const allGrades = [...grades, grade(10, 'test', 'm2'), { ...grade(20, 'test', 'm3'), space_id: 's2' }];
  close(study.overallAverage(allGrades, { grade_space_ids: ['s1', 's2', 'empty'], average_scale: 20 }, [module1, module2, anotherSubject]), 16.4);
  close(study.overallAverage(allGrades, { grade_space_ids: ['s1', 's1', 's2'], average_scale: 20 }, [module1, module2, anotherSubject]), 16.4);
  assert.equal(study.overallIncludesEstimates(allGrades, { grade_space_ids: ['s1'] }, [estimatedModule, module2, anotherSubject]), true);
  assert.equal(study.overallIncludesEstimates(allGrades, { grade_space_ids: ['s2'] }, [estimatedModule, module2, anotherSubject]), false);

  const schema = load('src/db/schema.ts');
  const migration = load('src/db/migrations.ts', { './schema': schema });
  const sql = new DatabaseSync(':memory:');
  sql.exec('PRAGMA foreign_keys = ON');
  // Simulate a real v2 database containing an existing assessment.
  const oldSchema = schema.INITIAL_SCHEMA
    .replace(/CREATE TABLE IF NOT EXISTS grade_modules \([\s\S]*?CREATE INDEX IF NOT EXISTS grade_modules_space_idx[^;]*;/, '')
    .replace('  module_id TEXT REFERENCES grade_modules(id) ON DELETE SET NULL,\n', '')
    .replace('  category_id TEXT,\n', '');
  const oldSchemaWithoutQualitative = oldSchema.replace('  qualitative_value TEXT,\n', '');
  sql.exec(oldSchemaWithoutQualitative);
  sql.exec("PRAGMA user_version = 2; INSERT INTO spaces (id, name, created_at, updated_at) VALUES ('s1', 'Math', 'now', 'now'), ('s2', 'Other', 'now', 'now');");
  sql.exec("INSERT INTO grades (id, space_id, title, score, max_score, weight, graded_at, created_at, updated_at) VALUES ('old', 's1', 'Old test', 17, 20, 2, '2026-11-11', 'now', 'now');");
  const database = {
    getFirstAsync: async (query, ...params) => sql.prepare(query).get(...params) ?? null,
    getAllAsync: async (query, ...params) => sql.prepare(query).all(...params),
    runAsync: async (query, ...params) => sql.prepare(query).run(...params),
    execAsync: async query => sql.exec(query),
    withTransactionAsync: async callback => {
      sql.exec('BEGIN');
      try { await callback(); sql.exec('COMMIT'); } catch (error) { sql.exec('ROLLBACK'); throw error; }
    },
  };
  await migration.migrateDatabase(database);
  await migration.migrateDatabase(database);
  const old = await database.getFirstAsync("SELECT * FROM grades WHERE id = 'old'");
  assert.equal(old.score, 17); assert.equal(old.weight, 2); assert.equal(old.module_id, null);
  const repo = load('src/db/repositories/grades.repo.ts', {
    '../client': { getDatabase: async () => database },
    '../ids': { createId: () => 'new-grade', nowIso: () => '2026-11-11T10:00:00.000Z' },
    '../../utils/gradeAverages': math,
  });
  await repo.saveGradeModule(module1);
  await repo.saveGradeModule({ ...defaultModule, id: 'grouped-preset' });
  assert.deepEqual((await repo.listGradeModules('s1')).find(row => row.id === 'grouped-preset').criteria, math.defaultGradeCriteria);
  await repo.deleteGradeModule('grouped-preset', 's1');
  assert.deepEqual((await repo.listGradeModules('s1'))[0].criteria, criteria);
  await repo.createGrade({ ...grade(16, 'test'), title: 'New test', topic_id: null, graded_at: '2026-11-11' });
  assert.equal((await repo.listGrades('s1')).find(row => row.id === 'new-grade').module_id, 'm1');
  await assert.rejects(repo.createGrade({ ...grade(16, 'test'), space_id: 's2', title: 'Wrong subject', topic_id: null, graded_at: '2026-11-11' }));
  await assert.rejects(repo.saveGradeModule({ ...module1, space_id: 's2' }));
  await assert.rejects(repo.saveGradeModule({ ...module1, criteria: { ...criteria, test: 90 } }));
  await assert.rejects(repo.createGrade({ ...grade(Infinity, 'test'), title: 'Invalid', topic_id: null, graded_at: '2026-11-11' }));
  await repo.updateGrade('old', 's1', { module_id: 'm1', category_id: 'worksheet' });
  assert.equal((await repo.listGrades('s1')).find(row => row.id === 'old').category_id, 'worksheet');
  await repo.saveGradeModule({ ...module1, behavior_score: 19 });
  assert.equal((await repo.listGradeModules('s1'))[0].behavior_score, 19);
  for (const type of math.qualitativeTypes) {
    await repo.updateGrade('new-grade', 's1', { qualitative_value: type, score: math.qualitativeScore(type, 100), max_score: 100 });
    const saved = (await repo.listGrades('s1')).find(row => row.id === 'new-grade');
    assert.equal(saved.qualitative_value, type);
    close(saved.score, math.qualitativeScore(type, 100));
  }
  await repo.updateGrade('new-grade', 's1', { qualitative_value: 'good', score: 80, max_score: 100 });
  const estimatedGrade = (await repo.listGrades('s1')).find(row => row.id === 'new-grade');
  assert.equal(estimatedGrade.qualitative_value, 'good');
  close(estimatedGrade.score, 80);
  await assert.rejects(repo.updateGrade('new-grade', 's1', { score: 99 }));
  await repo.saveGradeModule({ ...module1, behavior_score: 19, behavior_qualitative: 'very_good' });
  await assert.rejects(repo.saveGradeModule({ ...module1, behavior_score: 17.5, behavior_qualitative: 'very_good' }));
  // Upgrade the interim conversion without changing exact numeric assessments.
  sql.exec("UPDATE grades SET score = 62.5 WHERE id = 'new-grade'; UPDATE grade_modules SET behavior_score = 17.5, participation_score = 2.5, participation_qualitative = 'insufficient' WHERE id = 'm1'; PRAGMA user_version = 4;");
  await migration.migrateDatabase(database);
  close((await database.getFirstAsync("SELECT score FROM grades WHERE id = 'new-grade'")).score, 80);
  close((await database.getFirstAsync("SELECT score FROM grades WHERE id = 'old'")).score, 17);
  const recalculatedModule = (await repo.listGradeModules('s1'))[0];
  close(recalculatedModule.behavior_score, 19);
  close(recalculatedModule.participation_score, 7);
  await migration.migrateDatabase(database);
  close((await database.getFirstAsync("SELECT score FROM grades WHERE id = 'new-grade'")).score, 80);
  await repo.updateGrade('new-grade', 's1', { qualitative_value: null, score: 83 });
  assert.equal((await repo.listGrades('s1')).find(row => row.id === 'new-grade').qualitative_value, null);
  await repo.deleteGradeModule('m1', 's1');
  assert.equal((await repo.listGrades('s1')).length, 2);
  assert.ok((await repo.listGrades('s1')).every(row => row.module_id === null));
  sql.close();
  console.log('Passed: weighted module/subject/overall averages, all five qualitative conversions, estimate indicators, scales, legacy grades, SQLite v2/v4 migrations, persistence, validation and safe module deletion.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
