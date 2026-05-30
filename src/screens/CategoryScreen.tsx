/**
 * CategoryScreen (Browse) – using per‑category JSON (full metadata)
 * Uses loadCategory (no indexer)
 */

import React, {
  useState, useEffect, useMemo, useCallback, memo, useRef,
} from 'react';
import { unstable_batchedUpdates } from 'react-native';
import {
  View, StyleSheet, FlatList, Text, TouchableOpacity,
  TextInput, StatusBar, Modal, ScrollView, Dimensions,
  ActivityIndicator, InteractionManager,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadCategory, getRuntimeCache, clearRuntimeCache } from '../services/metadataService';
import { ContentItem } from '../types';
import { MovieCard, CARD_WIDTH } from '../components/MovieCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorView } from '../components/ErrorView';
import { Colors } from '../theme/colors';
import { CATEGORIES } from '../constants/categories';
import { useTranslation } from 'react-i18next';
import { Image } from 'react-native';
import { getAllViews } from '../services/api';

import { localizeGenre, localizeGenres } from '../i18n/genres';

const ANIME_CATS = new Set(['anime', 'anime-movies']);
type AnimeSeason = 'Winter' | 'Spring' | 'Summer' | 'Fall';

function getAnimeSeason(dateStr: string | null | undefined): AnimeSeason | null {
  if (!dateStr) return null;
  const month = parseInt(String(dateStr).slice(5, 7), 10);
  if (!month) return null;
  return month <= 3 ? 'Winter' : month <= 6 ? 'Spring' : month <= 9 ? 'Summer' : 'Fall';
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const PAGE_SIZE = 30;

const SORT_OPTIONS = [
  { key: 'year_desc', labelKey: 'sort_newest' },
  { key: 'year_asc',  labelKey: 'sort_oldest' },
  { key: 'az',        labelKey: 'sort_az' },
  { key: 'za',        labelKey: 'sort_za' },
] as const;

// Hoisted sort helpers (work with ContentItem, using capitalized fields)
const sortByYearAsc = (items: ContentItem[]) =>
  [...items].sort((a, b) => {
    const ya = parseInt((a as any).ReleaseDate || (a as any).Year || '0', 10);
    const yb = parseInt((b as any).ReleaseDate || (b as any).Year || '0', 10);
    if (ya !== yb) return ya - yb;
    // Same year — tiebreak by last_scraped ISO timestamp (newer first)
    const sa = (a as any).last_scraped || '';
    const sb = (b as any).last_scraped || '';
    return sb.localeCompare(sa);
  });
const sortByAZ = (items: ContentItem[]) =>
  [...items].sort((a, b) => (a.Title || '').localeCompare(b.Title || ''));
const sortByZA = (items: ContentItem[]) =>
  [...items].sort((a, b) => (b.Title || '').localeCompare(a.Title || ''));
const sortByRatingDesc = (items: ContentItem[]) =>
  [...items].sort((a, b) => {
    const ra = parseFloat((a as any).Rating || '0');
    const rb = parseFloat((b as any).Rating || '0');
    return rb - ra;
  });

const keyExtractor = (item: ContentItem) => item.id;

const MovieCardItem = memo<{ item: ContentItem; onPress: (item: ContentItem) => void }>(
  ({ item, onPress }) => <MovieCard item={item} onPress={onPress} />,
  (prev, next) => prev.item.id === next.item.id,
);
MovieCardItem.displayName = 'MovieCardItem';


export const CategoryScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const isRTL = i18n.language === 'ar';
  const lang = isRTL ? 'ar' : 'en';

  const [allItems, setAllItems] = useState<ContentItem[]>([]);
  const loadedCategoryRef = useRef<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState(route.params?.category || 'movies');

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedSort, setSelectedSort] = useState<string>('year_desc');
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [ramadanFilter, setRamadanFilter] = useState<boolean>(false);
  const [selectedSeason, setSelectedSeason] = useState<AnimeSeason | null>(null);

  const [visibleItems, setVisibleItems] = useState<ContentItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const loadingMoreRef = useRef(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [showFilterPopup, setShowFilterPopup] = useState(false);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  const toggleSection = useCallback((key: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  const handleOpenFilterPopup = useCallback(() => {
    const active = new Set<string>();
    if (selectedSort !== 'year_desc') active.add('sort');
    if (selectedGenres.length > 0) active.add('genre');
    if (selectedYear) active.add('year');
    if (selectedCountry) active.add('country');
    if (ramadanFilter) active.add('ramadan');
    if (selectedSeason) active.add('animeSeason');
    setOpenSections(active);
    setShowFilterPopup(true);
  }, [selectedSort, selectedGenres, selectedYear, selectedCountry, ramadanFilter, selectedSeason]);

  // Sync when arriving with different params
  useEffect(() => {
    const incomingCat = route.params?.category;
    const incomingGenre = route.params?.genre;
    if (incomingCat && incomingCat !== selectedCategory) setSelectedCategory(incomingCat);
    if (incomingGenre !== undefined) setSelectedGenre(incomingGenre || null);
  }, [route.params?.category, route.params?.genre]);

  // Debounce search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(searchTimer.current!);
  }, [searchQuery]);

  // Load data — runtimeCache first (instant), disk fallback, network last
  const loadCategoryData = useCallback(async () => {
    // Fix 1: Only show spinner when switching to a different category or first load.
    // Avoids tearing down the UI on same-category re-focus.
    if (loadedCategoryRef.current !== selectedCategory) setLoading(true);
    setError(null);

    InteractionManager.runAfterInteractions(async () => {
      try {
        // ── Runtime cache hit: HomeScreen already loaded this, pre-sorted ──
        const cached = getRuntimeCache(selectedCategory);
        const itemsArray: ContentItem[] = cached
          ? cached
          : (d => Array.isArray(d) ? d as ContentItem[] : Object.values(d as any) as ContentItem[])((await loadCategory(selectedCategory as any)) ?? []);

        // Fix 3: Batch all 10 setState calls into a single re-render.
        // On old arch (Bridge) + async callbacks, React 18 does NOT
        // auto-batch — each setState triggers its own render cycle,
        // running all useMemos (filtered, availableGenres, availableYears,
        // availableCountries) on thousands of items per call. One render instead of 10.
        unstable_batchedUpdates(() => {
          setSelectedGenres([]);
          setSelectedYear(null);
          setSelectedCountry(null);
          setRamadanFilter(false);
          setSelectedSeason(null);
          setSelectedSort('year_desc');
          setSearchQuery('');
          setDebouncedQuery('');
          setHasMore(true);
          setPage(1);
          setAllItems(itemsArray);
          loadedCategoryRef.current = selectedCategory;
          setLoading(false);
        });

        // ── Views enrichment — getAllViews() cache hit (10 min TTL, free from HomeScreen) ──
        getAllViews().then(leaderboard => {
          const viewMap = new Map(
            leaderboard
              .filter(e => e.category === selectedCategory)
              .map(e => [e.id, e.views])
          );
          if (!viewMap.size) return;
          setAllItems(prev =>
            prev.map(item => {
              const v = viewMap.get(item.id);
              return v ? {...item, Views: String(v)} : item;
            })
          );
        }).catch(() => {});

      } catch (err: any) {
        setError(err.message || t('error_loading'));
        setLoading(false);
      }
    });
  }, [selectedCategory, t]);

  useEffect(() => { loadCategoryData(); }, [loadCategoryData]);

  // Filtered + sorted result
  const filtered = useMemo(() => {
    let result = allItems;
    if (debouncedQuery.trim()) {
      const q = debouncedQuery.toLowerCase();
      result = result.filter(item =>
        item.Title?.toLowerCase().includes(q) ||
        item.Genres?.some(g => g.toLowerCase().includes(q)) ||
        item.GenresAr?.some(g => g.toLowerCase().includes(q)) ||
        item.Country?.toLowerCase().includes(q)
      );
    }
    if (selectedGenres.length > 0) {
      const enKeys = selectedGenres.map(g => localizeGenre(g, 'en').toLowerCase());
      const arKeys = selectedGenres.map(g => localizeGenre(g, 'ar').toLowerCase());
      result = result.filter(item =>
        item.Genres?.some(g => enKeys.includes(g.toLowerCase()) || arKeys.includes(g.toLowerCase())) ||
        item.GenresAr?.some(g => enKeys.includes(g.toLowerCase()) || arKeys.includes(g.toLowerCase()))
      );
    }
    if (selectedYear) {
      result = result.filter(item =>
        String((item as any).ReleaseDate || (item as any).Year || '').slice(0, 4) === selectedYear
      );
    }
    if (selectedCountry) {
      result = result.filter(item =>
        item.Country?.toLowerCase() === selectedCountry.toLowerCase()
      );
    }
    if (ramadanFilter) {
      result = result.filter(item => !!(item as any).IsRamadan);
    }
    if (selectedSeason && ANIME_CATS.has(selectedCategory)) {
      result = result.filter(item =>
        getAnimeSeason((item as any).ReleaseDate || (item as any).Year) === selectedSeason
      );
    }
    switch (selectedSort) {
      case 'az': return sortByAZ(result);
      case 'za': return sortByZA(result);
      case 'year_asc': return sortByYearAsc(result);
      case 'rating_desc': return sortByRatingDesc(result);
      default:
        // Fix 2: allItems is pre-sorted year_desc by _setRuntimeCache at store time.
        // Re-sorting here on every filter change was re-sorting thousands of already-
        // sorted items for no reason. Filtering preserves relative order, so just return.
        return result;
    }
  }, [allItems, debouncedQuery, selectedGenres, selectedYear, selectedCountry, ramadanFilter, selectedSeason, selectedSort, selectedCategory]);

  const filteredRef = useRef(filtered);
  filteredRef.current = filtered;

  useEffect(() => { setPage(1); }, [debouncedQuery, selectedGenres, selectedYear, selectedCountry, ramadanFilter, selectedSeason, selectedSort]);

  useEffect(() => {
    const end = page * PAGE_SIZE;
    const nextChunk = filteredRef.current.slice(0, end);
    setVisibleItems(nextChunk);
    setHasMore(end < filteredRef.current.length);
  }, [filtered, page]);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setPage(p => p + 1);
    requestAnimationFrame(() => {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    });
  }, [hasMore]);

  const navigateToDetails = useCallback((item: ContentItem) => navigation.navigate('Details', { item }), [navigation]);
  const renderItem = useCallback(({ item }: { item: ContentItem }) => <MovieCardItem item={item} onPress={navigateToDetails} />, [navigateToDetails]);

  const handleCategorySelect = useCallback((cat: string) => {
    setSelectedCategory(cat);
    setSelectedGenres([]);
    setSelectedYear(null);
    setSelectedCountry(null);
    setSelectedSort('year_desc');
    setSearchQuery('');
    setDebouncedQuery('');
    setShowFilterPopup(false);
  }, []);

  // Available genres — localized to current language, deduped
  const availableGenres = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    allItems.forEach(item => {
      const raw = lang === 'ar'
        ? [...(item.GenresAr || []), ...(item.Genres || [])]
        : [...(item.Genres || []), ...(item.GenresAr || [])];
      raw.forEach(g => {
        const localized = localizeGenre(g, lang as 'ar' | 'en');
        if (localized && !seen.has(localized)) {
          seen.add(localized);
          result.push(localized);
        }
      });
    });
    return result.sort((a, b) => a.localeCompare(b));
  }, [allItems, lang]);

  const availableCountries = useMemo(() => {
    const s = new Set<string>();
    allItems.forEach(item => {
      const c = item.Country?.trim();
      if (c) s.add(c);
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [allItems]);

  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const s = new Set<string>();
    allItems.forEach(item => {
      // For anime cats use ReleaseDate first to get accurate year
      const raw = ANIME_CATS.has(selectedCategory)
        ? ((item as any).ReleaseDate || (item as any).Year) ?? (item as any).year
        : (item as any).Year ?? (item as any).year;
      if (!raw) return;
      const n = parseInt(String(raw).slice(0, 4), 10);
      if (!isNaN(n) && n >= 2000 && n <= currentYear + 1) s.add(String(n));
    });
    return Array.from(s).sort((a, b) => b.localeCompare(a));
  }, [allItems, selectedCategory]);

  const catConfig = CATEGORIES.find(c => c.key === selectedCategory);
  const screenTitle = catConfig ? (lang === 'ar' ? catConfig.labelAr : catConfig.labelEn) : t(selectedCategory);
  const activeFilterCount = (selectedGenres.length > 0 ? 1 : 0) + (selectedYear ? 1 : 0) + (selectedCountry ? 1 : 0) + (ramadanFilter ? 1 : 0) + (selectedSeason ? 1 : 0) + (selectedSort !== 'year_desc' ? 1 : 0);
  const clearFilters = useCallback(() => { setSelectedGenres([]); setSelectedYear(null); setSelectedCountry(null); setRamadanFilter(false); setSelectedSeason(null); setSelectedSort('year_desc'); }, []);
  const closeFilterPopup = useCallback(() => setShowFilterPopup(false), []);

  if (loading) return <LoadingSpinner />;
  if (error && !allItems.length) return <ErrorView message={error} onRetry={loadCategoryData} />;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.dark.background} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }, isRTL && styles.rowRTL]}>
        {navigation.canGoBack() && route.name !== 'BrowseTab' && (
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Image source={require('../../assets/icons/arrow.png')} style={[styles.headerIcon, { tintColor: Colors.dark.text, transform: [{ scaleX: isRTL ? -1 : 1 }] }]} />
          </TouchableOpacity>
        )}
        <Text style={[styles.headerTitle, isRTL && styles.textRTL]}>{screenTitle}</Text>
      </View>

      {/* Category tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.catTabsContent, isRTL && { flexDirection: 'row-reverse' }]}
        style={styles.catTabsRow}
      >
        {CATEGORIES.map(cat => {
          const isActive = selectedCategory === cat.key;
          return (
            <TouchableOpacity
              key={cat.key}
              style={[styles.catTab, isActive && styles.catTabActive]}
              onPress={() => handleCategorySelect(cat.key)}
              activeOpacity={0.75}
            >
              <Text style={[styles.catTabText, isActive && styles.catTabTextActive]} numberOfLines={1}>
                {lang === 'ar' ? cat.labelAr : cat.labelEn}
              </Text>
              {isActive && !loading && (
                <Text style={styles.catTabCount}>{allItems.length.toLocaleString()}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Search + filter button */}
      <View style={[styles.searchRow, isRTL && styles.rowRTL]}>
        <Image source={require('../../assets/icons/search.png')} style={[styles.searchIcon, { tintColor: Colors.dark.textMuted }]} />
        <TextInput style={[styles.searchInput, isRTL && styles.textRTL]} placeholder={t('search_placeholder')} placeholderTextColor={Colors.dark.textMuted} value={searchQuery} onChangeText={setSearchQuery} textAlign={isRTL ? 'right' : 'left'} />
        {searchQuery.length > 0 && <TouchableOpacity onPress={() => { setSearchQuery(''); setDebouncedQuery(''); }} style={styles.clearBtn}><Text style={{ fontSize: 18, color: Colors.dark.textMuted, fontWeight: '700' }}>×</Text></TouchableOpacity>}
        <TouchableOpacity style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]} onPress={handleOpenFilterPopup}>
          <Image source={require('../../assets/icons/setting.png')} style={[styles.filterBtnIcon, { tintColor: activeFilterCount > 0 ? Colors.dark.primary : Colors.dark.textSecondary }]} />
          {activeFilterCount > 0 && <View style={styles.filterBadge}><Text style={styles.filterBadgeText}>{activeFilterCount}</Text></View>}
        </TouchableOpacity>
      </View>

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <View style={[styles.activeFiltersRow, isRTL && styles.rowRTL]}>
          {selectedGenres.map(genre => <TouchableOpacity key={genre} style={styles.activeChip} onPress={() => setSelectedGenres(prev => prev.filter(g => g !== genre))}><Text style={styles.activeChipText}>{genre}</Text><Text style={styles.activeChipX}>×</Text></TouchableOpacity>)}
          {selectedYear && <TouchableOpacity style={styles.activeChip} onPress={() => setSelectedYear(null)}><Text style={styles.activeChipText}>{selectedYear}</Text><Text style={styles.activeChipX}>×</Text></TouchableOpacity>}
          {selectedCountry && <TouchableOpacity style={styles.activeChip} onPress={() => setSelectedCountry(null)}><Text style={styles.activeChipText}>{selectedCountry}</Text><Text style={styles.activeChipX}>×</Text></TouchableOpacity>}
          {ramadanFilter && <TouchableOpacity style={[styles.activeChip, {borderColor: '#C9A84C'}]} onPress={() => setRamadanFilter(false)}><Text style={[styles.activeChipText, {color: '#C9A84C'}]}>🌙 رمضان</Text><Text style={styles.activeChipX}>×</Text></TouchableOpacity>}
          {selectedSeason && <TouchableOpacity style={styles.activeChip} onPress={() => setSelectedSeason(null)}><Text style={styles.activeChipText}>{t(('season_' + selectedSeason.toLowerCase()) as any)}</Text><Text style={styles.activeChipX}>×</Text></TouchableOpacity>}
          {selectedSort !== 'year_desc' && <TouchableOpacity style={styles.activeChip} onPress={() => setSelectedSort('year_desc')}><Text style={styles.activeChipText}>{t(selectedSort)}</Text><Text style={styles.activeChipX}>×</Text></TouchableOpacity>}
          <TouchableOpacity onPress={clearFilters}><Text style={styles.clearAllText}>{t('cancel')}</Text></TouchableOpacity>
        </View>
      )}

      {/* Grid */}
      {visibleItems.length === 0 ? (
        <View style={styles.emptyContainer}><Text style={[styles.emptyText, isRTL && styles.textRTL]}>{t('no_results')}</Text></View>
      ) : (
        <FlatList
          data={visibleItems}
          numColumns={2}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + 100 }]}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
          initialNumToRender={PAGE_SIZE}
          maxToRenderPerBatch={PAGE_SIZE}
          windowSize={10}
          removeClippedSubviews
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={Colors.dark.primary} style={{ margin: 20 }} /> : null}
        />
      )}

      {/* Filter Modal */}
      <Modal visible={showFilterPopup} transparent animationType="fade" onRequestClose={closeFilterPopup}>
        <TouchableOpacity style={styles.filterOverlay} activeOpacity={1} onPress={closeFilterPopup}>
          <View style={styles.filterPanel}>
            <View style={[styles.filterHeader, isRTL && styles.rowRTL]}>
              <Text style={[styles.filterTitle, isRTL && styles.textRTL]}>{t('filter')}</Text>
              <TouchableOpacity onPress={closeFilterPopup}><Image source={require('../../assets/icons/close.png')} style={[styles.headerIcon, { tintColor: Colors.dark.text }]} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: SCREEN_HEIGHT * 0.7 }}>

              {/* Sort accordion */}
              <TouchableOpacity
                style={[styles.accordionBar, isRTL && styles.rowRTL, (selectedSort !== 'year_desc') && styles.accordionBarActive]}
                onPress={() => toggleSection('sort')}
                activeOpacity={0.7}
              >
                <Text style={[styles.accordionLabel, isRTL && styles.textRTL, (selectedSort !== 'year_desc') && styles.accordionLabelActive]}>
                  {t('sort_by')}{selectedSort !== 'year_desc' ? ` · ${t(SORT_OPTIONS.find(o => o.key === selectedSort)?.labelKey ?? '')}` : ''}
                </Text>
                <Text style={[styles.accordionChevron, openSections.has('sort') && styles.accordionChevronOpen]}>›</Text>
              </TouchableOpacity>
              {openSections.has('sort') && (
                <View style={[styles.filterOptionsRow, styles.accordionBody]}>
                  {SORT_OPTIONS.map(opt => (
                    <TouchableOpacity key={opt.key} style={[styles.filterOptionChip, selectedSort === opt.key && styles.filterOptionChipActive]} onPress={() => setSelectedSort(opt.key)}>
                      <Text style={[styles.filterOptionText, selectedSort === opt.key && styles.filterOptionTextActive]}>{t(opt.labelKey)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Genres accordion */}
              {availableGenres.length > 0 && (
                <>
                  <TouchableOpacity
                    style={[styles.accordionBar, isRTL && styles.rowRTL, selectedGenres.length > 0 && styles.accordionBarActive]}
                    onPress={() => toggleSection('genre')}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.accordionLabel, isRTL && styles.textRTL, selectedGenres.length > 0 && styles.accordionLabelActive]}>
                      {t('genres')}{selectedGenres.length > 0 ? ` · ${selectedGenres.length}` : ''}
                    </Text>
                    <Text style={[styles.accordionChevron, openSections.has('genre') && styles.accordionChevronOpen]}>›</Text>
                  </TouchableOpacity>
                  {openSections.has('genre') && (
                    <View style={[styles.filterOptionsRow, styles.accordionBody]}>
                      <TouchableOpacity style={[styles.filterOptionChip, selectedGenres.length === 0 && styles.filterOptionChipActive]} onPress={() => setSelectedGenres([])}>
                        <Text style={[styles.filterOptionText, selectedGenres.length === 0 && styles.filterOptionTextActive]}>{t('all')}</Text>
                      </TouchableOpacity>
                      {availableGenres.map(genre => {
                        const isSel = selectedGenres.includes(genre);
                        return (
                          <TouchableOpacity
                            key={genre}
                            style={[styles.filterOptionChip, isSel && styles.filterOptionChipActive]}
                            onPress={() => setSelectedGenres(prev => isSel ? prev.filter(g => g !== genre) : [...prev, genre])}
                          >
                            <Text style={[styles.filterOptionText, isSel && styles.filterOptionTextActive]}>{genre}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </>
              )}

              {/* Year accordion */}
              {availableYears.length > 0 && (
                <>
                  <TouchableOpacity
                    style={[styles.accordionBar, isRTL && styles.rowRTL, !!selectedYear && styles.accordionBarActive]}
                    onPress={() => toggleSection('year')}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.accordionLabel, isRTL && styles.textRTL, !!selectedYear && styles.accordionLabelActive]}>
                      {t('year')}{selectedYear ? ` · ${selectedYear}` : ''}
                    </Text>
                    <Text style={[styles.accordionChevron, openSections.has('year') && styles.accordionChevronOpen]}>›</Text>
                  </TouchableOpacity>
                  {openSections.has('year') && (
                    <View style={[styles.filterOptionsRow, styles.accordionBody]}>
                      <TouchableOpacity style={[styles.filterOptionChip, !selectedYear && styles.filterOptionChipActive]} onPress={() => setSelectedYear(null)}>
                        <Text style={[styles.filterOptionText, !selectedYear && styles.filterOptionTextActive]}>{t('all')}</Text>
                      </TouchableOpacity>
                      {availableYears.map(year => (
                        <TouchableOpacity key={year} style={[styles.filterOptionChip, selectedYear === year && styles.filterOptionChipActive]} onPress={() => setSelectedYear(selectedYear === year ? null : year)}>
                          <Text style={[styles.filterOptionText, selectedYear === year && styles.filterOptionTextActive]}>{year}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </>
              )}

              {/* Country accordion */}
              {availableCountries.length > 0 && (
                <>
                  <TouchableOpacity
                    style={[styles.accordionBar, isRTL && styles.rowRTL, !!selectedCountry && styles.accordionBarActive]}
                    onPress={() => toggleSection('country')}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.accordionLabel, isRTL && styles.textRTL, !!selectedCountry && styles.accordionLabelActive]}>
                      {t('country')}{selectedCountry ? ` · ${selectedCountry}` : ''}
                    </Text>
                    <Text style={[styles.accordionChevron, openSections.has('country') && styles.accordionChevronOpen]}>›</Text>
                  </TouchableOpacity>
                  {openSections.has('country') && (
                    <View style={[styles.filterOptionsRow, styles.accordionBody]}>
                      <TouchableOpacity style={[styles.filterOptionChip, !selectedCountry && styles.filterOptionChipActive]} onPress={() => setSelectedCountry(null)}>
                        <Text style={[styles.filterOptionText, !selectedCountry && styles.filterOptionTextActive]}>{t('all')}</Text>
                      </TouchableOpacity>
                      {availableCountries.map(country => (
                        <TouchableOpacity key={country} style={[styles.filterOptionChip, selectedCountry === country && styles.filterOptionChipActive]} onPress={() => setSelectedCountry(selectedCountry === country ? null : country)}>
                          <Text style={[styles.filterOptionText, selectedCountry === country && styles.filterOptionTextActive]}>{country === 'USA' ? t('country_usa') : country === 'UK' ? t('country_uk') : country}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </>
              )}

              {/* Anime Season accordion — only for anime / anime-movies */}
              {ANIME_CATS.has(selectedCategory) && (
                <>
                  <TouchableOpacity
                    style={[styles.accordionBar, isRTL && styles.rowRTL, !!selectedSeason && styles.accordionBarActive]}
                    onPress={() => toggleSection('animeSeason')}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.accordionLabel, isRTL && styles.textRTL, !!selectedSeason && styles.accordionLabelActive]}>
                      {t('anime_season_filter')}{selectedSeason ? ` · ${t(('season_' + selectedSeason.toLowerCase()) as any)}` : ''}
                    </Text>
                    <Text style={[styles.accordionChevron, openSections.has('animeSeason') && styles.accordionChevronOpen]}>›</Text>
                  </TouchableOpacity>
                  {openSections.has('animeSeason') && (
                    <View style={[styles.filterOptionsRow, styles.accordionBody]}>
                      <TouchableOpacity style={[styles.filterOptionChip, !selectedSeason && styles.filterOptionChipActive]} onPress={() => setSelectedSeason(null)}>
                        <Text style={[styles.filterOptionText, !selectedSeason && styles.filterOptionTextActive]}>{t('all')}</Text>
                      </TouchableOpacity>
                      {(['Winter', 'Spring', 'Summer', 'Fall'] as AnimeSeason[]).map(s => (
                        <TouchableOpacity
                          key={s}
                          style={[styles.filterOptionChip, selectedSeason === s && styles.filterOptionChipActive]}
                          onPress={() => setSelectedSeason(selectedSeason === s ? null : s)}
                        >
                          <Text style={[styles.filterOptionText, selectedSeason === s && styles.filterOptionTextActive]}>
                            {t(('season_' + s.toLowerCase()) as any)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </>
              )}

              {/* Ramadan accordion — only for arabic-series */}
              {selectedCategory === 'arabic-series' && (
                <>
                  <TouchableOpacity
                    style={[styles.accordionBar, isRTL && styles.rowRTL, ramadanFilter && styles.accordionBarRamadan]}
                    onPress={() => toggleSection('ramadan')}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.accordionLabel, isRTL && styles.textRTL, ramadanFilter && { color: '#C9A84C' }]}>
                      🌙 رمضان / Ramadan{ramadanFilter ? ' · مسلسلات رمضان' : ''}
                    </Text>
                    <Text style={[styles.accordionChevron, openSections.has('ramadan') && styles.accordionChevronOpen]}>›</Text>
                  </TouchableOpacity>
                  {openSections.has('ramadan') && (
                    <View style={[styles.filterOptionsRow, styles.accordionBody]}>
                      <TouchableOpacity style={[styles.filterOptionChip, !ramadanFilter && styles.filterOptionChipActive]} onPress={() => setRamadanFilter(false)}>
                        <Text style={[styles.filterOptionText, !ramadanFilter && styles.filterOptionTextActive]}>{t('all')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.filterOptionChip, ramadanFilter && { borderColor: '#C9A84C', backgroundColor: 'rgba(201,168,76,0.15)' }]}
                        onPress={() => setRamadanFilter(!ramadanFilter)}
                      >
                        <Text style={[styles.filterOptionText, ramadanFilter && { color: '#C9A84C', fontWeight: '700' }]}>
                          🌙 مسلسلات رمضان
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}
            </ScrollView>
            <View style={[styles.filterFooter, isRTL && styles.rowRTL]}>
              <Text style={[styles.filterResultCount, isRTL && styles.textRTL]}>{filtered.length} {t('results')}</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {activeFilterCount > 0 && (
                  <TouchableOpacity style={styles.filterClearBtn} onPress={clearFilters}>
                    <Text style={styles.filterClearText}>{t('clear')}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.filterApplyBtn} onPress={closeFilterPopup}>
                  <Text style={styles.filterApplyText}>{t('apply')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10, gap: 10 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.dark.surface, justifyContent: 'center', alignItems: 'center' },
  headerIcon: { width: 20, height: 20 },
  headerTitle: { flex: 1, color: Colors.dark.text, fontSize: 22, fontWeight: '800', fontFamily: 'Rubik' },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 8, backgroundColor: Colors.dark.surface, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 2, borderWidth: 1, borderColor: Colors.dark.border, gap: 4 },
  searchIcon: { width: 18, height: 18 },
  searchInput: { flex: 1, color: Colors.dark.text, fontSize: 14, paddingVertical: 10, fontFamily: 'Rubik' },
  clearBtn: { paddingHorizontal: 4 },
  filterBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.dark.background, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.dark.border },
  filterBtnActive: { borderColor: Colors.dark.primary, backgroundColor: `${Colors.dark.primary}20` },
  filterBtnIcon: { width: 18, height: 18 },
  filterBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: Colors.dark.primary, width: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  filterBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  activeFiltersRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 8, gap: 8, flexWrap: 'wrap' },
  activeChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: `${Colors.dark.primary}20`, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1, borderColor: `${Colors.dark.primary}40`, gap: 4 },
  activeChipText: { color: Colors.dark.primary, fontSize: 12, fontFamily: 'Rubik' },
  activeChipX: { color: Colors.dark.textMuted, fontSize: 12, fontFamily: 'Rubik' },
  clearAllText: { color: Colors.dark.textMuted, fontSize: 12, fontFamily: 'Rubik', marginLeft: 4 },
  grid: { paddingHorizontal: 14, paddingTop: 4 },
  row: { justifyContent: 'space-between', gap: 12 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 60 },
  emptyText: { color: Colors.dark.textMuted, fontSize: 16, fontFamily: 'Rubik' },
  filterOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center' },
  filterPanel: { backgroundColor: Colors.dark.surface, borderRadius: 24, padding: 20, width: '90%', maxWidth: 480, maxHeight: '85%', borderWidth: 1, borderColor: Colors.dark.border },
  filterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.dark.border },
  filterTitle: { color: Colors.dark.text, fontSize: 20, fontWeight: '700', fontFamily: 'Rubik' },
  filterSectionTitle: { color: Colors.dark.textSecondary, fontSize: 12, fontWeight: '600', fontFamily: 'Rubik', marginBottom: 8, marginTop: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  filterOptionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  filterOptionChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: Colors.dark.background, borderWidth: 1, borderColor: Colors.dark.border },
  filterOptionChipActive: { backgroundColor: `${Colors.dark.primary}20`, borderColor: Colors.dark.primary },
  filterOptionText: { color: Colors.dark.textSecondary, fontSize: 13, fontWeight: '500', fontFamily: 'Rubik' },
  filterOptionTextActive: { color: Colors.dark.primary, fontWeight: '600' },
  catTabsRow:       { marginBottom: 10 },
  catTabsContent:   { paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8 },
  catTab:           { alignItems: 'center', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 22, backgroundColor: Colors.dark.surface, borderWidth: 1, borderColor: Colors.dark.border },
  catTabActive:     { backgroundColor: Colors.dark.primary, borderColor: Colors.dark.primary },
  catTabText:       { color: Colors.dark.textSecondary, fontSize: 13, fontWeight: '600', fontFamily: 'Rubik' },
  catTabTextActive: { color: '#fff' },
  catTabCount:      { color: 'rgba(255,255,255,0.65)', fontSize: 10, fontFamily: 'Rubik', marginTop: 1 },
  filterFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.dark.border },
  filterResultCount: { color: Colors.dark.textMuted, fontSize: 13, fontFamily: 'Rubik' },
  filterApplyBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: Colors.dark.primary },
  filterApplyText: { color: '#fff', fontSize: 14, fontWeight: '700', fontFamily: 'Rubik' },
  filterClearBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: Colors.dark.border },
  filterClearText: { color: Colors.dark.textSecondary, fontSize: 14, fontWeight: '600', fontFamily: 'Rubik' },
  rowRTL: { flexDirection: 'row-reverse' },
  textRTL: { textAlign: 'right', writingDirection: 'rtl' },
  accordionBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 14, borderRadius: 12, backgroundColor: Colors.dark.background, borderWidth: 1, borderColor: Colors.dark.border, marginBottom: 6 },
  accordionBarActive: { borderColor: Colors.dark.primary, backgroundColor: `${Colors.dark.primary}15` },
  accordionBarRamadan: { borderColor: '#C9A84C', backgroundColor: 'rgba(201,168,76,0.1)' },
  accordionLabel: { color: Colors.dark.textSecondary, fontSize: 14, fontWeight: '600', fontFamily: 'Rubik', flex: 1 },
  accordionLabelActive: { color: Colors.dark.primary },
  accordionChevron: { color: Colors.dark.textMuted, fontSize: 20, fontWeight: '300', transform: [{ rotate: '90deg' }] },
  accordionChevronOpen: { transform: [{ rotate: '-90deg' }] },
  accordionBody: { marginBottom: 10, paddingHorizontal: 4 },
});