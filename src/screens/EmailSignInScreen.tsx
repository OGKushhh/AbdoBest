import React, {useRef, useState} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Image,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView, Keyboard,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {Colors} from '../theme/colors';
import {AuthHeader} from '../components/AuthHeader';
import {signInWithEmail, signUpWithEmail, resetPassword, AbdoUser} from '../services/authService';
import {getFriendlyError, useAuthSuccess} from './SignInScreen';

// 'choose' shown first so the user explicitly picks sign-in vs. create-account
// up front, rather than landing on one of them by default.
type EmailStep = 'choose' | 'signin' | 'signup' | 'reset';

export const EmailSignInScreen: React.FC = () => {
  const {t}        = useTranslation();
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();
  const onSuccess: ((user: AbdoUser) => void) | undefined = route.params?.onSuccess;
  const handleSuccess = useAuthSuccess(onSuccess);

  const [loading, setLoading]     = useState(false);
  const [step, setStep]           = useState<EmailStep>('choose');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPassword, setShowPassword]   = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  const passwordRef = useRef<TextInput>(null);
  const confirmRef   = useRef<TextInput>(null);

  const handleSubmit = async () => {
    Keyboard.dismiss();
    if (!email.trim()) { Alert.alert(t('error'), t('email_required')); return; }

    if (step === 'reset') {
      setLoading(true);
      try {
        await resetPassword(email.trim());
        Alert.alert(t('reset_link_sent_title'), t('reset_link_sent_body'));
        setStep('signin');
      } catch (e: any) { Alert.alert(t('error'), getFriendlyError(e, 'Email') || t('reset_send_failed')); }
      finally { setLoading(false); }
      return;
    }

    if (!password) { Alert.alert(t('error'), t('password_required')); return; }
    if (step === 'signup' && password !== confirmPw) {
      Alert.alert(t('error'), t('password_mismatch')); return;
    }

    setLoading(true);
    try {
      const user = step === 'signin'
        ? await signInWithEmail(email.trim(), password)
        : await signUpWithEmail(email.trim(), password);
      handleSuccess(user);
    } catch (e: any) {
      Alert.alert(t('error'), getFriendlyError(e, 'Email') || t('email_signin_title'));
    } finally { setLoading(false); }
  };

  const isChoosing = step === 'choose';

  return (
    <KeyboardAvoidingView style={{flex: 1}} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={S.container}>
        <AuthHeader
          icon={require('../../assets/icons/email.png')}
          title={t('email_signin_title')}
          subtitle={isChoosing ? t('email_choose_title') : t('email_signin_subtitle')}
          onBack={() => navigation.goBack()}
        />

        <ScrollView contentContainerStyle={S.body} keyboardShouldPersistTaps="handled">
          {isChoosing ? (
            // ── Upfront choice: sign in vs. create account ──
            <View style={S.choiceWrap}>
              <TouchableOpacity style={S.choiceCard} onPress={() => setStep('signin')} activeOpacity={0.8}>
                <View style={S.choiceIconCircle}>
                  <Image source={require('../../assets/icons/account.png')} style={S.choiceIcon} />
                </View>
                <View style={{flex: 1}}>
                  <Text style={S.choiceTitle}>{t('email_choose_signin')}</Text>
                  <Text style={S.choiceSub}>{t('email_choose_signin_sub')}</Text>
                </View>
                <Image source={require('../../assets/icons/chevron-down.png')} style={S.choiceChevron} />
              </TouchableOpacity>

              <TouchableOpacity style={S.choiceCard} onPress={() => setStep('signup')} activeOpacity={0.8}>
                <View style={S.choiceIconCircle}>
                  <Image source={require('../../assets/icons/plus.png')} style={S.choiceIcon} />
                </View>
                <View style={{flex: 1}}>
                  <Text style={S.choiceTitle}>{t('email_choose_signup')}</Text>
                  <Text style={S.choiceSub}>{t('email_choose_signup_sub')}</Text>
                </View>
                <Image source={require('../../assets/icons/chevron-down.png')} style={S.choiceChevron} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={S.form}>
              <TextInput
                style={S.input}
                placeholder={t('email_placeholder')}
                placeholderTextColor={Colors.dark.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType={step === 'reset' ? 'done' : 'next'}
                onSubmitEditing={() => step !== 'reset' && passwordRef.current?.focus()}
              />
              {step !== 'reset' && (
                <View style={S.inputWithToggle}>
                  <TextInput
                    ref={passwordRef}
                    style={[S.input, S.inputFlex]}
                    placeholder={t('password_placeholder')}
                    placeholderTextColor={Colors.dark.textMuted}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    returnKeyType={step === 'signup' ? 'next' : 'done'}
                    onSubmitEditing={() => step === 'signup' ? confirmRef.current?.focus() : handleSubmit()}
                  />
                  <TouchableOpacity style={S.eyeBtn} onPress={() => setShowPassword(v => !v)} hitSlop={10}>
                    <Image source={require('../../assets/icons/eyes.png')} style={[S.eyeIcon, showPassword && S.eyeIconActive]} />
                  </TouchableOpacity>
                </View>
              )}
              {step === 'signup' && (
                <View style={S.inputWithToggle}>
                  <TextInput
                    ref={confirmRef}
                    style={[S.input, S.inputFlex]}
                    placeholder={t('confirm_password_placeholder')}
                    placeholderTextColor={Colors.dark.textMuted}
                    value={confirmPw}
                    onChangeText={setConfirmPw}
                    secureTextEntry={!showConfirmPw}
                    returnKeyType="done"
                    onSubmitEditing={handleSubmit}
                  />
                  <TouchableOpacity style={S.eyeBtn} onPress={() => setShowConfirmPw(v => !v)} hitSlop={10}>
                    <Image source={require('../../assets/icons/eyes.png')} style={[S.eyeIcon, showConfirmPw && S.eyeIconActive]} />
                  </TouchableOpacity>
                </View>
              )}
              <TouchableOpacity style={S.submitBtn} onPress={handleSubmit} disabled={loading} activeOpacity={0.8}>
                {loading ? <ActivityIndicator color="#fff" /> : (
                  <Text style={S.submitText}>
                    {step === 'signin' ? t('btn_sign_in') : step === 'signup' ? t('btn_create_account') : t('btn_send_reset_link')}
                  </Text>
                )}
              </TouchableOpacity>
              <View style={S.formLinks}>
                {step === 'signin' && <>
                  <TouchableOpacity onPress={() => setStep('signup')}>
                    <Text style={S.link}>{t('link_create_account')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setStep('reset')}>
                    <Text style={S.link}>{t('link_forgot_password')}</Text>
                  </TouchableOpacity>
                </>}
                {step !== 'signin' && (
                  <TouchableOpacity onPress={() => setStep('signin')}>
                    <Text style={S.link}>{t('link_back_to_signin')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
};

const S = StyleSheet.create({
  container:  {flex: 1, backgroundColor: Colors.dark.background},
  body:       {paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40},

  // Upfront choice cards
  choiceWrap: {gap: 12},
  choiceCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.dark.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.dark.border,
    paddingHorizontal: 16, paddingVertical: 16,
  },
  choiceIconCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(229,57,53,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  choiceIcon: {width: 22, height: 22, tintColor: '#E53935'},
  choiceTitle: {color: Colors.dark.text, fontSize: 16, fontWeight: '700', fontFamily: 'Rubik-Bold', marginBottom: 2},
  choiceSub: {color: Colors.dark.textMuted, fontSize: 13, fontFamily: 'Rubik'},
  choiceChevron: {width: 14, height: 14, tintColor: Colors.dark.textMuted, transform: [{rotate: '-90deg'}]},

  form:       {backgroundColor: Colors.dark.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.dark.border},
  input:      {backgroundColor: Colors.dark.background, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: Colors.dark.text, fontFamily: 'Rubik', fontSize: 15, marginBottom: 10, borderWidth: 1, borderColor: Colors.dark.border},
  inputWithToggle: {flexDirection: 'row', alignItems: 'center'},
  inputFlex:  {flex: 1, marginBottom: 10},
  eyeBtn:     {position: 'absolute', right: 12, top: 0, bottom: 10, justifyContent: 'center'},
  eyeIcon:    {width: 20, height: 20, tintColor: Colors.dark.textMuted},
  eyeIconActive: {tintColor: '#E53935'},
  submitBtn:  {backgroundColor: '#E53935', borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 4},
  submitText: {color: '#fff', fontWeight: '700', fontSize: 15, fontFamily: 'Rubik-Bold'},
  formLinks:  {flexDirection: 'row', justifyContent: 'space-between', marginTop: 12},
  link:       {color: '#E53935', fontSize: 13, fontFamily: 'Rubik'},
});
