import React, {useMemo, useState} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, TextInput,
  FlatList, Image,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {Colors} from '../theme/colors';
import {Country, COUNTRIES} from '../constants/countries';

interface TriggerProps {
  country: Country;
  onPress: () => void;
}

/** Compact "flag + dial code + chevron" button shown next to the phone input. */
export const CountryPickerTrigger: React.FC<TriggerProps> = ({country, onPress}) => (
  <TouchableOpacity style={S.trigger} onPress={onPress} activeOpacity={0.7}>
    <Text style={S.triggerFlag}>{country.flag}</Text>
    <Text style={S.triggerDial}>+{country.dial}</Text>
    <Image source={require('../../assets/icons/chevron-down.png')} style={S.triggerChevron} />
  </TouchableOpacity>
);

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (country: Country) => void;
}

export const CountryPickerModal: React.FC<ModalProps> = ({visible, onClose, onSelect}) => {
  const {t, i18n} = useTranslation();
  const isAr = i18n.language === 'ar';
  const [query, setQuery] = useState('');

  const filtered: Country[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((c: Country) =>
      c.name.toLowerCase().includes(q) ||
      c.nameAr.toLowerCase().includes(q) ||
      c.dial.includes(q) ||
      c.iso2.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={S.overlay}>
        <View style={S.sheet}>
          <View style={S.handle} />
          <View style={S.headerRow}>
            <Text style={S.title}>{t('select_country')}</Text>
            <TouchableOpacity onPress={onClose} style={S.closeBtn}>
              <Image source={require('../../assets/icons/close.png')} style={S.closeIcon} />
            </TouchableOpacity>
          </View>

          <View style={S.searchBox}>
            <Image source={require('../../assets/icons/search.png')} style={S.searchIcon} />
            <TextInput
              style={[S.searchInput, isAr && {textAlign: 'right'}]}
              placeholder={t('search_country')}
              placeholderTextColor={Colors.dark.textMuted}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
            />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={item => item.iso2}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={30}
            renderItem={({item}) => (
              <TouchableOpacity
                style={S.row}
                onPress={() => { onSelect(item); onClose(); }}
                activeOpacity={0.65}>
                <Text style={S.rowFlag}>{item.flag}</Text>
                <Text style={[S.rowName, isAr && {textAlign: 'right'}]} numberOfLines={1}>
                  {isAr ? item.nameAr : item.name}
                </Text>
                <Text style={S.rowDial}>+{item.dial}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={S.empty}>{t('no_results')}</Text>
            }
          />
        </View>
      </View>
    </Modal>
  );
};

const S = StyleSheet.create({
  // Trigger
  trigger: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.dark.background,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.dark.border,
    paddingHorizontal: 10, height: 48, marginRight: 8,
  },
  triggerFlag: {fontSize: 18, marginRight: 6},
  triggerDial: {color: Colors.dark.text, fontFamily: 'Rubik', fontSize: 15, marginRight: 4},
  triggerChevron: {width: 12, height: 12, tintColor: Colors.dark.textMuted},

  // Modal sheet
  overlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end'},
  sheet: {
    backgroundColor: Colors.dark.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    height: '75%', paddingTop: 10, paddingHorizontal: 16,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.dark.border, alignSelf: 'center', marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {color: Colors.dark.text, fontSize: 18, fontFamily: 'Rubik-Bold'},
  closeBtn: {padding: 4},
  closeIcon: {width: 20, height: 20, tintColor: Colors.dark.textMuted},
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.dark.background, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.dark.border,
    paddingHorizontal: 12, height: 44, marginBottom: 8,
  },
  searchIcon: {width: 16, height: 16, tintColor: Colors.dark.textMuted, marginRight: 8},
  searchInput: {flex: 1, color: Colors.dark.text, fontFamily: 'Rubik', fontSize: 15},
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.dark.border,
  },
  rowFlag: {fontSize: 22, marginRight: 12},
  rowName: {flex: 1, color: Colors.dark.text, fontFamily: 'Rubik', fontSize: 15},
  rowDial: {color: Colors.dark.textMuted, fontFamily: 'Rubik', fontSize: 14, marginLeft: 8},
  empty: {color: Colors.dark.textMuted, textAlign: 'center', marginTop: 40, fontFamily: 'Rubik'},
});
