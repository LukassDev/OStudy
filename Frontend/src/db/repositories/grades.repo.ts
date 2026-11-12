import { getDatabase } from '../client';
import { createId, nowIso } from '../ids';
import { assessmentTypes, validGradeCriteria, qualitativeTypes, qualitativeScore, type AssessmentType, type GradeModule, type QualitativeGrade } from '../../utils/gradeAverages';

export interface GradeRow {
  id: string;
  space_id: string;
  title: string;
  score: number;
  max_score: number;
  weight: number;
  module_id?: string | null;
  category_id?: AssessmentType | null;
  qualitative_value?: QualitativeGrade | null;
  topic_id: string | null;
  graded_at: string;
  created_at: string;
  updated_at: string;
}

export async function listGrades(spaceId: string): Promise<GradeRow[]> {
  const database = await getDatabase();
  return database.getAllAsync<GradeRow>(
    'SELECT * FROM grades WHERE space_id = ? ORDER BY created_at, id',
    spaceId,
  );
}

export async function listAllGrades(): Promise<GradeRow[]> {
  const database = await getDatabase();
  return database.getAllAsync<GradeRow>('SELECT * FROM grades ORDER BY created_at, id');
}

export async function createGrade(data: Omit<GradeRow, 'id' | 'created_at' | 'updated_at'>): Promise<void> {
  const database = await getDatabase();
  await validateGrade(data);
  const timestamp = nowIso();
  await database.runAsync(
    `INSERT INTO grades (id, space_id, title, score, max_score, weight, topic_id, graded_at, created_at, updated_at, module_id, category_id, qualitative_value)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    createId(), data.space_id, data.title, data.score, data.max_score, data.weight, data.topic_id, data.graded_at,
    timestamp, timestamp, data.module_id ?? null, data.category_id ?? null, data.qualitative_value ?? null,
  );
}

export async function updateGrade(id: string, spaceId: string, changes: Partial<GradeRow>): Promise<void> {
  const database = await getDatabase();
  const previous = await database.getFirstAsync<GradeRow>('SELECT * FROM grades WHERE id = ? AND space_id = ?', id, spaceId);
  if (!previous) throw new Error('Avaliação não encontrada.');
  await validateGrade({ ...previous, ...changes, space_id: spaceId });
  const fields: (keyof GradeRow)[] = ['title', 'score', 'max_score', 'weight', 'topic_id', 'graded_at', 'module_id', 'category_id', 'qualitative_value'];
  const updates = fields.filter((field) => changes[field] !== undefined);
  if (!updates.length) return;
  const assignments = updates.map((field) => `${field} = ?`);
  const values = updates.map((field) => changes[field] ?? null);
  assignments.push('updated_at = ?');
  values.push(nowIso());
  values.push(id, spaceId);
  await database.runAsync(
    `UPDATE grades SET ${assignments.join(', ')} WHERE id = ? AND space_id = ?`,
    ...values,
  );
}

export async function deleteGrade(id: string, spaceId: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM grades WHERE id = ? AND space_id = ?', id, spaceId);
}

async function validateGrade(grade: Omit<GradeRow, 'id' | 'created_at' | 'updated_at'>) {
  if (!grade.title.trim() || !Number.isFinite(grade.score) || !Number.isFinite(grade.max_score)
    || !Number.isFinite(grade.weight) || grade.max_score <= 0 || grade.weight <= 0
    || grade.score < 0 || grade.score > grade.max_score || !/^\d{4}-\d{2}-\d{2}$/.test(grade.graded_at)) {
    throw new Error('Valores da avaliação inválidos.');
  }
  if (grade.qualitative_value != null && (!qualitativeTypes.includes(grade.qualitative_value)
    || Math.abs(grade.score - qualitativeScore(grade.qualitative_value, grade.max_score)) > 0.000001)) {
    throw new Error('A nota estimada não corresponde ao qualitativo escolhido.');
  }
  if (!grade.module_id) return;
  const module = (await listGradeModules(grade.space_id)).find(row => row.id === grade.module_id);
  if (!module || !grade.category_id || !assessmentTypes.includes(grade.category_id)) {
    throw new Error('Escolha um módulo e um tipo de avaliação válidos para esta disciplina.');
  }
}

type ModuleRow = Omit<GradeModule, 'criteria'> & { criteria: string };

export async function listGradeModules(spaceId?: string): Promise<GradeModule[]> {
  const database = await getDatabase();
  const rows = spaceId
    ? await database.getAllAsync<ModuleRow>('SELECT * FROM grade_modules WHERE space_id = ? ORDER BY created_at, id', spaceId)
    : await database.getAllAsync<ModuleRow>('SELECT * FROM grade_modules ORDER BY created_at, id');
  return rows.map(row => ({ ...row, criteria: JSON.parse(row.criteria) }));
}

export async function saveGradeModule(module: GradeModule): Promise<void> {
  const validScore = (value: number | null) => value === null || (Number.isFinite(value) && value >= 0 && value <= 20);
  if (!module.name.trim() || !validGradeCriteria(module.criteria)
    || !validScore(module.behavior_score) || !validScore(module.participation_score)) {
    throw new Error('Os pesos devem somar 100% e as médias devem estar entre 0 e 20.');
  }
  for (const type of ['behavior', 'participation'] as const) {
    const qualitative = module[`${type}_qualitative`];
    if (qualitative != null && (!qualitativeTypes.includes(qualitative)
      || module[`${type}_score`] == null || Math.abs(module[`${type}_score`]! - qualitativeScore(qualitative)) > 0.000001)) {
      throw new Error('A média estimada não corresponde ao qualitativo escolhido.');
    }
  }
  const database = await getDatabase();
  const existing = await database.getFirstAsync<{ space_id: string }>('SELECT space_id FROM grade_modules WHERE id = ?', module.id);
  if (existing && existing.space_id !== module.space_id) throw new Error('O módulo pertence a outra disciplina.');
  const timestamp = nowIso();
  await database.runAsync(
    `INSERT INTO grade_modules (id, space_id, name, criteria, behavior_score, participation_score, created_at, updated_at, behavior_qualitative, participation_qualitative)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, criteria = excluded.criteria,
       behavior_score = excluded.behavior_score, participation_score = excluded.participation_score, updated_at = excluded.updated_at,
       behavior_qualitative = excluded.behavior_qualitative, participation_qualitative = excluded.participation_qualitative`,
    module.id, module.space_id, module.name.trim(), JSON.stringify(module.criteria),
    module.behavior_score, module.participation_score, timestamp, timestamp, module.behavior_qualitative ?? null, module.participation_qualitative ?? null,
  );
}

export async function deleteGradeModule(id: string, spaceId: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM grade_modules WHERE id = ? AND space_id = ?', id, spaceId);
}
