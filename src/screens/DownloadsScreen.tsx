import React, {useState, useCallback} from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, StatusBar, Alert, Image,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import FastImage from 'react-native-fast-image';
import {Colors} from '../theme/colors';
import {useTranslation} from 'react-i18next';
import {getDownloadState} from '../services/videoService';
import {DownloadItem} from '../types';

const getStatusIndicator = (status: DownloadItem['status']): {emoji: string; color: string} => {
  switch (status) {
    case 'completed': return {emoji: '✓', color: Colors.dark.success};
    case 'downloading': return {emoji: '↓', color: Colors.dark.accentLight};
    case 'paused': return {emoji: '⏸', color: Colors.dark.warning};
    case 'failed': return {emoji: '!', color: Colors.dark.error};
    default: return {emoji: '···', color: Colors.dark.textMuted};
  }
};

export const DownloadsScreen: React.FC = () => {
  const {t} = useTranslation();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useFocusEffect(
    useCallback(() => {
      setDownloads(getDownloadState());
    }, [])
  );

  // Search only downloads (as requested)
  const filtered = downloads.filter(d =>
    !searchQuery.trim() ||
    d.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderItem = ({item}: {item: DownloadItem}) => {
    const statusInfo = getStatusIndicator(item.status);
    return (
      <TouchableOpacity
        style={styles.downloadCard}
        activeOpacity={0.8}
        onPress={() => {
          if (item.status === 'completed' && item.localPath) {
            navigation.navigate('Player', {url: item.localPath, title: item.title});
          }
        }}
      >
        {item.imageUrl ? (
          <FastImage
            source={{uri: item.imageUrl}}
            style={styles.thumb}
            resizeMode={FastImage.resizeMode.cover}
            fallback
          />
        ) : (
          <View style={[styles.thumb, {justifyContent: 'center', alignItems: 'center'}]}>
            <Image source={require('../../assets/icons/files.png')} style={{width: 24, height: 24, tintColor: Colors.dark.textMuted}} />
          </View>
        )}
        <View style={styles.info}>
          <Text style={styles.downloadTitle} numberOfLines={2}>{item.title}</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, {backgroundColor: statusInfo.color}]}>
              <Text style={styles.statusEmoji}>{statusInfo.emoji}</Text>
            </View>
            <Text style={[styles.statusText, {color: statusInfo.color}]}>
              {t(item.status)}
            </Text>
            {item.quality ? <Text style={styles.quality}>{item.quality}</Text> : null}
          </View>
          {item.status === 'downloading' && (
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, {width: `${item.progress * 100}%`}]} />
            </View>
          )}
        </View>
        {item.status === 'completed' && (
          <Image source={require('../../assets/icons/clapboard.png')} style={{width: 28, height: 28, tintColor: Colors.dark.accentLight}} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.dark.background} />

      {/* Header */}
      <View style={[styles.header, {paddingTop: insets.top + 6}]}>
        <Text style={styles.headerTitle}>{t('downloads')}</Text>
        {downloads.length > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{downloads.length}</Text>
          </View>
        )}
      </View>

      {/* Search (searches downloads only) */}
      <View style={styles.searchRow}>
        <Image source={require('../../assets/icons/search.png')} style={[styles.searchIcon, {tintColor: Colors.dark.textMuted}]} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('search_downloads')}
          placeholderTextColor={Colors.dark.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Text style={styles.clearBtn}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Image source={require('../../assets/icons/files.png')} style={{width: 40, height: 40, tintColor: Colors.dark.textMuted}} />
          </View>
          <Text style={styles.emptyTitle}>{t('no_downloads')}</Text>
          <Text style={styles.emptySub}>{t('no_downloads_sub')}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.list, {paddingBottom: insets.bottom + 100}]}
          showsVerticalScrollIndicator={false}
          renderItem={renderItem}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 10,
  },
  headerTitle: {
    color: Colors.dark.text,
    fontSize: 26,
    fontWeight: '800',
    fontFamily: 'Rubik',
    flex: 1,
  },
  countBadge: {
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Rubik',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  searchIcon: {
    width: 18,
    height: 18,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: Colors.dark.text,
    fontSize: 14,
    paddingVertical: 10,
    fontFamily: 'Rubik',
  },
  clearBtn: {
    color: Colors.dark.textMuted,
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 4,
  },
  list: {paddingHorizontal: 16, paddingTop: 4},
  downloadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 12,
  },
  thumb: {
    width: 60, height: 90,
    borderRadius: 8,
    backgroundColor: Colors.dark.surfaceLight,
  },
  info: {flex: 1},
  downloadTitle: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Rubik',
    marginBottom: 6,
    lineHeight: 20,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusDot: {
    width: 16, height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusEmoji: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Rubik',
  },
  quality: {
    color: Colors.dark.accentLight,
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Rubik',
    backgroundColor: `${Colors.dark.accent}20`,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 4,
  },
  progressBar: {
    marginTop: 8,
    height: 3,
    backgroundColor: Colors.dark.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.dark.accentLight,
    borderRadius: 2,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 88, height: 88,
    borderRadius: 44,
    backgroundColor: Colors.dark.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  emptyTitle: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Rubik',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySub: {
    color: Colors.dark.textMuted,
    fontSize: 14,
    textAlign: 'center',
    fontFamily: 'Rubik',
    lineHeight: 20,
  },
});
