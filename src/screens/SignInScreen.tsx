import React, {useState, useRef} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  ActivityIndicator, Alert, StatusBar, TextInput,
  KeyboardAvoidingView, Platform, ScrollView, Keyboard,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import {useNavigation, useRoute} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {Colors} from '../theme/colors';
import {
  signInWithGoogle, signInWithFacebook, signInAsGuest,
  signInWithEmail, signUpWithEmail, resetPassword,
  sendPhoneOTP, confirmPhoneOTP, AbdoUser,
} from '../services/authService';
import {fetchCollections} from '../services/favoritesService';
import {initFCM} from '../services/fcmService';

type Mode = null | 'email' | 'phone';
type EmailStep = 'signin' | 'signup' | 'reset';
type PhoneStep = 'number' | 'otp';

function getFriendlyError(e: any, provider: string): string {
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

export const SignInScreen: React.FC = () => {
  const {t}        = useTranslation();
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();
  const onSuccess: ((user: AbdoUser) => void) | undefined = route.params?.onSuccess;

  const [loading, setLoading]       = useState<string | null>(null);
  const [mode, setMode]             = useState<Mode>(null);

  // Email state
  const [emailStep, setEmailStep]   = useState<EmailStep>('signin');
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [confirmPw, setConfirmPw]   = useState('');

  // Phone state
  const [phoneStep, setPhoneStep]   = useState<PhoneStep>('number');
  const [phone, setPhone]           = useState('');
  const [otp, setOtp]               = useState('');
  const [confirmation, setConfirmation] = useState<any>(null);

  const passwordRef = useRef<TextInput>(null);
  const confirmRef  = useRef<TextInput>(null);
  const otpRef      = useRef<TextInput>(null);

  const handleSuccess = (user: AbdoUser) => {
    fetchCollections().catch(() => {});
    initFCM().catch(() => {});
    if (onSuccess) { onSuccess(user); }
    navigation.goBack();
  };

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

  // ── Email handlers ────────────────────────────────────────────────────────
  const handleEmailSubmit = async () => {
    Keyboard.dismiss();
    if (!email.trim()) { Alert.alert('خطأ', 'أدخل البريد الإلكتروني.'); return; }

    if (emailStep === 'reset') {
      setLoading('email');
      try {
        await resetPassword(email.trim());
        Alert.alert('تم الإرسال', 'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني.');
        setEmailStep('signin');
      } catch (e: any) { Alert.alert('خطأ', getFriendlyError(e, 'Email') || 'فشل الإرسال.'); }
      finally { setLoading(null); }
      return;
    }

    if (!password) { Alert.alert('خطأ', 'أدخل كلمة المرور.'); return; }
    if (emailStep === 'signup' && password !== confirmPw) {
      Alert.alert('خطأ', 'كلمتا المرور غير متطابقتين.'); return;
    }

    setLoading('email');
    try {
      const user = emailStep === 'signin'
        ? await signInWithEmail(email.trim(), password)
        : await signUpWithEmail(email.trim(), password);
      handleSuccess(user);
    } catch (e: any) {
      Alert.alert('خطأ', getFriendlyError(e, 'Email') || 'فشل تسجيل الدخول.');
    } finally { setLoading(null); }
  };

  // ── Phone handlers ────────────────────────────────────────────────────────
  const handleSendOTP = async () => {
    Keyboard.dismiss();
    const cleaned = phone.trim();
    if (!cleaned || !cleaned.startsWith('+')) {
      Alert.alert('خطأ', 'أدخل رقم الهاتف بصيغة دولية. مثال: +201012345678'); return;
    }
    setLoading('phone');
    try {
      const conf = await sendPhoneOTP(cleaned);
      setConfirmation(conf);
      setPhoneStep('otp');
      setTimeout(() => otpRef.current?.focus(), 400);
    } catch (e: any) {
      Alert.alert('خطأ', getFriendlyError(e, 'Phone') || 'فشل إرسال رمز التحقق.');
    } finally { setLoading(null); }
  };

  const handleConfirmOTP = async () => {
    Keyboard.dismiss();
    if (!otp.trim() || otp.length < 6) { Alert.alert('خطأ', 'أدخل رمز التحقق المكون من 6 أرقام.'); return; }
    setLoading('otp');
    try {
      const user = await confirmPhoneOTP(confirmation, otp.trim());
      handleSuccess(user);
    } catch (e: any) {
      Alert.alert('خطأ', getFriendlyError(e, 'Phone') || 'رمز التحقق غير صحيح.');
    } finally { setLoading(null); }
  };

  const isAnyLoading = loading !== null;

  // ── Render email form ─────────────────────────────────────────────────────
  const renderEmailForm = () => (
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
        returnKeyType={emailStep === 'reset' ? 'done' : 'next'}
        onSubmitEditing={() => emailStep !== 'reset' && passwordRef.current?.focus()}
      />
      {emailStep !== 'reset' && (
        <TextInput
          ref={passwordRef}
          style={S.input}
          placeholder="كلمة المرور"
          placeholderTextColor={Colors.dark.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          returnKeyType={emailStep === 'signup' ? 'next' : 'done'}
          onSubmitEditing={() => emailStep === 'signup' ? confirmRef.current?.focus() : handleEmailSubmit()}
        />
      )}
      {emailStep === 'signup' && (
        <TextInput
          ref={confirmRef}
          style={S.input}
          placeholder="تأكيد كلمة المرور"
          placeholderTextColor={Colors.dark.textMuted}
          value={confirmPw}
          onChangeText={setConfirmPw}
          secureTextEntry
          returnKeyType="done"
          onSubmitEditing={handleEmailSubmit}
        />
      )}
      <TouchableOpacity style={S.submitBtn} onPress={handleEmailSubmit} disabled={isAnyLoading} activeOpacity={0.8}>
        {loading === 'email' ? <ActivityIndicator color="#fff" /> : (
          <Text style={S.submitText}>
            {emailStep === 'signin' ? 'تسجيل الدخول' : emailStep === 'signup' ? 'إنشاء حساب' : 'إرسال رابط الاسترداد'}
          </Text>
        )}
      </TouchableOpacity>
      <View style={S.formLinks}>
        {emailStep === 'signin' && <>
          <TouchableOpacity onPress={() => setEmailStep('signup')}>
            <Text style={S.link}>إنشاء حساب جديد</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setEmailStep('reset')}>
            <Text style={S.link}>نسيت كلمة المرور؟</Text>
          </TouchableOpacity>
        </>}
        {emailStep !== 'signin' && (
          <TouchableOpacity onPress={() => setEmailStep('signin')}>
            <Text style={S.link}>العودة لتسجيل الدخول</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  // ── Render phone form ─────────────────────────────────────────────────────
  const renderPhoneForm = () => (
    <View style={S.form}>
      {phoneStep === 'number' ? (
        <>
          <TextInput
            style={S.input}
            placeholder="+201012345678"
            placeholderTextColor={Colors.dark.textMuted}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            returnKeyType="done"
            onSubmitEditing={handleSendOTP}
          />
          <Text style={S.hint}>أدخل رقم هاتفك بصيغة دولية تبدأ بـ +</Text>
          <TouchableOpacity style={S.submitBtn} onPress={handleSendOTP} disabled={isAnyLoading} activeOpacity={0.8}>
            {loading === 'phone' ? <ActivityIndicator color="#fff" /> : (
              <Text style={S.submitText}>إرسال رمز التحقق</Text>
            )}
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={S.hint}>تم إرسال رمز التحقق إلى {phone}</Text>
          <TextInput
            ref={otpRef}
            style={[S.input, S.otpInput]}
            placeholder="000000"
            placeholderTextColor={Colors.dark.textMuted}
            value={otp}
            onChangeText={setOtp}
            keyboardType="number-pad"
            maxLength={6}
            returnKeyType="done"
            onSubmitEditing={handleConfirmOTP}
          />
          <TouchableOpacity style={S.submitBtn} onPress={handleConfirmOTP} disabled={isAnyLoading} activeOpacity={0.8}>
            {loading === 'otp' ? <ActivityIndicator color="#fff" /> : (
              <Text style={S.submitText}>تأكيد</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setPhoneStep('number'); setOtp(''); }} style={{marginTop: 10, alignItems: 'center'}}>
            <Text style={S.link}>تغيير رقم الهاتف</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView style={{flex: 1}} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={S.container}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <LinearGradient colors={['#E53935', '#FF6D00']} start={{x: 0, y: 0}} end={{x: 1, y: 1}} style={S.header}>
          <SafeAreaView edges={['top']}>
            <TouchableOpacity style={S.backBtn} onPress={() => navigation.goBack()}>
              <Image source={require('../../assets/icons/chevron-down.png')} style={S.backIcon} />
            </TouchableOpacity>
            <View style={S.headerContent}>
              <Image source={require('../../assets/icons/heart.png')} style={S.headerIcon} />
              <Text style={S.headerTitle}>{t('sign_in')}</Text>
              <Text style={S.headerSubtitle}>{t('sign_in_subtitle')}</Text>
            </View>
          </SafeAreaView>
        </LinearGradient>

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

          {/* Email */}
          <TouchableOpacity
            style={[S.btn, S.btnEmail, mode === 'email' && S.btnActive]}
            onPress={() => setMode(mode === 'email' ? null : 'email')}
            disabled={isAnyLoading} activeOpacity={0.8}>
            <Image source={require('../../assets/icons/notice.png')} style={[S.btnIcon, {tintColor: '#fff'}]} />
            <Text style={S.btnText}>البريد الإلكتروني</Text>
          </TouchableOpacity>
          {mode === 'email' && renderEmailForm()}

          {/* Phone */}
          <TouchableOpacity
            style={[S.btn, S.btnPhone, mode === 'phone' && S.btnActive]}
            onPress={() => setMode(mode === 'phone' ? null : 'phone')}
            disabled={isAnyLoading} activeOpacity={0.8}>
            <Image source={require('../../assets/icons/browsing.png')} style={[S.btnIcon, {tintColor: '#fff'}]} />
            <Text style={S.btnText}>رقم الهاتف</Text>
          </TouchableOpacity>
          {mode === 'phone' && renderPhoneForm()}

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
    </KeyboardAvoidingView>
  );
};

const S = StyleSheet.create({
  container:     {flex: 1, backgroundColor: Colors.dark.background},
  header:        {paddingBottom: 40},
  backBtn:       {padding: 16, alignSelf: 'flex-start'},
  backIcon:      {width: 22, height: 22, tintColor: '#fff', transform: [{rotate: '90deg'}]},
  headerContent: {alignItems: 'center', paddingHorizontal: 24, paddingBottom: 8},
  headerIcon:    {width: 48, height: 48, tintColor: 'rgba(255,255,255,0.9)', marginBottom: 12},
  headerTitle:   {fontSize: 28, fontWeight: '700', color: '#fff', fontFamily: 'Rubik-Bold', marginBottom: 8},
  headerSubtitle:{fontSize: 15, color: 'rgba(255,255,255,0.8)', fontFamily: 'Rubik', textAlign: 'center', lineHeight: 22},
  body:          {paddingHorizontal: 24, paddingTop: 28, paddingBottom: 40},
  btn:           {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 54, borderRadius: 14, marginBottom: 12},
  btnGoogle:     {backgroundColor: '#fff'},
  btnFacebook:   {backgroundColor: '#1877F2'},
  btnEmail:      {backgroundColor: '#E53935'},
  btnPhone:      {backgroundColor: '#2E7D32'},
  btnGuest:      {backgroundColor: Colors.dark.surface, borderWidth: 1, borderColor: Colors.dark.border},
  btnActive:     {opacity: 0.85},
  btnIcon:       {width: 22, height: 22, tintColor: '#fff', marginRight: 10},
  btnText:       {fontSize: 16, fontWeight: '600', color: '#fff', fontFamily: 'Rubik'},
  divider:       {flexDirection: 'row', alignItems: 'center', marginVertical: 8},
  dividerLine:   {flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: Colors.dark.border},
  dividerText:   {marginHorizontal: 12, fontSize: 13, color: Colors.dark.textMuted, fontFamily: 'Rubik'},
  disclaimer:    {fontSize: 12, color: Colors.dark.textMuted, textAlign: 'center', lineHeight: 18, marginTop: 16, fontFamily: 'Rubik'},
  // Forms
  form:          {backgroundColor: Colors.dark.surface, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.dark.border},
  input:         {backgroundColor: Colors.dark.background, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: Colors.dark.text, fontFamily: 'Rubik', fontSize: 15, marginBottom: 10, borderWidth: 1, borderColor: Colors.dark.border},
  otpInput:      {letterSpacing: 8, fontSize: 22, textAlign: 'center'},
  submitBtn:     {backgroundColor: '#E53935', borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 4},
  submitText:    {color: '#fff', fontWeight: '700', fontSize: 15, fontFamily: 'Rubik-Bold'},
  formLinks:     {flexDirection: 'row', justifyContent: 'space-between', marginTop: 12},
  link:          {color: '#E53935', fontSize: 13, fontFamily: 'Rubik'},
  hint:          {color: Colors.dark.textMuted, fontSize: 12, fontFamily: 'Rubik', marginBottom: 8},
});
