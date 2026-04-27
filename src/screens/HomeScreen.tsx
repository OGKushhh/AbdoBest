import React, {useState, useCallback, useMemo, memo} from 'react';
import {View, StyleSheet, FlatList, RefreshControl, StatusBar} from 'react-native';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {loadCategory, loadFeatured, getMoviesArray} from '../services/metadataService';
import {ContentItem, TrendingContent, TrendingItem} from '../types';
import {MovieCard, CARD_WIDTH} from '../components/MovieCard';
import {SectionHeader} from '../components/SectionHeader';
import {LoadingSpinner} from '../components/LoadingSpinner';
import {ErrorView} from '../components/ErrorView';
import {Colors} from '../theme/colors';
import {useTranslation} from 'react-i18next';

// ─── Memoized horizontal row for performance ──────────────────────
interface HorizontalSectionProps {
  title: string;
  items: ContentItem[];
  onSeeAll?: () => void;
  cardWidth?: number;
  onPressItem: (item: ContentItem) => void;
}

const HorizontalSection = memo<HorizontalSectionProps>(
  ({title, items, onSeeAll, cardWidth, onPressItem}) => {
    if (items.length === 0) return null;
    return (
      <View style={styles.section}>
        <SectionHeader title={title} onSeeAll={onSeeAll} />
        <FlatList
          data={items}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
          keyExtractor={(item) => item.id}
          initialNumToRender={4}
          maxToRenderPerBatch={4}
          windowSize={3}
          removeClippedSubviews={true}
          renderItem={({item}) => (
            <MovieCard item={item} onPress={onPressItem} width={cardWidth || CARD_WIDTH} />
          )}
        />
      </View>
    );
  },
  (prev, next) =>
    prev.title === next.title &&
    prev.items.length === next.items.length &&
    prev.items[0]?.id === next.items[0]?.id,
);
HorizontalSection.displayName = 'HorizontalSection';

export const HomeScreen: React.FC = () => {
  const {t} = useTranslation();
  const navigation = useNavigation<any>();
  const [movies, setMovies] = useState<ContentItem[]>([]);
  const [trending, setTrending] = useState<TrendingContent | null>(null);
  const [featured, setFeatured] = useState<TrendingContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (forceRefresh = false) => {
    try {
      setError(null);
      const [moviesDict, trendingData, featuredData] = await Promise.all([
        loadCategory('movies', forceRefresh),
        loadCategory('trending', forceRefresh),
        loadFeatured(forceRefresh),
      ]);
      setMovies(getMoviesArray(moviesDict as Record<string, any>));
      setTrending(trendingData as TrendingContent);
      setFeatured(featuredData as TrendingContent);
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

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData(true);
  }, [loadData]);

  const navigateToDetails = useCallback((item: ContentItem) => {
    navigation.navigate('Details', {item});
  }, [navigation]);

  const navigateToCategory = useCallback((category: string) => {
    navigation.navigate('Category', {category});
  }, [navigation]);

  const trendingToItems = useCallback((items: TrendingItem[], prefix: string): ContentItem[] => {
    return items.slice(0, 20).map((tItem, i) => ({
      id: `${prefix}_${i}`,
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
  }, []);

  const latestMovies = useMemo(() => movies.slice(0, 20), [movies]);
  const recentAdded = useMemo(() => movies.slice(-20).reverse(), [movies]);

  const trendingItems = useMemo(
    () => (trending?.movies ? trendingToItems(trending.movies, 'trending') : []),
    [trending?.movies, trendingToItems],
  );

  const featuredItems = useMemo(
    () => (featured?.movies ? trendingToItems(featured.movies, 'featured') : []),
    [featured?.movies, trendingToItems],
  );

  if (loading) return <LoadingSpinner />;
  if (error && movies.length === 0) return <ErrorView message={error} onRetry={() => loadData(true)} />;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.dark.background} />
      <FlatList
        data={[]}
        ListHeaderComponent={
          <View>
            <HorizontalSection
              title={t('trending_now')}
              items={trendingItems}
              onSeeAll={() => navigateToCategory('trending')}
              cardWidth={140}
              onPressItem={navigateToDetails}
            />
            <HorizontalSection
              title={t('featured_now')}
              items={featuredItems}
              onSeeAll={() => navigateToCategory('trending')}
              cardWidth={140}
              onPressItem={navigateToDetails}
            />
            <HorizontalSection
              title={t('latest_movies')}
              items={latestMovies}
              onSeeAll={() => navigateToCategory('movies')}
              onPressItem={navigateToDetails}
            />
            <HorizontalSection
              title={t('most_viewed')}
              items={recentAdded}
              onSeeAll={() => navigateToCategory('movies')}
              onPressItem={navigateToDetails}
            />
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
