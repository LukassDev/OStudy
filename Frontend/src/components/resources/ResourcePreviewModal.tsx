import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Modal, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../../constants/theme';
import { Resource, useResourcesStore } from '../../stores/resourcesStore';
import { readAttachmentBase64 } from '../../utils/readAttachmentBase64';
import { renderOfficePreview } from '../../services/resources/officePreview';
import { Button } from '../ui/Button';
import ResourcePdfPreview from './ResourcePdfPreview';
import OfficePreview from './OfficePreview';

function VideoPreview({ uri, onError }: { uri: string; onError: () => void }) {
  if (Platform.OS === 'web') {
    return React.createElement('video' as any, {
      controls: true, playsInline: true, preload: 'metadata', onError,
      style: { width: '100%', height: '100%', background: '#000', objectFit: 'contain' },
    }, React.createElement('source', { src: uri }));
  }
  const safeUri = uri.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;background:#000}video{display:block;width:100%;height:100%;object-fit:contain}</style></head><body><video controls playsinline webkit-playsinline preload="metadata"><source src="${safeUri}"></video></body></html>`;
  let trustedHosts: string[] = [];
  try { trustedHosts = [new URL(uri).hostname]; } catch { /* Invalid signed URL stays blocked. */ }
  return <WebView source={{ html }} originWhitelist={['*']} javaScriptEnabled={false}
    allowsInlineMediaPlayback mediaPlaybackRequiresUserAction allowsFullscreenVideo
    onError={onError} onHttpError={onError} setSupportMultipleWindows={false}
    incognito cacheEnabled={false} allowFileAccess={false} allowFileAccessFromFileURLs={false}
    allowUniversalAccessFromFileURLs={false}
    onShouldStartLoadWithRequest={request => {
      if (request.url === 'about:blank') return true;
      try {
        const target = new URL(request.url);
        return target.protocol === 'https:' && trustedHosts.includes(target.hostname);
      } catch { return false; }
    }}
    style={{ flex: 1, backgroundColor: '#000' }} />;
}

export function ResourcePreviewModal({ resource, onClose }: { resource: Resource | null; onClose: () => void }) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { width } = useWindowDimensions();
  const compact = width < 700;
  const [showInfo, setShowInfo] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [actionFailed, setActionFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [officeHtml, setOfficeHtml] = useState<string | null>(null);
  const [simplePreview, setSimplePreview] = useState(false);
  useEffect(() => { setSimplePreview(false); setShowInfo(false); }, [resource?.id]);
  const extension = (resource?.original_name || resource?.storage_path || resource?.title || '').split('.').pop()?.toLowerCase();
  const isOffice = !!extension && ['doc', 'docx', 'pptx', 'xls', 'xlsx', 'csv'].includes(extension);
  const isLocalOffice = isOffice && !!resource?.file_uri;
  const isVideo = resource?.type === 'video' || (!!extension && ['3g2', '3gp', 'avi', 'm4v', 'mkv', 'mov', 'mp4', 'mpeg', 'mpg', 'mts', 'ogv', 'ts', 'webm', 'wmv'].includes(extension));
  const useMicrosoft = isOffice && !isLocalOffice && extension !== 'csv' && !simplePreview;
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setOfficeHtml(null);
    setUrl(null); setFailed(false); setActionFailed(false);
    if (!resource?.storage_path) {
      setLoading(false);
      return;
    }
    setLoading(true);
    useResourcesStore.getState().getSignedUrl(resource.storage_path).then(async signed => {
      if (cancelled) return;
      setUrl(signed);
      // Microsoft must fetch the original through a publicly reachable HTTPS URL.
      if (signed && useMicrosoft && (!signed.startsWith('https://') || new URL(signed).hostname === 'localhost')) {
        setSimplePreview(true);
        return;
      }
      if (signed && isLocalOffice && extension) {
        const base64 = await readAttachmentBase64(signed);
        const html = await renderOfficePreview(base64, extension);
        if (cancelled) return;
        setOfficeHtml(html);
      } else if (signed && isOffice && !useMicrosoft) {
        const response = await fetch(`${signed}${signed.includes('?') ? '&' : '?'}preview=1`, { signal: controller.signal });
        if (!response.ok) throw new Error('Preview failed');
        const result = await response.json();
        if (typeof result.html !== 'string') throw new Error('Invalid preview');
        if (cancelled) return;
        setOfficeHtml(result.html);
      }
      setLoading(false); setFailed(!signed);
    }).catch(() => { if (!cancelled) { setLoading(false); setFailed(true); } });
    return () => { cancelled = true; controller.abort(); };
  }, [resource, retry, isOffice, isLocalOffice, extension, useMicrosoft]);
  useEffect(() => {
    if (!resource || Platform.OS !== 'web') return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [resource, onClose]);
  const download = () => {
    if (!url) return;
    setActionFailed(false);
    const target = `${url}${url.includes('?') ? '&' : '?'}download=1`;
    if (Platform.OS === 'web') {
      // Keep this synchronous with the click so browser popup protection permits it.
      window.open(target, '_blank', 'noopener,noreferrer');
    } else {
      Linking.openURL(target).catch(() => setActionFailed(true));
    }
  };
  const canPreview = isOffice || isVideo || resource?.type === 'image' || (resource?.type === 'pdf' && Platform.OS !== 'android');
  return <Modal visible={!!resource} animationType="fade" presentationStyle="fullScreen"
    supportedOrientations={['portrait', 'landscape']} onRequestClose={onClose}>
    <SafeAreaView accessibilityViewIsModal style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <View style={{ paddingHorizontal: compact ? 4 : 16, paddingVertical: 6, minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: compact ? 4 : 12, borderBottomWidth: 1, borderColor: colors.border }}>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('attachmentViewer.close')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={22} color={colors.textPrimary} />
          </Pressable>
          {!compact && <Ionicons name={isVideo ? 'videocam-outline' : 'document-text-outline'} size={24} color={colors.primary} />}
          <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, color: colors.textPrimary, fontSize: compact ? 14 : 16, fontWeight: '600' }}>{resource?.title}</Text>
          {isOffice && <Pressable onPress={() => setShowInfo(value => !value)} accessibilityRole="button"
            accessibilityLabel={t(useMicrosoft ? 'resources.preview.microsoftNote' : 'resources.preview.officeNote')}
            accessibilityState={{ expanded: showInfo }} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="information-circle-outline" size={22} color={colors.textSecondary} />
          </Pressable>}
          {useMicrosoft && <Pressable onPress={() => setSimplePreview(true)} accessibilityRole="button"
            accessibilityLabel={t('resources.preview.simplePreview')}
            style={{ minWidth: 44, height: 44, paddingHorizontal: compact ? 0 : 12, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: colors.background }}>
            <Ionicons name="reader-outline" size={20} color={colors.textPrimary} />
            {!compact && <Text style={{ color: colors.textPrimary, fontSize: 13 }}>{t('resources.preview.simplePreview')}</Text>}
          </Pressable>}
          <Pressable onPress={download} disabled={!url} accessibilityRole="button" accessibilityLabel={t('resources.preview.download')}
            accessibilityState={{ disabled: !url }}
            style={{ minWidth: 44, height: 44, paddingHorizontal: compact ? 0 : 14, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: colors.primary, opacity: url ? 1 : .45 }}>
            <Ionicons name="download-outline" size={20} color="#fff" />
            {!compact && <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>{t('resources.preview.download')}</Text>}
          </Pressable>
        </View>
        {isOffice && showInfo && <Text style={{ paddingHorizontal: 16, paddingVertical: 10, color: colors.textSecondary, fontSize: 12 }}>{t(useMicrosoft ? 'resources.preview.microsoftNote' : 'resources.preview.officeNote')}</Text>}
        {actionFailed && <Text accessibilityRole="alert" style={{ padding: 10, color: colors.error }}>{t('resources.uploadError.openFailed')}</Text>}
        <View style={{ flex: 1, minHeight: 0, overflow: 'hidden', backgroundColor: colors.background }}>
          {loading ? <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator color={colors.primary} /></View>
            : typeof resource?.text_content === 'string' ? <ScrollView contentContainerStyle={{ padding: 24 }}>
                <Text selectable style={{ color: colors.textPrimary, fontSize: 15, lineHeight: 23 }}>{resource.text_content}</Text>
              </ScrollView>
            : url && canPreview && !failed ? isOffice
              ? <OfficePreview key={useMicrosoft ? url : 'simple'} html={officeHtml || undefined}
                  uri={useMicrosoft ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}` : undefined}
                  title={resource?.title || ''} onError={() => useMicrosoft ? setSimplePreview(true) : setFailed(true)} />
              : isVideo
              ? <VideoPreview uri={url} onError={() => setFailed(true)} />
              : resource?.type === 'image'
              ? <Image source={{ uri: url }} resizeMode="contain" style={{ flex: 1, width: '100%' }} onError={() => setFailed(true)} />
              : <ResourcePdfPreview uri={url} title={resource?.title || ''} onLoad={() => {}} onError={() => setFailed(true)} />
            : <View style={{ flex: 1, padding: 28, justifyContent: 'center', alignItems: 'center', gap: 16 }}>
                <Ionicons name={failed ? 'alert-circle-outline' : 'document-text-outline'} size={56} color={colors.textTertiary} />
                <Text style={{ color: colors.textSecondary, textAlign: 'center', fontSize: 15 }}>
                  {t(failed ? 'resources.preview.failed' : 'resources.preview.unsupported')}
                </Text>
                {failed && <Button title={t('resources.preview.retry')} onPress={() => setRetry(value => value + 1)} variant="outline" size="sm" fullWidth={false} />}
              </View>}
        </View>
      </View>
    </SafeAreaView>
  </Modal>;
}
