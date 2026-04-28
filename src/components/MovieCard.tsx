import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Dimensions} from 'react-native';
import FastImage from 'react-native-fast-image';
import {ContentItem} from '../types';
import {Colors} from '../theme/colors';
import {Typography} from '../theme/typography';

interface MovieCardProps {
  item: ContentItem;
  onPress: (item: ContentItem) => void;
  width?: number;
  showTitle?: boolean;
}

const CARD_WIDTH = (Dimensions.get('window').width - 60) / 2;
const CARD_HEIGHT = CARD_WIDTH * 1.5;

export const MovieCard: React.FC<MovieCardProps> = ({item, onPress, width = CARD_WIDTH, showTitle = true}) => {
  const imageUri = item['Image Source'];
  
  return (
    <TouchableOpacity style={[styles.card, {width}]} onPress={() => onPress(item)} activeOpacity={0.8}>
      <View style={styles.imageContainer}>
        <FastImage
          source={imageUri ? {uri: imageUri} : require('../../assets/placeholder.png')}
          style={[styles.image, {width, height: width * 1.5}]}
          resizeMode={FastImage.resizeMode.cover}
          fallback
        />
        {item.Format && (
          <View style={styles.formatBadge}>
            <Text style={styles.formatText}>{item.Format.split(' ')[0]}</Text>
          </View>
        )}
      </View>
      {showTitle && (
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={2}>{item.Title}</Text>
          {item.Genres?.length > 0 && (
            <Text style={styles.genre} numberOfLines={1}>{item.Genres[0]}</Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.dark.card,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  imageContainer: {
    position: 'relative',
  },
  image: {
    borderRadius: 12,
    backgroundColor: Colors.dark.surfaceLight,
  },
  formatBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  formatText: {
    color: '#00E5FF',
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.bold,
  },
  info: {
    padding: 8,
  },
  title: {
    color: Colors.dark.text,
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    lineHeight: 18,
  },
  genre: {
    color: Colors.dark.textSecondary,
    fontSize: Typography.sizes.xs,
    marginTop: 2,
  },
});

export {CARD_WIDTH, CARD_HEIGHT};
