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
import {CountryPickerModal, CountryPickerTrigger} from '../components/CountryPickerModal';
import {COUNTRIES, Country} from '../constants/countries';
import {getDeviceCountryISO2} from '../utils/deviceCountry';
import {sendPhoneOTP, confirmPhoneOTP, AbdoUser} from '../services/authService';
import {getFriendlyError, useAuthSuccess} from './SignInScreen';

type PhoneStep = 'number' | 'otp';

function detectDefaultCountry(): Country {
  const iso2 = getDeviceCountryISO2();
  return COUNTRIES.find(c => c.iso2 === iso2) ?? COUNTRIES.find(c => c.iso2 === 'EG')!;
}

export const PhoneSignInScreen: React.FC = () => {
  const {t}        = useTranslation();
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();
  const onSuccess: ((user: AbdoUser) => void) | undefined = route.params?.onSuccess;
  const handleSuccess = useAuthSuccess(onSuccess);

  const [loading, setLoading]       = useState<string | null>(null);
  const [step, setStep]             = useState<PhoneStep>('number');
  const [country, setCountry]       = useState<Country>(detectDefaultCountry);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [localNumber, setLocalNumber] = useState('');
  const [otp, setOtp]               = useState('');
  const [confirmation, setConfirmation] = useState<any>(null);

  const otpRef = useRef<TextInput>(null);
  const isAnyLoading = loading !== null;

  const handleSendOTP = async () => {
    Keyboard.dismiss();
    const cleaned = localNumber.trim().replace(/^0+/, '');
    if (!cleaned) {
      Alert.alert('خطأ', 'أدخل رقم الهاتف.'); return;
    }
    const fullNumber = `+${country.dial}${cleaned}`;
    setLoading('phone');
    try {
      const conf = await sendPhoneOTP(fullNumber);
      setConfirmation(conf);
      setStep('otp');
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

  return (
    <KeyboardAvoidingView style={{flex: 1}} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={S.container}>
        <AuthHeader
          icon={require('../../assets/icons/phone.png')}
          title={t('phone_signin_title')}
          subtitle={t('phone_signin_subtitle')}
          onBack={() => navigation.goBack()}
        />

        <ScrollView contentContainerStyle={S.body} keyboardShouldPersistTaps="handled">
          <View style={S.form}>
            {step === 'number' ? (
              <>
                <View style={S.phoneRow}>
                  <CountryPickerTrigger country={country} onPress={() => setPickerVisible(true)} />
                  <TextInput
                    style={[S.input, S.phoneInput]}
                    placeholder="1012345678"
                    placeholderTextColor={Colors.dark.textMuted}
                    value={localNumber}
                    onChangeText={setLocalNumber}
                    keyboardType="phone-pad"
                    returnKeyType="done"
                    onSubmitEditing={handleSendOTP}
                  />
                </View>
                <Text style={S.hint}>
                  سيتم إرسال الرمز إلى: +{country.dial} {localNumber || '...'}
                </Text>
                <TouchableOpacity style={S.submitBtn} onPress={handleSendOTP} disabled={isAnyLoading} activeOpacity={0.8}>
                  {loading === 'phone' ? <ActivityIndicator color="#fff" /> : (
                    <Text style={S.submitText}>إرسال رمز التحقق</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={S.hint}>تم إرسال رمز التحقق إلى +{country.dial}{localNumber}</Text>
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
                <TouchableOpacity onPress={() => { setStep('number'); setOtp(''); }} style={{marginTop: 10, alignItems: 'center'}}>
                  <Text style={S.link}>تغيير رقم الهاتف</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>

        <CountryPickerModal
          visible={pickerVisible}
          onClose={() => setPickerVisible(false)}
          onSelect={setCountry}
        />
      </View>
    </KeyboardAvoidingView>
  );
};

const S = StyleSheet.create({
  container:  {flex: 1, backgroundColor: Colors.dark.background},
  body:       {paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40},
  form:       {backgroundColor: Colors.dark.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.dark.border},
  input:      {backgroundColor: Colors.dark.background, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: Colors.dark.text, fontFamily: 'Rubik', fontSize: 15, borderWidth: 1, borderColor: Colors.dark.border},
  phoneRow:   {flexDirection: 'row', alignItems: 'center', marginBottom: 10},
  phoneInput: {flex: 1, marginBottom: 0},
  otpInput:   {letterSpacing: 8, fontSize: 22, textAlign: 'center', marginBottom: 10},
  submitBtn:  {backgroundColor: '#E53935', borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 4},
  submitText: {color: '#fff', fontWeight: '700', fontSize: 15, fontFamily: 'Rubik-Bold'},
  link:       {color: '#E53935', fontSize: 13, fontFamily: 'Rubik'},
  hint:       {color: Colors.dark.textMuted, fontSize: 12, fontFamily: 'Rubik', marginBottom: 8},
});
