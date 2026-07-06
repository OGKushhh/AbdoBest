import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Image, StatusBar} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';

interface Props {
  icon: any;
  title: string;
  subtitle?: string;
  onBack: () => void;
}

/** Compact gradient header shared by SignIn / EmailSignIn / PhoneSignIn screens. */
export const AuthHeader: React.FC<Props> = ({icon, title, subtitle, onBack}) => (
  <LinearGradient colors={['#E53935', '#FF6D00']} start={{x: 0, y: 0}} end={{x: 1, y: 1}} style={S.header}>
    <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
    <SafeAreaView edges={['top']}>
      <TouchableOpacity style={S.backBtn} onPress={onBack}>
        <Image source={require('../../assets/icons/chevron-down.png')} style={S.backIcon} />
      </TouchableOpacity>
      <View style={S.content}>
        <View style={S.iconCircle}>
          <Image source={icon} style={S.icon} />
        </View>
        <Text style={S.title}>{title}</Text>
        {subtitle ? <Text style={S.subtitle}>{subtitle}</Text> : null}
      </View>
    </SafeAreaView>
  </LinearGradient>
);

const S = StyleSheet.create({
  header:     {paddingBottom: 12},
  backBtn:    {padding: 10, alignSelf: 'flex-start'},
  backIcon:   {width: 18, height: 18, tintColor: '#fff', transform: [{rotate: '90deg'}]},
  content:    {alignItems: 'center', paddingHorizontal: 24, paddingTop: 0, paddingBottom: 2},
  iconCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 8,
  },
  icon:       {width: 18, height: 18, tintColor: '#fff'},
  title:      {fontSize: 17, fontWeight: '700', color: '#fff', fontFamily: 'Rubik-Bold', marginBottom: 3},
  subtitle:   {fontSize: 12, color: 'rgba(255,255,255,0.85)', fontFamily: 'Rubik', textAlign: 'center', lineHeight: 16},
});
