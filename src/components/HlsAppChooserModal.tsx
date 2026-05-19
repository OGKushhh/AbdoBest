import React, {useCallback, useEffect, useState} from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Share,
  ToastAndroid,
  Alert,
  Platform,
} from 'react-native';
import {Linking} from 'react-native';
import {useTranslation} from 'react-i18next';
import {Colors} from '../theme/colors';

// ─── iOS downloader apps (download-only, no VLC) ──────────────────────────
// Checked in order. First one installed wins.
const IOS_DOWNLOADERS = [
  {
    name: 'Outplayer',
    // Outplayer accepts: outplayer://URL  — downloads + converts to MP4
    scheme: (url: string) => `outplayer://${url}`,
    storeUrl: 'https://apps.apple.com/app/outplayer/id1449697545',
  },
  {
    name: 'Documents',
    // Documents by Readdle: rdocs://URL  — downloads to Files app
    scheme: (url: string) => `rdocs://${url}`,
    storeUrl: 'https://apps.apple.com/app/documents-file-manager-browser/id364901807',
  },
] as const;

// Fallback App Store URL when nothing is installed — send user to Outplayer
const IOS_FALLBACK_STORE = 'https://apps.apple.com/app/outplayer/id1449697545';

interface Props {
  visible: boolean;
  m3u8Url: string;
  title: string;
  onClose: () => void;
}

const HlsDownloadSheet: React.FC<Props> = ({visible, m3u8Url, title, onClose}) => {
  const {t} = useTranslation();
  const filename = `${title}.mp4`;

  // ── iOS: detect which downloader is installed ────────────────────────────
  // null  = still detecting
  // index = found app at that index
  // -1    = none installed
  const [iosAppIndex, setIosAppIndex] = useState<number | null>(
    Platform.OS === 'android' ? -1 : null,
  );

  useEffect(() => {
    if (Platform.OS !== 'ios' || !visible) return;
    let cancelled = false;
    (async () => {
      for (let i = 0; i < IOS_DOWNLOADERS.length; i++) {
        const testUrl = IOS_DOWNLOADERS[i].scheme('https://test.com/test.m3u8');
        const can = await Linking.canOpenURL(testUrl).catch(() => false);
        if (can) {
          if (!cancelled) setIosAppIndex(i);
          return;
        }
      }
      if (!cancelled) setIosAppIndex(-1);
    })();
    return () => { cancelled = true; };
  }, [visible]);

  const iosButtonLabel = Platform.OS === 'ios'
    ? iosAppIndex === null
      ? '…'                                          // still detecting
      : iosAppIndex >= 0
        ? `Open in ${IOS_DOWNLOADERS[iosAppIndex].name}`
        : 'Get Outplayer'                             // nothing installed
    : 'Open in 1DM';                                 // Android — unchanged

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleOpen = useCallback(async () => {
    // ── ANDROID — completely unchanged from original ─────────────────────
    if (Platform.OS === 'android') {
      const pkg = 'idm.internet.download.manager';
      const scheme = m3u8Url.startsWith('https') ? 'https' : 'http';
      const rawUrl = m3u8Url.replace(/^https?:\/\//, '');
      const encodedTitle = encodeURIComponent(filename);
      const encodedReferer = encodeURIComponent('https://www.fasel-hd.cam/');

      // Method 1: Explicit intent URI targeting UrlHandlerDownloader
      try {
        const explicitIntentUrl =
          `intent://${rawUrl}#Intent;scheme=${scheme};` +
          `package=${pkg};` +
          `component=${pkg}/.UrlHandlerDownloader;` +
          `S.title=${encodedTitle};` +
          `S.extra_referer=${encodedReferer};end`;
        const canOpen = await Linking.canOpenURL(explicitIntentUrl).catch(() => false);
        if (canOpen) {
          await Linking.openURL(explicitIntentUrl);
          onClose();
          return;
        }
      } catch {}

      // Method 2: Implicit intent by package only
      try {
        const scheme2 = m3u8Url.startsWith('https') ? 'https' : 'http';
        const implicitIntentUrl =
          `intent://${rawUrl}#Intent;scheme=${scheme2};` +
          `package=${pkg};` +
          `S.title=${encodedTitle};` +
          `S.extra_referer=${encodedReferer};end`;
        const canOpen = await Linking.canOpenURL(implicitIntentUrl).catch(() => false);
        if (canOpen) {
          await Linking.openURL(implicitIntentUrl);
          onClose();
          return;
        }
      } catch {}

      // Fallback: open Play Store to install 1DM
      const androidPkg = 'idm.internet.download.manager';
      try {
        await Linking.openURL(`market://details?id=${androidPkg}`);
      } catch {
        await Linking.openURL(`https://play.google.com/store/apps/details?id=${androidPkg}`);
      }
      onClose();
      return;
    }

    // ── iOS ──────────────────────────────────────────────────────────────
    if (iosAppIndex !== null && iosAppIndex >= 0) {
      // A supported downloader is installed — hand off the URL
      const app = IOS_DOWNLOADERS[iosAppIndex];
      try {
        await Linking.openURL(app.scheme(m3u8Url));
        onClose();
        return;
      } catch {}
    }

    // Nothing installed — share URL and send to App Store
    try { await Share.share({message: m3u8Url}); } catch {}
    await Linking.openURL(
      iosAppIndex !== null && iosAppIndex >= 0
        ? IOS_DOWNLOADERS[iosAppIndex].storeUrl
        : IOS_FALLBACK_STORE,
    );
    onClose();
  }, [m3u8Url, filename, onClose, iosAppIndex]);

  const handleCopy = useCallback(() => {
    Share.share({message: m3u8Url}).catch(() => {});
    if (Platform.OS === 'android') {
      ToastAndroid.show(t('copied') || 'Copied', ToastAndroid.SHORT);
    } else {
      Alert.alert('', t('copied') || 'Link copied');
    }
  }, [m3u8Url, t]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <Text style={styles.iconText}>⬇</Text>
            </View>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>{t('download') || 'Download'}</Text>
              <Text style={styles.headerSub} numberOfLines={1}>{title}</Text>
            </View>
          </View>

          {/* URL row */}
          <View style={styles.urlRow}>
            <Text style={styles.urlText} numberOfLines={1} ellipsizeMode="middle">
              {m3u8Url}
            </Text>
            <TouchableOpacity style={styles.copyBtn} onPress={handleCopy} activeOpacity={0.7}>
              <Text style={styles.copyBtnText}>{t('copy') || 'Copy'}</Text>
            </TouchableOpacity>
          </View>

          {/* Open in downloader — label updates based on what's installed */}
          <TouchableOpacity
            style={[styles.openBtn, iosAppIndex === null && {opacity: 0.6}]}
            onPress={handleOpen}
            activeOpacity={0.85}
            disabled={iosAppIndex === null}>
            <Text style={styles.openBtnText}>{iosButtonLabel}</Text>
          </TouchableOpacity>

          {/* iOS hint when nothing is installed */}
          {Platform.OS === 'ios' && iosAppIndex === -1 && (
            <Text style={styles.iosHint}>
              Outplayer will be installed. Your link has been copied — paste it inside the app.
            </Text>
          )}

          {/* Cancel */}
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.cancelText}>{t('cancel') || 'Cancel'}</Text>
          </TouchableOpacity>

        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  card: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: `${Colors.dark.primary}20`,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconText: {
    fontSize: 18,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Rubik',
  },
  headerSub: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontFamily: 'Rubik',
    marginTop: 1,
  },
  urlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surfaceLight,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 8,
  },
  urlText: {
    flex: 1,
    color: Colors.dark.textSecondary,
    fontSize: 11,
    fontFamily: 'Rubik',
  },
  copyBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: `${Colors.dark.primary}25`,
    flexShrink: 0,
  },
  copyBtnText: {
    color: Colors.dark.primary,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Rubik',
  },
  openBtn: {
    backgroundColor: Colors.dark.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 10,
  },
  openBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'Rubik',
  },
  cancelBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  cancelText: {
    color: Colors.dark.textMuted,
    fontSize: 13,
    fontFamily: 'Rubik',
  },
  iosHint: {
    color: Colors.dark.textMuted,
    fontSize: 11,
    fontFamily: 'Rubik',
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 16,
  },
});

export default HlsDownloadSheet;
