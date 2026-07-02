/**
 * FavoritesScreen.tsx
 * Three-tab screen: Favourites / Watched / Watch Later
 * Tapping a card navigates to DetailsScreen.
 */

import React, {useState, useCallback, useEffect} from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  StatusBar, Image, RefreshControl, Alert,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import FastImage from 'react-native-fast-image';
import {Colors} from '../theme/colors';
import {useTranslation} from 'react-i18next';
import {
  CollectionEntry,
  CollectionName,
  getCollectionItems,
  removeFromCollection,
  fetchCollections,
} from '../services/favoritesService';
import {API_BASE} from '../constants/endpoints';

// ─── Types ───────────────────────────────────────────────────────────────────
type Tab = 'favourites' | 'watched' | 'watch_later';

const TABS: {key: Tab; labelKey: string}[] = [
  {key: 'favourites',  labelKey: 'favorites_tab_favourites'},
  {key: 'watched',     labelKey: 'favorites_tab_watched'},
  {key: 'watch_later', labelKey: 'favorites_tab_watch_later'},
];

// ─── Card ────────────────────────────────────────────────────────────────────
const CARD_W = 110;
const CARD_H = 160;

interface CardProps {
  item: CollectionEntry;
  tab:  Tab;
  onPress:  () => void;
  onRemove: () => void;
}

const FavCard: React.FC<CardProps> = ({item, tab, onPress, onRemove}) => {
  const {t} = useTranslation();
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      onLongPress={onRemove}
      activeOpacity={0.75}>
      <FastImage
        source={{uri: item.image, priority: FastImage.priority.normal}}
        style={styles.cardImage}
        resizeMode={FastImage.resizeMode.cover}
      />
      {/* progress badge for watched */}
      {tab === 'watched' && item.progress && (item.progress.season || item.progress.episode) && (
        <View style={styles.progressBadge}>
          <Text style={styles.progressText}>
            {item.progress.season
              ? `S${item.progress.season}E${item.progress.episode ?? '?'}`
              : `E${item.progress.episode}`}
          </Text>
        </View>
      )}
      <View style={styles.cardOverlay}>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
      </View>
    </TouchableOpacity>
  );
};

// ─── Screen ──────────────────────────────────────────────────────────────────
export const FavoritesScreen: React.FC = () => {
  const {t, i18n} = useTranslation();
  const insets    = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const isRTL     = i18n.language === 'ar';

  const [activeTab, setActiveTab] = useState<Tab>('favourites');
  const [items,     setItems]     = useState<CollectionEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (withServerSync = false) => {
    if (withServerSync) {
      setRefreshing(true);
      await fetchCollections();
      setRefreshing(false);
    }
    const data = await getCollectionItems(activeTab as CollectionName);
    setItems(data);
  }, [activeTab]);

  // Reload when tab changes or screen comes into focus
  useFocusEffect(useCallback(() => { load(false); }, [load]));
  useEffect(() => { load(false); }, [activeTab]);

  const handleRemove = useCallback((item: CollectionEntry) => {
    Alert.alert(
      t('favorites_remove_title'),
      t('favorites_remove_body', {title: item.title}),
      [
        {text: t('cancel'), style: 'cancel'},
        {
          text: t('remove'),
          style: 'destructive',
          onPress: async () => {
            await removeFromCollection(activeTab as CollectionName, item.content_id, item.category);
            load(false);
          },
        },
      ],
    );
  }, [activeTab, load, t]);

  const handlePress = useCallback(async (item: CollectionEntry) => {
    try {
      const cat = item.category;
      const res = await fetch();
      const data = await res.json();
      const fullItem = data[item.content_id] ?? data[Object.keys(data).find(k => k === item.content_id) ?? ''];
      if (fullItem) {
        navigation.navigate('Details', {
          item: { ...fullItem, id: item.content_id, Category: cat },
          category: cat,
        });
        return;
      }
    } catch {}
    // Fallback to stub if fetch fails
    navigation.navigate('Details', {
      item: {
        id: item.content_id,
        Title: item.title,
        'Image Source': item.image,
        Category: item.category,
        Source: '',
        Genres: [],
        GenresAr: [],
        Format: '',
        Runtime: null,
        Country: null,
      },
      category: item.category,
    });
  }, [navigation]);

  const isEmpty = items.length === 0;

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.dark.background} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('favorites')}</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]}
            onPress={() => setActiveTab(tab.key)}
            activeOpacity={0.7}>
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
              {t(tab.labelKey)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      {isEmpty ? (
        <View style={styles.emptyContainer}>
          <Image
            source={require('../../assets/icons/heart.png')}
            style={styles.emptyIcon}
          />
          <Text style={styles.emptyTitle}>{t(`favorites_empty_${activeTab}`)}</Text>
          <Text style={styles.emptySubtitle}>{t('favorites_empty_hint')}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => `${item.category}:${item.content_id}`}
          numColumns={3}
          contentContainerStyle={styles.grid}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={Colors.dark.primary}
            />
          }
          renderItem={({item}) => (
            <FavCard
              item={item}
              tab={activeTab}
              onPress={() => handlePress(item)}
              onRemove={() => handleRemove(item)}
            />
          )}
        />
      )}
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.dark.text,
    fontFamily: 'Rubik-Bold',
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: Colors.dark.surface,
    borderRadius: 10,
    padding: 3,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabItemActive: {
    backgroundColor: Colors.dark.primary,
  },
  tabLabel: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    fontFamily: 'Rubik',
  },
  tabLabelActive: {
    color: '#fff',
    fontWeight: '600',
    fontFamily: 'Rubik-Bold',
  },
  grid: {
    paddingHorizontal: 12,
    paddingBottom: 20,
  },
  card: {
    width: CARD_W,
    height: CARD_H,
    margin: 5,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: Colors.dark.surface,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 6,
    paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  cardTitle: {
    fontSize: 11,
    color: '#fff',
    fontFamily: 'Rubik',
    lineHeight: 14,
  },
  progressBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: Colors.dark.primary,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  progressText: {
    fontSize: 10,
    color: '#fff',
    fontFamily: 'Rubik-Bold',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    tintColor: Colors.dark.textMuted,
    marginBottom: 16,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: 18,
    color: Colors.dark.text,
    fontFamily: 'Rubik-Bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.dark.textMuted,
    fontFamily: 'Rubik',
    textAlign: 'center',
    lineHeight: 20,
  },
});
