import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {Typography} from '../theme/typography';

interface QualityBadgeProps {
  quality: string;
  size?: 'small' | 'normal';
}

export const QualityBadge: React.FC<QualityBadgeProps> = ({quality, size = 'normal'}) => {
  const isHD = quality.includes('1080');
  const isSD = quality.includes('480') || quality.includes('360');

  const getBadgeColor = () => {
    if (isHD) return '#FFD700';
    if (isSD) return '#888';
    return '#00E5FF';
  };

  return (
    <View style={[styles.badge, {backgroundColor: getBadgeColor()}, size === 'small' && styles.badgeSmall]}>
      <Text style={[styles.text, size === 'small' && styles.textSmall]}>{quality.split(' ')[0]}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
  },
  badgeSmall: {
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  text: {
    color: '#000',
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
  },
  textSmall: {
    fontSize: Typography.sizes.xs,
  },
});
