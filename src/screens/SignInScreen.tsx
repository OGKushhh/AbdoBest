/**
 * SignInScreen.tsx
 * Dedicated sign-in screen with Google, Facebook, and Guest options.
 * Navigated to from ProfileScreen (when no user) or from the sign-in prompt.
 *
 * Accepts optional `onSuccess` callback via route params so the caller
 * can return the user to where they were after signing in.
 */

import React, {useState} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Image, ActivityIndicator, Alert, StatusBar,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import {useNavigation, useRoute} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {Colors} from '../theme/colors';
import {
  signInWithGoogle,
  signInWithFacebook,
  signInAsGuest,
  AbdoUser,
} from '../services/authService';
import {fetchCollections} from '../services/favoritesService';
import {initFCM} from '../services/fcmService';

// ─── Error messages ──────────────────────────────────────────────────────────
function getFriendlyError(e: any, provider: string): string {
  const msg = e?.message ?? '';
  if (msg.includes('cancelled') || msg.includes('canceled') || msg.includes('CANCELED')) {
    return ''; // user cancelled — silent
  }
  if (msg.includes('network') || msg.includes('Network')) {
    return 'No internet connection. Please try again.';
  }
  if (msg.includes('SIGN_IN_FAILED') || msg.includes('ApiException')) {
    return `${provider} sign-in failed. Make sure you have the app installed and try again.`;
  }
  if (msg.includes('account-exists-with-different-credential')) {
    return 'An account already exists with a different sign-in method.';
  }
  return `${provider} sign-in failed. Please try again.`;
}

// ─── Screen ──────────────────────────────────────────────────────────────────
export const SignInScreen: React.FC = () => {
  const {t}         = useTranslation();
  const navigation  = useNavigation<any>();
  const route       = useRoute<any>();

  // Optional callback passed by caller (e.g. from DetailsScreen prompt)
  const onSuccess: ((user: AbdoUser) => void) | undefined = route.params?.onSuccess;

  const [loading, setLoading] = useState<'google' | 'facebook' | 'guest' | null>(null);

  const handleSuccess = (user: AbdoUser) => {
    // Kick off background tasks
    fetchCollections().catch(() => {});
    initFCM().catch(() => {});

    if (onSuccess) {
      onSuccess(user);
      navigation.goBack();
    } else {
      // Default — go back to wherever came from
      navigation.goBack();
    }
  };

  const handleGoogle = async () => {
    setLoading('google');
    try {
      const user = await signInWithGoogle();
      handleSuccess(user);
    } catch (e: any) {
      const msg = getFriendlyError(e, 'Google');
      if (msg) Alert.alert('Sign In Failed', msg);
    } finally {
      setLoading(null);
    }
  };

  const handleFacebook = async () => {
    setLoading('facebook');
    try {
      const user = await signInWithFacebook();
      handleSuccess(user);
    } catch (e: any) {
      const msg = getFriendlyError(e, 'Facebook');
      if (msg) Alert.alert('Sign In Failed', msg);
    } finally {
      setLoading(null);
    }
  };

  const handleGuest = async () => {
    setLoading('guest');
    try {
      const user = await signInAsGuest();
      handleSuccess(user);
    } catch (e: any) {
      Alert.alert('Error', 'Could not continue as guest. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const isAnyLoading = loading !== null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Gradient header */}
      <LinearGradient
        colors={['#E53935', '#FF6D00']}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}
        style={styles.header}>
        <SafeAreaView edges={['top']}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Image
              source={require('../../assets/icons/chevron-down.png')}
              style={styles.backIcon}
            />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Image
              source={require('../../assets/icons/heart.png')}
              style={styles.headerIcon}
            />
            <Text style={styles.headerTitle}>{t('sign_in')}</Text>
            <Text style={styles.headerSubtitle}>{t('sign_in_subtitle')}</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Buttons */}
      <SafeAreaView edges={['bottom']} style={styles.body}>

        {/* Google */}
        <TouchableOpacity
          style={[styles.btn, styles.btnGoogle]}
          onPress={handleGoogle}
          disabled={isAnyLoading}
          activeOpacity={0.8}>
          {loading === 'google' ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Image
                source={require('../../assets/icons/google.png')}
                style={[styles.btnIcon, {tintColor: undefined}]}
              />
              <Text style={[styles.btnText, {color: '#1a1a1a'}]}>{t('sign_in_google')}</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Facebook */}
        <TouchableOpacity
          style={[styles.btn, styles.btnFacebook]}
          onPress={handleFacebook}
          disabled={isAnyLoading}
          activeOpacity={0.8}>
          {loading === 'facebook' ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Image
                source={require('../../assets/icons/facebook.png')}
                style={styles.btnIcon}
              />
              <Text style={styles.btnText}>{t('sign_in_facebook')}</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t('or')}</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Guest */}
        <TouchableOpacity
          style={[styles.btn, styles.btnGuest]}
          onPress={handleGuest}
          disabled={isAnyLoading}
          activeOpacity={0.8}>
          {loading === 'guest' ? (
            <ActivityIndicator color={Colors.dark.text} />
          ) : (
            <Text style={[styles.btnText, {color: Colors.dark.text}]}>{t('continue_as_guest')}</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.disclaimer}>{t('sign_in_disclaimer')}</Text>
      </SafeAreaView>
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:       {flex: 1, backgroundColor: Colors.dark.background},
  header:          {paddingBottom: 40},
  backBtn:         {padding: 16, alignSelf: 'flex-start'},
  backIcon:        {width: 22, height: 22, tintColor: '#fff', transform: [{rotate: '90deg'}]},
  headerContent:   {alignItems: 'center', paddingHorizontal: 24, paddingBottom: 8},
  headerIcon:      {width: 48, height: 48, tintColor: 'rgba(255,255,255,0.9)', marginBottom: 12},
  headerTitle:     {fontSize: 28, fontWeight: '700', color: '#fff', fontFamily: 'Rubik-Bold', marginBottom: 8},
  headerSubtitle:  {fontSize: 15, color: 'rgba(255,255,255,0.8)', fontFamily: 'Rubik', textAlign: 'center', lineHeight: 22},
  body:            {flex: 1, paddingHorizontal: 24, paddingTop: 32},
  btn:             {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 54, borderRadius: 14, marginBottom: 14},
  btnGoogle:       {backgroundColor: '#fff'},
  btnFacebook:     {backgroundColor: '#1877F2'},
  btnGuest:        {backgroundColor: Colors.dark.surface, borderWidth: 1, borderColor: Colors.dark.border},
  btnIcon:         {width: 22, height: 22, tintColor: '#fff', marginRight: 10},
  btnText:         {fontSize: 16, fontWeight: '600', color: '#fff', fontFamily: 'Rubik'},
  divider:         {flexDirection: 'row', alignItems: 'center', marginVertical: 8, marginBottom: 14},
  dividerLine:     {flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: Colors.dark.border},
  dividerText:     {marginHorizontal: 12, fontSize: 13, color: Colors.dark.textMuted, fontFamily: 'Rubik'},
  disclaimer:      {fontSize: 12, color: Colors.dark.textMuted, textAlign: 'center', lineHeight: 18, marginTop: 16, fontFamily: 'Rubik'},
});
