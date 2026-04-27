import React, {useState, useCallback, useEffect, useMemo, useRef, memo} from 'react';
import {View, StyleSheet, FlatList, Text, TextInput, TouchableOpacity} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import {searchContent} from '../services/metadataService';
import {ContentItem} from '../types';
import {MovieCard, CARD_WIDTH} from '../components/MovieCard';
import {LoadingSpinner} from '../components/LoadingSpinner';
import {Colors} from '../theme/colors';
import {Typography} from '../theme/typography';
import {useTranslation} from 'react-i18next';

// ─── Debounce hook for search input ────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

// ─── Memoized MovieCard row item ───────────────────────────────────
interface MovieCardItemProps {
  item: ContentItem;
  onPress: (item: ContentItem) => void;
}

const MovieCardItem = memo<MovieCardItemProps>(
  ({item, onPress}) => <MovieCard item={item} onPress={onPress} />,
  (prev, next) => prev.item.id === next.item.id,
);
MovieCardItem.displayName = 'MovieCardItem';

export const SearchScreen: React.FC = () => {
  const {t} = useTranslation();
  const navigation = useNavigation<any>();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Debounce search by 400ms to avoid excessive searches on fast typing
  // This is critical with 13,000+ movies to prevent UI jank
  const debouncedQuery = useDebounce(query, 400);

  const navigateToDetails = useCallback((item: ContentItem) => {
    navigation.navigate('Details', {item});
  }, [navigation]);

  // Auto-search when debounced query changes
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    let cancelled = false;

    const performSearch = async () => {
      setLoading(true);
      try {
        const found = await searchContent(debouncedQuery);
        if (!cancelled) {
          setResults(found);
          setHasSearched(true);
        }
      } catch {
        if (!cancelled) {
          setResults([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    performSearch();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  // ─── Memoized renderers ──────────────────────────────────────────
  const renderItem = useCallback(({item}: {item: ContentItem}) => (
    <MovieCardItem item={item} onPress={navigateToDetails} />
  ), [navigateToDetails]);

  const keyExtractor = useCallback((item: ContentItem) => item.id, []);

  const ListEmptyComponent = useMemo(() => {
    if (loading) return null;

    if (hasSearched) {
      return (
        <View style={styles.emptyContainer}>
          <Icon name="search-outline" size={48} color={Colors.dark.textMuted} />
          <Text style={styles.emptyText}>{t('no_results')}</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Icon name="film-outline" size={48} color={Colors.dark.textMuted} />
        <Text style={styles.emptyText}>{t('search_placeholder')}</Text>
      </View>
    );
  }, [loading, hasSearched, t]);

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <View style={styles.searchInputContainer}>
          <Icon name="search" size={20} color={Colors.dark.textSecondary} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder={t('search_placeholder')}
            placeholderTextColor={Colors.dark.textMuted}
            autoFocus
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Icon name="close-circle" size={20} color={Colors.dark.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.cancelButton} onPress={() => setQuery('')}>
          <Text style={styles.cancelText}>{t('cancel')}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <LoadingSpinner fullScreen={false} size="small" />
      ) : (
        <FlatList
          data={results}
          numColumns={2}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
          // Performance optimizations for search results
          initialNumToRender={8}
          maxToRenderPerBatch={6}
          windowSize={5}
          removeClippedSubviews={true}
          ListEmptyComponent={ListEmptyComponent}
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
    paddingTop: 12,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  searchInput: {
    flex: 1,
    color: Colors.dark.text,
    fontSize: Typography.sizes.md,
    marginLeft: 8,
    padding: 0,
  },
  cancelButton: {
    marginLeft: 12,
  },
  cancelText: {
    color: Colors.dark.primary,
    fontSize: Typography.sizes.md,
  },
  grid: {
    paddingHorizontal: 12,
    paddingBottom: 80,
  },
  row: {
    justifyContent: 'space-between',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: Colors.dark.textSecondary,
    fontSize: Typography.sizes.md,
    marginTop: 12,
  },
});
