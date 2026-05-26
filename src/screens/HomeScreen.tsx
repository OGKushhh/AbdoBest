import React, {
  useState, useCallback, useMemo, useRef, useEffect,
} from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl, StatusBar,
  TouchableOpacity, Image, TextInput, ActivityIndicator,
  Dimensions, Animated, ScrollView,
} from 'react-native';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import FastImage from 'react-native-fast-image';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import {
  loadCategory, getMoviesArray, getRuntimeCache, searchContent,
  BackgroundUpdateCallback, clearRuntimeCache, sortByNewest,
} from '../services/metadataService';
import {ContentItem} from '../types';
import {MovieCard, CARD_WIDTH} from '../components/MovieCard';
import {Colors} from '../theme/colors';
import AdsterraBanner from '../ads/AdsterraBanner';
import {getAllViews, invalidateViewsCache} from '../services/api';
import {retrySyncViews} from '../services/viewService';

const {width: SW} = Dimensions.get('window');


const HERO_H = SW * 0.78;
const SECTION_CARD_W = SW * 0.38;
const SECTION_CARD_H = SECTION_CARD_W * 1.52;

// ── All categories (unchanged) ────────────────────────────────────────────────
const CATEGORIES = [
  'movies',
  'dubbed-movies',
  'hindi',
  'anime',
  'asian-movies',
  'anime-movies',
  'series',
  'tvshows',
  'asian-series',
  'arabic-series',
] as const;

// Category emoji icons for the browse grid
const CAT_EMOJI: Record<string, string> = {
  most_viewed: '🏆',
  'movies':         '🎬',
  'dubbed-movies':  '🎙️',
  'hindi':          '🎵',
  'asian-movies':   '🌏',
  'anime':          '⚡',
  'anime-movies':   '🎌',
  'series':         '📺',
  'tvshows':        '📡',
  'asian-series':   '🌸',
  'arabic-series':  '🌙',
};

// ─────────────────────────────────────────────────────────────────────────────
// HeroBanner – auto-rotate + swipe, cinematic style
// ─────────────────────────────────────────────────────────────────────────────
const HeroBanner: React.FC<{
  items: ContentItem[];
  onPress: (item: ContentItem) => void;
  insetTop?: number;
}> = ({items, onPress, insetTop = 0}) => {
  const {t} = useTranslation();
  const flatListRef = useRef<FlatList>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const progressAnim = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  const startProgress = useCallback(() => {
    animRef.current?.stop();
    progressAnim.setValue(0);
    animRef.current = Animated.timing(progressAnim, {
      toValue: 1,
      duration: 5000,
      useNativeDriver: false,
    });
    animRef.current.start();
  }, [progressAnim]);

  useEffect(() => {
    if (items.length <= 1) return;
    startProgress();
    timerRef.current = setInterval(() => {
      setActiveIdx(prev => (prev + 1) % items.length);
    }, 5000);
    return () => {
      clearInterval(timerRef.current);
      animRef.current?.stop();
    };
  }, [items]);

  useEffect(() => {
    startProgress();
    if (flatListRef.current && items.length > 0) {
      flatListRef.current.scrollToIndex({index: activeIdx, animated: true});
    }
  }, [activeIdx]);

  const handleManualSwipe = useCallback((e: any) => {
    const offset = e.nativeEvent.contentOffset.x;
    const idx = Math.round(offset / SW);
    if (idx !== activeIdx && idx >= 0 && idx < items.length) {
      clearInterval(timerRef.current);
      animRef.current?.stop();
      setActiveIdx(idx);
      timerRef.current = setInterval(() => {
        setActiveIdx(prev => (prev + 1) % items.length);
      }, 5000);
    }
  }, [activeIdx, items.length]);

  if (!items.length) return null;

  return (
    <View style={heroS.wrapper}>
      <FlatList
        ref={flatListRef}
        data={items}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={i => i.id}
        getItemLayout={(_, idx) => ({length: SW, offset: SW * idx, index: idx})}
        onMomentumScrollEnd={handleManualSwipe}
        renderItem={({item}) => {
          const raw = item as any;
          const year = String(raw.ReleaseDate || raw.Year || '').slice(0, 4);
          const genres = (item.GenresAr?.length ? item.GenresAr : item.Genres)?.slice(0, 3) ?? [];
          const rating = raw.Rating || '';
          const quality = item.Format || raw.quality || '';
          const imageSource = item['Image Source'] || raw.Image;
          const description = raw.description || raw.Description || '';
          // Duration: prefer episodic field for series/anime, fall back to Runtime
          const isEpisodic = ['series','tvshows','anime','asian-series','arabic-series']
            .includes((item as any).Category || '');
          const duration = isEpisodic
            ? (raw.EpisodeDuration || raw.Runtime || '')
            : (raw.Runtime || raw.EpisodeDuration || '');

          return (
            <TouchableOpacity
              style={heroS.card}
              activeOpacity={0.95}
              onPress={() => onPress(item)}
            >
              <FastImage
                source={{uri: imageSource}}
                style={StyleSheet.absoluteFillObject}
                resizeMode={FastImage.resizeMode.cover}
              />
              {/* Deep gradient overlay */}
              <View style={heroS.gradientOverlay} />

              {/* Quality badge — top right */}
              {quality ? (
                <View style={[heroS.qualityBadge, {top: insetTop + 56}]}>
                  <Text style={heroS.qualityTxt}>{quality}</Text>
                </View>
              ) : null}

              {/* Rating badge — top left (keep existing position) */}
              {rating ? (
                <View style={[heroS.ratingBadge, {top: insetTop + 56}]}>
                  <Image
                    source={require('../../assets/icons/star.png')}
                    style={{width: 11, height: 11, tintColor: '#FFD700'}}
                  />
                  <Text style={heroS.ratingTxt}>{rating}</Text>
                </View>
              ) : null}

              {/* Bottom content */}
              <View style={heroS.content}>
                {/* 1. Genre pills */}
                {genres.length > 0 && (
                  <View style={heroS.genreRow}>
                    {genres.map((g, i) => (
                      <View key={i} style={heroS.genrePill}>
                        <Text style={heroS.genreTxt}>{g}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {/* 2. Title in tight dark badge */}
                <View style={heroS.titleBadge}>
                  <Text style={heroS.title} numberOfLines={2}>{item.Title}</Text>
                </View>
                {/* 3. Two-column row: left = meta pills + play btn, right = desc badge */}
                <View style={heroS.bottomRow}>
                  {/* Left column */}
                  <View style={heroS.leftCol}>
                    {/* Year + duration meta pills */}
                    <View style={heroS.metaPills}>
                      {year ? (
                        <View style={heroS.metaPill}>
                          <Text style={heroS.metaPillTxt}>{year}</Text>
                        </View>
                      ) : null}
                      {duration ? (
                        <View style={heroS.metaPill}>
                          <Text style={heroS.metaPillTxt}>{duration}</Text>
                        </View>
                      ) : null}
                    </View>
                    {/* Compact play button */}
                    <TouchableOpacity
                      style={heroS.playBtn}
                      onPress={() => onPress(item)}
                      activeOpacity={0.8}
                    >
                      <Image
                        source={require('../../assets/icons/play.png')}
                        style={{width: 13, height: 13, tintColor: '#fff'}}
                      />
                      <Text style={heroS.playTxt}>{t('play')}</Text>
                    </TouchableOpacity>
                  </View>
                  {/* Right column — frosted description badge */}
                  {description ? (
                    <View style={heroS.descBadge}>
                      <Text style={heroS.descTxt} numberOfLines={3}>{description}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* Progress bar indicators */}
      <View style={heroS.progressRow}>
        {items.map((_, i) => (
          <View key={i} style={heroS.progressTrack}>
            {i === activeIdx ? (
              <Animated.View
                style={[
                  heroS.progressFill,
                  {width: progressAnim.interpolate({inputRange: [0, 1], outputRange: ['0%', '100%']})},
                ]}
              />
            ) : (
              <View style={[heroS.progressFill, {width: i < activeIdx ? '100%' : '0%'}]} />
            )}
          </View>
        ))}
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SectionRow – horizontal scroll of cards for a category
// ─────────────────────────────────────────────────────────────────────────────
const SectionRow: React.FC<{
  catLabel: string;
  cat: string;
  items: ContentItem[];
  onPress: (item: ContentItem) => void;
  onSeeAll: () => void;
}> = ({catLabel, cat, items, onPress, onSeeAll}) => {
  const {t} = useTranslation();
  const emoji = CAT_EMOJI[cat] || '🎬';

  if (!items.length) return null;

  return (
    <View style={sectionS.wrapper}>
      {/* Header */}
      <View style={sectionS.header}>
        <View style={sectionS.headerLeft}>
          <Text style={sectionS.emoji}>{emoji}</Text>
          <Text style={sectionS.title}>{catLabel}</Text>
        </View>
        <TouchableOpacity style={sectionS.seeAllBtn} onPress={onSeeAll} activeOpacity={0.7}>
          <Text style={sectionS.seeAllTxt}>{t('all')}</Text>
          <Text style={sectionS.seeAllArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Horizontal card scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={sectionS.scrollContent}
      >
        {items.map(item => (
          <TouchableOpacity
            key={item.id}
            style={sectionS.card}
            onPress={() => onPress(item)}
            activeOpacity={0.78}
          >
            <FastImage
              source={{
                uri: item['Image Source'] || (item as any).Image || '',
                priority: FastImage.priority.normal,
              }}
              style={sectionS.poster}
              resizeMode={FastImage.resizeMode.cover}
            />
            {/* Rating badge */}
            {(item as any).Rating ? (
              <View style={sectionS.ratingBadge}>
                <Image
                  source={require('../../assets/icons/star.png')}
                  style={{width: 9, height: 9, tintColor: '#FFD700'}}
                />
                <Text style={sectionS.ratingTxt}>{(item as any).Rating}</Text>
              </View>
            ) : null}
            {/* Views badge */}
            {(item as any).Views ? (
              <View style={sectionS.viewsBadge}>
                <Image
                  source={require('../../assets/icons/eyes.png')}
                  style={{width: 9, height: 9, tintColor: '#fff'}}
                />
                <Text style={sectionS.viewsTxt}>{(item as any).Views}</Text>
              </View>
            ) : null}
            {/* Title */}
            <View style={sectionS.titleBox}>
              <Text style={sectionS.itemTitle} numberOfLines={2}>
                {(item.Title || '').replace(/\s*(مترجم|اون لاين|مسلسل|فيلم|online|مدبلج)\s*/gi, '').trim()}
              </Text>
              {((item as any).ReleaseDate || (item as any).Year) ? (
                <Text style={sectionS.year}>
                  {String((item as any).ReleaseDate || (item as any).Year).slice(0, 4)}
                </Text>
              ) : null}
            </View>
          </TouchableOpacity>
        ))}

        {/* See all card at end */}
        <TouchableOpacity style={sectionS.seeAllCard} onPress={onSeeAll} activeOpacity={0.75}>
          <View style={sectionS.seeAllInner}>
            <Text style={sectionS.seeAllCardEmoji}>{emoji}</Text>
            <Text style={sectionS.seeAllCardTxt}>{t('all')}</Text>
            <Text style={sectionS.seeAllCardArrow}>›</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Browse grid at the bottom
// ─────────────────────────────────────────────────────────────────────────────
const BrowseGrid: React.FC<{onPress: (cat: string) => void}> = ({onPress}) => {
  const {t} = useTranslation();
  const catI18nKey = (cat: string) =>
    cat === 'dubbed-movies' ? 'dubbed_movies' :
    cat === 'asian-movies'  ? 'asian_movies'  :
    cat === 'anime-movies'  ? 'anime_movies'  :
    cat === 'asian-series'  ? 'asian_series'  :
    cat === 'arabic-series' ? 'arabic_series' : cat;

  return (
    <View style={browseS.wrapper}>
      <Text style={browseS.heading}>{t('browse')}</Text>
      <View style={browseS.grid}>
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat}
            style={browseS.tile}
            onPress={() => onPress(cat)}
            activeOpacity={0.75}
          >
            <Text style={browseS.tileEmoji}>{CAT_EMOJI[cat]}</Text>
            <Text style={browseS.tileTxt} numberOfLines={2}>{t(catI18nKey(cat))}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// HomeScreen
// ─────────────────────────────────────────────────────────────────────────────
export const HomeScreen: React.FC = () => {
  const {t, i18n} = useTranslation();
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [categoryData, setCategoryData] = useState<Record<string, ContentItem[]>>({});
  const [mostViewed, setMostViewed] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search state (unchanged)
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ContentItem[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  const hasMountedRef = useRef(false);

  // Scroll-driven header opacity
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerBg = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: ['rgba(10,13,20,0)', 'rgba(10,13,20,0.98)'],
    extrapolate: 'clamp',
  });

  // ── Background update (unchanged) ──────────────────────────────────────────
  const onBackgroundUpdate = useCallback<BackgroundUpdateCallback>(
    (category, freshData) => {
      const freshItems = sortByNewest(getMoviesArray(freshData as any));
      setCategoryData(prev => ({...prev, [category]: freshItems}));
    },
    [],
  );

  // ── Core loader (unchanged logic) ──────────────────────────────────────────
  const loadData = useCallback(async (force = false) => {
    try {
      setError(null);
      // Runtime cache is populated by syncAllWithProgress on launch.
      // Read from memory first (instant, no disk, no parse, no sort).
      // Fall back to loadCategory only on force refresh or cache miss.
      const map: Record<string, ContentItem[]> = {};
      if (!force) {
        for (const cat of CATEGORIES) {
          const cached = getRuntimeCache(cat);
          if (cached) map[cat] = cached;
        }
      }
      // Load any categories not yet in runtime cache (or force refresh)
      const missing = CATEGORIES.filter(cat => force || !map[cat]);
      if (missing.length > 0) {
        const results = await Promise.all(
          missing.map(cat =>
            loadCategory(cat as any, force, force ? undefined : onBackgroundUpdate)
              .then(d => ({cat, items: getRuntimeCache(cat) ?? (d ? sortByNewest(getMoviesArray(d as any)) : [])}))
              .catch(() => ({cat, items: [] as ContentItem[]}))
          ),
        );
        for (const r of results) map[r.cat] = r.items;
      }
      setCategoryData(map);

      // ── Most Viewed — 1 fetch, pure array math, no per-title API calls ──────
      // getAllViews() fetches /api/views/all once (cached 10 min in module memory),
      // filters out episode-level keys, and returns entries sorted by views desc.
      // We map each entry against already-loaded categoryData — zero extra requests.
      const loadMostViewed = async () => {
        try {
          const leaderboard = await getAllViews();
          const top7: ContentItem[] = [];
          for (const entry of leaderboard) {
            if (top7.length >= 7) break;
            const catItems = map[entry.category] ?? [];
            const match = catItems.find(i => i.id === entry.id);
            if (match) top7.push({...match, Views: String(entry.views)});
          }
          setMostViewed(top7);
        } catch {
          // mostViewed stays empty — non-critical, rest of UI unaffected
        }
      };
      loadMostViewed();
      retrySyncViews().catch(() => {});
    } catch (err: any) {
      setError(err.message || 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [onBackgroundUpdate]);

  useFocusEffect(
    useCallback(() => {
      if (!hasMountedRef.current) {
        hasMountedRef.current = true;
        loadData(false);
      } else {
        loadData(false);
      }
    }, [loadData]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    invalidateViewsCache();
    clearRuntimeCache();   // force CategoryScreen to re-read fresh data
    loadData(true);
  }, [loadData]);

  // ── Hero items — data pre-sorted by sortByNewest() in loadData, just filter ───
  const heroItems = useMemo(() => {
    const movies = categoryData['movies'] ?? [];
    return movies
      .filter(i => !!(i['Image Source'] || (i as any).Image))
      .slice(0, 5);
  }, [categoryData]);

  // ── Sections — now includes top items per category for horizontal scroll ───
  // Category sections — newest 7 per category
  const sections = useMemo(() => {
    const catI18nKey = (cat: string) =>
      cat === 'dubbed-movies' ? 'dubbed_movies' :
      cat === 'asian-movies'  ? 'asian_movies'  :
      cat === 'anime-movies'  ? 'anime_movies'  :
      cat === 'asian-series'  ? 'asian_series'  :
      cat === 'arabic-series' ? 'arabic_series' : cat;

    return CATEGORIES
      .map(cat => ({
        cat,
        catLabel: t(catI18nKey(cat)),
        items: (categoryData[cat] ?? []).slice(0, 7),
      }))
      .filter(s => s.items.length > 0);
  }, [categoryData, t]);

  // ── Navigation (unchanged) ─────────────────────────────────────────────────
  const goDetails = useCallback((item: ContentItem) => nav.navigate('Details', {item}), [nav]);
  const goCategory = useCallback((cat: string) => nav.navigate('Category', {category: cat}), [nav]);

  // ── Search (unchanged logic) ───────────────────────────────────────────────
  const handleSearch = useCallback((text: string) => {
    setSearchQuery(text);
    clearTimeout(searchTimer.current);
    if (!text.trim()) { setSearchResults([]); return; }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try { setSearchResults(await searchContent(text)); } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 380);
  }, []);

  const closeSearch = () => { setSearchOpen(false); setSearchQuery(''); setSearchResults([]); };

  // ── Search screen (improved style, same logic) ────────────────────────────
  if (searchOpen) {
    return (
      <View style={S.container}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.dark.background} />
        <View style={[S.searchHeader, {paddingTop: insets.top + 8}]}>
          <View style={S.searchBox}>
            <Image source={require('../../assets/icons/search.png')} style={[S.searchIcon, {tintColor: Colors.dark.textMuted}]} />
            <TextInput
              style={S.searchInput}
              placeholder={t('search_placeholder')}
              placeholderTextColor={Colors.dark.textMuted}
              value={searchQuery}
              onChangeText={handleSearch}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
                <Text style={S.clearX}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity onPress={closeSearch}>
            <Text style={S.cancelTxt}>{t('cancel')}</Text>
          </TouchableOpacity>
        </View>
        {searching ? (
          <View style={S.center}><ActivityIndicator size="large" color={Colors.dark.primary} /></View>
        ) : searchResults.length > 0 ? (
          <FlatList
            data={searchResults}
            numColumns={2}
            keyExtractor={i => i.id}
            contentContainerStyle={S.searchGrid}
            columnWrapperStyle={S.row}
            showsVerticalScrollIndicator={false}
            renderItem={({item}) => <MovieCard item={item} onPress={goDetails} />}
          />
        ) : searchQuery.length > 0 ? (
          <View style={S.center}>
            <Text style={S.noResults}>{t('no_results')}</Text>
          </View>
        ) : null}
      </View>
    );
  }

  if (loading && !Object.keys(categoryData).length) {
    return (
      <View style={[S.container, S.center]}>
        <ActivityIndicator size="large" color={Colors.dark.primary} />
      </View>
    );
  }

  return (
    <View style={S.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Floating header — fades in on scroll */}
      <Animated.View style={[S.floatingHeader, {paddingTop: insets.top, backgroundColor: headerBg}]}>
        <Text style={S.appName}>
          <Text style={{color: '#E53935'}}>Abdo</Text>
          <Text style={{color: '#29B6F6'}}>Best</Text>
        </Text>
        <TouchableOpacity style={S.searchBtn} onPress={() => setSearchOpen(true)}>
          <Image source={require('../../assets/icons/search.png')} style={[S.searchBtnIcon, {tintColor: Colors.dark.text}]} />
        </TouchableOpacity>
      </Animated.View>

      <Animated.FlatList
        data={sections}
        keyExtractor={s => s.cat}
        onScroll={Animated.event([{nativeEvent: {contentOffset: {y: scrollY}}}], {useNativeDriver: false})}
        scrollEventThrottle={16}
        ListHeaderComponent={
          <View>
            {/* Hero — no top padding, goes edge to edge */}
            {heroItems.length > 0 && <HeroBanner items={heroItems} onPress={goDetails} insetTop={insets.top} />}

            {/* Ads */}
            <View style={{marginTop: 8, marginBottom: 4}}>
              <AdsterraBanner visible type="native" height={90} />
              <AdsterraBanner visible type="propeller" height={90} />
            </View>

            {/* Most Viewed — top 7 across all categories */}
            {mostViewed.length > 0 && (
              <SectionRow
                cat="most_viewed"
                catLabel={t('most_viewed')}
                items={mostViewed}
                onPress={goDetails}
                onSeeAll={() => {}}
              />
            )}
          </View>
        }
        renderItem={({item}) => (
          <SectionRow
            cat={item.cat}
            catLabel={item.catLabel}
            items={item.items}
            onPress={goDetails}
            onSeeAll={() => goCategory(item.cat)}
          />
        )}
        ListFooterComponent={
          <BrowseGrid onPress={goCategory} />
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.dark.primary}
            colors={[Colors.dark.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{paddingBottom: insets.bottom + 90}}
      />
    </View>
  );
};

// ─── Main styles ──────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.dark.background},
  center: {flex: 1, justifyContent: 'center', alignItems: 'center'},

  floatingHeader: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingBottom: 10,
  },
  appName: {fontSize: 26, fontWeight: '900', fontFamily: 'Rubik'},
  searchBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  searchBtnIcon: {width: 20, height: 20},

  // Search
  searchHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingBottom: 8, gap: 10,
  },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.dark.surface, borderRadius: 12,
    paddingHorizontal: 10, borderWidth: 1, borderColor: Colors.dark.border, gap: 6,
  },
  searchIcon: {width: 16, height: 16},
  searchInput: {flex: 1, color: Colors.dark.text, fontSize: 14, paddingVertical: 10, fontFamily: 'Rubik'},
  clearX: {color: Colors.dark.textMuted, fontSize: 16, padding: 4},
  cancelTxt: {color: Colors.dark.primary, fontSize: 14, fontWeight: '600', fontFamily: 'Rubik'},
  searchGrid: {paddingHorizontal: 14, paddingBottom: 80, paddingTop: 8},
  row: {justifyContent: 'space-between', gap: 12},
  noResults: {color: Colors.dark.textMuted, fontSize: 15, fontFamily: 'Rubik'},
});

// ─── Hero styles ──────────────────────────────────────────────────────────────
const heroS = StyleSheet.create({
  wrapper: {height: HERO_H, marginBottom: 8},
  card: {width: SW, height: HERO_H, overflow: 'hidden'},
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  // Quality badge — floats top-right
  qualityBadge: {
    position: 'absolute', top: 56, right: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  qualityTxt: {color: '#fff', fontSize: 11, fontWeight: '800', fontFamily: 'Rubik'},
  // Rating badge — floats top-left
  ratingBadge: {
    position: 'absolute', top: 56, left: 16,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)',
  },
  ratingTxt: {color: '#FFD700', fontSize: 11, fontWeight: '700', fontFamily: 'Rubik'},
  // Bottom content area
  content: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 16, paddingBottom: 36,
  },
  // 1. Genre pills row
  genreRow: {flexDirection: 'row', gap: 6, marginBottom: 7, flexWrap: 'wrap'},
  genrePill: {
    backgroundColor: `${Colors.dark.primary}CC`,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6,
  },
  genreTxt: {color: '#fff', fontSize: 11, fontWeight: '600', fontFamily: 'Rubik'},
  // 2. Title badge — tight wrap, dark semi-transparent
  titleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8, marginBottom: 8,
  },
  title: {
    color: '#fff', fontSize: 20, fontWeight: '900',
    fontFamily: 'Rubik',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: {width: 0, height: 2},
    textShadowRadius: 6,
  },
  // 3. Two-column row
  bottomRow: {
    flexDirection: 'row', gap: 8, alignItems: 'stretch',
  },
  // Left column — fixed width, no grow
  leftCol: {
    flexShrink: 0, gap: 6,
  },
  // Meta pills (year + duration) — dark background like titleBadge for readability
  metaPills: {flexDirection: 'row', gap: 5, flexWrap: 'wrap'},
  metaPill: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  metaPillTxt: {color: '#fff', fontSize: 11, fontWeight: '700', fontFamily: 'Rubik'},
  // Compact play button
  playBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.dark.primary,
    paddingVertical: 9, paddingHorizontal: 16,
    borderRadius: 10, gap: 6, alignSelf: 'flex-start',
  },
  playTxt: {color: '#fff', fontSize: 13, fontWeight: '700', fontFamily: 'Rubik'},
  // Right column — dark background like titleBadge for readability
  descBadge: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8,
    justifyContent: 'center',
  },
  descTxt: {
    color: 'rgba(255,255,255,0.9)', fontSize: 11, lineHeight: 16,
    fontFamily: 'Rubik', fontWeight: '400',
  },
  // Progress bars
  progressRow: {
    position: 'absolute', bottom: 12, left: 16, right: 16,
    flexDirection: 'row', gap: 5,
  },
  progressTrack: {
    flex: 1, height: 3, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%', borderRadius: 2,
    backgroundColor: Colors.dark.primary,
  },
});

// ─── Section row styles ───────────────────────────────────────────────────────
const sectionS = StyleSheet.create({
  wrapper: {marginTop: 24},
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, marginBottom: 12,
  },
  headerLeft: {flexDirection: 'row', alignItems: 'center', gap: 8},
  emoji: {fontSize: 18},
  title: {color: Colors.dark.text, fontSize: 17, fontWeight: '800', fontFamily: 'Rubik'},
  seeAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: `${Colors.dark.primary}18`,
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 10, borderWidth: 1, borderColor: `${Colors.dark.primary}30`,
  },
  seeAllTxt: {color: Colors.dark.primary, fontSize: 13, fontWeight: '700', fontFamily: 'Rubik'},
  seeAllArrow: {color: Colors.dark.primary, fontSize: 16, lineHeight: 18},
  scrollContent: {paddingHorizontal: 16, gap: 10},
  card: {
    width: SECTION_CARD_W,
    borderRadius: 12,
    backgroundColor: Colors.dark.card,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  poster: {width: SECTION_CARD_W, height: SECTION_CARD_H, borderRadius: 12},
  ratingBadge: {
    position: 'absolute', top: 6, left: 6,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5,
  },
  ratingTxt: {color: '#FFD700', fontSize: 10, fontWeight: '700', fontFamily: 'Rubik'},
  viewsBadge: {
    position: 'absolute', top: 6, right: 6,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5,
  },
  viewsTxt: {color: '#fff', fontSize: 10, fontWeight: '600', fontFamily: 'Rubik'},
  titleBox: {
    paddingHorizontal: 7, paddingTop: 7, paddingBottom: 8,
    minHeight: 44, justifyContent: 'center', gap: 2,
  },
  itemTitle: {
    color: Colors.dark.text, fontSize: 12, fontWeight: '600',
    lineHeight: 16, textAlign: 'center', fontFamily: 'Rubik',
  },
  year: {
    color: Colors.dark.textMuted, fontSize: 10,
    fontFamily: 'Rubik', textAlign: 'center',
  },
  seeAllCard: {
    width: SECTION_CARD_W,
    height: SECTION_CARD_H + 44,
    borderRadius: 12,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1, borderColor: Colors.dark.border,
    justifyContent: 'center', alignItems: 'center',
  },
  seeAllInner: {alignItems: 'center', gap: 8},
  seeAllCardEmoji: {fontSize: 28},
  seeAllCardTxt: {color: Colors.dark.textSecondary, fontSize: 13, fontWeight: '600', fontFamily: 'Rubik'},
  seeAllCardArrow: {color: Colors.dark.primary, fontSize: 22, fontWeight: '800'},
});

// ─── Browse grid styles ───────────────────────────────────────────────────────
const browseS = StyleSheet.create({
  wrapper: {marginTop: 28, paddingHorizontal: 16, marginBottom: 8},
  heading: {
    color: Colors.dark.text, fontSize: 17, fontWeight: '800',
    fontFamily: 'Rubik', marginBottom: 14,
  },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
  },
  tile: {
    width: (SW - 32 - 20) / 3,   // 3 columns with 10px gaps and 16px side padding
    backgroundColor: Colors.dark.surface,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.dark.border,
    paddingVertical: 16, paddingHorizontal: 8,
    alignItems: 'center', gap: 6,
  },
  tileEmoji: {fontSize: 26},
  tileTxt: {
    color: Colors.dark.textSecondary, fontSize: 11.5, fontWeight: '600',
    fontFamily: 'Rubik', textAlign: 'center', lineHeight: 15,
  },
});

export default HomeScreen;
