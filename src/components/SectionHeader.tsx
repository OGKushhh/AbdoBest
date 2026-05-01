import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ImageSourcePropType,
} from 'react-native';
import { Colors, SPACING } from '../theme/colors';
import { FONTS } from '../theme/typography';
import { useTranslation } from 'react-i18next';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface SectionHeaderProps {
  /** Section title displayed on the left */
  title: string;
  /** Optional local PNG icon rendered before the title */
  icon?: ImageSourcePropType;
  /** Fires when "See All" is pressed */
  onSeeAll?: () => void;
  /** Custom "See All" label – defaults to i18n key */
  seeAllLabel?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  icon,
  onSeeAll,
  seeAllLabel,
}) => {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      {/* Left side: optional icon + title */}
      <View style={styles.leftRow}>
        {icon ? (
          <Image
            source={icon}
            style={[styles.iconImg, { tintColor: Colors.dark.primary }]}
            resizeMode="contain"
          />
        ) : null}
        <Text style={[styles.title, FONTS.heading2]}>{title}</Text>
      </View>

      {/* Right side: optional "See All" */}
      {onSeeAll ? (
        <TouchableOpacity
          onPress={onSeeAll}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
          accessibilityLabel={seeAllLabel ?? t('all')}
          accessibilityRole="button">
          <Text style={[styles.seeAllText, FONTS.caption]}>
            {seeAllLabel ?? t('all')}
          </Text>
        </TouchableOpacity>
      ) : null}

      {/* Subtle bottom border – spans full width */}
      <View style={styles.bottomBorder} />
    </View>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    position: 'relative',
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flexShrink: 1,
  },
  iconImg: {
    width: 22,
    height: 22,
  },
  title: {
    color: Colors.dark.text,
  },
  seeAllText: {
    color: Colors.dark.accent,
  },
  bottomBorder: {
    position: 'absolute',
    bottom: 0,
    left: SPACING.lg,
    right: SPACING.lg,
    height: 1,
    backgroundColor: Colors.dark.border,
    opacity: 0.6,
  },
});
