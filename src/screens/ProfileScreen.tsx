/**
 * ProfileScreen.tsx
 * Opened from the profile row at the top of SettingsScreen.
 * Shows avatar, display name, email, provider badge, and sign-out.
 */

import React, {useState, useCallback} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import {useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {useTheme} from '../hooks/useTheme';
import {signOut, AbdoUser} from '../services/authService';
import {clearCollectionsCache} from '../services/favoritesService';

interface Props {
  route: {params: {user: AbdoUser}};
}

export const ProfileScreen: React.FC<Props> = ({route}) => {
  const user = route.params?.user ?? null;
  const {colors}     = useTheme();
  const {t}          = useTranslation();
  const navigation   = useNavigation<any>();
  const [signingOut, setSigningOut] = useState(false);

  const providerLabel = !user ? t('sign_in') : user.isGuest
    ? t('profile_guest')
    : user.email?.includes('facebook')
    ? 'Facebook'
    : 'Google';

  const providerColor = user.isGuest ? colors.textMuted : colors.primary;

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
              await signOut();
              // Go back to Settings — AuthContext in App.tsx will handle
              // redirecting to login screen if needed
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

  const initials = user?.displayName
    ? user.displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
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
            {user.photoURL ? (
              <Image source={{uri: user.photoURL}} style={styles.avatar} />
            ) : (
              <LinearGradient
                colors={['#E53935', '#FF6D00']}
                style={styles.avatarFallback}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </LinearGradient>
            )}
            <Text style={[styles.displayName, {color: colors.text}]}>
              {user.displayName ?? t('profile_guest')}
            </Text>
            {user.email ? (
              <Text style={[styles.email, {color: colors.textMuted}]}>{user.email}</Text>
            ) : null}
            <View style={[styles.providerBadge, {backgroundColor: `${providerColor}20`}]}>
              <Text style={[styles.providerText, {color: providerColor}]}>
                {providerLabel}
              </Text>
            </View>
          </View>

          {/* ── Info section ── */}
          <View style={[styles.section, {backgroundColor: colors.surface, borderColor: colors.border}]}>
            <View style={styles.row}>
              <Text style={[styles.rowLabel, {color: colors.textMuted}]}>{t('profile_uid')}</Text>
              <Text style={[styles.rowValue, {color: colors.text}]} numberOfLines={1}>
                {user.uid.slice(0, 16)}…
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
  avatar:        {width: 96, height: 96, borderRadius: 48, marginBottom: 14},
  avatarFallback:{width: 96, height: 96, borderRadius: 48, marginBottom: 14, justifyContent: 'center', alignItems: 'center'},
  avatarInitials:{fontSize: 34, fontWeight: '700', color: '#fff', fontFamily: 'Rubik-Bold'},
  displayName:   {fontSize: 22, fontWeight: '700', fontFamily: 'Rubik-Bold', marginBottom: 4},
  email:         {fontSize: 14, fontFamily: 'Rubik', marginBottom: 10},
  providerBadge: {borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4},
  providerText:  {fontSize: 13, fontWeight: '600', fontFamily: 'Rubik'},
  section:       {marginHorizontal: 16, marginBottom: 24, borderRadius: 16, borderWidth: 1, overflow: 'hidden'},
  row:           {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)'},
  rowLast:       {borderBottomWidth: 0},
  rowLabel:      {fontSize: 13, fontFamily: 'Rubik'},
  rowValue:      {fontSize: 13, fontFamily: 'Rubik', maxWidth: '60%', textAlign: 'right'},
  signOutBtn:    {marginHorizontal: 16, marginTop: 8, paddingVertical: 16, borderRadius: 14, borderWidth: 1, alignItems: 'center'},
  signOutText:   {fontSize: 16, fontWeight: '700', color: '#E53935', fontFamily: 'Rubik-Bold'},
});
