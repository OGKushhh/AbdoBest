import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BadgeColors, BadgeVariant } from '../theme/colors';
import { FONTS } from '../theme/typography';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface QualityBadgeProps {
  /** Label displayed inside the badge */
  label: string;
  /** Colour variant – maps to BadgeColors from the theme */
  variant?: BadgeVariant;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export const QualityBadge: React.FC<QualityBadgeProps> = ({
  label,
  variant = 'quality',
}) => {
  // Guard against unknown variant
  const colors = BadgeColors[variant] ?? BadgeColors.quality;

  return (
    <View style={[styles.badge, { backgroundColor: colors.backgroundColor }]}>
      <Text
        style={[
          styles.text,
          FONTS.caption,
          { color: colors.color },
        ]}
        numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  badge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  text: {
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
