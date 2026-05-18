/**
 * HlsAppChooserModal
 *
 * Shown when the user taps a Fasel download button.
 * - If one app is already installed → skip modal, launch directly.
 * - If both installed → show chooser.
 * - If neither → show install prompt with Play Store links.
 */

import React, {useEffect, useState, useCallback} from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Image,
  ActivityIndicator,
} from 'react-native';
import {Linking} from 'react-native';
import {useTranslation} from 'react-i18next';
import {Colors} from '../theme/colors';

// ─── App definitions ──────────────────────────────────────────────────────────

export type HlsApp = '1DM' | 'ADM';

interface AppDef {
  id: HlsApp;
  label: string;
  sublabel: string;
  pkg: string;
  size: string;
  icon: any;
  accentColor: string;
}

const APPS: AppDef[] = [
  {
    id: '1DM',
    label: '1DM',
    sublabel: 'Internet Download Manager',
    pkg: 'idm.internet.download.manager',
    size: '108 MB',
    icon: require('../../assets/icons/1dm.png'),
    accentColor: '#2196F3',
  },
  {
    id: 'ADM',
    label: 'ADM',
    sublabel: 'Advanced Download Manager',
    pkg: 'com.dv.adm',
    size: '27 MB',
    icon: require('../../assets/icons/adm.png'),
    accentColor: '#4CAF50',
  },
];

// ─── Intent builders ──────────────────────────────────────────────────────────

/**
 * Attempt to launch an HLS download in the given app.
 * Returns true if the intent fired, false if the app is not installed.
 */
export async function launchHlsApp(
  app: HlsApp,
  m3u8Url: string,
  filename: string,
  referer: string,
  userAgent: string,
): Promise<boolean> {
  const def = APPS.find(a => a.id === app)!;

  try {
    if (app === '1DM') {
      // 1DM uses the intent:// scheme with named string extras
      const intentUrl =
        `intent:${m3u8Url}` +
        `#Intent` +
        `;package=${def.pkg}` +
        `;scheme=idmdownload` +
        `;S.extra_filename=${encodeURIComponent(filename)}` +
        `;S.extra_referer=${encodeURIComponent(referer)}` +
        `;S.extra_useragent=${encodeURIComponent(userAgent)}` +
        `;end`;
      await Linking.openURL(intentUrl);
    } else {
      // ADM uses a named Activity intent with TEXT + filename extras
      // React Native's Linking can't pass extras to a specific class,
      // so we use the ACTION_VIEW fallback that ADM intercepts via its
      // registered intent filter for http/https scheme.
      // ADM registers itself as a handler for http(s) URLs when installed.
      await Linking.openURL(m3u8Url);
    }
    return true;
  } catch {
    return false;
  }
}

/** Open the Play Store listing for an app. */
export async function openPlayStore(pkg: string) {
  try {
    await Linking.openURL(`market://details?id=${pkg}`);
  } catch {
    await Linking.openURL(`https://play.google.com/store/apps/details?id=${pkg}`);
  }
}

// ─── Hook: detect installed apps ─────────────────────────────────────────────

function useInstalledApps(): {installed: Record<HlsApp, boolean>; checked: boolean} {
  const [installed, setInstalled] = useState<Record<HlsApp, boolean>>({
    '1DM': false,
    'ADM': false,
  });
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // canOpenURL with intent:// + package is unreliable for install detection.
    // We probe with a package-specific custom scheme that only the installed
    // app can handle. For apps without a custom scheme, we fall back to trying
    // to open and catching; but we do that at launch-time, not here.
    //
    // Reliable approach: attempt a no-op intent and see if it resolves.
    // We resolve both simultaneously.
    const check = async () => {
      const results = await Promise.all(
        APPS.map(async app => {
          try {
            // intent:// with a bogus path — Android resolves the package lookup
            // synchronously and throws ActivityNotFoundException if not installed.
            const probe = `intent://__probe__#Intent;package=${app.pkg};end`;
            const can = await Linking.canOpenURL(probe);
            return {id: app.id, installed: can};
          } catch {
            return {id: app.id, installed: false};
          }
        }),
      );
      const map = {} as Record<HlsApp, boolean>;
      results.forEach(r => (map[r.id] = r.installed));
      setInstalled(map);
      setChecked(true);
    };
    check();
  }, []);

  return {installed, checked};
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  m3u8Url: string;
  filename: string;
  referer?: string;
  userAgent?: string;
  /** Called after a launch attempt (installed app fired) or user dismissed */
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

const DEFAULT_UA =
  'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

const HlsAppChooserModal: React.FC<Props> = ({
  visible,
  m3u8Url,
  filename,
  referer = 'https://www.fasel-hd.cam/',
  userAgent = DEFAULT_UA,
  onClose,
}) => {
  const {t} = useTranslation();
  const {installed, checked} = useInstalledApps();
  const [launching, setLaunching] = useState<HlsApp | null>(null);

  const neitherInstalled = checked && !installed['1DM'] && !installed['ADM'];
  const bothInstalled = checked && installed['1DM'] && installed['ADM'];
  const onlyOne = checked && (installed['1DM'] !== installed['ADM']);

  // If exactly one app is installed, auto-launch and close
  useEffect(() => {
    if (!visible || !checked || !onlyOne) return;
    const app = installed['1DM'] ? '1DM' : 'ADM';
    launchHlsApp(app, m3u8Url, filename, referer, userAgent).then(onClose);
  }, [visible, checked, onlyOne]);

  const handleLaunch = useCallback(async (app: HlsApp) => {
    setLaunching(app);
    const success = await launchHlsApp(app, m3u8Url, filename, referer, userAgent);
    setLaunching(null);
    if (success) {
      onClose();
    } else {
      // App was detected as installed but intent failed — offer Play Store
      await openPlayStore(APPS.find(a => a.id === app)!.pkg);
      onClose();
    }
  }, [m3u8Url, filename, referer, userAgent, onClose]);

  const handleInstall = useCallback(async (pkg: string) => {
    await openPlayStore(pkg);
    onClose();
  }, [onClose]);

  // Don't render if auto-launching
  if (!visible) return null;
  if (!checked || onlyOne) {
    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <ActivityIndicator color={Colors.dark.accentLight} size="large" />
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>

          {/* Header */}
          <Text style={styles.title}>
            {neitherInstalled ? t('hls_chooser_title_install') : t('hls_chooser_title_pick')}
          </Text>
          <Text style={styles.subtitle}>
            {neitherInstalled
              ? t('hls_chooser_subtitle_install')
              : t('hls_chooser_subtitle_pick')}
          </Text>

          {/* App rows */}
          {APPS.map(app => {
            const isInstalled = installed[app.id];
            const isLaunching = launching === app.id;

            return (
              <TouchableOpacity
                key={app.id}
                style={[styles.appRow, {borderColor: `${app.accentColor}30`}]}
                activeOpacity={0.75}
                onPress={() =>
                  isInstalled
                    ? handleLaunch(app.id)
                    : handleInstall(app.pkg)
                }
              >
                {/* Icon */}
                <Image source={app.icon} style={styles.appIcon} />

                {/* Labels */}
                <View style={styles.appInfo}>
                  <Text style={styles.appLabel}>{app.label}</Text>
                  <Text style={styles.appSublabel}>{app.sublabel}</Text>
                  <Text style={[styles.appSize, {color: app.accentColor}]}>
                    {app.size}
                  </Text>
                </View>

                {/* Action badge */}
                <View style={[
                  styles.actionBadge,
                  {backgroundColor: isInstalled ? `${app.accentColor}20` : `${Colors.dark.primary}15`},
                ]}>
                  {isLaunching ? (
                    <ActivityIndicator size="small" color={app.accentColor} />
                  ) : (
                    <Text style={[
                      styles.actionText,
                      {color: isInstalled ? app.accentColor : Colors.dark.primary},
                    ]}>
                      {isInstalled ? t('hls_chooser_open') : t('hls_chooser_install')}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Cancel */}
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.cancelText}>{t('cancel')}</Text>
          </TouchableOpacity>

        </Pressable>
      </Pressable>
    </Modal>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  title: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Rubik',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    color: Colors.dark.textMuted,
    fontSize: 12,
    fontFamily: 'Rubik',
    textAlign: 'center',
    marginBottom: 20,
  },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surfaceLight,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  appIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    marginEnd: 14,
  },
  appInfo: {
    flex: 1,
  },
  appLabel: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'Rubik',
  },
  appSublabel: {
    color: Colors.dark.textSecondary,
    fontSize: 11,
    fontFamily: 'Rubik',
    marginTop: 1,
  },
  appSize: {
    fontSize: 11,
    fontFamily: 'Rubik',
    fontWeight: '600',
    marginTop: 3,
  },
  actionBadge: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Rubik',
  },
  cancelBtn: {
    marginTop: 6,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
  },
  cancelText: {
    color: Colors.dark.textMuted,
    fontSize: 13,
    fontFamily: 'Rubik',
  },
});

export default HlsAppChooserModal;
