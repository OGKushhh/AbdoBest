import React, {useState, useEffect, useMemo} from 'react';
import {View, StyleSheet, FlatList, Text, TextInput, TouchableOpacity} from 'react-native';
import {useRoute, useNavigation} from '@react-navigation/native';
import {loadCategory, getMoviesArray, filterByGenre, ContentCategory} from '../services/metadataService';
import {ContentItem} from '../types';
import {MovieCard, CARD_WIDTH} from '../components/MovieCard';
import {LoadingSpinner} from '../components/LoadingSpinner';
import {ErrorView} from '../components/ErrorView';
import {Colors} from '../theme/colors';
import {GENRE_FILTERS} from '../constants/categories';
import {useTranslation} from 'react-i18next';
import Icon from 'react-native-vector-icons/Ionicons';

// Map route category param → service category key
const CATEGORY_MAP: Record<string, ContentCategory> = {
  movies: 'movies',
  anime: 'anime',
  series: 'series',
  tvshows: 'tvshows',
  trending: 'trending',
};

export const CategoryScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const category = route.params?.category || 'movies';
  const {t} = useTranslation();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const serviceCategory = CATEGORY_MAP[category] || 'movies';

  useEffect(() => {
    loadCategoryData();
  }, [category]);

  const loadCategoryData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch ONLY the category we need — not the entire database
      const data = await loadCategory(serviceCategory);

      if (!data) {
        setItems([]);
        return;
      }

      // Handle both dict format (movies, series) and array format
      if (Array.isArray(data)) {
        setItems(data);
      } else if (typeof data === 'object') {
        const dict = data as Record<string, ContentItem>;
        setItems(getMoviesArray(dict));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredMovies = useMemo(() => {
    let result = items;

    if (category === 'trending') {
      const shuffled = [...result].sort(() => Math.random() - 0.5);
      result = shuffled.slice(0, 50);
    }

    if (selectedGenre) {
      const dict = result.reduce((acc, m) => ({...acc, [m.id]: m}), {});
      result = filterByGenre(dict, selectedGenre);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(m =>
        m.Title?.toLowerCase().includes(q) ||
        m.Genres?.some(g => g.toLowerCase().includes(q))
      );
    }

    return result;
  }, [items, selectedGenre, searchQuery, category]);

  const navigateToDetails = (item: ContentItem) => {
    navigation.navigate('Details', {item});
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorView message={error} onRetry={loadCategoryData} />;

  const getTitle = () => {
    const titles: Record<string, string> = {
      movies: t('movies'),
      anime: t('anime'),
      series: t('series'),
      tvshows: t('tvshows'),
      trending: t('trending_now'),
    };
    return titles[category] || t('browse');
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Icon name="search" size={18} color={Colors.dark.textSecondary} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t('search_placeholder')}
          placeholderTextColor={Colors.dark.textMuted}
        />
      </View>

      <FlatList
        data={[null, ...GENRE_FILTERS]}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item || 'all'}
        contentContainerStyle={styles.genreList}
        renderItem={({item: genre}) => (
          <TouchableOpacity
            style={[styles.genreChip, selectedGenre === genre && styles.genreChipActive]}
            onPress={() => setSelectedGenre(genre === selectedGenre ? null : genre)}
          >
            <Text style={[styles.genreText, selectedGenre === genre && styles.genreTextActive]}>
              {genre ? genre : t('all')}
            </Text>
          </TouchableOpacity>
        )}
      />

      <FlatList
        data={filteredMovies}
        numColumns={2}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.row}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="film-outline" size={48} color={Colors.dark.textMuted} />
            <Text style={styles.emptyText}>{t('no_results')}</Text>
          </View>
        }
        renderItem={({item}) => (
          <MovieCard item={item} onPress={navigateToDetails} />
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    paddingTop: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 10,
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    color: Colors.dark.text,
    fontSize: 14,
    marginLeft: 8,
    padding: 0,
  },
  genreList: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  genreChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.dark.surface,
    marginRight: 8,
  },
  genreChipActive: {
    backgroundColor: Colors.dark.primary,
  },
  genreText: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  genreTextActive: {
    color: '#fff',
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
    fontSize: 16,
    marginTop: 12,
  },
});
