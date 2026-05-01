/**
 * SearchScreen — Search with filter system
 *
 * Features:
 *   - Text search bar with debounce
 *   - Single FILTER button → opens modal popup with all filter categories:
 *       • Content Category (Movies, Series, Anime, TV Shows, etc.)
 *       • Genres (Action, Comedy, Drama, Horror, etc.)
 *       • Quality (1080p, 720p, 4K, BluRay, WEB-DL, etc.)
 *       • Year (2024, 2023, 2022, ...)
 *       • Minimum Rating (5+, 6+, 7+, 8+, 9+)
 *       • Sort By (Views, Rating, Year, Default)
 *   - Selected filters appear as removable BADGES under the search bar
 *   - All filtering is LOCAL (catalog loaded once on mount)
 *   - Loading skeleton grid, error + empty states
 *   - No Ionicons — only local PNG icons + text icons
 *
 * Safety rules:
 *   - MovieCard.onPress is () => void — always wrap: onPress={() => goToDetails(item)}
 *   - All optional chaining on item properties
 */

import React, { useState, useCallback, useEffect, useRef, memo, useMemo } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Text,
  TouchableOpacity,
  Image,
  Dimensions,
  Animated,
  Easing,
  ScrollView,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  loadCategory,
  collectGenres,
  sortByNewest,
} from '../services/metadataService';
import { ContentItem } from '../types';
import { MovieCard } from '../components/MovieCard';
import { SearchBar } from '../components/SearchBar';
import { ErrorView } from '../components/ErrorView';
import { SPACING, RADIUS } from '../theme/colors';
import { FONTS } from '../theme/typography';
import { useTheme } from '../hooks/useTheme';

// =============================================================================
// Constants
// =============================================================================
const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const NUM_COLUMNS = 3;
const GRID_PADDING = SPACING.lg;
const GRID_GAP = SPACING.sm;
const CARD_WIDTH_CALC =
  (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP * (NUM_COLUMNS - 1)) /
  NUM_COLUMNS;
const DEBOUNCE_MS = 400;
const SKELETON_COUNT = 9;

// Local PNG icons
const ICON_ARROW = require('../../assets/icons/arrow.png');
const ICON_SEARCH = require('../../assets/icons/search.png');
const ICON_STAR = require('../../assets/icons/star.png');

// ── Filter definitions ──────────────────────────────────────────────────
const CONTENT_CATEGORIES = [
  { key: 'movies', label: 'Movies' },
  { key: 'series', label: 'Series' },
  { key: 'anime', label: 'Anime' },
  { key: 'tvshows', label: 'TV Shows' },
  { key: 'dubbed-movies', label: 'Dubbed Movies' },
  { key: 'hindi', label: 'Hindi' },
  { key: 'asian-movies', label: 'Asian Movies' },
  { key: 'anime-movies', label: 'Anime Movies' },
  { key: 'asian-series', label: 'Asian Series' },
];

const QUALITY_OPTIONS = [
  '1080p', '720p', '480p', '4K', 'BluRay', 'WEB-DL', 'WEBRip', 'HDRip', 'HDTV', 'DVDRip',
];

const YEAR_OPTIONS = (() => {
  const current = new Date().getFullYear();
  const years: string[] = [];
  for (let y = current; y >= current - 15; y--) years.push(String(y));
  years.push('Older');
  return years;
})();

const RATING_OPTIONS = ['5+', '6+', '7+', '7.5+', '8+', '8.5+', '9+'];

const SORT_OPTIONS = [
  { key: 'default', label: 'Default' },
  { key: 'views', label: 'Most Viewed' },
  { key: 'rating', label: 'Highest Rated' },
  { key: 'year', label: 'Newest' },
  { key: 'year_asc', label: 'Oldest' },
];

// =============================================================================
// Filter state shape
// =============================================================================
interface Filters {
  categories: string[];   // content type keys
  genres: string[];       // genre names
  qualities: string[];    // quality/format strings
  years: string[];        // year strings
  minRating: number | null; // 5, 6, 7, 7.5, 8, 8.5, 9
  sortBy: string;         // 'default' | 'views' | 'rating' | 'year' | 'year_asc'
}

const EMPTY_FILTERS: Filters = {
  categories: [],
  genres: [],
  qualities: [],
  years: [],
  minRating: null,
  sortBy: 'default',
};

// =============================================================================
// useDebounce hook
// =============================================================================
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

// =============================================================================
// SkeletonCard
// =============================================================================
const SkeletonCard: React.FC<{ width: number }> = ({ width }) => {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.3)).current;
  const skStyles = useMemo(
    () =>
      StyleSheet.create({
        container: { borderRadius: RADIUS.lg, backgroundColor: colors.surfaceElevated, overflow: 'hidden' },
        poster: { width: '100%', backgroundColor: colors.surfaceElevated, borderRadius: RADIUS.lg, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
        shimmer: { height: '100%', borderRadius: RADIUS.sm, backgroundColor: 'rgba(255,255,255,0.08)' },
        line1: { height: 12, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 8, marginHorizontal: 4 },
        line2: { height: 10, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 6, marginHorizontal: 4 },
      }),
    [colors],
  );
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <View style={[skStyles.container, { width }]}>
      <View style={[skStyles.poster, { height: width * 1.5 }]}>
        <Animated.View style={[skStyles.shimmer, { width: width * 0.6, opacity }]} />
      </View>
      <Animated.View style={[skStyles.line1, { width: '80%', opacity }]} />
      <Animated.View style={[skStyles.line2, { width: '55%', opacity }]} />
    </View>
  );
};

// =============================================================================
// Memoized MovieCard wrapper
// =============================================================================
const MovieCardItem = memo<{ item: ContentItem; onPress: () => void }>(
  ({ item, onPress }) => <MovieCard item={item} onPress={onPress} width={CARD_WIDTH_CALC} />,
  (p, n) => p.item?.id === n.item?.id && p.onPress === n.onPress,
);
MovieCardItem.displayName = 'MovieCardItem';

const SKELETON_DATA = Array.from({ length: SKELETON_COUNT }, (_, i) => ({ key: `s-${i}` }));

// =============================================================================
// SearchScreen
// =============================================================================
export const SearchScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  // ── State ──────────────────────────────────────────────────────────────
  const [query, setQuery] = useState('');
  const [allItems, setAllItems] = useState<ContentItem[]>([]);
  const [results, setResults] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  // Increment to re-trigger load effect after error
  const [loadTrigger, setLoadTrigger] = useState(0);

  // Filter state
  const [filters, setFilters] = useState<Filters>({ ...EMPTY_FILTERS });
  const [tempFilters, setTempFilters] = useState<Filters>({ ...EMPTY_FILTERS });
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [allGenres, setAllGenres] = useState<string[]>([]);

  const debouncedQuery = useDebounce(query, DEBOUNCE_MS);

  // ── Load catalog on mount ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const cats = ['movies', 'series', 'anime', 'tvshows', 'asian-series', 'dubbed-movies', 'hindi', 'asian-movies', 'anime-movies'] as const;
        const dicts = await Promise.all(cats.map(cat => loadCategory(cat).catch(() => null)));
        if (cancelled) return;

        const merged: ContentItem[] = [];
        for (let ci = 0; ci < dicts.length; ci++) {
          const data = dicts[ci];
          if (!data || typeof data !== 'object' || Array.isArray(data)) continue;
          if ((data as any).movies && !(data as any).Title) continue;
          const items = Object.values(data) as ContentItem[];
          // Tag each item with its source category so sub-category
          // filtering works (e.g. "dubbed-movies", "hindi" which all
          // have Category: "movies" in backend data)
          const sourceCat = cats[ci];
          for (const item of items) {
            if (item) {
              (item as any)._sourceCategory = sourceCat;
            }
          }
          merged.push(...items.filter(Boolean));
        }
        setAllItems(merged);
        const genres = collectGenres(merged);
        setAllGenres(genres.length > 0 ? genres : [
          'Action', 'Adventure', 'Animation', 'Biography', 'Comedy', 'Crime',
          'Documentary', 'Drama', 'Family', 'Fantasy', 'History', 'Horror',
          'Music', 'Mystery', 'Romance', 'Sci-Fi', 'Sport', 'Thriller',
          'War', 'Western', 'Supernatural', 'Musical',
        ]);
      } catch {
        setError('Failed to load catalog');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [loadTrigger]);

  // ── Count active filters ──────────────────────────────────────────────
  const activeFilterCount = useMemo(() => {
    let c = 0;
    c += filters.categories.length;
    c += filters.genres.length;
    c += filters.qualities.length;
    c += filters.years.length;
    if (filters.minRating !== null) c++;
    if (filters.sortBy !== 'default') c++;
    return c;
  }, [filters]);

  const hasActiveFilters = activeFilterCount > 0;

  // ── Build badge list from active filters ──────────────────────────────
  const filterBadges = useMemo(() => {
    const badges: { id: string; label: string; type: string }[] = [];
    filters.categories.forEach(key => {
      const cat = CONTENT_CATEGORIES.find(c => c.key === key);
      badges.push({ id: `cat_${key}`, label: cat?.label ?? key, type: 'category' });
    });
    filters.genres.forEach(g => badges.push({ id: `genre_${g}`, label: g, type: 'genre' }));
    filters.qualities.forEach(q => badges.push({ id: `qual_${q}`, label: q, type: 'quality' }));
    filters.years.forEach(y => badges.push({ id: `year_${y}`, label: y, type: 'year' }));
    if (filters.minRating !== null) {
      badges.push({ id: 'rating', label: `${filters.minRating}+ Rating`, type: 'rating' });
    }
    if (filters.sortBy !== 'default') {
      const sort = SORT_OPTIONS.find(s => s.key === filters.sortBy);
      badges.push({ id: 'sort', label: `Sort: ${sort?.label ?? filters.sortBy}`, type: 'sort' });
    }
    return badges;
  }, [filters]);

  // ── Filter + sort allItems based on query + filters ───────────────────
  useEffect(() => {
    if (allItems.length === 0) return;

    let filtered = [...allItems];
    const q = debouncedQuery.trim().toLowerCase();

    // Text search
    if (q) {
      filtered = filtered.filter(item => {
        if (!item) return false;
        return (
          item.Title?.toLowerCase().includes(q) ||
          item.Genres?.some((g: string) => g?.toLowerCase().includes(q)) ||
          item.GenresAr?.some((g: string) => g?.toLowerCase().includes(q)) ||
          item.Country?.toLowerCase().includes(q) ||
          item.Format?.toLowerCase().includes(q)
        );
      });
    }

    // Category filter — use _sourceCategory tag for sub-categories
    // (dubbed-movies, hindi, asian-movies, anime-movies all have
    //  Category: "movies" in backend data, but _sourceCategory preserves
    //  the actual endpoint they came from)
    if (filters.categories.length > 0) {
      const catSet = new Set(filters.categories.map(c => c.toLowerCase()));
      filtered = filtered.filter(item => {
        const srcCat = (item as any)?._sourceCategory?.toLowerCase() ?? '';
        const cat = item?.Category?.toLowerCase() ?? '';
        return catSet.has(srcCat) || catSet.has(cat);
      });
    }

    // Genre filter
    if (filters.genres.length > 0) {
      const genreSet = new Set(filters.genres.map(g => g.toLowerCase()));
      filtered = filtered.filter(item =>
        item?.Genres?.some(g => genreSet.has(g.toLowerCase())) ||
        item?.GenresAr?.some(g => genreSet.has(g.toLowerCase()))
      );
    }

    // Quality filter (Format field)
    if (filters.qualities.length > 0) {
      const qualSet = new Set(filters.qualities.map(q => q.toLowerCase()));
      filtered = filtered.filter(item => {
        const fmt = item.Format?.toLowerCase() ?? '';
        return qualSet.some(q => fmt.includes(q));
      });
    }

    // Year filter
    if (filters.years.length > 0) {
      const hasOlder = filters.years.includes('Older');
      const yearNums = filters.years
        .filter(y => y !== 'Older')
        .map(Number);

      filtered = filtered.filter(item => {
        const y = item.Year ? parseInt(item.Year, 10) : 0;
        if (hasOlder && y > 0 && y < yearNums[yearNums.length - 1]) return true;
        return yearNums.includes(y);
      });
    }

    // Min rating filter
    if (filters.minRating !== null) {
      filtered = filtered.filter(item => {
        const r = parseFloat(item.Rating ?? '');
        return !isNaN(r) && r >= filters.minRating!;
      });
    }

    // Sort
    switch (filters.sortBy) {
      case 'views':
        filtered.sort((a, b) => {
          const va = parseInt(a.Views?.replace(/[^\d]/g, '') ?? '0', 10);
          const vb = parseInt(b.Views?.replace(/[^\d]/g, '') ?? '0', 10);
          return vb - va;
        });
        break;
      case 'rating':
        filtered.sort((a, b) => {
          const ra = parseFloat(a.Rating ?? '0');
          const rb = parseFloat(b.Rating ?? '0');
          return rb - ra;
        });
        break;
      case 'year':
        filtered.sort((a, b) => {
          const ya = a.Year ? parseInt(a.Year, 10) : 0;
          const yb = b.Year ? parseInt(b.Year, 10) : 0;
          return yb - ya;
        });
        break;
      case 'year_asc':
        filtered.sort((a, b) => {
          const ya = a.Year ? parseInt(a.Year, 10) : 0;
          const yb = b.Year ? parseInt(b.Year, 10) : 0;
          return ya - yb;
        });
        break;
      default:
        filtered = sortByNewest(filtered);
        break;
    }

    setResults(filtered);
    setHasSearched(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allItems, debouncedQuery, filters]);

  // ── Remove a single filter badge ──────────────────────────────────────
  const removeBadge = useCallback((badge: { id: string; type: string }) => {
    setFilters(prev => {
      const next = { ...prev };
      switch (badge.type) {
        case 'category':
          next.categories = prev.categories.filter(k => `cat_${k}` !== badge.id);
          break;
        case 'genre':
          next.genres = prev.genres.filter(g => `genre_${g}` !== badge.id);
          break;
        case 'quality':
          next.qualities = prev.qualities.filter(q => `qual_${q}` !== badge.id);
          break;
        case 'year':
          next.years = prev.years.filter(y => `year_${y}` !== badge.id);
          break;
        case 'rating':
          next.minRating = null;
          break;
        case 'sort':
          next.sortBy = 'default';
          break;
      }
      return next;
    });
  }, []);

  // ── Clear all filters ─────────────────────────────────────────────────
  const clearAllFilters = useCallback(() => {
    setFilters({ ...EMPTY_FILTERS });
  }, []);

  // ── Filter modal: toggle helpers ──────────────────────────────────────
  const toggleTempArray = useCallback((field: 'categories' | 'genres' | 'qualities' | 'years', value: string) => {
    setTempFilters(prev => {
      const arr = prev[field];
      const idx = arr.indexOf(value);
      const next = idx >= 0 ? arr.filter(v => v !== value) : [...arr, value];
      return { ...prev, [field]: next };
    });
  }, []);

  const toggleTempRating = useCallback((rating: string) => {
    const val = parseFloat(rating);
    setTempFilters(prev => ({
      ...prev,
      minRating: prev.minRating === val ? null : val,
    }));
  }, []);

  const setTempSort = useCallback((sortKey: string) => {
    setTempFilters(prev => ({
      ...prev,
      sortBy: prev.sortBy === sortKey ? 'default' : sortKey,
    }));
  }, []);

  // ── Apply filters from modal ──────────────────────────────────────────
  const applyFilters = useCallback(() => {
    setFilters(tempFilters);
    setShowFilterModal(false);
  }, [tempFilters]);

  // ── Clear temp filters in modal ───────────────────────────────────────
  const clearTempFilters = useCallback(() => {
    setTempFilters({ ...EMPTY_FILTERS });
  }, []);

  // ── Open filter modal (copy current to temp) ──────────────────────────
  const openFilterModal = useCallback(() => {
    setTempFilters({ ...filters });
    setShowFilterModal(true);
  }, [filters]);

  // ── Navigation helper ──────────────────────────────────────────────────
  const goToDetails = useCallback(
    (item: ContentItem) => {
      if (!item) return;
      navigation.navigate('Details', { item });
    },
    [navigation],
  );

  // ══════════════════════════════════════════════════════════════════════
  // STYLES
  // ══════════════════════════════════════════════════════════════════════
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },

        // ── Header ──
        header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md, gap: SPACING.sm },
        backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
        backIcon: { width: 24, height: 24, tintColor: colors.text },
        searchBarWrap: { flex: 1 },
        filterBtn: {
          width: 44, height: 44, borderRadius: RADIUS.lg,
          backgroundColor: hasActiveFilters ? colors.primary : colors.surfaceElevated,
          justifyContent: 'center', alignItems: 'center',
          borderWidth: hasActiveFilters ? 1.5 : 0,
          borderColor: colors.primary,
        },
        filterBtnText: { color: hasActiveFilters ? '#FFFFFF' : colors.textSecondary, fontSize: 18, fontWeight: '700' },
        filterBadge: {
          position: 'absolute', top: -4, right: -4,
          minWidth: 18, height: 18, borderRadius: 9,
          backgroundColor: colors.primary,
          justifyContent: 'center', alignItems: 'center',
          paddingHorizontal: 4,
        },
        filterBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },

        // ── Filter badges row ──
        badgesWrap: {
          paddingHorizontal: SPACING.lg,
          paddingVertical: SPACING.xs,
        },
        badgesRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
        badgeScroll: { flex: 1, flexDirection: 'row', gap: SPACING.xs },
        badgeChip: {
          flexDirection: 'row', alignItems: 'center',
          paddingHorizontal: 12, paddingVertical: 5,
          borderRadius: RADIUS.full,
          backgroundColor: colors.primary,
          gap: 6,
          borderWidth: 1,
          borderColor: colors.primary,
        },
        badgeText: { color: '#FFFFFF', ...FONTS.captionSmall, fontWeight: '600' },
        badgeX: {
          width: 16, height: 16, borderRadius: 8,
          backgroundColor: 'rgba(255,255,255,0.3)',
          justifyContent: 'center', alignItems: 'center',
        },
        badgeXText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700', textAlign: 'center', lineHeight: 16 },
        clearAllBtn: {
          paddingHorizontal: 10, paddingVertical: 5,
          borderRadius: RADIUS.full,
          backgroundColor: colors.surfaceElevated,
          borderWidth: 1, borderColor: colors.border,
        },
        clearAllText: { color: colors.textSecondary, ...FONTS.captionSmall, fontWeight: '600' },

        // ── Body ──
        body: { flex: 1 },

        // ── Results count ──
        resultCount: { ...FONTS.captionSmall, color: colors.textMuted, paddingHorizontal: SPACING.lg, paddingTop: SPACING.xs, paddingBottom: SPACING.sm },

        // ── Grid ──
        grid: { paddingHorizontal: GRID_PADDING },
        row: { gap: GRID_GAP },

        // ── Loading skeleton grid ──
        loadingGridWrap: { flex: 1, paddingTop: SPACING.xs },

        // ── Empty state ──
        emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 80, paddingHorizontal: SPACING.xxl },
        emptyIcon: { width: 56, height: 56, tintColor: colors.textMuted, opacity: 0.6, marginBottom: SPACING.lg },
        emptyTitle: { ...FONTS.heading3, color: colors.textSecondary, marginBottom: SPACING.sm },
        emptySubtitle: { ...FONTS.body, color: colors.textMuted, textAlign: 'center' },

        // ── Filter Modal ──
        modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
        modalPanel: {
          backgroundColor: colors.surface,
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          maxHeight: SCREEN_HEIGHT * 0.82,
          paddingBottom: insets.bottom + 16,
        },
        modalHandle: {
          width: 40, height: 4, borderRadius: 2,
          backgroundColor: colors.border,
          alignSelf: 'center', marginTop: 12,
        },
        modalHeader: {
          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
          paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md,
        },
        modalTitle: { ...FONTS.heading2, color: colors.text, flex: 1 },
        modalClearBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: colors.surfaceElevated },
        modalClearBtnText: { ...FONTS.bodySmall, color: colors.textSecondary },

        modalBody: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xl },

        sectionTitle: { ...FONTS.bodySmall, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: SPACING.sm, marginTop: SPACING.md },

        chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
        chip: {
          paddingHorizontal: 14, paddingVertical: 8,
          borderRadius: RADIUS.full,
          backgroundColor: colors.surfaceElevated,
          borderWidth: 1.5, borderColor: colors.border,
        },
        chipText: { ...FONTS.bodySmall, color: colors.textSecondary },
        chipActive: {
          backgroundColor: `${colors.primary}22`,
          borderColor: colors.primary,
        },
        chipActiveText: { color: colors.primary, fontWeight: '700' },

        modalFooter: {
          flexDirection: 'row', gap: SPACING.md,
          paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md,
          borderTopWidth: 1, borderTopColor: colors.border,
        },
        applyBtn: {
          flex: 1, paddingVertical: 14, borderRadius: RADIUS.lg,
          backgroundColor: colors.primary,
          justifyContent: 'center', alignItems: 'center',
        },
        applyBtnText: { ...FONTS.heading3, color: '#FFFFFF' },
        cancelBtn: {
          paddingHorizontal: 24, paddingVertical: 14, borderRadius: RADIUS.lg,
          backgroundColor: colors.surfaceElevated,
          justifyContent: 'center', alignItems: 'center',
          borderWidth: 1, borderColor: colors.border,
        },
        cancelBtnText: { ...FONTS.body, color: colors.textSecondary },
      }),
    [colors, hasActiveFilters],
  );

  // ══════════════════════════════════════════════════════════════════════
  // RENDER: Filter Modal
  // ══════════════════════════════════════════════════════════════════════
  const renderFilterModal = () => {
    const tempCount =
      tempFilters.categories.length + tempFilters.genres.length +
      tempFilters.qualities.length + tempFilters.years.length +
      (tempFilters.minRating !== null ? 1 : 0) +
      (tempFilters.sortBy !== 'default' ? 1 : 0);

    return (
      <Modal
        visible={showFilterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowFilterModal(false)}
        >
          <TouchableOpacity activeOpacity={1}>
            <View style={styles.modalPanel}>
              <View style={styles.modalHandle} />

              {/* Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Filters</Text>
                {tempCount > 0 && (
                  <TouchableOpacity style={styles.modalClearBtn} onPress={clearTempFilters}>
                    <Text style={styles.modalClearBtnText}>Clear All</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Body — scrollable */}
              <ScrollView
                showsVerticalScrollIndicator={false}
                bounces
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.modalBody}
              >
                {/* ── Content Category ── */}
                <Text style={styles.sectionTitle}>Category</Text>
                <View style={styles.chipRow}>
                  {CONTENT_CATEGORIES.map(cat => {
                    const active = tempFilters.categories.includes(cat.key);
                    return (
                      <TouchableOpacity
                        key={cat.key}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => toggleTempArray('categories', cat.key)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.chipText, active && styles.chipActiveText]}>{cat.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* ── Genres ── */}
                <Text style={styles.sectionTitle}>Genre</Text>
                <View style={styles.chipRow}>
                  {allGenres.map(genre => {
                    const active = tempFilters.genres.includes(genre);
                    return (
                      <TouchableOpacity
                        key={genre}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => toggleTempArray('genres', genre)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.chipText, active && styles.chipActiveText]}>{genre}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* ── Quality ── */}
                <Text style={styles.sectionTitle}>Quality</Text>
                <View style={styles.chipRow}>
                  {QUALITY_OPTIONS.map(qual => {
                    const active = tempFilters.qualities.includes(qual);
                    return (
                      <TouchableOpacity
                        key={qual}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => toggleTempArray('qualities', qual)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.chipText, active && styles.chipActiveText]}>{qual}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* ── Year ── */}
                <Text style={styles.sectionTitle}>Year</Text>
                <View style={styles.chipRow}>
                  {YEAR_OPTIONS.map(year => {
                    const active = tempFilters.years.includes(year);
                    return (
                      <TouchableOpacity
                        key={year}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => toggleTempArray('years', year)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.chipText, active && styles.chipActiveText]}>{year}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* ── Rating ── */}
                <Text style={styles.sectionTitle}>Minimum Rating</Text>
                <View style={styles.chipRow}>
                  {RATING_OPTIONS.map(rating => {
                    const val = parseFloat(rating);
                    const active = tempFilters.minRating === val;
                    return (
                      <TouchableOpacity
                        key={rating}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => toggleTempRating(rating)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.chipText, active && styles.chipActiveText]}>{rating}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* ── Sort By ── */}
                <Text style={styles.sectionTitle}>Sort By</Text>
                <View style={styles.chipRow}>
                  {SORT_OPTIONS.map(opt => {
                    const active = tempFilters.sortBy === opt.key;
                    return (
                      <TouchableOpacity
                        key={opt.key}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => setTempSort(opt.key)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.chipText, active && styles.chipActiveText]}>{opt.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Bottom spacing for footer */}
                <View style={{ height: 20 }} />
              </ScrollView>

              {/* Footer */}
              <View style={styles.modalFooter}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowFilterModal(false)} activeOpacity={0.7}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.applyBtn} onPress={applyFilters} activeOpacity={0.8}>
                  <Text style={styles.applyBtnText}>
                    Apply{tempCount > 0 ? ` ${tempCount}` : ''}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    );
  };

  // ── Render: filter badges row ─────────────────────────────────────────
  const renderBadges = () => {
    if (filterBadges.length === 0) return null;
    return (
      <View style={styles.badgesWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgesScroll}>
          {filterBadges.map(badge => (
            <TouchableOpacity
              key={badge.id}
              style={styles.badgeChip}
              onPress={() => removeBadge(badge)}
              activeOpacity={0.8}
            >
              <Text style={styles.badgeText}>{badge.label}</Text>
              <View style={styles.badgeX}>
                <Text style={styles.badgeXText}>x</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {filterBadges.length > 1 && (
          <TouchableOpacity style={styles.clearAllBtn} onPress={clearAllFilters} activeOpacity={0.7}>
            <Text style={styles.clearAllText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // ── Render: skeleton item ──────────────────────────────────────────────
  const renderSkeletonItem = useCallback(() => <SkeletonCard width={CARD_WIDTH_CALC} />, []);

  // ── Render: result card ────────────────────────────────────────────────
  const renderResultItem = useCallback(
    ({ item }: { item: ContentItem }) => {
      if (!item) return null;
      return <MovieCardItem item={item} onPress={() => goToDetails(item)} />;
    },
    [goToDetails],
  );

  // ── Render: empty state ────────────────────────────────────────────────
  const renderEmptyState = useCallback(() => {
    if (loading || error) return null;
    return (
      <View style={styles.emptyContainer}>
        <Image source={ICON_SEARCH} style={styles.emptyIcon} resizeMode="contain" />
        <Text style={styles.emptyTitle}>No results found</Text>
        <Text style={styles.emptySubtitle}>
          Try different keywords or adjust your filters
        </Text>
      </View>
    );
  }, [loading, error, styles]);

  // ── Render: loading skeleton grid ──────────────────────────────────────
  const renderLoadingGrid = useCallback(
    () => (
      <View style={styles.loadingGridWrap}>
        <FlatList
          data={SKELETON_DATA}
          keyExtractor={item => item.key}
          numColumns={NUM_COLUMNS}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.grid}
          scrollEnabled={false}
          renderItem={renderSkeletonItem}
        />
      </View>
    ),
    [renderSkeletonItem, styles],
  );

  // ══════════════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ══════════════════════════════════════════════════════════════════════
  return (
    <View style={styles.container}>
      {/* ── Header: Back + Search + Filter button ── */}
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Image source={ICON_ARROW} style={styles.backIcon} resizeMode="contain" />
        </TouchableOpacity>

        <View style={styles.searchBarWrap}>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder="Search movies, series, anime..."
          />
        </View>

        {/* Filter button */}
        <TouchableOpacity
          style={styles.filterBtn}
          onPress={openFilterModal}
          activeOpacity={0.7}
          accessibilityLabel="Open filters"
          accessibilityRole="button"
        >
          <Text style={styles.filterBtnText}>☰</Text>
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Active filter badges ── */}
      {renderBadges()}

      {/* ── Filter Modal ── */}
      {renderFilterModal()}

      {/* ── Body ── */}
      <View style={styles.body}>
        {error && !loading ? (
          <ErrorView
            errorText="Search failed"
            subtitle={error}
            onRetry={() => {
              // Re-trigger the load effect by incrementing trigger
              setLoadTrigger(prev => prev + 1);
            }}
            onGoBack={() => navigation.goBack()}
          />
        ) : loading ? (
          renderLoadingGrid()
        ) : (
          <>
            {hasSearched && results.length > 0 && (
              <Text style={styles.resultCount}>
                {results.length} result{results.length !== 1 ? 's' : ''} found
              </Text>
            )}

            <FlatList
              data={results}
              keyExtractor={(item) => item?.id ?? `f-${Math.random().toString(36).slice(2)}`}
              numColumns={NUM_COLUMNS}
              columnWrapperStyle={styles.row}
              contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + SPACING.xxxl }]}
              showsVerticalScrollIndicator={false}
              initialNumToRender={12}
              maxToRenderPerBatch={6}
              windowSize={5}
              removeClippedSubviews
              ListEmptyComponent={hasSearched ? renderEmptyState : null}
              renderItem={renderResultItem}
            />
          </>
        )}
      </View>
    </View>
  );
};
