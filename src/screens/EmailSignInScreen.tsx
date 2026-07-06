import React, {useRef, useState} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView, Keyboard,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {Colors} from '../theme/colors';
import {AuthHeader} from '../components/AuthHeader';
import {signInWithEmail, signUpWithEmail, resetPassword, AbdoUser} from '../services/authService';
import {getFriendlyError, useAuthSuccess} from './SignInScreen';

type EmailStep = 'signin' | 'signup' | 'reset';

export const EmailSignInScreen: React.FC = () => {
  const {t}        = useTranslation();
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();
  const onSuccess: ((user: AbdoUser) => void) | undefined = route.params?.onSuccess;
  const handleSuccess = useAuthSuccess(onSuccess);

  const [loading, setLoading]     = useState(false);
  const [step, setStep]           = useState<EmailStep>('signin');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [confirmPw, setConfirmPw] = useState('');

  const passwordRef = useRef<TextInput>(null);
  const confirmRef   = useRef<TextInput>(null);

  const handleSubmit = async () => {
    Keyboard.dismiss();
    if (!email.trim()) { Alert.alert('خطأ', 'أدخل البريد الإلكتروني.'); return; }

    if (step === 'reset') {
      setLoading(true);
      try {
        await resetPassword(email.trim());
        Alert.alert('تم الإرسال', 'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني.');
        setStep('signin');
      } catch (e: any) { Alert.alert('خطأ', getFriendlyError(e, 'Email') || 'فشل الإرسال.'); }
      finally { setLoading(false); }
      return;
    }

    if (!password) { Alert.alert('خطأ', 'أدخل كلمة المرور.'); return; }
    if (step === 'signup' && password !== confirmPw) {
      Alert.alert('خطأ', 'كلمتا المرور غير متطابقتين.'); return;
    }

    setLoading(true);
    try {
      const user = step === 'signin'
        ? await signInWithEmail(email.trim(), password)
        : await signUpWithEmail(email.trim(), password);
      handleSuccess(user);
    } catch (e: any) {
      Alert.alert('خطأ', getFriendlyError(e, 'Email') || 'فشل تسجيل الدخول.');
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={{flex: 1}} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={S.container}>
        <AuthHeader
          icon={require('../../assets/icons/email.png')}
          title={t('email_signin_title')}
          subtitle={t('email_signin_subtitle')}
          onBack={() => navigation.goBack()}
        />

        <ScrollView contentContainerStyle={S.body} keyboardShouldPersistTaps="handled">
          <View style={S.form}>
            <TextInput
              style={S.input}
              placeholder="البريد الإلكتروني"
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
              <TextInput
                ref={passwordRef}
                style={S.input}
                placeholder="كلمة المرور"
                placeholderTextColor={Colors.dark.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                returnKeyType={step === 'signup' ? 'next' : 'done'}
                onSubmitEditing={() => step === 'signup' ? confirmRef.current?.focus() : handleSubmit()}
              />
            )}
            {step === 'signup' && (
              <TextInput
                ref={confirmRef}
                style={S.input}
                placeholder="تأكيد كلمة المرور"
                placeholderTextColor={Colors.dark.textMuted}
                value={confirmPw}
                onChangeText={setConfirmPw}
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
            )}
            <TouchableOpacity style={S.submitBtn} onPress={handleSubmit} disabled={loading} activeOpacity={0.8}>
              {loading ? <ActivityIndicator color="#fff" /> : (
                <Text style={S.submitText}>
                  {step === 'signin' ? 'تسجيل الدخول' : step === 'signup' ? 'إنشاء حساب' : 'إرسال رابط الاسترداد'}
                </Text>
              )}
            </TouchableOpacity>
            <View style={S.formLinks}>
              {step === 'signin' && <>
                <TouchableOpacity onPress={() => setStep('signup')}>
                  <Text style={S.link}>إنشاء حساب جديد</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setStep('reset')}>
                  <Text style={S.link}>نسيت كلمة المرور؟</Text>
                </TouchableOpacity>
              </>}
              {step !== 'signin' && (
                <TouchableOpacity onPress={() => setStep('signin')}>
                  <Text style={S.link}>العودة لتسجيل الدخول</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
};

const S = StyleSheet.create({
  container:  {flex: 1, backgroundColor: Colors.dark.background},
  body:       {paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40},
  form:       {backgroundColor: Colors.dark.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.dark.border},
  input:      {backgroundColor: Colors.dark.background, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: Colors.dark.text, fontFamily: 'Rubik', fontSize: 15, marginBottom: 10, borderWidth: 1, borderColor: Colors.dark.border},
  submitBtn:  {backgroundColor: '#E53935', borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 4},
  submitText: {color: '#fff', fontWeight: '700', fontSize: 15, fontFamily: 'Rubik-Bold'},
  formLinks:  {flexDirection: 'row', justifyContent: 'space-between', marginTop: 12},
  link:       {color: '#E53935', fontSize: 13, fontFamily: 'Rubik'},
});
