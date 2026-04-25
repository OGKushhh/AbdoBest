import React, {useState} from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, Alert, Share, ActivityIndicator,
} from 'react-native';
import {useRoute, useNavigation} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import FastImage from 'react-native-fast-image';
import {ContentItem} from '../types';
import {getStreamUrl} from '../services/videoService';
import {Colors} from '../theme/colors';
import {Typography} from '../theme/typography';
import {QualityBadge} from '../components/QualityBadge';
import {useTranslation} from 'react-i18next';

const {height: SCREEN_HEIGHT} = Dimensions.get('window');
const BACKDROP_HEIGHT = SCREEN_HEIGHT * 0.45;

export const DetailsScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const item: ContentItem = route.params?.item;
  const {t} = useTranslation();
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  const hasSource = item.Source && item.Source.length > 0;

  const handlePlay = async () => {
    if (!hasSource) {
      Alert.alert(t('video_unavailable'), t('not_available'));
      return;
    }

    setExtracting(true);
    setExtractError(null);

    try {
      const result = await getStreamUrl(item.id, item.Source);
      if (result.video_url) {
        navigation.navigate('Player', {url: result.video_url, title: item.Title});
      } else {
        setExtractError(t('video_unavailable'));
      }
    } catch (err: any) {
      setExtractError(err.message || t('server_error'));
    } finally {
      setExtracting(false);
    }
  };

  const handleDownload = async () => {
    if (!hasSource) {
      Alert.alert(t('video_unavailable'), t('not_available'));
      return;
    }

    setExtracting(true);
    setExtractError(null);

    try {
      const result = await getStreamUrl(item.id, item.Source);
      if (result.video_url) {
        Alert.alert(
          t('download'),
          t('coming_soon'),
          [{text: 'OK'}]
        );
      }
    } catch (err: any) {
      setExtractError(err.message || t('server_error'));
    } finally {
      setExtracting(false);
    }
  };

  const handleShare = () => {
    if (item.Source) {
      Share.share({message: item.Title, url: item.Source});
    }
  };

  const formatRuntime = (minutes: number | null) => {
    if (!minutes) return null;
    if (minutes >= 60) {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return m > 0 ? `${h}${t('hours')} ${m}${t('minutes')}` : `${h}${t('hours')}`;
    }
    return `${minutes}${t('minutes')}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.backdropContainer}>
        {item['Image Source'] ? (
          <FastImage
            source={{uri: item['Image Source'].replace('/posters/', '/backdrops/') || item['Image Source']}}
            style={styles.backdrop}
            resizeMode={FastImage.resizeMode.cover}
            fallback
          />
        ) : (
          <View style={[styles.backdrop, styles.backdropPlaceholder]} />
        )}
        <View style={styles.backdropOverlay}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={28} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
            <Icon name="share-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.posterRow}>
          <FastImage
            source={item['Image Source'] ? {uri: item['Image Source']} : 0}
            style={styles.poster}
            resizeMode={FastImage.resizeMode.cover}
            fallback
          />
          <View style={styles.posterInfo}>
            <Text style={styles.title} numberOfLines={3}>{item.Title}</Text>
            <View style={styles.metaRow}>
              {item.Format && <QualityBadge quality={item.Format} />}
              {item.Runtime && (
                <Text style={styles.metaText}>{formatRuntime(item.Runtime)}</Text>
              )}
            </View>
            {item.Country && (
              <View style={styles.countryRow}>
                <Icon name="location-outline" size={14} color={Colors.dark.textSecondary} />
                <Text style={styles.countryText}>{item.Country}</Text>
              </View>
            )}
          </View>
        </View>

        {item.Genres && item.Genres.length > 0 && (
          <View style={styles.genresContainer}>
            {item.Genres.map((genre, idx) => (
              <View key={idx} style={styles.genreChip}>
                <Text style={styles.genreText}>{genre}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.playButton]}
            onPress={handlePlay}
            disabled={extracting}
          >
            {extracting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Icon name="play" size={22} color="#fff" />
                <Text style={styles.actionText}>{t('play')}</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.downloadButton]}
            onPress={handleDownload}
            disabled={extracting}
          >
            <Icon name="download-outline" size={22} color="#fff" />
            <Text style={styles.actionText}>{t('download')}</Text>
          </TouchableOpacity>
        </View>

        {extractError && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{extractError}</Text>
            <TouchableOpacity onPress={handlePlay}>
              <Text style={styles.retryText}>{t('retry')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {!hasSource && (
          <View style={styles.availabilityNotice}>
            <Icon name="information-circle-outline" size={18} color={Colors.dark.warning} />
            <Text style={styles.availabilityText}>
              {t('not_available')}
            </Text>
          </View>
        )}

        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>{t('quality')}</Text>
          <Text style={styles.infoText}>{item.Format || 'N/A'}</Text>

          {item.Runtime && (
            <>
              <Text style={styles.sectionTitle}>{t('duration')}</Text>
              <Text style={styles.infoText}>{formatRuntime(item.Runtime)}</Text>
            </>
          )}

          {item.Country && (
            <>
              <Text style={styles.sectionTitle}>{t('country')}</Text>
              <Text style={styles.infoText}>{item.Country}</Text>
            </>
          )}

          {item.Genres?.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>{t('genres')}</Text>
              <Text style={styles.infoText}>{item.Genres.join(', ')}</Text>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  backdropContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: BACKDROP_HEIGHT,
    zIndex: 0,
  },
  backdrop: {
    width: '100%',
    height: '100%',
  },
  backdropPlaceholder: {
    backgroundColor: Colors.dark.surface,
  },
  backdropOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  shareButton: {
    position: 'absolute',
    top: 50,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  content: {
    zIndex: 1,
    marginTop: BACKDROP_HEIGHT - 60,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  posterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  poster: {
    width: 120,
    height: 180,
    borderRadius: 12,
    backgroundColor: Colors.dark.surfaceLight,
  },
  posterInfo: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  title: {
    color: Colors.dark.text,
    fontSize: Typography.sizes.xxl,
    fontWeight: Typography.weights.bold,
    lineHeight: 30,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  metaText: {
    color: Colors.dark.textSecondary,
    fontSize: Typography.sizes.sm,
    marginLeft: 4,
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  countryText: {
    color: Colors.dark.textSecondary,
    fontSize: Typography.sizes.sm,
    marginLeft: 4,
  },
  genresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  genreChip: {
    backgroundColor: Colors.dark.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  genreText: {
    color: Colors.dark.textSecondary,
    fontSize: Typography.sizes.sm,
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 12,
    marginHorizontal: 6,
  },
  playButton: {
    backgroundColor: Colors.dark.primary,
  },
  downloadButton: {
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.primary,
  },
  actionText: {
    color: '#fff',
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semibold,
    marginLeft: 8,
  },
  errorContainer: {
    marginHorizontal: 16,
    padding: 12,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  errorText: {
    color: Colors.dark.error,
    fontSize: Typography.sizes.sm,
    textAlign: 'center',
  },
  retryText: {
    color: Colors.dark.primary,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semibold,
    marginTop: 4,
  },
  availabilityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    padding: 12,
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderRadius: 8,
    marginBottom: 16,
  },
  availabilityText: {
    color: Colors.dark.warning,
    fontSize: Typography.sizes.sm,
    marginLeft: 8,
  },
  infoSection: {
    paddingHorizontal: 16,
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    color: Colors.dark.textSecondary,
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 12,
    marginBottom: 4,
  },
  infoText: {
    color: Colors.dark.text,
    fontSize: Typography.sizes.md,
  },
});
