import React, {useCallback} from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Clipboard,
  ToastAndroid,
  Platform,
} from 'react-native';
import {Linking} from 'react-native';
import {useTranslation} from 'react-i18next';
import {Colors} from '../theme/colors';

async function openPlayStore() {
  const pkg = 'idm.internet.download.manager';
  try {
    await Linking.openURL(`market://details?id=${pkg}`);
  } catch {
    await Linking.openURL(`https://play.google.com/store/apps/details?id=${pkg}`);
  }
}

interface Props {
  visible: boolean;
  m3u8Url: string;
  title: string;
  onClose: () => void;
}

const HlsDownloadSheet: React.FC<Props> = ({visible, m3u8Url, title, onClose}) => {
  const {t} = useTranslation();
  const filename = `${title}.mp4`;

  const handleOpen = useCallback(async () => {
    const pkg = 'idm.internet.download.manager';
    const encodedTitle = encodeURIComponent(filename);
    const encodedReferer = encodeURIComponent('https://www.fasel-hd.cam/');

    // Strip scheme from URL, pass it as the scheme= param (Gemini Method 2)
    const scheme = m3u8Url.startsWith('https') ? 'https' : 'http';
    const rawUrl = m3u8Url.replace(/^https?:\/\//, '');

    // Method 1: Explicit intent targeting 1DM's UrlHandlerDownloader activity directly
    const explicitIntentUrl =
      `intent://${rawUrl}#Intent;scheme=${scheme};` +
      `package=${pkg};` +
      `component=${pkg}/.UrlHandlerDownloader;` +
      `S.title=${encodedTitle};` +
      `S.extra_referer=${encodedReferer};end`;

    try {
      const canOpen = await Linking.canOpenURL(explicitIntentUrl).catch(() => false);
      if (canOpen) {
        await Linking.openURL(explicitIntentUrl);
        onClose();
        return;
      }
    } catch {}

    // Method 2: Fallback — implicit intent by package only, let Android resolve the activity
    const implicitIntentUrl =
      `intent://${rawUrl}#Intent;scheme=${scheme};` +
      `package=${pkg};` +
      `S.title=${encodedTitle};` +
      `S.extra_referer=${encodedReferer};end`;

    try {
      const canOpen = await Linking.canOpenURL(implicitIntentUrl).catch(() => false);
      if (canOpen) {
        await Linking.openURL(implicitIntentUrl);
        onClose();
        return;
      }
    } catch {}

    // Method 3: 1DM not installed — open Play Store
    await openPlayStore();
    onClose();
  }, [m3u8Url, filename, onClose]);

  const handleCopy = useCallback(() => {
    Clipboard.setString(m3u8Url);
    if (Platform.OS === 'android') {
      ToastAndroid.show(t('copied') || 'Copied', ToastAndroid.SHORT);
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

          {/* Open in 1DM */}
          <TouchableOpacity style={styles.openBtn} onPress={handleOpen} activeOpacity={0.85}>
            <Text style={styles.openBtnText}>Open in 1DM</Text>
          </TouchableOpacity>

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
});

export default HlsDownloadSheet;
