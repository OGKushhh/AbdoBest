/**
 * HomeScreen
 *
 * Sections:
 *   1. "Most Viewed"   — fetched from GET /api/view/:category/:id for all loaded items,
 *                        sorted descending. Falls back to items with embedded Views field.
 *   2. "Latest Added"  — first slice of freshly loaded movies dict (newest first)
 *   3. "Anime"         — slice of anime category
 *   4. "Series"        — slice of series category
 *
 * No trending/featured JSON endpoints used.
 * Search button in top-right opens full-screen search overlay.
 */

import React, {useState, useCallback, useMemo, useRef, memo, useEffect} from 'react';
import {
  View, StyleSheet, FlatList, RefreshControl,
  StatusBar, Text, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {loadCategory, getMoviesArray, searchContent} from '../services/metadataService';
import {getViewCount} from '../services/api';
import {trySyncViews} from '../services/viewService';
import {ContentItem} from '../types';
import {MovieCard, CARD_WIDTH} from '../components/MovieCard';
import {SectionHeader} from '../components/SectionHeader';
import {SearchBar} from '../components/SearchBar';
import {LoadingSpinner} from '../components/LoadingSpinner';
import {ErrorView} from '../components/ErrorView';
import {Colors} from '../theme/colors';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import Icon from 'react-native-vector-icons/Ionicons';

const H_CARD_W = 142;

// ── Stable horizontal row — never re-renders unless items change ────
interface HRowProps {
  title: string;
  items: ContentItem[];
  onSeeAll?: () => void;
  onPressItem: (item: ContentItem) => void;
}

const HRow = memo<HRowProps>(({title, items, onSeeAll, onPressItem}) => {
  if (!items.length) return null;
  return (
    <View style={styles.section}>
      <SectionHeader title={title} onSeeAll={onSeeAll} />
      <FlatList
        data={items}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.hList}
        keyExtractor={i => i.id}
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        windowSize={7}
        removeClippedSubviews
        getItemLayout={(_, idx) => ({length: H_CARD_W + 10, offset: (H_CARD_W + 10) * idx, index: idx})}
        renderItem={({item}) => (
          <View style={{marginRight: 10}}>
            <MovieCard item={item} onPress={onPressItem} width={H_CARD_W} />
          </View>
        )}
      />
    </View>
  );
}, (p, n) => p.title === n.title && p.items.length === n.items.length && p.items[0]?.id === n.items[0]?.id);
HRow.displayName = 'HRow';

// ── Enrich items with live view counts from the API ─────────────────
const enrichWithViewCounts = async (
  items: ContentItem[],
  category: string,
  sample = 30,
): Promise<ContentItem[]> => {
  const batch = items.slice(0, sample);
  const withCounts = await Promise.all(
    batch.map(async item => {
      try {
        const v = await getViewCount(category, item.id);
        return {...item, Views: v > 0 ? String(v) : item.Views ?? ''};
      } catch {
        return item;
      }
    })
  );
  return withCounts;
};

// Sort by views descending (using Views string field)
const sortByViews = (items: ContentItem[]): ContentItem[] =>
  [...items].sort((a, b) => {
    const va = parseInt((a as any).Views || '0', 10);
    const vb = parseInt((b as any).Views || '0', 10);
    return vb - va;
  });

export const HomeScreen: React.FC = () => {
  const {t} = useTranslation();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [movies,  setMovies]  = useState<ContentItem[]>([]);
  const [anime,   setAnime]   = useState<ContentItem[]>([]);
  const [series,  setSeries]  = useState<ContentItem[]>([]);
  const [mostViewed, setMostViewed] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // Search
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ContentItem[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  // ── Load data ──────────────────────────────────────────────────
  const loadData = useCallback(async (force = false) => {
    try {
      setError(null);

      // Load movies + anime + series in parallel
      const [moviesData, animeData, seriesData] = await Promise.all([
        loadCategory('movies',  force).catch(() => null),
        loadCategory('anime',   force).catch(() => null),
        loadCategory('series',  force).catch(() => null),
      ]);

      const moviesArr = moviesData  ? getMoviesArray(moviesData  as Record<string, any>) : [];
      const animeArr  = animeData   ? getMoviesArray(animeData   as Record<string, any>) : [];
      const seriesArr = seriesData  ? getMoviesArray(seriesData  as Record<string, any>) : [];

      setMovies(moviesArr);
      setAnime(animeArr.slice(0, 20));
      setSeries(seriesArr.slice(0, 20));

      // Build initial most-viewed from embedded Views field
      const withViews = [...moviesArr, ...animeArr, ...seriesArr]
        .filter(i => parseInt((i as any).Views || '0', 10) > 0);
      const initialTop = withViews.length >= 6
        ? sortByViews(withViews).slice(0, 20)
        : [...moviesArr].reverse().slice(0, 20);
      setMostViewed(initialTop);

      // Async: enrich top candidates with live API view counts
      enrichWithViewCounts(moviesArr.slice(0, 30), 'movies').then(enriched => {
        const liveTop = sortByViews(enriched).filter(i => parseInt((i as any).Views || '0', 10) > 0);
        if (liveTop.length >= 4) setMostViewed(liveTop.slice(0, 20));
      }).catch(() => {});

      // Try syncing pending view counts
      trySyncViews().catch(() => {});
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = useCallback(() => { setRefreshing(true); loadData(true); }, [loadData]);

  // ── Navigation ─────────────────────────────────────────────────
  const goToDetails  = useCallback((item: ContentItem) => navigation.navigate('Details', {item}), [navigation]);
  const goToCategory = useCallback((cat: string) => navigation.navigate('Category', {category: cat}), [navigation]);

  // ── Search ─────────────────────────────────────────────────────
  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    clearTimeout(searchTimer.current);
    if (!q.trim()) { setSearchResults([]); setSearching(false); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      const results = await searchContent(q).catch(() => []);
      setSearchResults(results);
      setSearching(false);
    }, 380);
  }, []);

  // ── Latest = first 20 movies (dict order = insertion order = newest) ──
  const latestMovies = useMemo(() => movies.slice(0, 20), [movies]);

  if (loading) return <LoadingSpinner />;
  if (error && !movies.length) return <ErrorView message={error} onRetry={() => loadData(true)} />;

  // ── Search overlay ─────────────────────────────────────────────
  if (searchVisible) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.dark.background} />
        <View style={[styles.searchHeader, {paddingTop: insets.top + 6}]}>
          <SearchBar
            value={searchQuery}
            onChangeText={handleSearch}
            placeholder={t('search_placeholder')}
            show
            onToggle={() => { setSearchVisible(false); setSearchQuery(''); setSearchResults([]); }}
          />
        </View>

        {searching ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={Colors.dark.primary} />
          </View>
        ) : searchResults.length > 0 ? (
          <FlatList
            data={searchResults}
            numColumns={2}
            keyExtractor={i => i.id}
            contentContainerStyle={styles.searchGrid}
            columnWrapperStyle={styles.row}
            showsVerticalScrollIndicator={false}
            renderItem={({item}) => <MovieCard item={item} onPress={goToDetails} />}
          />
        ) : searchQuery.length > 0 ? (
          <View style={styles.centerBox}>
            <Text style={styles.noResultsText}>{t('no_results')}</Text>
          </View>
        ) : null}
      </View>
    );
  }

  // ── Main home ──────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.dark.background} />

      {/* Top bar */}
      <View style={[styles.topBar, {paddingTop: insets.top + 6}]}>
        <Text style={styles.appName}>AbdoBest</Text>
        <TouchableOpacity style={styles.searchBtn} onPress={() => setSearchVisible(true)}>
          <Icon name="search-outline" size={22} color={Colors.dark.text} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={[]}
        ListHeaderComponent={
          <>
            <HRow
              title={t('most_viewed')}
              items={mostViewed}
              onSeeAll={() => goToCategory('movies')}
              onPressItem={goToDetails}
            />
            <HRow
              title={t('latest_movies')}
              items={latestMovies}
              onSeeAll={() => goToCategory('movies')}
              onPressItem={goToDetails}
            />
            <HRow
              title={t('anime')}
              items={anime}
              onSeeAll={() => goToCategory('anime')}
              onPressItem={goToDetails}
            />
            <HRow
              title={t('series')}
              items={series}
              onSeeAll={() => goToCategory('series')}
              onPressItem={goToDetails}
            />
          </>
        }
        renderItem={() => null}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.dark.primary}
            colors={[Colors.dark.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{paddingBottom: insets.bottom + 90, paddingTop: 4}}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container:   {flex: 1, backgroundColor: Colors.dark.background},
  topBar:      {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 8},
  appName:     {color: Colors.dark.primary, fontSize: 26, fontWeight: '900', fontFamily: 'Rubik', letterSpacing: 0.3},
  searchBtn:   {width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.dark.surface, justifyContent: 'center', alignItems: 'center'},
  searchHeader:{paddingHorizontal: 14, paddingBottom: 6},
  section:     {marginBottom: 6},
  hList:       {paddingLeft: 14, paddingRight: 14},
  searchGrid:  {paddingHorizontal: 14, paddingBottom: 80, paddingTop: 8},
  row:         {justifyContent: 'space-between'},
  centerBox:   {flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 60},
  noResultsText: {color: Colors.dark.textMuted, fontSize: 15, fontFamily: 'Rubik'},
});
