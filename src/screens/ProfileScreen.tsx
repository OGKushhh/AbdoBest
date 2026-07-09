/**
 * ProfileScreen.tsx
 * Opened from the profile row at the top of SettingsScreen.
 * Shows avatar, display name, email, provider badge, and sign-out.
 *
 * Editable app-level profile (name/gender/genres/avatar) lives on the
 * backend under /data/users/{uid}.json's "profile" key — see
 * profileService.ts and app.py. This is distinct from Firebase Auth's
 * displayName/photoURL (only populated for Google/Facebook); the backend
 * profile values take precedence when set, so email/guest accounts (which
 * have neither) get a way to set a name and picture too.
 */

import React, {useState, useCallback, useEffect} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  Alert, ActivityIndicator, ScrollView, TextInput, Modal,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import {useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {launchImageLibrary} from 'react-native-image-picker';
import {useTheme} from '../hooks/useTheme';
import {signOut, AbdoUser} from '../services/authService';
import {clearCollectionsCache} from '../services/favoritesService';
import {
  fetchProfile, updateProfile, uploadAvatar, avatarUrlFor,
  clearProfileCache, UserProfile,
} from '../services/profileService';
import {GENRE_EN_TO_AR, localizeGenre} from '../i18n/genres';

interface Props {
  route: {params: {user: AbdoUser}};
}

const ALL_GENRES = Object.keys(GENRE_EN_TO_AR);
const MAX_GENRES = 10;

export const ProfileScreen: React.FC<Props> = ({route}) => {
  const user = route.params?.user ?? null;
  const {colors}     = useTheme();
  const {t, i18n}    = useTranslation();
  const isAr         = i18n.language === 'ar';
  const navigation   = useNavigation<any>();
  const [signingOut, setSigningOut] = useState(false);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarBust, setAvatarBust] = useState(0); // cache-bust the avatar <Image> after a new upload

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName]       = useState('');
  const [editGender, setEditGender]   = useState<UserProfile['gender']>('');
  const [editGenres, setEditGenres]   = useState<string[]>([]);
  const [saving, setSaving]           = useState(false);

  useEffect(() => {
    if (!user || user.isGuest) return;
    fetchProfile().then(setProfile).catch(() => {});
  }, [user?.uid]);

  const providerLabel = !user ? t('sign_in') : user.isGuest
    ? t('profile_guest')
    : user.email?.includes('facebook')
    ? 'Facebook'
    : 'Google';

  const providerColor = user?.isGuest ? colors.textMuted : colors.primary;

  const displayName = profile?.name || user?.displayName || null;
  const avatarUri = profile?.avatar
    ? `${avatarUrlFor(user?.uid)}?v=${avatarBust}`
    : user?.photoURL || null;

  const handleSignOut = useCallback(() => {
    Alert.alert(
      t('profile_signout_title'),
      t('profile_signout_body'),
      [
        {text: t('cancel'), style: 'cancel'},
        {
          text: t('profile_signout_confirm'),
          style: 'destructive',
          onPress: async () => {
            setSigningOut(true);
            try {
              await clearCollectionsCache();
              await clearProfileCache();
              await signOut();
              navigation.goBack();
            } catch (e) {
              Alert.alert(t('error'), t('profile_signout_error'));
            } finally {
              setSigningOut(false);
            }
          },
        },
      ],
    );
  }, [navigation, t]);

  const handleChangeAvatar = useCallback(async () => {
    if (!user || user.isGuest) return;
    const result = await launchImageLibrary({mediaType: 'photo', quality: 0.9});
    if (result.didCancel || !result.assets?.[0]?.uri) return;

    setAvatarUploading(true);
    try {
      await uploadAvatar(result.assets[0].uri);
      setProfile(prev => prev ? {...prev, avatar: 'set'} : prev);
      setAvatarBust(b => b + 1); // force the <Image> to reload past any cache
    } catch (e) {
      Alert.alert(t('error'), t('avatar_upload_failed'));
    } finally {
      setAvatarUploading(false);
    }
  }, [user, t]);

  const openEditModal = useCallback(() => {
    setEditName(profile?.name || user?.displayName || '');
    setEditGender(profile?.gender || '');
    setEditGenres(profile?.genres || []);
    setShowEditModal(true);
  }, [profile, user]);

  const toggleGenre = useCallback((g: string) => {
    setEditGenres(prev => {
      if (prev.includes(g)) return prev.filter(x => x !== g);
      if (prev.length >= MAX_GENRES) return prev;
      return [...prev, g];
    });
  }, []);

  const handleSaveProfile = useCallback(async () => {
    setSaving(true);
    try {
      const updated = await updateProfile({
        name: editName.trim(),
        gender: editGender,
        genres: editGenres,
      });
      setProfile(updated);
      setShowEditModal(false);
    } catch (e) {
      Alert.alert(t('error'), t('profile_save_failed'));
    } finally {
      setSaving(false);
    }
  }, [editName, editGender, editGenres, t]);

  const initials = displayName
    ? displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <SafeAreaView edges={['bottom']} style={{flex: 1}}>
        <ScrollView showsVerticalScrollIndicator={false}>

          {/* ── Header ── */}
          <LinearGradient
            colors={['#E53935', '#FF6D00']}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 0}}
            style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <Image
                source={require('../../assets/icons/chevron-down.png')}
                style={[styles.backIcon, {tintColor: '#fff'}]}
              />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t('profile')}</Text>
            <View style={{width: 40}} />
          </LinearGradient>

          {/* ── Avatar + name ── */}
          <View style={styles.avatarSection}>
            <TouchableOpacity
              onPress={handleChangeAvatar}
              disabled={!user || user.isGuest || avatarUploading}
              activeOpacity={0.8}
              style={styles.avatarTouchable}
            >
              {avatarUri ? (
                <Image source={{uri: avatarUri}} style={styles.avatar} />
              ) : (
                <LinearGradient colors={['#E53935', '#FF6D00']} style={styles.avatarFallback}>
                  <Text style={styles.avatarInitials}>{initials}</Text>
                </LinearGradient>
              )}
              {avatarUploading && (
                <View style={styles.avatarUploadOverlay}>
                  <ActivityIndicator color="#fff" size="small" />
                </View>
              )}
              {user && !user.isGuest && !avatarUploading && (
                <View style={[styles.avatarEditBadge, {borderColor: colors.background}]}>
                  <Image source={require('../../assets/icons/setting.png')} style={styles.avatarEditIcon} />
                </View>
              )}
            </TouchableOpacity>

            <Text style={[styles.displayName, {color: colors.text}]}>
              {displayName ?? t('profile_guest')}
            </Text>
            {user?.email ? (
              <Text style={[styles.email, {color: colors.textMuted}]}>{user.email}</Text>
            ) : null}
            <View style={[styles.providerBadge, {backgroundColor: `${providerColor}20`}]}>
              <Text style={[styles.providerText, {color: providerColor}]}>{providerLabel}</Text>
            </View>

            {user && !user.isGuest && (
              <TouchableOpacity style={[styles.editBtn, {borderColor: colors.border}]} onPress={openEditModal}>
                <Text style={[styles.editBtnText, {color: colors.text}]}>{t('profile_edit')}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Personal info (read-only summary) ── */}
          {user && !user.isGuest && (profile?.gender || (profile?.genres?.length ?? 0) > 0) && (
            <View style={[styles.section, {backgroundColor: colors.surface, borderColor: colors.border}]}>
              {profile?.gender ? (
                <View style={styles.row}>
                  <Text style={[styles.rowLabel, {color: colors.textMuted}]}>{t('profile_gender')}</Text>
                  <Text style={[styles.rowValue, {color: colors.text}]}>{t(`gender_${profile.gender}`)}</Text>
                </View>
              ) : null}
              {profile?.genres && profile.genres.length > 0 ? (
                <View style={[styles.row, styles.rowLast, {flexWrap: 'wrap'}]}>
                  <Text style={[styles.rowLabel, {color: colors.textMuted}]}>{t('profile_genres')}</Text>
                  <Text style={[styles.rowValue, {color: colors.text}]} numberOfLines={2}>
                    {profile.genres.map(g => localizeGenre(g, isAr ? 'ar' : 'en')).join(isAr ? '، ' : ', ')}
                  </Text>
                </View>
              ) : null}
            </View>
          )}

          {/* ── Info section ── */}
          <View style={[styles.section, {backgroundColor: colors.surface, borderColor: colors.border}]}>
            <View style={styles.row}>
              <Text style={[styles.rowLabel, {color: colors.textMuted}]}>{t('profile_uid')}</Text>
              <Text
                style={[styles.rowValue, {color: colors.text}]}
                numberOfLines={1}
                selectable={true}>
                {user?.uid?.slice(0, 16)}…
              </Text>
            </View>
            <View style={[styles.row, styles.rowLast]}>
              <Text style={[styles.rowLabel, {color: colors.textMuted}]}>{t('profile_account_type')}</Text>
              <Text style={[styles.rowValue, {color: colors.text}]}>{providerLabel}</Text>
            </View>
          </View>

          {/* ── Sign out / Sign in ── */}
          {user ? (
            <TouchableOpacity
              style={[styles.signOutBtn, {backgroundColor: 'rgba(229,57,53,0.12)', borderColor: '#E53935'}]}
              onPress={handleSignOut}
              disabled={signingOut}
              activeOpacity={0.75}>
              {signingOut ? (
                <ActivityIndicator size="small" color="#E53935" />
              ) : (
                <Text style={styles.signOutText}>{t('profile_signout')}</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.signOutBtn, {backgroundColor: 'rgba(229,57,53,0.12)', borderColor: '#E53935'}]}
              onPress={() => navigation.navigate('SignIn')}
              activeOpacity={0.75}>
              <Text style={styles.signOutText}>{t('sign_in')}</Text>
            </TouchableOpacity>
          )}

        </ScrollView>
      </SafeAreaView>

      {/* ── Edit Profile modal ── */}
      <Modal visible={showEditModal} transparent animationType="slide" onRequestClose={() => setShowEditModal(false)}>
        <View style={styles.editOverlay}>
          <View style={[styles.editSheet, {backgroundColor: colors.surface}]}>
            <View style={styles.editHeader}>
              <Text style={[styles.editTitle, {color: colors.text}]}>{t('profile_edit')}</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Image source={require('../../assets/icons/close.png')} style={[styles.editCloseIcon, {tintColor: colors.textMuted}]} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={[styles.editLabel, {color: colors.textMuted}]}>{t('profile_name')}</Text>
              <TextInput
                style={[styles.editInput, {color: colors.text, borderColor: colors.border, backgroundColor: colors.background}]}
                value={editName}
                onChangeText={setEditName}
                placeholder={t('profile_name_placeholder')}
                placeholderTextColor={colors.textMuted}
                maxLength={40}
              />

              <Text style={[styles.editLabel, {color: colors.textMuted}]}>{t('profile_gender')}</Text>
              <View style={styles.chipsWrap}>
                {(['male', 'female', 'other'] as const).map(g => {
                  const active = editGender === g;
                  return (
                    <TouchableOpacity
                      key={g}
                      style={[styles.chip, {borderColor: colors.border, backgroundColor: colors.background}, active && styles.chipActive]}
                      onPress={() => setEditGender(active ? '' : g)}
                    >
                      <Text style={[styles.chipText, {color: colors.textSecondary}, active && styles.chipTextActive]}>
                        {t(`gender_${g}`)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.editLabel, {color: colors.textMuted}]}>{t('profile_genres')}</Text>
              <Text style={[styles.editHint, {color: colors.textMuted}]}>{t('profile_genres_hint')}</Text>
              <View style={styles.chipsWrap}>
                {ALL_GENRES.map(g => {
                  const active = editGenres.includes(g);
                  return (
                    <TouchableOpacity
                      key={g}
                      style={[styles.chip, {borderColor: colors.border, backgroundColor: colors.background}, active && styles.chipActive]}
                      onPress={() => toggleGenre(g)}
                    >
                      <Text style={[styles.chipText, {color: colors.textSecondary}, active && styles.chipTextActive]}>
                        {localizeGenre(g, isAr ? 'ar' : 'en')}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProfile} disabled={saving} activeOpacity={0.85}>
              {saving ? <ActivityIndicator color="#fff" size="small" /> : (
                <Text style={styles.saveBtnText}>{t('profile_save')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container:     {flex: 1},
  header:        {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingBottom: 20, paddingHorizontal: 16},
  headerTitle:   {fontSize: 20, fontWeight: '700', color: '#fff', fontFamily: 'Rubik-Bold'},
  backBtn:       {width: 40, height: 40, justifyContent: 'center'},
  backIcon:      {width: 20, height: 20, transform: [{rotate: '90deg'}]},
  avatarSection: {alignItems: 'center', paddingVertical: 32},
  avatarTouchable: {marginBottom: 14},
  avatar:        {width: 96, height: 96, borderRadius: 48},
  avatarFallback:{width: 96, height: 96, borderRadius: 48, justifyContent: 'center', alignItems: 'center'},
  avatarInitials:{fontSize: 34, fontWeight: '700', color: '#fff', fontFamily: 'Rubik-Bold'},
  avatarUploadOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 48, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarEditBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#E53935', borderWidth: 3,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarEditIcon: {width: 14, height: 14, tintColor: '#fff'},
  displayName:   {fontSize: 22, fontWeight: '700', fontFamily: 'Rubik-Bold', marginBottom: 4},
  email:         {fontSize: 14, fontFamily: 'Rubik', marginBottom: 10},
  providerBadge: {borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 14},
  providerText:  {fontSize: 13, fontWeight: '600', fontFamily: 'Rubik'},
  editBtn:       {borderWidth: 1, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 8},
  editBtnText:   {fontSize: 13, fontWeight: '600', fontFamily: 'Rubik'},
  section:       {marginHorizontal: 16, marginBottom: 24, borderRadius: 16, borderWidth: 1, overflow: 'hidden'},
  row:           {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)'},
  rowLast:       {borderBottomWidth: 0},
  rowLabel:      {fontSize: 13, fontFamily: 'Rubik'},
  rowValue:      {fontSize: 13, fontFamily: 'Rubik', maxWidth: '60%', textAlign: 'right'},
  signOutBtn:    {marginHorizontal: 16, marginTop: 8, paddingVertical: 16, borderRadius: 14, borderWidth: 1, alignItems: 'center'},
  signOutText:   {fontSize: 16, fontWeight: '700', color: '#E53935', fontFamily: 'Rubik-Bold'},

  // Edit modal
  editOverlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end'},
  editSheet: {borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%'},
  editHeader: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16},
  editTitle: {fontSize: 18, fontWeight: '700', fontFamily: 'Rubik-Bold'},
  editCloseIcon: {width: 20, height: 20},
  editLabel: {fontSize: 13, fontWeight: '600', fontFamily: 'Rubik', marginBottom: 8, marginTop: 14},
  editHint: {fontSize: 12, fontFamily: 'Rubik', marginBottom: 8, marginTop: -4},
  editInput: {
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, fontFamily: 'Rubik',
  },
  chipsWrap: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  chip: {paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1},
  chipActive: {borderColor: '#E53935', backgroundColor: 'rgba(229,57,53,0.15)'},
  chipText: {fontSize: 13, fontFamily: 'Rubik'},
  chipTextActive: {color: '#E53935', fontWeight: '700'},
  saveBtn: {backgroundColor: '#E53935', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20},
  saveBtnText: {color: '#fff', fontSize: 15, fontWeight: '700', fontFamily: 'Rubik-Bold'},
});
