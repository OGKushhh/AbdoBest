/**
 * FavoritesScreen.tsx
 * Three-tab screen: Favourites / Watched / Watch Later
 * Tapping a card navigates to DetailsScreen. Long-press removes it.
 *
 * Grid uses the same MovieCard component as CategoryScreen (2 columns,
 * same title styling, same rating/quality/category/season badges) —
 * whenever the full item is available in the runtime cache. If a title
 * isn't cached yet (e.g. fresh app launch, that category hasn't loaded),
 * falls back to a stub card with just the title/image that were saved
 * when the user favourited it.
 */

import React, {useState, useCallback, useEffect, useMemo} from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  StatusBar, Image, RefreshControl, Alert, Modal, ScrollView,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {Colors} from '../theme/colors';
import {useTranslation} from 'react-i18next';
import {
  CollectionEntry,
  CollectionName,
  getCollectionItems,
  removeFromCollection,
  fetchCollections,
} from '../services/favoritesService';
import {getRuntimeCache} from '../services/metadataService';
import {ContentItem} from '../types';
import {MovieCard, CARD_WIDTH} from '../components/MovieCard';
import {CATEGORIES} from '../constants/categories';

// ─── Types ───────────────────────────────────────────────────────────────────
type Tab = 'favourites' | 'watched' | 'watch_later';
type SortKey = 'added_desc' | 'added_asc' | 'az' | 'za';

const TABS: {key: Tab; labelKey: string}[] = [
  {key: 'favourites',  labelKey: 'favorites_tab_favourites'},
  {key: 'watched',     labelKey: 'favorites_tab_watched'},
  {key: 'watch_later', labelKey: 'favorites_tab_watch_later'},
];

const SORT_OPTIONS: {key: SortKey; labelKey: string}[] = [
  {key: 'added_desc', labelKey: 'sort_newest'},
  {key: 'added_asc',  labelKey: 'sort_oldest'},
  {key: 'az',         labelKey: 'sort_az'},
  {key: 'za',         labelKey: 'sort_za'},
];

const CATEGORY_LABEL: Record<string, {en: string; ar: string}> =
  Object.fromEntries(CATEGORIES.map(c => [c.key, {en: c.labelEn, ar: c.labelAr}]));

/** Builds a minimal ContentItem-shaped stub so MovieCard can still render
 *  (title/image only — every badge in MovieCard is already guarded with a
 *  truthy check, so empty fields here just mean no badges, not a crash). */
function stubContentItem(entry: CollectionEntry): ContentItem {
  return {
    id: entry.content_id,
    Title: entry.title,
    'Image Source': entry.image,
    Category: entry.category,
    Source: '',
    Genres: [],
    GenresAr: [],
    Format: '',
    Runtime: null,
    Country: null,
  } as unknown as ContentItem;
}

// ─── Screen ──────────────────────────────────────────────────────────────────
export const FavoritesScreen: React.FC = () => {
  const {t, i18n} = useTranslation();
  const insets    = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const isRTL     = i18n.language === 'ar';
  const lang      = isRTL ? 'ar' : 'en';

  const [activeTab, setActiveTab]   = useState<Tab>('favourites');
  const [items, setItems]           = useState<CollectionEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [showFilterPopup, setShowFilterPopup] = useState(false);
  const [selectedSort, setSelectedSort]         = useState<SortKey>('added_desc');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

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

  // Reset category filter when switching tabs — categories present differ per tab
  useEffect(() => { setSelectedCategories([]); }, [activeTab]);

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

  const handlePress = useCallback((fullItem: ContentItem) => {
    navigation.navigate('Details', {item: fullItem});
  }, [navigation]);

  // Hydrate each saved entry with its full cached ContentItem when available,
  // so the card gets the same rating/quality/category/season badges as
  // CategoryScreen — falls back to a title/image-only stub otherwise.
  const hydrated = useMemo(() => {
    return items.map(entry => {
      const cached = getRuntimeCache(entry.category);
      const full = cached?.find(i => i.id === entry.content_id);
      return {entry, full: full ?? stubContentItem(entry)};
    });
  }, [items]);

  // Distinct categories present in this tab, for the filter chips
  const availableCategories = useMemo(() => {
    const set = new Set(items.map(i => i.category));
    return Array.from(set);
  }, [items]);

  const activeFilterCount = selectedCategories.length + (selectedSort !== 'added_desc' ? 1 : 0);

  const visibleItems = useMemo(() => {
    let list = hydrated;
    if (selectedCategories.length > 0) {
      list = list.filter(({entry}) => selectedCategories.includes(entry.category));
    }
    const sorted = [...list];
    switch (selectedSort) {
      case 'added_asc':
        sorted.sort((a, b) => a.entry.added_at.localeCompare(b.entry.added_at));
        break;
      case 'az':
        sorted.sort((a, b) => a.entry.title.localeCompare(b.entry.title));
        break;
      case 'za':
        sorted.sort((a, b) => b.entry.title.localeCompare(a.entry.title));
        break;
      case 'added_desc':
      default:
        sorted.sort((a, b) => b.entry.added_at.localeCompare(a.entry.added_at));
        break;
    }
    return sorted;
  }, [hydrated, selectedCategories, selectedSort]);

  const toggleCategory = useCallback((cat: string) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  }, []);

  const clearFilters = useCallback(() => {
    setSelectedSort('added_desc');
    setSelectedCategories([]);
  }, []);

  const isEmpty = items.length === 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.dark.background} />

      {/* Header — same title styling as CategoryScreen */}
      <View style={[styles.header, {paddingTop: insets.top + 6}, isRTL && styles.rowRTL]}>
        <Text style={[styles.headerTitle, isRTL && styles.textRTL]}>{t('favorites')}</Text>
        {!isEmpty && (
          <TouchableOpacity
            style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]}
            onPress={() => setShowFilterPopup(true)}
          >
            <Image source={require('../../assets/icons/setting.png')} style={[styles.filterBtnIcon, {tintColor: activeFilterCount > 0 ? Colors.dark.primary : Colors.dark.textSecondary}]} />
            {activeFilterCount > 0 && <View style={styles.filterBadge}><Text style={styles.filterBadgeText}>{activeFilterCount}</Text></View>}
          </TouchableOpacity>
        )}
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

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <View style={[styles.activeFiltersRow, isRTL && styles.rowRTL]}>
          {selectedCategories.map(cat => (
            <TouchableOpacity key={cat} style={styles.activeChip} onPress={() => toggleCategory(cat)}>
              <Text style={styles.activeChipText}>{CATEGORY_LABEL[cat]?.[lang] ?? cat}</Text>
              <Text style={styles.activeChipX}>×</Text>
            </TouchableOpacity>
          ))}
          {selectedSort !== 'added_desc' && (
            <TouchableOpacity style={styles.activeChip} onPress={() => setSelectedSort('added_desc')}>
              <Text style={styles.activeChipText}>{t(SORT_OPTIONS.find(s => s.key === selectedSort)!.labelKey)}</Text>
              <Text style={styles.activeChipX}>×</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={clearFilters}><Text style={styles.clearAllText}>{t('clear_all_filters')}</Text></TouchableOpacity>
        </View>
      )}

      {/* Grid */}
      {isEmpty ? (
        <View style={styles.emptyContainer}>
          <Image
            source={require('../../assets/icons/heart.png')}
            style={styles.emptyIcon}
          />
          <Text style={styles.emptyTitle}>{t(`favorites_empty_${activeTab}`)}</Text>
          <Text style={styles.emptySubtitle}>{t('favorites_empty_hint')}</Text>
        </View>
      ) : visibleItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptySubtitle}>{t('no_results')}</Text>
        </View>
      ) : (
        <FlatList
          data={visibleItems}
          keyExtractor={({entry}) => `${entry.category}:${entry.content_id}`}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={[styles.grid, {paddingBottom: insets.bottom + 100}]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={Colors.dark.primary}
            />
          }
          renderItem={({item: {entry, full}}) => (
            <View>
              <MovieCard
                item={full}
                onPress={handlePress}
                onLongPress={() => handleRemove(entry)}
                width={CARD_WIDTH}
              />
              {activeTab === 'watched' && entry.progress && (entry.progress.season || entry.progress.episode) && (
                <View style={styles.progressBadge}>
                  <Text style={styles.progressText}>
                    {entry.progress.season
                      ? `S${entry.progress.season}E${entry.progress.episode ?? '?'}`
                      : `E${entry.progress.episode}`}
                  </Text>
                </View>
              )}
            </View>
          )}
        />
      )}

      {/* Filter Modal */}
      <Modal visible={showFilterPopup} transparent animationType="fade" onRequestClose={() => setShowFilterPopup(false)}>
        <TouchableOpacity style={styles.filterOverlay} activeOpacity={1} onPress={() => setShowFilterPopup(false)}>
          <View style={styles.filterPanel} onStartShouldSetResponder={() => true}>
            <View style={[styles.filterHeader, isRTL && styles.rowRTL]}>
              <Text style={[styles.filterTitle, isRTL && styles.textRTL]}>{t('filter')}</Text>
              <TouchableOpacity onPress={() => setShowFilterPopup(false)}>
                <Image source={require('../../assets/icons/close.png')} style={[styles.headerIcon, {tintColor: Colors.dark.text}]} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.filterSectionTitle, isRTL && styles.textRTL]}>{t('filter')}</Text>
              <View style={[styles.chipsWrap, isRTL && styles.rowRTL]}>
                {SORT_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.chip, selectedSort === opt.key && styles.chipActive]}
                    onPress={() => setSelectedSort(opt.key)}
                  >
                    <Text style={[styles.chipText, selectedSort === opt.key && styles.chipTextActive]}>{t(opt.labelKey)}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {availableCategories.length > 1 && (
                <>
                  <Text style={[styles.filterSectionTitle, isRTL && styles.textRTL]}>{t('category')}</Text>
                  <View style={[styles.chipsWrap, isRTL && styles.rowRTL]}>
                    {availableCategories.map(cat => {
                      const active = selectedCategories.includes(cat);
                      return (
                        <TouchableOpacity
                          key={cat}
                          style={[styles.chip, active && styles.chipActive]}
                          onPress={() => toggleCategory(cat)}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>
                            {CATEGORY_LABEL[cat]?.[lang] ?? cat}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}
            </ScrollView>

            <TouchableOpacity style={styles.applyBtn} onPress={() => setShowFilterPopup(false)}>
              <Text style={styles.applyBtnText}>{t('filter')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 10, gap: 10,
  },
  headerTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    color: Colors.dark.text,
    fontFamily: 'Rubik',
  },
  filterBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.dark.surface,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.dark.border,
  },
  filterBtnActive: {
    borderColor: Colors.dark.primary,
    backgroundColor: `${Colors.dark.primary}20`,
  },
  filterBtnIcon: {width: 18, height: 18},
  filterBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: Colors.dark.primary,
    width: 16, height: 16, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
  },
  filterBadgeText: {color: '#fff', fontSize: 9, fontWeight: '700'},
  headerIcon: {width: 20, height: 20},
  rowRTL: {flexDirection: 'row-reverse'},
  textRTL: {textAlign: 'right', writingDirection: 'rtl'},
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
  activeFiltersRow: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 16, marginBottom: 8, gap: 6, alignItems: 'center',
  },
  activeChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: Colors.dark.primary, gap: 4,
  },
  activeChipText: {color: Colors.dark.primary, fontSize: 12, fontFamily: 'Rubik'},
  activeChipX: {color: Colors.dark.primary, fontSize: 14, fontWeight: '700'},
  clearAllText: {color: Colors.dark.textMuted, fontSize: 12, fontFamily: 'Rubik', textDecorationLine: 'underline'},
  grid: {
    paddingHorizontal: 14,
    paddingTop: 4,
  },
  row: {
    justifyContent: 'space-between',
  },
  progressBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
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
  // Filter modal
  filterOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end',
  },
  filterPanel: {
    backgroundColor: Colors.dark.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: '70%',
  },
  filterHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 16,
  },
  filterTitle: {fontSize: 18, fontWeight: '700', color: Colors.dark.text, fontFamily: 'Rubik-Bold'},
  filterSectionTitle: {
    fontSize: 13, fontWeight: '600', color: Colors.dark.textMuted,
    fontFamily: 'Rubik', marginBottom: 8, marginTop: 12,
  },
  chipsWrap: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    backgroundColor: Colors.dark.background,
    borderWidth: 1, borderColor: Colors.dark.border,
  },
  chipActive: {borderColor: Colors.dark.primary, backgroundColor: `${Colors.dark.primary}20`},
  chipText: {color: Colors.dark.textSecondary, fontSize: 13, fontFamily: 'Rubik'},
  chipTextActive: {color: Colors.dark.primary, fontWeight: '700'},
  applyBtn: {
    backgroundColor: Colors.dark.primary, borderRadius: 12,
    paddingVertical: 13, alignItems: 'center', marginTop: 16,
  },
  applyBtnText: {color: '#fff', fontSize: 15, fontWeight: '700', fontFamily: 'Rubik-Bold'},
});
