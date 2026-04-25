import React, {useState, useCallback, useEffect} from 'react';
import {View, StyleSheet, FlatList, Text, TextInput, TouchableOpacity} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import {loadMovies, searchContent} from '../services/metadataService';
import {ContentItem} from '../types';
import {MovieCard, CARD_WIDTH} from '../components/MovieCard';
import {LoadingSpinner} from '../components/LoadingSpinner';
import {Colors} from '../theme/colors';
import {Typography} from '../theme/typography';
import {useTranslation} from 'react-i18next';

export const SearchScreen: React.FC = () => {
  const {t} = useTranslation();
  const navigation = useNavigation<any>();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  const navigateToDetails = (item: ContentItem) => {
    navigation.navigate('Details', {item});
  };

  const handleSearch = useCallback(async () => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const moviesDict = await loadMovies();
      const found = searchContent(moviesDict, query);
      setResults(found);
      setSearchHistory(prev => {
        const filtered = prev.filter(h => h !== query);
        return [query, ...filtered].slice(0, 10);
      });
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    if (!query.trim()) setResults([]);
  }, [query]);

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
            onSubmitEditing={handleSearch}
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
      ) : results.length > 0 ? (
        <FlatList
          data={results}
          numColumns={2}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
          renderItem={({item}) => (
            <MovieCard item={item} onPress={navigateToDetails} />
          )}
        />
      ) : query.trim().length > 0 ? (
        <View style={styles.emptyContainer}>
          <Icon name="search-outline" size={48} color={Colors.dark.textMuted} />
          <Text style={styles.emptyText}>{t('no_results')}</Text>
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <Icon name="film-outline" size={48} color={Colors.dark.textMuted} />
          <Text style={styles.emptyText}>{t('search_placeholder')}</Text>
        </View>
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
