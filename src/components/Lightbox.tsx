/**
 * Lightbox.tsx
 * Full-screen image viewer: tap a poster/avatar, it expands over the current
 * screen with a dimmed backdrop. Tap anywhere to dismiss.
 *
 * Deliberately simple — no pinch-zoom, no extra gesture library — see the
 * safety notes at each call site (DetailsScreen especially) for why: this
 * screen already juggles several other <Modal> components (season picker,
 * watched-progress picker, collection sheet, HLS chooser) plus a full-screen
 * *non*-Modal extraction overlay. Stacking RN <Modal>s, or having one survive
 * a navigation transition, is a known Android crash source — so every call
 * site is responsible for guarding when this can open and closing it on
 * blur/unmount. This component itself stays minimal on purpose.
 */
import React from 'react';
import {Modal, View, Image, TouchableOpacity, StyleSheet, Dimensions, StatusBar} from 'react-native';

const {width: SW, height: SH} = Dimensions.get('window');

interface Props {
  visible: boolean;
  imageUri: string | null;
  onClose: () => void;
}

export const Lightbox: React.FC<Props> = ({visible, imageUri, onClose}) => {
  if (!imageUri) return null;
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" backgroundColor="rgba(0,0,0,0.92)" />
      <TouchableOpacity style={S.backdrop} activeOpacity={1} onPress={onClose}>
        <Image source={{uri: imageUri}} style={S.image} resizeMode="contain" />
        <TouchableOpacity style={S.closeBtn} onPress={onClose} hitSlop={12}>
          <View style={S.closeCircle}>
            <View style={[S.closeLine, S.closeLineA]} />
            <View style={[S.closeLine, S.closeLineB]} />
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const S = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SW,
    height: SH * 0.8,
  },
  closeBtn: {
    position: 'absolute',
    top: 44,
    right: 20,
  },
  closeCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  closeLine: {
    position: 'absolute',
    width: 18, height: 2, backgroundColor: '#fff', borderRadius: 1,
  },
  closeLineA: {transform: [{rotate: '45deg'}]},
  closeLineB: {transform: [{rotate: '-45deg'}]},
});
