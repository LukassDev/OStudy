import { Ionicons } from "@expo/vector-icons";
import { formatDistanceToNow } from "date-fns";
import type { Href } from "expo-router";
import { guardedPush } from "../utils/navigation";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useThemeColors } from "../constants/theme";
import { useDateFnsLocale } from "../i18n/dateFnsLocale";
import { Chat, useChatStore } from "../stores/chatStore";
import { Button } from "./ui/Button";
import { ConfirmModal } from "./ui/ConfirmModal";
import { showAppDialog } from "./ui/AppDialog";
import { EmptyState } from "./ui/EmptyState";
import { KeyboardAwareModal } from "./ui/KeyboardAwareModal";

interface ChatListProps {
  spaceId: string;
  readOnly?: boolean;
}

export function ChatList({ spaceId, readOnly = false }: ChatListProps) {
  const { chats, loading, fetchChats, renameChat, deleteChat } = useChatStore();
  const colors = useThemeColors();
  const { t } = useTranslation();
  const dateLocale = useDateFnsLocale();
  const [renaming, setRenaming] = useState<Chat | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Chat | null>(null);

  useEffect(() => {
    fetchChats(spaceId);
  }, [spaceId, fetchChats]);

  const handleChatPress = (chatId: string) => {
    guardedPush(`/(app)/chats/${chatId}` as Href);
  };

  // Evita que toques rápidos repetidos em "novo chat" criem chats duplicados
  // antes de a criação terminar.
  const creatingRef = useRef(false);
  const handleNewChat = async () => {
    if (readOnly) return;
    if (creatingRef.current) return;
    creatingRef.current = true;
    try {
      const { createChat } = useChatStore.getState();
      const chat = await createChat(spaceId);
      guardedPush(`/(app)/chats/${chat.id}` as Href);
    } catch (error) {
      console.error("Error creating chat:", error);
    } finally {
      creatingRef.current = false;
    }
  };

  const openRename = (chat: Chat) => {
    setNewTitle(chat.title);
    setRenaming(chat);
  };

  const handleSaveRename = async () => {
    if (!renaming || !newTitle.trim()) return;
    setSaving(true);
    try {
      await renameChat(renaming.id, newTitle.trim());
      setRenaming(null);
    } catch (e) {
      console.error("Error renaming chat:", e);
    } finally {
      setSaving(false);
    }
  };

  const handleLongPress = (chat: Chat) => {
    if (readOnly) return;
    showAppDialog(chat.title, t("chatList.longPressMenu.question"), [
      { text: t("chatList.longPressMenu.cancel"), style: "cancel" },
      {
        text: t("chatList.longPressMenu.rename"),
        onPress: () => openRename(chat),
      },
      {
        text: t("chatList.longPressMenu.delete"),
        style: "destructive",
        onPress: () => setConfirmDelete(chat),
      },
    ]);
  };

  const renderItem = ({ item }: { item: Chat }) => (
    <TouchableOpacity
      className="bg-surface rounded-[10px] p-4 mx-4 mb-2.5"
      onPress={() => handleChatPress(item.id)}
      onLongPress={readOnly ? undefined : () => handleLongPress(item)}
      delayLongPress={350}
    >
      <View className="flex-row justify-between items-center mb-1">
        <Text
          className="text-textPrimary font-semibold flex-1 mr-2"
          numberOfLines={1}
        >
          {item.title}
        </Text>
        <Text className="text-textTertiary text-xs">
          {formatDistanceToNow(new Date(item.updated_at), {
            locale: dateLocale,
            addSuffix: true,
          })}
        </Text>
      </View>
      {item.last_message_preview ? (
        <Text className="text-textSecondary text-sm" numberOfLines={1}>
          {item.last_message_preview}
        </Text>
      ) : (
        <Text className="text-textTertiary text-sm italic">
          {t("chatList.noMessagesYet")}
        </Text>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View className="py-10 items-center">
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  return (
    <View className="flex-1">
      {chats.length > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, paddingHorizontal: 16, paddingTop: 24, paddingBottom: 20 }}>
          <Text style={{ color: colors.textPrimary, fontFamily: 'DMSans_700Bold', fontSize: 20 }}>
            {t('chatList.conversationsHeading', { defaultValue: 'Conversas' })}
          </Text>
          <TouchableOpacity accessibilityRole="button" onPress={handleNewChat} disabled={readOnly}
            style={{ minWidth: Platform.OS === 'web' ? 180 : 140, minHeight: 52, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 14,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
              backgroundColor: colors.primary, opacity: readOnly ? 0.5 : 1 }}>
            <Ionicons name="add" size={24} color="#FFFFFF" />
            <Text style={{ color: colors.primaryText, fontFamily: 'DMSans_700Bold', fontSize: 16 }}>{t('chatList.newChat')}</Text>
          </TouchableOpacity>
        </View>
      )}
      {chats.length === 0 ? (
        <EmptyState
          icon="chatbubbles-outline"
          title={t("chatList.empty.title")}
          subtitle={t("chatList.empty.subtitle")}
          actionLabel={t("chatList.empty.action")}
          onAction={handleNewChat}
          actionDisabled={readOnly}
        />
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListHeaderComponent={Platform.OS !== 'web' ? <Text className="text-textTertiary text-xs text-center mb-2">{t("chatList.longPressHint")}</Text> : null}
        />
      )}

      <KeyboardAwareModal
        visible={!!renaming}
        onRequestClose={() => setRenaming(null)}
      >
        <View className="bg-background p-6">
          <Text className="text-lg font-bold text-textPrimary mb-4">
            {t("chatList.renameModal.title")}
          </Text>
          <TextInput
            className="bg-surface rounded-xl px-4 py-3.5 text-textPrimary text-base mb-4"
            value={newTitle}
            onChangeText={setNewTitle}
            placeholder={t("chatList.renameModal.placeholder")}
            placeholderTextColor={colors.textTertiary}
            autoFocus
          />
          <Button
            title={t("chatList.renameModal.save")}
            onPress={handleSaveRename}
            loading={saving}
          />
          <TouchableOpacity
            className="py-3 items-center mt-1"
            onPress={() => setRenaming(null)}
          >
            <Text className="text-textSecondary">
              {t("chatList.renameModal.cancel")}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAwareModal>

      <ConfirmModal
        visible={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={async () => {
          await deleteChat(confirmDelete!.id);
          setConfirmDelete(null);
        }}
        icon="trash-outline"
        variant="danger"
        title={t("chatList.deleteConfirm.title")}
        messages={[t("chatList.deleteConfirm.message")]}
        confirmLabel={t("chatList.deleteConfirm.confirm")}
        cancelLabel={t("chatList.deleteConfirm.cancel")}
      />
    </View>
  );
}
