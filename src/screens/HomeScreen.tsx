import React, {useState, useCallback} from 'react';
import {View, StyleSheet, FlatList, RefreshControl, StatusBar} from 'react-native';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {loadMovies, loadTrending, getMoviesArray} from '../services/metadataService';
import {ContentItem, TrendingContent, TrendingItem} from '../types';
import {MovieCard, CARD_WIDTH} from '../components/MovieCard';
import {SectionHeader} from '../components/SectionHeader';
import {LoadingSpinner} from '../components/LoadingSpinner';
import {ErrorView} from '../components/ErrorView';
import {Colors} from '../theme/colors';
import {useTranslation} from 'react-i18next';

export const HomeScreen: React.FC = () => {
  const {t} = useTranslation();
  const navigation = useNavigation<any>();
  const [movies, setMovies] = useState<ContentItem[]>([]);
  const [trending, setTrending] = useState<TrendingContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (forceRefresh = false) => {
    try {
      setError(null);
      const moviesDict = await loadMovies(forceRefresh);
      const trendingData = await loadTrending(forceRefresh);
      setMovies(getMoviesArray(moviesDict));
      setTrending(trendingData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const navigateToDetails = (item: ContentItem) => {
    navigation.navigate('Details', {item});
  };

  const navigateToCategory = (category: string) => {
    navigation.navigate('Category', {category});
  };

  const trendingToItems = (items: TrendingItem[]): ContentItem[] => {
    return items.slice(0, 20).map((tItem, i) => ({
      id: `trending_${i}`,
      Title: tItem.title,
      Category: tItem.content_type || 'movies',
      'Image Source': tItem.image,
      Source: tItem.link,
      Genres: [],
      GenresAr: [],
      Format: tItem.quality || '',
      Runtime: null,
      Country: null,
    }));
  };

  const latestMovies = movies.slice(0, 20);
  const recentAdded = movies.slice(-20).reverse();

  if (loading) return <LoadingSpinner />;
  if (error && movies.length === 0) return <ErrorView message={error} onRetry={() => loadData(true)} />;

  const renderTrendingSection = () => {
    if (!trending?.movies?.length) return null;
    const items = trendingToItems(trending.movies);
    return (
      <View style={styles.section}>
        <SectionHeader title={t('trending_now')} onSeeAll={() => navigateToCategory('trending')} />
        <FlatList
          data={items}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
          keyExtractor={(item) => item.id}
          renderItem={({item}) => (
            <MovieCard item={item} onPress={navigateToDetails} width={140} />
          )}
        />
      </View>
    );
  };

  const renderLatestSection = () => {
    if (latestMovies.length === 0) return null;
    return (
      <View style={styles.section}>
        <SectionHeader title={t('latest_movies')} onSeeAll={() => navigateToCategory('movies')} />
        <FlatList
          data={latestMovies}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
          keyExtractor={(item) => item.id}
          renderItem={({item}) => (
            <MovieCard item={item} onPress={navigateToDetails} width={CARD_WIDTH} />
          )}
        />
      </View>
    );
  };

  const renderRecentSection = () => {
    if (recentAdded.length === 0) return null;
    return (
      <View style={styles.section}>
        <SectionHeader title={t('most_viewed')} onSeeAll={() => navigateToCategory('movies')} />
        <FlatList
          data={recentAdded}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
          keyExtractor={(item) => item.id}
          renderItem={({item}) => (
            <MovieCard item={item} onPress={navigateToDetails} width={CARD_WIDTH} />
          )}
        />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.dark.background} />
      <FlatList
        data={[]}
        ListHeaderComponent={
          <View>
            {renderTrendingSection()}
            {renderLatestSection()}
            {renderRecentSection()}
          </View>
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
        contentContainerStyle={styles.content}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  content: {
    paddingTop: 16,
    paddingBottom: 80,
  },
  section: {
    marginBottom: 8,
  },
  horizontalList: {
    paddingLeft: 16,
    paddingRight: 16,
  },
});
