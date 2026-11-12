import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "../ui/DateTimePicker";
import { format } from "date-fns";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Platform,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import Svg, {
    Line,
    Polygon,
    Polyline,
    Rect,
    Text as SvgText,
} from "react-native-svg";
import { useThemeColors } from "../../constants/theme";
import { useDateFnsLocale } from "../../i18n/dateFnsLocale";
import { Grade, useGradesStore } from "../../stores/gradesStore";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { KeyboardAwareModal } from "../ui/KeyboardAwareModal";
import { showAppDialog } from "../ui/AppDialog";
import { GradeModuleModal } from './GradeModuleModal';
import { assessmentTypes, moduleCriterionTypes, criterionLabelKey, calculateModuleAverage, weightedGradeAverage, qualitativeScore, subjectIncludesEstimates, type GradeModule, type AssessmentType, type QualitativeGrade } from '../../utils/gradeAverages';
import { GradeValueInput } from './GradeValueInput';

interface GradesTabProps {
  spaceId: string;
  readOnly?: boolean;
}

type ChartType = "bar" | "line";

function GradesChart({
  grades,
  colors,
  chartType,
}: {
  grades: Grade[];
  colors: any;
  chartType: ChartType;
}) {
  const sorted = [...grades].sort(
    (a, b) => new Date(a.graded_at).getTime() - new Date(b.graded_at).getTime(),
  );
  const [containerWidth, setContainerWidth] = useState(280);
  const visibleWidth = Math.max(200, containerWidth - 4);
  const H = 210;
  const PAD_LEFT = 34;
  const PAD_RIGHT = 12;
  const PAD_BOTTOM = 38;
  const PAD_TOP = 18;
  const W = Math.max(visibleWidth, PAD_LEFT + PAD_RIGHT + sorted.length * 64);
  const chartW = W - PAD_LEFT - 8;
  const chartH = H - PAD_BOTTOM - PAD_TOP;
  const n = sorted.length;

  const pcts = sorted.map((g) =>
    Math.max(0, Math.min(1, g.score / g.max_score)),
  );
  const barW = Math.min(42, Math.max(22, (chartW / n) * 0.62));
  const gap = chartW / n;

  // Color per bar based on score
  function barColor(pct: number) {
    if (pct >= 0.85) return "#22C55E";
    if (pct >= 0.6) return colors.success;
    return "#EF4444";
  }

  const gridValues = [0, 0.25, 0.5, 0.75, 1];

  function ChartGrid() {
    return (
      <>
        {gridValues.map((value) => {
          const y = PAD_TOP + chartH - value * chartH;
          return (
            <React.Fragment key={value}>
              <Line
                x1={PAD_LEFT}
                y1={y}
                x2={W - PAD_RIGHT}
                y2={y}
                stroke={colors.border}
                strokeWidth={value === 0 ? 1.5 : 1}
                strokeDasharray={value === 0 ? undefined : "4,6"}
                opacity={value === 0 ? 0.9 : 0.55}
              />
              <SvgText
                x={PAD_LEFT - 7}
                y={y + 4}
                fontSize={9}
                fill={colors.textTertiary}
                textAnchor="end"
              >
                {Math.round(value * 100)}%
              </SvgText>
            </React.Fragment>
          );
        })}
      </>
    );
  }

  if (chartType === "bar") {
    return (
      <ScrollView
        horizontal
        onLayout={event => setContainerWidth(event.nativeEvent.layout.width)}
        showsHorizontalScrollIndicator={false}
        nestedScrollEnabled
        contentContainerStyle={{ paddingRight: 4 }}
      >
        <Svg width={W} height={H}>
          <ChartGrid />
          {pcts.map((pct, i) => {
            const bh = Math.max(6, pct * chartH);
            const x = PAD_LEFT + gap * i + gap / 2 - barW / 2;
            const y = PAD_TOP + chartH - bh;
            const label = sorted[i].title.slice(0, 8);
            return (
              <React.Fragment key={sorted[i].id}>
                <Rect
                  x={x}
                  y={y}
                  width={barW}
                  height={bh}
                  rx={4}
                  fill={barColor(pct)}
                  opacity={0.95}
                />
                <Rect
                  x={x + barW * 0.28}
                  y={y}
                  width={barW * 0.18}
                  height={bh}
                  rx={3}
                  fill="#FFFFFF"
                  opacity={0.16}
                />
                <SvgText
                  x={(x + barW / 2) - 3}
                  y={Math.max(PAD_TOP + 6, y - 10)}
                  fontSize={12}
                  fontWeight="bold"
                  fill={colors.textPrimary}
                  textAnchor="middle"
                >
                  {Math.round(pct * 100)}%
                </SvgText>
                <SvgText
                  x={x + barW / 2}
                  y={H - 14}
                  fontSize={11}
                  fill={colors.textSecondary}
                  textAnchor="middle"
                >
                  {label}
                </SvgText>
              </React.Fragment>
            );
          })}
        </Svg>
      </ScrollView>
    );
  }

  // Line chart
  const points = pcts.map((pct, i) => {
    const x = PAD_LEFT + gap * i + gap / 2;
    const y = PAD_TOP + chartH - pct * chartH;
    return { x, y, pct };
  });
  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");
  const areaPoints = `${PAD_LEFT},${PAD_TOP + chartH} ${polylinePoints} ${W - PAD_RIGHT},${PAD_TOP + chartH}`;

  return (
    <ScrollView
      horizontal
      onLayout={event => setContainerWidth(event.nativeEvent.layout.width)}
      showsHorizontalScrollIndicator={false}
      nestedScrollEnabled
      contentContainerStyle={{ paddingRight: 4 }}
    >
      <Svg width={W} height={H}>
        <ChartGrid />
        <Polygon points={areaPoints} fill={colors.textSecondary} opacity={0.12} />
        <Polyline
          points={polylinePoints}
          fill="none"
          stroke={colors.textSecondary}
          strokeWidth={4}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((p, i) => (
          <React.Fragment key={sorted[i].id}>
            <SvgText
              x={p.x}
              y={Math.max(PAD_TOP + 11, p.y - 13)}
              fontSize={12}
              fontWeight="bold"
              fill={colors.textPrimary}
              textAnchor="middle"
            >
              {Math.round(p.pct * 100)}%
            </SvgText>
            <SvgText
              x={p.x}
              y={H - 14}
              fontSize={11}
              fill={colors.textSecondary}
              textAnchor="middle"
            >
              {sorted[i].title.slice(0, 8)}
            </SvgText>
          </React.Fragment>
        ))}
      </Svg>
    </ScrollView>
  );
}

interface GradesTabProps {
  spaceId: string;
  readOnly?: boolean;
}

export function GradesTab({ spaceId, readOnly = false }: GradesTabProps) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const dateLocale = useDateFnsLocale();
  const {
    grades,
    modules,
    loading,
    fetchGrades,
    deleteGrade,
    weightedAverage,
    averageScale,
    setAverageScale,
    deleteModule,
  } = useGradesStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Grade | null>(null);
  const [scalePickerOpen, setScalePickerOpen] = useState(false);
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [moduleModalOpen, setModuleModalOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<GradeModule | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [criteriaExpanded, setCriteriaExpanded] = useState(false);

  useEffect(() => {
    setCriteriaExpanded(false);
  }, [spaceId, selectedModuleId]);

  const SCALE_OPTIONS = [10, 20, 100];

  useEffect(() => {
    setSelectedModuleId(null);
    setModalOpen(false);
    setModuleModalOpen(false);
    setLoadError(false);
    void fetchGrades(spaceId).catch(() => setLoadError(true));
  }, [spaceId, fetchGrades]);

  const selectedModule = modules.find(module => module.id === selectedModuleId);
  const visibleGrades = selectedModuleId === null ? grades : grades.filter(grade => selectedModuleId === 'unassigned'
    ? !modules.some(module => module.id === grade.module_id) : grade.module_id === selectedModuleId);
  const moduleResult = selectedModule ? calculateModuleAverage(grades, selectedModule, averageScale) : null;
  const average = moduleResult ? moduleResult.average : selectedModuleId === 'unassigned'
    ? weightedGradeAverage(visibleGrades, averageScale) : weightedAverage();
  const includesEstimates = moduleResult ? moduleResult.estimated : selectedModuleId === 'unassigned'
    ? visibleGrades.some(grade => grade.qualitative_value != null) : subjectIncludesEstimates(grades, modules, spaceId);
  const chip = (label: string, selected: boolean, onPress: () => void, key = label) => <TouchableOpacity
    key={key} accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress}
    className={`rounded-xl px-3 py-2 ${selected ? 'bg-border' : 'bg-surface'}`}>
    <Text className="text-textPrimary text-sm">{label}</Text>
  </TouchableOpacity>;

  const handleDelete = (grade: Grade) => {
    if (readOnly) return;
    showAppDialog(
      t("grades.deleteConfirm.title"),
      t("grades.deleteConfirm.message", { title: grade.title }),
      [
        { text: t("grades.deleteConfirm.cancel"), style: "cancel" },
        {
          text: t("grades.deleteConfirm.confirm"),
          style: "destructive",
          onPress: async () => {
            try { await deleteGrade(grade.id, spaceId); }
            catch { showAppDialog(t('grades.deleteConfirm.title'), t('grades.modal.errors.saveFailed')); }
          },
        },
      ],
    );
  };

  return (
    <View className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24, width: '100%', maxWidth: 820, alignSelf: 'center' as const, paddingTop: 8 }}
      >
        <View className="mx-4 mt-4" style={{ gap: 12 }}>
          <Text className="text-textPrimary font-bold text-lg">{t('grades.modules.title')}</Text>
          {loadError && <Text accessibilityRole="alert" className="text-error">{t('grades.modules.loadError')}</Text>}
          {loadError && <Button title={t('update15.retry')} onPress={() => {
            setLoadError(false); void fetchGrades(spaceId).catch(() => setLoadError(true));
          }} />}
          {!loading && !loadError && <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            {chip(t('grades.modules.subjectAverage'), selectedModuleId === null, () => setSelectedModuleId(null))}
            {modules.map(module => chip(module.name, selectedModuleId === module.id, () => setSelectedModuleId(module.id), module.id))}
            {grades.some(grade => !modules.some(module => module.id === grade.module_id))
              && chip(t('grades.modules.unassigned'), selectedModuleId === 'unassigned', () => setSelectedModuleId('unassigned'))}
          </View>}
          {!readOnly && !loading && !loadError && <Button title={t('grades.modules.new')} variant="outline" onPress={() => {
            setEditingModule(null); setModuleModalOpen(true);
          }} />}
          {selectedModule && <View className="bg-surface rounded-xl p-4" style={{ gap: 10 }}>
            <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: criteriaExpanded }}
              onPress={() => setCriteriaExpanded(previous => !previous)} className="flex-row items-center justify-between" style={{ minHeight: 44 }}>
              <Text className="text-textPrimary font-semibold">{t('grades.modules.criteria')}</Text>
              <Ionicons name={criteriaExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
            </TouchableOpacity>
            {criteriaExpanded && <View style={{ gap: 10 }}>
            {moduleCriterionTypes(selectedModule.criteria).filter(type => selectedModule.criteria[type] > 0).map(type => <View key={type} className="flex-row justify-between">
              <Text className="text-textSecondary text-sm">{t(criterionLabelKey(selectedModule.criteria, type))} · {selectedModule.criteria[type]}%</Text>
              <Text className="text-textPrimary text-sm">{(type === 'behavior' || type === 'participation') && selectedModule[`${type}_qualitative`]
                ? t(`grades.qualitative.labels.${selectedModule[`${type}_qualitative`]}`)
                : moduleResult?.averages[type] == null ? '—' : `${moduleResult.averages[type]!.toFixed(2)} / ${averageScale}`}</Text>
            </View>)}
            {!readOnly && <View className="flex-row" style={{ gap: 10, flexWrap: 'wrap' }}>
              <Button title={t('grades.modules.edit')} fullWidth={false} size="sm" variant="outline" onPress={() => { setEditingModule(selectedModule); setModuleModalOpen(true); }} />
              <Button title={t('grades.modules.delete')} fullWidth={false} size="sm" variant="ghost" onPress={() => showAppDialog(t('grades.modules.delete'), t('grades.modules.deleteHelp'), [
                { text: t('grades.modal.cancel'), style: 'cancel' },
                { text: t('grades.deleteConfirm.confirm'), style: 'destructive', onPress: async () => {
                  try { await deleteModule(selectedModule.id, spaceId); setSelectedModuleId(null); }
                  catch { showAppDialog(t('grades.modules.delete'), t('grades.modal.errors.saveFailed')); }
                } },
              ])} />
            </View>}
            </View>}
          </View>}
        </View>
        {average !== null && (
          <View className="bg-surfaceElevated rounded-xl mx-4 mt-4 p-5 items-center">
            <Text className="text-textSecondary text-xs font-semibold mb-1">
              {selectedModule ? selectedModule.name : t(selectedModuleId === 'unassigned' ? 'grades.modules.unassigned' : 'grades.modules.subjectAverage')}
            </Text>
            <Text className="text-textPrimary text-3xl font-bold">
              {includesEstimates ? '≈ ' : ''}{average.toFixed(2)}
            </Text>
            <TouchableOpacity
              className="flex-row items-center mt-0.5"
              onPress={() => setScalePickerOpen(true)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Text className="text-textTertiary text-xs">
                {t("grades.outOfScale", { scale: averageScale })}
              </Text>
              <Ionicons
                name="chevron-down"
                size={12}
                color={colors.textTertiary}
                style={{ marginLeft: 3 }}
              />
            </TouchableOpacity>
          </View>
        )}

        {scalePickerOpen && (
          <View className="mx-4 mt-2 bg-surface rounded-[10px] p-3 flex-row justify-around">
            {SCALE_OPTIONS.map((scale) => (
              <TouchableOpacity
                key={scale}
                onPress={() => {
                  setAverageScale(scale);
                  setScalePickerOpen(false);
                }}
                className={`px-4 py-2 rounded-xl ${averageScale === scale ? "bg-border" : ""}`}
              >
                <Text
                  className={
                    averageScale === scale
                      ? "text-textPrimary font-bold"
                      : "text-textPrimary"
                  }
                >
                  /{scale}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Gráfico de evolução com toggle barras/linhas */}
        {visibleGrades.length > 1 && (
          <View className="mx-4 mt-4 bg-surface rounded-[10px] p-4">
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <Text className="text-xs font-semibold text-textTertiary">
                {t("grades.evolutionTitle")}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  borderRadius: 8,
                  overflow: "hidden",
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <TouchableOpacity
                  onPress={() => setChartType("bar")}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    backgroundColor:
                      chartType === "bar" ? colors.border : "transparent",
                  }}
                >
                  <Ionicons
                    name="bar-chart-outline"
                    size={14}
                    color={chartType === "bar" ? colors.textPrimary : colors.textSecondary}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setChartType("line")}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    backgroundColor:
                      chartType === "line" ? colors.border : "transparent",
                  }}
                >
                  <Ionicons
                    name="trending-up-outline"
                    size={14}
                    color={chartType === "line" ? colors.textPrimary : colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>
            <GradesChart
              grades={visibleGrades}
              colors={colors}
              chartType={chartType}
            />
          </View>
        )}

        <TouchableOpacity
            className="bg-primaryStrong rounded-[12px] py-3 px-4 mx-4 mt-4 mb-2 flex-row items-center justify-center"
            onPress={() => {
              setEditing(null);
              setModalOpen(true);
            }}
            disabled={readOnly || loading || loadError}
            style={{ opacity: readOnly ? 0.5 : 1, ...(Platform.OS === 'web' ? { alignSelf: 'flex-start' as const, paddingHorizontal: 24 } : {}) }}
          >
            <Ionicons name="add" size={20} color={colors.primaryText} />
            <Text className="text-primaryText font-semibold ml-1">
              {t("grades.newGrade")}
            </Text>
        </TouchableOpacity>

        {!loading && visibleGrades.length === 0 && <EmptyState icon="stats-chart-outline" title={t('grades.empty.title')} subtitle={t('grades.empty.subtitle')} />}
        {[...visibleGrades].reverse().map((grade) => (
          <View
            key={grade.id}
            className="flex-row items-center justify-between bg-surface rounded-[10px] px-4 py-3 mx-4 mb-2"
          >
            <TouchableOpacity
              className="flex-1 flex-row items-center"
                onPress={() => {
                  if (readOnly) return;
                  setEditing(grade);
                  setModalOpen(true);
                }}
                disabled={readOnly}
              activeOpacity={0.75}
            >
              <View className="flex-1">
                <Text
                  className="text-textPrimary font-semibold"
                  numberOfLines={1}
                >
                  {grade.title}
                </Text>
                <Text className="text-textTertiary text-xs mt-0.5">
                  {format(
                    new Date(grade.graded_at),
                    t("grades.dateFormatShort"),
                    { locale: dateLocale },
                  )}{" "}
                  · {grade.module_id && modules.some(module => module.id === grade.module_id)
                    ? `${modules.find(module => module.id === grade.module_id)?.name} · ${t(`grades.modules.types.${grade.category_id ?? 'other'}`)}`
                    : t("grades.weightLabel", { weight: grade.weight })}
                </Text>
              </View>
              <Text className="text-textPrimary font-bold text-base">
                {grade.qualitative_value ? t(`grades.qualitative.labels.${grade.qualitative_value}`) : `${grade.score}/${grade.max_score}`}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
                onPress={() => handleDelete(grade)}
                disabled={readOnly}
                hitSlop={8}
                className="ml-3 w-9 h-9 rounded-full items-center justify-center"
                style={{ backgroundColor: "transparent" }}
                accessibilityLabel="Delete grade"
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={17} color={colors.error} />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      <GradeModal
        visible={modalOpen}
        spaceId={spaceId}
        editing={editing}
        defaultModuleId={selectedModule?.id ?? null}
        onClose={() => setModalOpen(false)}
      />
      <GradeModuleModal visible={moduleModalOpen} spaceId={spaceId} editing={editingModule}
        template={selectedModule ?? modules[modules.length - 1]} onClose={() => setModuleModalOpen(false)} onSaved={setSelectedModuleId} />
    </View>
  );
}

function GradeModal({
  visible,
  spaceId,
  editing,
  defaultModuleId,
  onClose,
}: {
  visible: boolean;
  spaceId: string;
  editing: Grade | null;
  defaultModuleId: string | null;
  onClose: () => void;
}) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const dateLocale = useDateFnsLocale();
  const { createGrade, updateGrade, modules } = useGradesStore();
  const [moduleId, setModuleId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<AssessmentType>('test');
  const [qualitative, setQualitative] = useState<QualitativeGrade | null>(null);
  const [title, setTitle] = useState("");
  const [score, setScore] = useState("");
  const [maxScore, setMaxScore] = useState("20");
  const [weight, setWeight] = useState("1");
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (visible) {
      setTitle(editing?.title || "");
      setScore(editing ? String(editing.score) : "");
      setMaxScore(editing ? String(editing.max_score) : "20");
      setWeight(editing ? String(editing.weight) : "1");
      setModuleId(editing ? editing.module_id ?? null : defaultModuleId ?? modules[0]?.id ?? null);
      setCategoryId(editing?.category_id ?? 'test');
      setQualitative(editing?.qualitative_value ?? null);
      setDate(editing ? new Date(editing.graded_at) : new Date());
      setError("");
    }
  }, [visible, editing, defaultModuleId, modules]);

  const handleSave = async () => {
    const maxNum = maxScore.trim() ? Number(maxScore.replace(",", ".")) : NaN;
    const scoreNum = qualitative ? qualitativeScore(qualitative, maxNum) : score.trim() ? Number(score.replace(",", ".")) : NaN;
    const weightNum = weight.trim() ? Number(weight.replace(",", ".")) : NaN;

    if (
      !title.trim() ||
      !Number.isFinite(scoreNum) ||
      !Number.isFinite(maxNum) ||
      !Number.isFinite(weightNum) ||
      scoreNum < 0 ||
      scoreNum > maxNum ||
      maxNum <= 0 ||
      weightNum <= 0
    ) {
      setError(t("grades.modal.errors.invalidValues"));
      return;
    }

    setSaving(true);
    setError("");
    try {
      const isoDate = format(date, "yyyy-MM-dd");
      if (editing) {
        await updateGrade(editing.id, spaceId, {
          title: title.trim(),
          score: scoreNum,
          max_score: maxNum,
          weight: weightNum,
          module_id: moduleId,
          category_id: moduleId ? categoryId : null,
          qualitative_value: qualitative,
          graded_at: isoDate,
        });
      } else {
        await createGrade({
          space_id: spaceId,
          title: title.trim(),
          score: scoreNum,
          max_score: maxNum,
          weight: weightNum,
          module_id: moduleId,
          category_id: moduleId ? categoryId : null,
          qualitative_value: qualitative,
          topic_id: null,
          graded_at: isoDate,
        });
      }
      onClose();
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : t("grades.modal.errors.saveFailed")
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAwareModal visible={visible} onRequestClose={() => { if (!saving) onClose(); }}>
      <View className="bg-background p-6">
        <Text className="text-lg font-bold text-textPrimary mb-4">
          {editing ? t("grades.modal.editTitle") : t("grades.modal.newTitle")}
        </Text>

        {error ? (
          <Text className="text-error text-sm mb-3">{error}</Text>
        ) : null}

        {modules.length > 0 && <View className="mb-4" style={{ gap: 10 }}>
          <Text className="text-textSecondary text-xs">{t('grades.modules.module')}</Text>
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            {[{ id: null, name: t('grades.modules.unassigned') }, ...modules].map(module => <TouchableOpacity
              key={module.id ?? 'unassigned'} disabled={saving} accessibilityRole="button" accessibilityState={{ selected: moduleId === module.id }}
              onPress={() => { setModuleId(module.id); setWeight('1'); }} className={`px-3 py-2 rounded-xl ${moduleId === module.id ? 'bg-border' : 'bg-surface'}`}>
              <Text className="text-textPrimary text-sm">{module.name}</Text>
            </TouchableOpacity>)}
          </View>
          {moduleId && <>
            <Text className="text-textSecondary text-xs">{t('grades.modules.type')}</Text>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {assessmentTypes.map(type => <TouchableOpacity key={type} disabled={saving} accessibilityRole="button"
                accessibilityState={{ selected: categoryId === type }} onPress={() => setCategoryId(type)}
                className={`px-3 py-2 rounded-xl ${categoryId === type ? 'bg-border' : 'bg-surface'}`}>
                <Text className="text-textPrimary text-sm">{t(`grades.modules.types.${type}`)}{modules.find(module => module.id === moduleId)?.criteria.grouped
                  ? '' : ` · ${modules.find(module => module.id === moduleId)?.criteria[type] ?? 0}%`}</Text>
              </TouchableOpacity>)}
            </View>
            {!modules.find(module => module.id === moduleId)?.criteria.grouped && <Text className="text-textSecondary text-xs">{t('grades.modules.typeHelp')}</Text>}
          </>}
        </View>}

        <Text className="text-xs font-semibold text-textTertiary mb-1.5 uppercase">
          {t("grades.modal.titleLabel")}
        </Text>
        <TextInput
          className="bg-surface rounded-xl px-4 py-3.5 text-textPrimary text-base mb-4"
          placeholder={t("grades.modal.titlePlaceholder")}
          placeholderTextColor={colors.textTertiary}
          value={title}
          onChangeText={setTitle}
        />

        <View className="mb-4">
          <GradeValueInput label={t('grades.modal.scoreLabel')} value={score} onChange={setScore} qualitative={qualitative}
            onQualitativeChange={setQualitative} maxScore={Number(maxScore.replace(',', '.'))} disabled={saving} />
        </View>
        <View className="flex-row gap-3 mb-4">
          <View className="flex-1">
            <Text className="text-xs font-semibold text-textTertiary mb-1.5 uppercase">
              {t("grades.modal.outOfLabel")}
            </Text>
            <TextInput
              className="bg-surface rounded-xl px-4 py-3.5 text-textPrimary text-base"
              placeholder="20"
              keyboardType="decimal-pad"
              placeholderTextColor={colors.textTertiary}
              value={maxScore}
              onChangeText={value => {
                setMaxScore(value);
                const maximum = Number(value.replace(',', '.'));
                if (qualitative && Number.isFinite(maximum) && maximum > 0) setScore(String(qualitativeScore(qualitative, maximum)));
              }}
            />
          </View>
          {!moduleId && <View className="flex-1">
            <Text className="text-xs font-semibold text-textTertiary mb-1.5 uppercase">
              {t("grades.modal.weightFieldLabel")}
            </Text>
            <TextInput
              className="bg-surface rounded-xl px-4 py-3.5 text-textPrimary text-base"
              placeholder="1"
              keyboardType="decimal-pad"
              placeholderTextColor={colors.textTertiary}
              value={weight}
              onChangeText={setWeight}
            />
          </View>}
        </View>

        <Text className="text-xs font-semibold text-textTertiary mb-1.5 uppercase">
          {t("grades.modal.dateLabel")}
        </Text>
        {Platform.OS === "web" ? <View style={{ marginBottom: 24 }}><DateTimePicker value={date} mode="date" onChange={(_, selected) => { if (selected) setDate(selected); }} /></View> : <TouchableOpacity
          className="bg-surface rounded-xl px-4 py-3.5 mb-6 flex-row items-center justify-between"
          onPress={() => setShowPicker(true)}
        >
          <Text className="text-textPrimary text-base">
            {format(date, t("grades.dateFormatLong"), { locale: dateLocale })}
          </Text>
          <Ionicons
            name="calendar-outline"
            size={18}
            color={colors.textTertiary}
          />
        </TouchableOpacity>}
        {Platform.OS !== "web" && showPicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display={Platform.OS === "ios" ? "inline" : "default"}
            onChange={(_, selected) => {
              setShowPicker(Platform.OS === "ios");
              if (selected) setDate(selected);
            }}
          />
        )}

        <Button
          title={
            editing ? t("grades.modal.saveButton") : t("grades.modal.addButton")
          }
          onPress={handleSave}
          loading={saving}
        />
        <TouchableOpacity className="py-3 items-center mt-1" onPress={onClose} disabled={saving}>
          <Text className="text-textSecondary">{t("grades.modal.cancel")}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAwareModal>
  );
}
