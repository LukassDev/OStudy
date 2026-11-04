import { Ionicons } from "@expo/vector-icons";
import { formatDistanceToNow } from "date-fns";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useThemeColors } from "../../constants/theme";
import { useDateFnsLocale } from "../../i18n/dateFnsLocale";
import { Topic, useContentStore } from "../../stores/contentStore";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { KeyboardAwareModal } from "../ui/KeyboardAwareModal";
import { showAppDialog } from "../ui/AppDialog";

interface ContentTabProps {
  spaceId: string;
  readOnly?: boolean;
}

function useImportanceLabels(): Record<string, string> {
  const { t } = useTranslation();
  return {
    low: t("content.importance.low"),
    medium: t("content.importance.medium"),
    high: t("content.importance.high"),
  };
}

export function ContentTab({ spaceId, readOnly = false }: ContentTabProps) {
  const { t } = useTranslation();
  const { topics, loading, fetchTopics, deleteTopic, markReviewed } =
    useContentStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Topic | null>(null);
  const [parentFor, setParentFor] = useState<string | null>(null);

  useEffect(() => {
    fetchTopics(spaceId);
  }, [spaceId, fetchTopics]);

  const openCreate = (parentId: string | null = null) => {
    if (readOnly) return;
    setEditing(null);
    setParentFor(parentId);
    setModalOpen(true);
  };

  const openEdit = (topic: Topic) => {
    if (readOnly) return;
    setEditing(topic);
    setParentFor(topic.parent_id);
    setModalOpen(true);
  };

  const handleDelete = (topic: Topic) => {
    if (readOnly) return;
    showAppDialog(
      t("content.deleteConfirm.title"),
      topic.children && topic.children.length > 0
        ? t("content.deleteConfirm.withChildren", {
            count: topic.children.length,
            title: topic.title,
          })
        : t("content.deleteConfirm.withoutChildren", { title: topic.title }),
      [
        { text: t("content.deleteConfirm.cancel"), style: "cancel" },
        {
          text: t("content.deleteConfirm.confirm"),
          style: "destructive",
          onPress: () => deleteTopic(topic.id, spaceId),
        },
      ],
    );
  };

  if (!loading && topics.length === 0) {
    return (
      <View className="flex-1">
        <EmptyState
          icon="book-outline"
          title={t("content.empty.title")}
          subtitle={t("content.empty.subtitle")}
          actionLabel={t("content.empty.action")}
          onAction={() => openCreate(null)}
          actionDisabled={readOnly}
        />
        <TopicModal
          visible={modalOpen}
          spaceId={spaceId}
          editing={editing}
          parentId={parentFor}
          onClose={() => setModalOpen(false)}
        />
      </View>
    );
  }

  return (
    <View className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <TouchableOpacity
          className="bg-primary rounded-[12px] py-3 px-4 mx-4 mt-4 mb-2 flex-row items-center justify-center"
          onPress={() => openCreate(null)}
          disabled={readOnly}
          style={{ opacity: readOnly ? 0.5 : 1 }}
        >
          <Ionicons name="add" size={20} color="#FFFFFF" />
          <Text className="text-primaryText font-semibold ml-1">
            {t("content.newTopic")}
          </Text>
        </TouchableOpacity>

        {topics.map((topic) => (
          <TopicNode
            key={topic.id}
            topic={topic}
            spaceId={spaceId}
            level={0}
            onEdit={openEdit}
            onDelete={handleDelete}
            onAddChild={openCreate}
            onToggleReviewed={(id) => markReviewed(id, spaceId)}
            readOnly={readOnly}
          />
        ))}
      </ScrollView>

      <TopicModal
        visible={modalOpen}
        spaceId={spaceId}
        editing={editing}
        parentId={parentFor}
        onClose={() => setModalOpen(false)}
      />
    </View>
  );
}

function TopicNode({
  topic,
  spaceId,
  level,
  onEdit,
  onDelete,
  onAddChild,
  onToggleReviewed,
  readOnly,
}: {
  topic: Topic;
  spaceId: string;
  level: number;
  onEdit: (t: Topic) => void;
  onDelete: (t: Topic) => void;
  onAddChild: (parentId: string) => void;
  onToggleReviewed: (id: string) => void;
  readOnly: boolean;
}) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const dateLocale = useDateFnsLocale();
  const IMPORTANCE_LABEL = useImportanceLabels();
  const IMPORTANCE_COLOR: Record<string, string> = {
    low: colors.textTertiary,
    medium: colors.warning,
    high: colors.error,
  };
  const [expanded, setExpanded] = useState(false);
  const hasChildren = topic.children && topic.children.length > 0;

  return (
    <View>
      <View
        className="flex-row items-center bg-surface rounded-[10px] px-4 py-3 mx-4 mb-2"
        style={{ marginLeft: 16 + level * 16 }}
      >
        {/* Botão de expansão para sub-tópicos */}
        {hasChildren ? (
          <TouchableOpacity
            onPress={() => setExpanded(!expanded)}
            hitSlop={8}
            className="mr-2"
          >
            <Ionicons
              name={expanded ? "chevron-down" : "chevron-forward"}
              size={14}
              color={colors.textTertiary}
            />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 14, marginRight: 8 }} />
        )}

        {/* Botão Manual de Marcar/Desmarcar como Revisto */}
        <TouchableOpacity
          onPress={() => onToggleReviewed(topic.id)}
          disabled={readOnly}
          hitSlop={8}
          className="mr-3"
        >
          <Ionicons
            name={
              topic.last_reviewed_at ? "checkmark-circle" : "ellipse-outline"
            }
            size={22}
            color={
              topic.last_reviewed_at ? colors.success : colors.textTertiary
            }
          />
        </TouchableOpacity>

        {/* Informações do Tópico (clicável para abrir modal de edição) */}
        <TouchableOpacity
          className="flex-1"
          onPress={() => onEdit(topic)}
          disabled={readOnly}
          activeOpacity={0.7}
        >
          <View className="flex-row items-center">
            <Text
              className={`font-semibold shrink ${
                topic.last_reviewed_at
                  ? "text-textTertiary line-through"
                  : "text-textPrimary"
              }`}
              numberOfLines={1}
            >
              {topic.title}
            </Text>
            <View
              className="rounded-full px-2 py-0.5 ml-1.5"
              style={{
                backgroundColor: `${IMPORTANCE_COLOR[topic.importance]}20`,
              }}
            >
              <Text
                className="text-[10px] font-semibold"
                style={{ color: IMPORTANCE_COLOR[topic.importance] }}
              >
                {IMPORTANCE_LABEL[topic.importance]}
              </Text>
            </View>
          </View>
          {topic.summary ? (
            <Text
              className="text-textSecondary text-xs mt-0.5"
              numberOfLines={1}
            >
              {topic.summary}
            </Text>
          ) : null}
          <Text className="text-textTertiary text-[11px] mt-1">
            {topic.last_reviewed_at
              ? t("content.reviewedAgo", {
                  time: formatDistanceToNow(new Date(topic.last_reviewed_at), {
                    locale: dateLocale,
                    addSuffix: true,
                  }),
                })
              : t("content.notReviewedYet")}
          </Text>
        </TouchableOpacity>

        {/* Ações (Adicionar Sub-Tópico / Apagar) */}
        <TouchableOpacity
          onPress={() => onAddChild(topic.id)}
          disabled={readOnly}
          hitSlop={8}
          className="ml-2"
        >
          <Ionicons
            name="add-circle-outline"
            size={20}
            color={colors.textTertiary}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onDelete(topic)}
          disabled={readOnly}
          hitSlop={8}
          className="ml-2"
        >
          <Ionicons name="trash-outline" size={18} color={colors.error} />
        </TouchableOpacity>
      </View>

      {/* Renderização recursiva dos Sub-Tópicos */}
      {hasChildren && expanded && (
        <View>
          {topic.children!.map((child) => (
            <TopicNode
              key={child.id}
              topic={child}
              spaceId={spaceId}
              level={level + 1}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
              onToggleReviewed={onToggleReviewed}
              readOnly={readOnly}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function TopicModal({
  visible,
  spaceId,
  editing,
  parentId,
  onClose,
}: {
  visible: boolean;
  spaceId: string;
  editing: Topic | null;
  parentId: string | null;
  onClose: () => void;
}) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const IMPORTANCE_LABEL = useImportanceLabels();
  const { createTopic, updateTopic } = useContentStore();
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [importance, setImportance] = useState<"low" | "medium" | "high">(
    "medium",
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setTitle(editing?.title || "");
      setSummary(editing?.summary || "");
      setImportance(editing?.importance || "medium");
    }
  }, [visible, editing]);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await updateTopic(editing.id, spaceId, {
          title: title.trim(),
          summary: summary.trim() || null,
          importance,
        });
      } else {
        await createTopic({
          space_id: spaceId,
          parent_id: parentId,
          title: title.trim(),
          summary: summary.trim() || null,
          importance,
        });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const modalTitle = editing
    ? t("content.modal.editTitle")
    : parentId
      ? t("content.modal.newSubtopicTitle")
      : t("content.modal.newTopicTitle");

  return (
    <KeyboardAwareModal
      visible={visible}
      onRequestClose={onClose}
    >
      <View className="bg-background p-6">
        <Text className="text-lg font-bold text-textPrimary mb-4">
          {modalTitle}
        </Text>

        <Text className="text-xs font-semibold text-textTertiary mb-1.5 uppercase">
          {t("content.modal.titleLabel")}
        </Text>
        <TextInput
          className="bg-surface rounded-xl px-4 py-3.5 text-textPrimary text-base mb-4"
          placeholder={t("content.modal.titlePlaceholder")}
          placeholderTextColor={colors.textTertiary}
          value={title}
          onChangeText={setTitle}
        />

        <Text className="text-xs font-semibold text-textTertiary mb-1.5 uppercase">
          {t("content.modal.summaryLabel")}
        </Text>
        <TextInput
          className="bg-surface rounded-xl px-4 py-3.5 text-textPrimary text-base mb-4"
          placeholder={t("content.modal.summaryPlaceholder")}
          placeholderTextColor={colors.textTertiary}
          value={summary}
          onChangeText={setSummary}
          multiline
          scrollEnabled
          textAlignVertical="top"
          style={{ minHeight: 112, maxHeight: 190 }}
        />

        <Text className="text-xs font-semibold text-textTertiary mb-2 uppercase">
          {t("content.modal.importanceLabel")}
        </Text>
        <View className="flex-row gap-2 mb-6">
          {(["low", "medium", "high"] as const).map((imp) => (
            <TouchableOpacity
              key={imp}
              onPress={() => setImportance(imp)}
              className={`px-4 py-2 rounded-full ${importance === imp ? "bg-primary" : "bg-surface"}`}
            >
              <Text
                className={
                  importance === imp
                    ? "text-white text-sm font-medium"
                    : "text-textSecondary text-sm"
                }
              >
                {IMPORTANCE_LABEL[imp]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Button
          title={
            editing
              ? t("content.modal.saveButton")
              : t("content.modal.createButton")
          }
          onPress={handleSave}
          loading={saving}
        />
        <TouchableOpacity className="py-3 items-center mt-1" onPress={onClose}>
          <Text className="text-textSecondary">
            {t("content.modal.cancel")}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAwareModal>
  );
}
