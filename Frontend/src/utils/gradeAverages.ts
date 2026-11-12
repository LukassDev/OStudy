export const assessmentTypes = ['test', 'worksheet', 'presentation', 'other'] as const;
export const criterionTypes = [...assessmentTypes, 'behavior', 'participation'] as const;
export type AssessmentType = typeof assessmentTypes[number];
export type CriterionType = typeof criterionTypes[number];
export type GradeCriteria = Record<CriterionType, number> & { grouped?: boolean };
export const groupedCriterionTypes: CriterionType[] = ['test', 'presentation', 'behavior'];
export function moduleCriterionTypes(criteria: Pick<GradeCriteria, 'grouped'>): readonly CriterionType[] {
  return criteria.grouped ? groupedCriterionTypes : criterionTypes;
}
export function criterionLabelKey(criteria: Pick<GradeCriteria, 'grouped'>, type: CriterionType): string {
  return `grades.modules.${criteria.grouped ? 'groups' : 'types'}.${type}`;
}

/** User-defined estimates on a 0–20 scale; not official school grade bands. */
export const qualitativeScores = {
  very_insufficient: 2, insufficient: 7, sufficient: 12, good: 16, very_good: 19,
} as const;
export type QualitativeGrade = keyof typeof qualitativeScores;
export const qualitativeTypes = Object.keys(qualitativeScores) as QualitativeGrade[];
export const qualitativeRanges: Record<QualitativeGrade, string> = {
  very_insufficient: '0–<4', insufficient: '4–<10', sufficient: '10–<14', good: '14–<18', very_good: '18–20',
};
export function qualitativeScore(value: QualitativeGrade, maxScore = 20): number {
  return qualitativeScores[value] / 20 * maxScore;
}

export interface GradeModule {
  id: string;
  space_id: string;
  name: string;
  criteria: GradeCriteria;
  /** Attitude averages are stored on the Portuguese 0–20 scale. */
  behavior_score: number | null;
  participation_score: number | null;
  behavior_qualitative?: QualitativeGrade | null;
  participation_qualitative?: QualitativeGrade | null;
}

export interface CalculableGrade {
  space_id: string;
  score: number;
  max_score: number;
  weight: number;
  module_id?: string | null;
  category_id?: AssessmentType | null;
  qualitative_value?: QualitativeGrade | null;
}

/**
 * User-selected estimate: 55% tests/worksheets, 25% presentations/work, 20% attitudes.
 * Each assessment group pools its rows with equal weight. This is not an official rule.
 * See docs/grade-calculation.md for the source and rationale.
 */
export const defaultGradeCriteria: GradeCriteria = {
  grouped: true, test: 55, worksheet: 0, presentation: 25, other: 0, behavior: 20, participation: 0,
};

export function validGradeCriteria(criteria: GradeCriteria): boolean {
  return (criteria.grouped === undefined || typeof criteria.grouped === 'boolean')
    && (!criteria.grouped || ['worksheet', 'other', 'participation'].every(type => criteria[type as CriterionType] === 0))
    && criterionTypes.every(type => Number.isFinite(criteria[type]) && criteria[type] >= 0 && criteria[type] <= 100)
    && Math.abs(criterionTypes.reduce((sum, type) => sum + criteria[type], 0) - 100) < 0.000001;
}

export function weightedGradeAverage(grades: CalculableGrade[], scale = 20): number | null {
  const valid = grades.filter(grade => Number.isFinite(grade.score) && Number.isFinite(grade.max_score)
    && Number.isFinite(grade.weight) && grade.max_score > 0 && grade.weight > 0
    && grade.score >= 0 && grade.score <= grade.max_score);
  const weight = valid.reduce((sum, grade) => sum + grade.weight, 0);
  return weight ? valid.reduce((sum, grade) => sum + grade.score / grade.max_score * grade.weight, 0) / weight * scale : null;
}

export function calculateModuleAverage(grades: CalculableGrade[], module: GradeModule, scale = 20) {
  const rows = grades.filter(grade => grade.space_id === module.space_id && grade.module_id === module.id);
  const averages = {} as Record<CriterionType, number | null>;
  for (const type of assessmentTypes) {
    averages[type] = weightedGradeAverage(rows.filter(grade => grade.category_id === type), scale);
  }
  for (const type of ['behavior', 'participation'] as const) {
    const value = module[`${type}_score`];
    averages[type] = value !== null && Number.isFinite(value) && value >= 0 && value <= 20 ? value / 20 * scale : null;
  }
  if (module.criteria.grouped) {
    // Pool individual assessments, not category averages: two tests and one worksheet
    // are three equally weighted rows, even if imported individual weights differ.
    const groupAverage = (types: AssessmentType[]) => weightedGradeAverage(
      rows.filter(row => types.includes(row.category_id as AssessmentType)).map(row => ({ ...row, weight: 1 })), scale);
    averages.test = groupAverage(['test', 'worksheet']);
    averages.presentation = groupAverage(['presentation', 'other']);
  }
  const coveredWeight = criterionTypes.reduce((sum, type) => sum + (averages[type] === null ? 0 : module.criteria[type]), 0);
  const average = validGradeCriteria(module.criteria) && coveredWeight > 0
    ? criterionTypes.reduce((sum, type) => sum + (averages[type] ?? 0) * module.criteria[type], 0) / coveredWeight
    : null;
  const estimated = rows.some(grade => {
    const type = grade.category_id ?? 'other';
    const group = module.criteria.grouped ? (type === 'test' || type === 'worksheet' ? 'test' : 'presentation') : type;
    return grade.qualitative_value != null && module.criteria[group] > 0;
  })
    || (module.behavior_qualitative != null && module.criteria.behavior > 0)
    || (module.participation_qualitative != null && module.criteria.participation > 0);
  return { average, averages, coveredWeight, complete: Math.abs(coveredWeight - 100) < 0.000001, estimated };
}

export function subjectModuleAverages(grades: CalculableGrade[], modules: GradeModule[], spaceId: string, scale = 20) {
  return modules.filter(module => module.space_id === spaceId).map(module => ({
    ...calculateModuleAverage(grades, module, scale), id: module.id, name: module.name,
  }));
}

export function subjectAverage(grades: CalculableGrade[], modules: GradeModule[], spaceId: string, scale = 20) {
  const knownModules = new Set(modules.filter(module => module.space_id === spaceId).map(module => module.id));
  const legacyAverage = weightedGradeAverage(grades.filter(grade => grade.space_id === spaceId
    && (!grade.module_id || !knownModules.has(grade.module_id))), scale);
  const values = subjectModuleAverages(grades, modules, spaceId, scale)
    .flatMap(module => module.average === null ? [] : [module.average]);
  // Keep old grades visible and included until the user assigns them to modules.
  if (legacyAverage !== null) values.push(legacyAverage);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

export function subjectIncludesEstimates(grades: CalculableGrade[], modules: GradeModule[], spaceId: string): boolean {
  const subjectModules = modules.filter(module => module.space_id === spaceId);
  if (subjectModules.some(module => {
    const result = calculateModuleAverage(grades, module);
    return result.average !== null && result.estimated;
  })) return true;
  return grades.some(grade => grade.space_id === spaceId && grade.qualitative_value != null
    && !subjectModules.some(module => module.id === grade.module_id) && weightedGradeAverage([grade]) !== null);
}
