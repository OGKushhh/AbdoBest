import React, { useState, useMemo, useCallback } from 'react';
import {
  View, StyleSheet, Text, TouchableOpacity, Switch,
  Linking, ActivityIndicator, Image, ScrollView, Modal,
  Dimensions, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { useTranslation } from 'react-i18next';
import { getSettings, saveSettings } from '../storage';
import { clearAllMetadataCache } from '../storage/cache';
import { getLastSyncTime, clearRuntimeCache } from '../services/metadataService';
import { CacheSyncInline, useCacheSync } from '../components/CacheSyncOverlay';
import { checkForUpdate, openUpdateUrl, skipVersion } from '../services/updateService';
import { APP_VERSION } from '../constants/endpoints';
import { useTheme } from '../hooks/useTheme';
import { useNavigation } from '@react-navigation/native';
import { getPersistedUser, onAuthStateChanged, AbdoUser } from '../services/authService';
import { fetchProfile } from '../services/profileService';
import { useRewardAd, formatAdFreeRemaining } from '../ads/RewardAdPopup';
import { Colors } from '../theme/colors'; // for dark background etc. (fallback)

const { width: SW } = Dimensions.get('window');

// ─── Custom Modal (unchanged but stylish) ──────────────────────────────────
interface AppModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  colors: any;
}
const AppModal: React.FC<AppModalProps> = ({ visible, onClose, children, colors }) => (
  <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
    <TouchableOpacity
      style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }}
      activeOpacity={1}
      onPress={onClose}
    >
      <TouchableOpacity activeOpacity={1} onPress={() => {}}>
        <View style={{
          backgroundColor: colors.surface,
          borderRadius: 20,
          padding: 24,
          width: SW * 0.85,
          maxWidth: 360,
          borderWidth: 1,
          borderColor: colors.border,
          shadowColor: '#000',
          shadowOpacity: 0.4,
          shadowRadius: 20,
          elevation: 10,
        }}>
          {children}
        </View>
      </TouchableOpacity>
    </TouchableOpacity>
  </Modal>
);

// ─── Main Screen ───────────────────────────────────────────────────────────
export const SettingsScreen: React.FC = () => {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const insets = useSafeAreaInsets();
  const [settings, setSettings] = useState(getSettings());
  const navigation = useNavigation<any>();
  const [currentUser, setCurrentUser] = React.useState<AbdoUser | null>(null);
  const [profileName, setProfileName] = React.useState<string | null>(null);

  React.useEffect(() => {
    // One-time read so the UI has something to show immediately (no flash of
    // "signed out" while Firebase's listener below does its first callback),
    // then subscribe for real-time updates — this is what actually fixes
    // sign-in only showing up after an app restart: this screen is a tab
    // that stays mounted in the background, so a one-time read on mount
    // never notices a sign-in that happens later on a different screen.
    getPersistedUser().then(setCurrentUser);
    const unsubscribe = onAuthStateChanged(setCurrentUser);
    return unsubscribe;
  }, []);

  React.useEffect(() => {
    if (currentUser && !currentUser.isGuest) {
      fetchProfile().then(p => setProfileName(p.name || null)).catch(() => {});
    } else {
      setProfileName(null);
    }
  }, [currentUser?.uid]);

  const { rewardElement, triggerReward, adFreeActive, remainingMs } = useRewardAd();
  const { running: syncing, progress: syncProgress, start: startSync } = useCacheSync();

  // Modal states
  const [qualityModalVisible, setQualityModalVisible] = useState(false);
  const [cacheModalVisible, setCacheModalVisible] = useState(false);
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [dirModalVisible, setDirModalVisible] = useState(false);

  const [clearingCache, setClearingCache] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  const qualityOptions = ['auto', '1080', '720', '480', '360'];

  // ─── Unified settings updater ────────────────────────────────────────────
  const updateSetting = useCallback((key: string, value: any) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    saveSettings(updated);
  }, [settings]);

  const toggleLanguage = useCallback(() => {
    const newLang = settings.language === 'ar' ? 'en' : 'ar';
    updateSetting('language', newLang);
    i18n.changeLanguage(newLang);
  }, [settings.language, updateSetting, i18n]);

  const handleSync = useCallback(() => {
    // Clear runtime cache before force-sync so HomeScreen doesn't hold
    // stale category arrays while fresh data is being written to disk.
    // Without this, HomeScreen's categoryData state and the runtime cache
    // diverge — some categories show old data, some show new.
    clearRuntimeCache();
    startSync(true);
  }, [startSync]);

  const handleClearCacheConfirm = useCallback(async () => {
    setClearingCache(true);
    try { await clearAllMetadataCache(); } finally {
      setClearingCache(false);
      setCacheModalVisible(false);
    }
  }, []);

  const handleCheckUpdate = useCallback(async () => {
    setCheckingUpdate(true);
    try {
      const update = await checkForUpdate();
      setUpdateInfo(update);
      setUpdateModalVisible(true);
    } finally {
      setCheckingUpdate(false);
    }
  }, []);

  const lastSync = getLastSyncTime();
  const lastSyncText = lastSync ? new Date(lastSync).toLocaleDateString() : t('never');

  // ─── Styles (dynamic) ────────────────────────────────────────────────────
  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background || '#0F0F1A' },
    scrollContent: { paddingBottom: 50 },

    // Gradient Header Banner
    headerBanner: {
      paddingTop: insets.top + 14,
      paddingBottom: 18,
      paddingHorizontal: 20,
      borderBottomLeftRadius: 24,
      borderBottomRightRadius: 24,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      marginBottom: 16,
    },
    headerIconCircle: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: 'rgba(255,255,255,0.15)',
      justifyContent: 'center', alignItems: 'center',
    },
    headerIconImg: { width: 24, height: 24, tintColor: '#fff' },
    headerTextBlock: { flex: 1 },
    headerTitle: { fontSize: 24, fontWeight: '900', color: '#fff', letterSpacing: -0.5, fontFamily: 'Rubik', textAlign: isRTL ? 'right' : 'left' },
    headerVersion: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2, fontFamily: 'Rubik', textAlign: isRTL ? 'right' : 'left' },

    // Section
    section: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      marginHorizontal: 16,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    sectionTitle: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '700',
      fontFamily: 'Rubik',
      textTransform: 'uppercase',
      letterSpacing: 1.5,
      marginLeft: 20,
      marginBottom: 8,
      marginTop: 8,
    },

    // Row
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 15,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    rowLast: { borderBottomWidth: 0 },
    rowIcon: {
      width: 36, height: 36, borderRadius: 10,
      backgroundColor: `${colors.primary}18`,
      justifyContent: 'center', alignItems: 'center',
      marginRight: 14,
    },
    rowIconImg: { width: 18, height: 18, tintColor: colors.primary },
    rowContent: { flex: 1, minWidth: 0 },
    rowLabel: { fontSize: 15, fontWeight: '500', color: colors.text, fontFamily: 'Rubik' },
    rowSub: { fontSize: 12, color: colors.textMuted, marginTop: 2, fontFamily: 'Rubik' },
    rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    rowValue: { fontSize: 14, color: colors.textSecondary, fontFamily: 'Rubik' },
    rowChevron: { width: 18, height: 18, tintColor: colors.textMuted, transform: [{ rotate: '-90deg' }] },

    // Donate button — small badge, matching the Ko-fi button style used in the README
    donateBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      alignSelf: 'center',
      backgroundColor: '#72A4F2',
      borderRadius: 19,
      paddingVertical: 8, paddingHorizontal: 14,
      marginTop: 8, marginBottom: 40,
    },
    donateIconCircle: {
      width: 22, height: 22, borderRadius: 11,
      backgroundColor: '#fff',
      justifyContent: 'center', alignItems: 'center',
      marginRight: 8,
    },
    donateIcon: { fontSize: 12 },
    donateText: { color: '#202020', fontSize: 13, fontWeight: '800', fontFamily: 'Rubik' },

    // Modals
    modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 8, fontFamily: 'Rubik' },
    modalBody: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: 20, fontFamily: 'Rubik' },
    modalActions: { flexDirection: 'row', gap: 10 },
    modalBtnPrimary: { flex: 1, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
    modalBtnSecondary: { flex: 1, backgroundColor: colors.surfaceLight || 'rgba(255,255,255,0.08)', borderRadius: 12, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
    modalBtnTextPrimary: { color: '#fff', fontWeight: '700', fontSize: 15, fontFamily: 'Rubik' },
    modalBtnTextSecondary: { color: colors.text, fontWeight: '600', fontSize: 15, fontFamily: 'Rubik' },
    modalOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    modalOptionLast: { borderBottomWidth: 0 },
    modalOptionText: { fontSize: 15, color: colors.text, fontFamily: 'Rubik' },
    modalCheck: { width: 18, height: 18, tintColor: colors.primary },
    modalDivider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },

    // Update extras
    updateBadge: { alignSelf: 'flex-start', backgroundColor: `${colors.primary}20`, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 12 },
    updateBadgeText: { color: colors.primary, fontSize: 12, fontWeight: '700', fontFamily: 'Rubik' },
    changelogBox: { backgroundColor: colors.background || '#0F0F1A', borderRadius: 10, padding: 12, marginBottom: 16, maxHeight: 120 },
    changelogText: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, fontFamily: 'Rubik' },
  }), [colors, insets.top, isRTL]);

  // ─── Helper Row Component ──────────────────────────────────────────────────
  const SettingRow = ({ icon, label, sub, value, onPress, toggle, settingKey, last }: any) => {
    const isOn = settings[settingKey] ?? false;
    return (
      <TouchableOpacity
        style={[styles.row, last && styles.rowLast]}
        onPress={() => {
          if (toggle && settingKey) {
            updateSetting(settingKey, !settings[settingKey]);
          } else if (onPress) onPress();
        }}
        activeOpacity={0.65}
      >
        <View style={styles.rowIcon}>
          <Image source={icon} style={styles.rowIconImg} />
        </View>
        <View style={styles.rowContent}>
          <Text style={styles.rowLabel}>{label}</Text>
          {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
        </View>
        {toggle ? (
          <Switch
            value={isOn}
            onValueChange={(v) => updateSetting(settingKey, v)}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#fff"
          />
        ) : (
          <View style={styles.rowRight}>
            {value ? <Text style={styles.rowValue}>{value}</Text> : null}
            <Image source={require('../../assets/icons/chevron-down.png')} style={styles.rowChevron} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <SafeAreaView edges={['bottom']} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

          {/* ── Gradient Header Banner ── */}
          <LinearGradient
            colors={['#E53935', '#FF6D00']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.headerBanner}
          >
            <View style={styles.headerIconCircle}>
              <Image source={require('../../assets/icons/settings.png')} style={styles.headerIconImg} />
            </View>
            <View style={styles.headerTextBlock}>
              <Text style={styles.headerTitle}>{t('settings')}</Text>
              <Text style={styles.headerVersion}>v{APP_VERSION}</Text>
            </View>
          </LinearGradient>

          {/* ── Account / Profile ── */}
          <Text style={styles.sectionTitle}>{t('account')}</Text>
          <View style={styles.section}>
            <TouchableOpacity
              style={[styles.row, styles.rowLast]}
              onPress={() => {
                if (currentUser && !currentUser.isGuest) {
                  navigation.navigate('Profile', { user: currentUser });
                } else {
                  navigation.navigate('SignIn');
                }
              }}
              activeOpacity={0.65}>
              <View style={styles.rowIcon}>
                <Image source={require('../../assets/icons/account.png')} style={styles.rowIconImg} />
              </View>
              <View style={styles.rowContent}>
                <Text style={styles.rowLabel}>
                  {!currentUser
                    ? t('sign_in')
                    : currentUser.isGuest
                    ? t('profile_guest')
                    : profileName || currentUser.displayName || currentUser.email || t('profile')}
                </Text>
                <Text style={styles.rowSub}>
                  {currentUser ? (currentUser.isGuest ? t('profile_guest_sub') : currentUser.email ?? '') : t('profile_signin_hint')}
                </Text>
              </View>
              <Image source={require('../../assets/icons/chevron-down.png')} style={styles.rowChevron} />
            </TouchableOpacity>
          </View>

          {/* ── Appearance ── */}
          <Text style={styles.sectionTitle}>{t('appearance')}</Text>
          <View style={styles.section}>
            <SettingRow
              icon={require('../../assets/icons/planet-earth.png')}
              label={t('language')}
              value={settings.language === 'ar' ? t('arabic') : t('english')}
              onPress={toggleLanguage}
              last
            />
          </View>

          {/* ── Playback ── */}
          <Text style={styles.sectionTitle}>{t('playback')}</Text>
          <View style={styles.section}>
            <SettingRow
              icon={require('../../assets/icons/browsing.png')}
              label={t('mobile_data_warning')}
              settingKey="mobileDataWarning"
              toggle
            />
            <TouchableOpacity style={styles.row} onPress={() => setQualityModalVisible(true)} activeOpacity={0.65}>
              <View style={styles.rowIcon}>
                <Image source={require('../../assets/icons/setting.png')} style={styles.rowIconImg} />
              </View>
              <View style={styles.rowContent}>
                <Text style={styles.rowLabel}>{t('quality_preference')}</Text>
              </View>
              <View style={styles.rowRight}>
                <Text style={styles.rowValue}>{t(`quality_${settings.qualityPreference || 'auto'}`)}</Text>
                <Image source={require('../../assets/icons/chevron-down.png')} style={styles.rowChevron} />
              </View>
            </TouchableOpacity>
          </View>

          {/* ── Downloads ── */}
          <Text style={styles.sectionTitle}>{t('downloads_section')}</Text>
          <View style={styles.section}>
            {Platform.OS !== 'ios' && (
              <TouchableOpacity style={styles.row} onPress={() => setDirModalVisible(true)} activeOpacity={0.65}>
                <View style={styles.rowIcon}>
                  <Image source={require('../../assets/icons/download-to-storage-drive.png')} style={styles.rowIconImg} />
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.rowLabel}>{t('save_location')}</Text>
                  <Text style={styles.rowSub}>
                    {settings.downloadDir === 'internal' ? t('save_location_internal') : t('save_location_downloads')}
                  </Text>
                </View>
                <Image source={require('../../assets/icons/chevron-down.png')} style={styles.rowChevron} />
              </TouchableOpacity>
            )}
          </View>

          {/* ── Data ── */}
          <Text style={styles.sectionTitle}>{t('data')}</Text>
          <View style={styles.section}>
            <TouchableOpacity style={styles.row} onPress={handleSync} activeOpacity={0.65} disabled={syncing}>
              <View style={styles.rowIcon}>
                <Image source={require('../../assets/icons/sync.png')} style={styles.rowIconImg} />
              </View>
              <View style={styles.rowContent}>
                <Text style={styles.rowLabel}>{t('sync_database')}</Text>
                <Text style={styles.rowSub}>{t('last_sync')}: {lastSyncText}</Text>
              </View>
              {syncing ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Image source={require('../../assets/icons/chevron-down.png')} style={styles.rowChevron} />
              )}
            </TouchableOpacity>
            {syncing && (
              <CacheSyncInline progress={syncProgress} />
            )}
            <TouchableOpacity style={[styles.row, styles.rowLast]} onPress={() => setCacheModalVisible(true)} activeOpacity={0.65}>
              <View style={[styles.rowIcon, { backgroundColor: 'rgba(255,0,0,0.15)' }]}>
                <Image source={require('../../assets/icons/files.png')} style={[styles.rowIconImg, { tintColor: colors.error }]} />
              </View>
              <View style={styles.rowContent}>
                <Text style={[styles.rowLabel, { color: colors.error }]}>{t('clear_cache')}</Text>
              </View>
              <Image source={require('../../assets/icons/chevron-down.png')} style={styles.rowChevron} />
            </TouchableOpacity>
          </View>

          {/* ── About ── */}
          <Text style={styles.sectionTitle}>{t('about')}</Text>
          <View style={styles.section}>
            <TouchableOpacity style={[styles.row, styles.rowLast]} onPress={handleCheckUpdate} activeOpacity={0.65} disabled={checkingUpdate}>
              <View style={styles.rowIcon}>
                <Image source={require('../../assets/icons/download-to-storage-drive.png')} style={styles.rowIconImg} />
              </View>
              <View style={styles.rowContent}>
                <Text style={styles.rowLabel}>{t('check_for_updates')}</Text>
                <Text style={styles.rowSub}>{t('current_version')}: v{APP_VERSION}</Text>
              </View>
              {checkingUpdate ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Image source={require('../../assets/icons/chevron-down.png')} style={styles.rowChevron} />
              )}
            </TouchableOpacity>
          </View>

          {/* ── Ads ── */}
          <Text style={styles.sectionTitle}>{t('ads_section')}</Text>
          <View style={styles.section}>
            <TouchableOpacity
              style={[styles.row, styles.rowLast]}
              onPress={adFreeActive ? undefined : triggerReward}
              activeOpacity={adFreeActive ? 1 : 0.65}
            >
              <View style={[styles.rowIcon, adFreeActive && { backgroundColor: 'rgba(76,175,80,0.15)' }]}>
                <Text style={{ fontSize: 18 }}>{adFreeActive ? '✅' : '🎬'}</Text>
              </View>
              <View style={styles.rowContent}>
                <Text style={styles.rowLabel}>
                  {adFreeActive ? t('ad_free_active') : t('disable_ads')}
                </Text>
                <Text style={styles.rowSub}>
                  {adFreeActive
                    ? t('ad_free_expires', { time: formatAdFreeRemaining(remainingMs) })
                    : t('ad_free_watch_prompt')}
                </Text>
              </View>
              {!adFreeActive && (
                <Image source={require('../../assets/icons/chevron-down.png')} style={styles.rowChevron} />
              )}
            </TouchableOpacity>
          </View>

          {/* ── Support ── */}
          <Text style={styles.sectionTitle}>{t('support_us')}</Text>
          <TouchableOpacity
            style={styles.donateBtn}
            onPress={() => Linking.openURL('https://ko-fi.com/abdobest')}
            activeOpacity={0.8}
          >
            <View style={styles.donateIconCircle}>
              <Text style={styles.donateIcon}>☕</Text>
            </View>
            <Text style={styles.donateText}>Support me on Ko-fi</Text>
          </TouchableOpacity>

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>

      {/* ── Download Dir Modal ── */}
      <AppModal visible={dirModalVisible} onClose={() => setDirModalVisible(false)} colors={colors}>
        <Text style={styles.modalTitle}>{t('save_location_modal_title')}</Text>
        <Text style={styles.modalBody}>{t('save_location_modal_body')}</Text>
        {[
          { value: 'downloads', label: t('save_location_opt_downloads_label'), sub: t('save_location_opt_downloads_sub') },
          { value: 'internal',  label: t('save_location_opt_internal_label'),  sub: t('save_location_opt_internal_sub') },
        ].map((opt, i, arr) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.modalOption, i === arr.length - 1 && styles.modalOptionLast]}
            onPress={() => { updateSetting('downloadDir', opt.value); setDirModalVisible(false); }}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.modalOptionText, settings.downloadDir === opt.value && { color: colors.primary, fontWeight: '700' }]}>
                {opt.label}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>{opt.sub}</Text>
            </View>
            {settings.downloadDir === opt.value && (
              <Image source={require('../../assets/icons/checkmark.png')} style={styles.modalCheck} />
            )}
          </TouchableOpacity>
        ))}
      </AppModal>

      {/* ── Quality Modal ── */}
      <AppModal visible={qualityModalVisible} onClose={() => setQualityModalVisible(false)} colors={colors}>
        <Text style={styles.modalTitle}>{t('select_quality')}</Text>
        <View style={styles.modalDivider} />
        {qualityOptions.map((q, i, arr) => (
          <TouchableOpacity
            key={q}
            style={[styles.modalOption, i === arr.length - 1 && styles.modalOptionLast]}
            onPress={() => { updateSetting('qualityPreference', q); setQualityModalVisible(false); }}
          >
            <Text style={[styles.modalOptionText, settings.qualityPreference === q && { color: colors.primary, fontWeight: '700' }]}>
              {t(`quality_${q}`)}
            </Text>
            {settings.qualityPreference === q && (
              <Image source={require('../../assets/icons/checkmark.png')} style={styles.modalCheck} />
            )}
          </TouchableOpacity>
        ))}
      </AppModal>

      {/* ── Clear Cache Modal ── */}
      <AppModal visible={cacheModalVisible} onClose={() => setCacheModalVisible(false)} colors={colors}>
        <Text style={styles.modalTitle}>{t('clear_cache')}</Text>
        <Text style={styles.modalBody}>{t('clear_cache_confirm')}</Text>
        <View style={styles.modalActions}>
          <TouchableOpacity style={styles.modalBtnSecondary} onPress={() => setCacheModalVisible(false)}>
            <Text style={styles.modalBtnTextSecondary}>{t('cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modalBtnPrimary, { backgroundColor: colors.error }]}
            onPress={handleClearCacheConfirm}
            disabled={clearingCache}
          >
            {clearingCache ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalBtnTextPrimary}>{t('clear_cache')}</Text>}
          </TouchableOpacity>
        </View>
      </AppModal>

      {/* ── Update Modal ── */}
      <AppModal visible={updateModalVisible} onClose={() => setUpdateModalVisible(false)} colors={colors}>
        {updateInfo ? (
          <>
            <View style={styles.updateBadge}>
              <Text style={styles.updateBadgeText}>v{updateInfo.version} {t('latest_version')}</Text>
            </View>
            <Text style={styles.modalTitle}>{t('update_available')}</Text>
            <Text style={styles.modalBody}>{t('update_description')}</Text>
            {updateInfo.changelog ? (
              <ScrollView style={styles.changelogBox} showsVerticalScrollIndicator={false}>
                <Text style={styles.changelogText}>{updateInfo.changelog}</Text>
              </ScrollView>
            ) : null}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtnSecondary}
                onPress={() => { skipVersion(updateInfo.version); setUpdateModalVisible(false); }}
              >
                <Text style={styles.modalBtnTextSecondary}>{t('skip_version')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalBtnPrimary}
                onPress={() => { openUpdateUrl(updateInfo.downloadUrl); setUpdateModalVisible(false); }}
              >
                <Text style={styles.modalBtnTextPrimary}>{t('download_update')}</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.modalTitle}>{t('up_to_date')}</Text>
            <Text style={styles.modalBody}>v{APP_VERSION}</Text>
            <TouchableOpacity style={styles.modalBtnPrimary} onPress={() => setUpdateModalVisible(false)}>
              <Text style={styles.modalBtnTextPrimary}>{t('ok')}</Text>
            </TouchableOpacity>
          </>
        )}
      </AppModal>

      {/* Reward ad popup */}
      {rewardElement}
    </View>
  );
};