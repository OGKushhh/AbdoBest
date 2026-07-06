import React, {useState} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {Colors} from '../theme/colors';
import {AuthHeader} from '../components/AuthHeader';
import {signInWithGoogle, signInWithFacebook, signInAsGuest, AbdoUser} from '../services/authService';
import {fetchCollections} from '../services/favoritesService';
import {initFCM} from '../services/fcmService';

export function getFriendlyError(e: any, provider: string): string {
  const msg = (e?.message ?? '') + (e?.code ?? '');
  if (msg.includes('cancelled') || msg.includes('canceled') || msg.includes('CANCELED')) return '';
  if (msg.includes('network') || msg.includes('Network')) return 'لا يوجد اتصال بالإنترنت. حاول مرة أخرى.';
  if (msg.includes('user-not-found') || msg.includes('wrong-password') || msg.includes('invalid-credential'))
    return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
  if (msg.includes('email-already-in-use')) return 'هذا البريد الإلكتروني مستخدم بالفعل.';
  if (msg.includes('weak-password')) return 'كلمة المرور ضعيفة جداً. استخدم 6 أحرف على الأقل.';
  if (msg.includes('invalid-email')) return 'البريد الإلكتروني غير صالح.';
  if (msg.includes('invalid-phone') || msg.includes('invalid-verification-code')) return 'رمز التحقق غير صحيح.';
  if (msg.includes('too-many-requests')) return 'طلبات كثيرة جداً. حاول لاحقاً.';
  if (msg.includes('SIGN_IN_FAILED') || msg.includes('ApiException'))
    return `فشل تسجيل الدخول عبر ${provider}. حاول مرة أخرى.`;
  return `فشل تسجيل الدخول. حاول مرة أخرى.`;
}

/** Shared post-auth wiring, used here and by EmailSignInScreen / PhoneSignInScreen. */
export function useAuthSuccess(onSuccess?: (user: AbdoUser) => void) {
  const navigation = useNavigation<any>();
  return (user: AbdoUser) => {
    fetchCollections().catch(() => {});
    initFCM().catch(() => {});
    if (onSuccess) onSuccess(user);
    navigation.goBack();
  };
}

export const SignInScreen: React.FC = () => {
  const {t}         = useTranslation();
  const navigation  = useNavigation<any>();
  const route       = useRoute<any>();
  const onSuccess: ((user: AbdoUser) => void) | undefined = route.params?.onSuccess;

  const [loading, setLoading] = useState<string | null>(null);
  const isAnyLoading = loading !== null;
  const handleSuccess = useAuthSuccess(onSuccess);

  const handleGoogle = async () => {
    setLoading('google');
    try { handleSuccess(await signInWithGoogle()); }
    catch (e: any) { const m = getFriendlyError(e, 'Google'); if (m) Alert.alert('خطأ', m); }
    finally { setLoading(null); }
  };

  const handleFacebook = async () => {
    setLoading('facebook');
    try { handleSuccess(await signInWithFacebook()); }
    catch (e: any) { const m = getFriendlyError(e, 'Facebook'); if (m) Alert.alert('خطأ', m); }
    finally { setLoading(null); }
  };

  const handleGuest = async () => {
    setLoading('guest');
    try { handleSuccess(await signInAsGuest()); }
    catch (e: any) { Alert.alert('خطأ', 'تعذّر المتابعة كزائر. حاول مرة أخرى.'); }
    finally { setLoading(null); }
  };

  return (
    <View style={S.container}>
      <AuthHeader
        icon={require('../../assets/icons/heart.png')}
        title={t('sign_in')}
        subtitle={t('sign_in_subtitle')}
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={S.body} keyboardShouldPersistTaps="handled">

        {/* Google */}
        <TouchableOpacity style={[S.btn, S.btnGoogle]} onPress={handleGoogle} disabled={isAnyLoading} activeOpacity={0.8}>
          {loading === 'google' ? <ActivityIndicator color="#1a1a1a" /> : <>
            <Image source={require('../../assets/icons/google.png')} style={[S.btnIcon, {tintColor: undefined}]} />
            <Text style={[S.btnText, {color: '#1a1a1a'}]}>{t('sign_in_google')}</Text>
          </>}
        </TouchableOpacity>

        {/* Facebook */}
        <TouchableOpacity style={[S.btn, S.btnFacebook]} onPress={handleFacebook} disabled={isAnyLoading} activeOpacity={0.8}>
          {loading === 'facebook' ? <ActivityIndicator color="#fff" /> : <>
            <Image source={require('../../assets/icons/facebook.png')} style={S.btnIcon} />
            <Text style={S.btnText}>{t('sign_in_facebook')}</Text>
          </>}
        </TouchableOpacity>

        {/* Email — navigates to its own page */}
        <TouchableOpacity
          style={[S.btn, S.btnEmail]}
          onPress={() => navigation.navigate('EmailSignIn', {onSuccess})}
          disabled={isAnyLoading} activeOpacity={0.8}>
          <Image source={require('../../assets/icons/email.png')} style={[S.btnIcon, {tintColor: '#fff'}]} />
          <Text style={S.btnText}>{t('sign_in_email_btn')}</Text>
        </TouchableOpacity>

        {/* Phone — navigates to its own page */}
        <TouchableOpacity
          style={[S.btn, S.btnPhone]}
          onPress={() => navigation.navigate('PhoneSignIn', {onSuccess})}
          disabled={isAnyLoading} activeOpacity={0.8}>
          <Image source={require('../../assets/icons/phone.png')} style={[S.btnIcon, {tintColor: '#fff'}]} />
          <Text style={S.btnText}>{t('sign_in_phone_btn')}</Text>
        </TouchableOpacity>

        {/* Divider */}
        <View style={S.divider}>
          <View style={S.dividerLine} />
          <Text style={S.dividerText}>{t('or')}</Text>
          <View style={S.dividerLine} />
        </View>

        {/* Guest */}
        <TouchableOpacity style={[S.btn, S.btnGuest]} onPress={handleGuest} disabled={isAnyLoading} activeOpacity={0.8}>
          {loading === 'guest' ? <ActivityIndicator color={Colors.dark.text} /> : (
            <Text style={[S.btnText, {color: Colors.dark.text}]}>{t('continue_as_guest')}</Text>
          )}
        </TouchableOpacity>

        <Text style={S.disclaimer}>{t('sign_in_disclaimer')}</Text>
      </ScrollView>
    </View>
  );
};

const S = StyleSheet.create({
  container:     {flex: 1, backgroundColor: Colors.dark.background},
  body:          {paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40},
  btn:           {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 54, borderRadius: 14, marginBottom: 12},
  btnGoogle:     {backgroundColor: '#fff'},
  btnFacebook:   {backgroundColor: '#1877F2'},
  btnEmail:      {backgroundColor: '#E53935'},
  btnPhone:      {backgroundColor: '#2E7D32'},
  btnGuest:      {backgroundColor: Colors.dark.surface, borderWidth: 1, borderColor: Colors.dark.border},
  btnIcon:       {width: 22, height: 22, tintColor: '#fff', marginRight: 10},
  btnText:       {fontSize: 16, fontWeight: '600', color: '#fff', fontFamily: 'Rubik'},
  divider:       {flexDirection: 'row', alignItems: 'center', marginVertical: 8},
  dividerLine:   {flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: Colors.dark.border},
  dividerText:   {marginHorizontal: 12, fontSize: 13, color: Colors.dark.textMuted, fontFamily: 'Rubik'},
  disclaimer:    {fontSize: 12, color: Colors.dark.textMuted, textAlign: 'center', lineHeight: 18, marginTop: 16, fontFamily: 'Rubik'},
});
