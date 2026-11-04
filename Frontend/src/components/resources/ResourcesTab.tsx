import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import * as DocumentPicker from "expo-document-picker";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    Linking,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useThemeColors } from "../../constants/theme";
import { useDateFnsLocale } from "../../i18n/dateFnsLocale";
import {
    Resource,
    ResourceType,
    useResourcesStore,
} from "../../stores/resourcesStore";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { KeyboardAwareModal } from "../ui/KeyboardAwareModal";
import { showAppDialog } from "../ui/AppDialog";
import { ResourceOrderModal } from './ResourceOrderModal';
import { ResourcePreviewModal } from './ResourcePreviewModal';

const TYPE_ICON: Record<ResourceType, keyof typeof Ionicons.glyphMap> = {
  pdf: "document-text-outline",
  image: "image-outline",
  video: "videocam-outline",
  link: "link-outline",
  document: "document-outline",
};

interface ResourcesTabProps {
  spaceId: string;
  readOnly?: boolean;
}

export function ResourcesTab({ spaceId, readOnly = false }: ResourcesTabProps) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const dateLocale = useDateFnsLocale();
  const {
    resources,
    loading,
    uploading,
    fetchResources,
    uploadFileResource,
    deleteResource,
  } = useResourcesStore();
  const [renaming, setRenaming] = useState<Resource | null>(null);
  const [preview, setPreview] = useState<Resource | null>(null);
  useEffect(() => { setPreview(null); }, [spaceId]);
  const [newTitle, setNewTitle] = useState('');
  const [editingBusy, setEditingBusy] = useState(false);
  const editResource = async (action: () => Promise<void>) => { setEditingBusy(true); try { await action(); } catch (error) { showAppDialog(t('update15.error'), String(error)); } finally { setEditingBusy(false); } };
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [ordering, setOrdering] = useState(false);
  useEffect(() => { setOrdering(false); }, [spaceId, readOnly]);

  useEffect(() => {
    fetchResources(spaceId);
  }, [spaceId, fetchResources]);


  const handlePickFile = async () => {
    if (readOnly) return;

    const result = await DocumentPicker.getDocumentAsync({
      type: "*/*",
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const file = result.assets[0];
    try {
      await uploadFileResource(spaceId, {
        uri: file.uri,
        name: file.name,
        mimeType: file.mimeType,
        size: file.size,
      });
    } catch (e: any) {
      showAppDialog(
        t("resources.uploadError.title"),
        e.message || t("resources.uploadError.genericMessage"),
      );
    }
  };

  const handleAddLink = () => {
    if (readOnly) return;
    setLinkModalOpen(true);
  };

  const handleOpen = async (resource: Resource) => {
    if (resource.type === "link" && resource.url) {
      Linking.openURL(resource.url);
      return;
    }
    if (resource.storage_path || typeof resource.text_content === 'string') {
      setPreview(resource);
    }
  };

  const handleDelete = (resource: Resource) => {
    showAppDialog(
      t("content.deleteConfirm.title"),
      t("content.deleteConfirm.withoutChildren", { title: resource.title }),
      [
        { text: t("content.deleteConfirm.cancel"), style: "cancel" },
        {
          text: t("content.deleteConfirm.confirm"),
          style: "destructive",
          onPress: () => deleteResource(resource.id, spaceId),
        },
      ],
    );
  };

  if (!loading && resources.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <EmptyState
          icon="folder-open-outline"
          title={t("resources.empty.title")}
        />
        <View className="flex-row gap-3 w-full mt-2" style={{ maxWidth: 440, alignSelf: 'center' }}>
          <Button
            title={t("resources.addFile")}
            onPress={handlePickFile}
            loading={uploading}
            disabled={readOnly}
            size="sm"
            style={{ flex: 1 }}
          />
          <Button
            title={t("resources.addLink")}
            onPress={handleAddLink}
            disabled={readOnly}
            variant="outline"
            size="sm"
            style={{ flex: 1 }}
          />
        </View>
        <LinkModal
          visible={linkModalOpen}
          spaceId={spaceId}
          onClose={() => setLinkModalOpen(false)}
        />
      </View>
    );
  }

  return (
    <View className="flex-1">
      <ResourcePreviewModal resource={preview} onClose={() => setPreview(null)} />
      <ScrollView
        className="flex-1"
        scrollEnabled={!ordering}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <View className="flex-row gap-3 mt-4 mb-1" style={{ width: '100%', maxWidth: 440, alignSelf: 'center', paddingHorizontal: 16 }}>
          <TouchableOpacity
            className={`flex-1 rounded-[12px] py-3 items-center flex-row justify-center bg-primary`}
            onPress={handlePickFile}
            disabled={uploading || readOnly}
            style={{ opacity: readOnly ? 0.5 : 1 }}
          >
            {uploading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons
                  name="cloud-upload-outline"
                  size={18}
                  color="#FFFFFF"
                />
                <Text
                  className={`font-semibold ml-1.5 text-sm text-primaryText`}
                >
                  {t("resources.fileButton")}
                </Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 border border-border rounded-[12px] py-3 items-center flex-row justify-center"
            onPress={handleAddLink}
            disabled={readOnly}
            style={{ opacity: readOnly ? 0.5 : 1 }}
          >
            <Ionicons
              name="link-outline"
              size={18}
              color={colors.textPrimary}
            />
            <Text
              className={`font-semibold ml-1.5 text-sm text-textPrimary`}
            >
              {t("resources.linkButton")}
            </Text>
          </TouchableOpacity>
        </View>

        <Text className="text-textTertiary text-xs text-center mb-2 mx-6">
          {t("resources.longPressHint")}
        </Text>
        {!readOnly && resources.length > 1 && (
          <TouchableOpacity accessibilityRole="button" onPress={() => setOrdering(true)}
            style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 16, paddingVertical: 12 }}>
            <Ionicons name="move-outline" size={17} color={colors.primary} />
            <Text style={{ color: colors.primary, fontFamily: 'DMSans_700Bold', fontSize: 14 }}>{t('studyVisual.editResources')}</Text>
          </TouchableOpacity>
        )}

        {resources.map((resource) => (
          <TouchableOpacity
            key={resource.id}
            className="flex-row items-center bg-surface rounded-[10px] px-4 py-3 mx-4 mb-2"
            onPress={() => handleOpen(resource)}
            onLongPress={readOnly ? undefined : () => handleDelete(resource)}
          >
            <View className="w-9 h-9 rounded-[12px] bg-primarySoft items-center justify-center mr-3">
              <Ionicons
                name={TYPE_ICON[resource.type]}
                size={17}
                color={colors.primary}
              />
            </View>
            <View className="flex-1">
              <Text
                className="text-textPrimary font-semibold"
                numberOfLines={1}
              >
                {resource.title}
              </Text>
              <Text className="text-textTertiary text-xs mt-0.5">
                {format(
                  new Date(resource.created_at),
                  t("resources.dateFormatShort"),
                  { locale: dateLocale },
                )}
              </Text>
            </View>
            {!readOnly && <View style={{ flexDirection: 'row' }}>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('update15.rename')} disabled={editingBusy}
                style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginHorizontal: 8 }}
                onPress={e => { e.stopPropagation(); setRenaming(resource); setNewTitle(resource.title); }}>
                <Ionicons name="text" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>}
            <Ionicons
              name="open-outline"
              size={18}
              color={colors.textTertiary}
            />
          </TouchableOpacity>
        ))}
      </ScrollView>
      {ordering && !readOnly && <ResourceOrderModal spaceId={spaceId} resources={resources} onClose={() => setOrdering(false)} />}

      <KeyboardAwareModal visible={!!renaming} onRequestClose={() => setRenaming(null)} cornerRadius={0} contentStyle={{ padding: 24 }}>
        <Text className="text-textPrimary text-lg font-bold">{t('update15.rename')}</Text>
        <TextInput value={newTitle} onChangeText={setNewTitle} maxLength={200} className="text-textPrimary border border-border rounded-xl p-3 my-4" />
        <Button title={t('update15.save')} disabled={editingBusy || !newTitle.trim()} onPress={() => void editResource(async () => { if (renaming) await useResourcesStore.getState().renameResource(renaming.id, spaceId, newTitle); setRenaming(null); })} />
        <Button title={t('update15.cancel')} variant="ghost" disabled={editingBusy} onPress={() => setRenaming(null)} />
      </KeyboardAwareModal>
      <LinkModal
        visible={linkModalOpen}
        spaceId={spaceId}
        onClose={() => setLinkModalOpen(false)}
      />
    </View>
  );
}

function LinkModal({
  visible,
  spaceId,
  onClose,
}: {
  visible: boolean;
  spaceId: string;
  onClose: () => void;
}) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const { addLinkResource } = useResourcesStore();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (visible) {
      setTitle("");
      setUrl("");
      setError("");
    }
  }, [visible]);

  const handleSave = async () => {
    if (!title.trim() || !/^https?:\/\//.test(url.trim())) {
      setError(t("resources.linkModal.errors.invalid"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      await addLinkResource(spaceId, title.trim(), url.trim());
      onClose();
    } catch (e: any) {
      setError(e.message || t("resources.linkModal.errors.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAwareModal visible={visible} onRequestClose={onClose}>
      <View className="bg-background p-6">
        <Text className="text-lg font-bold text-textPrimary mb-4">
          {t("resources.linkModal.title")}
        </Text>
        {error ? (
          <Text className="text-error text-sm mb-3">{error}</Text>
        ) : null}

        <Text className="text-xs font-semibold text-textTertiary mb-1.5 uppercase">
          {t("resources.linkModal.titleFieldLabel")}
        </Text>
        <TextInput
          className="bg-surface rounded-xl px-4 py-3.5 text-textPrimary text-base mb-4"
          placeholder={t("resources.linkModal.titlePlaceholder")}
          placeholderTextColor={colors.textTertiary}
          value={title}
          onChangeText={setTitle}
        />

        <Text className="text-xs font-semibold text-textTertiary mb-1.5 uppercase">
          {t("resources.linkModal.urlLabel")}
        </Text>
        <TextInput
          className="bg-surface rounded-xl px-4 py-3.5 text-textPrimary text-base mb-6"
          placeholder="https://..."
          placeholderTextColor={colors.textTertiary}
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          keyboardType="url"
        />

        <Button
          title={t("resources.linkModal.addButton")}
          onPress={handleSave}
          loading={saving}
        />
        <TouchableOpacity className="py-3 items-center mt-1" onPress={onClose}>
          <Text className="text-textSecondary">
            {t("resources.linkModal.cancel")}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAwareModal>
  );
}
