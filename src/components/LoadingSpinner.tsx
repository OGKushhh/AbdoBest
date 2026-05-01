import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { Colors, SPACING } from '../theme/colors';
import { FONTS } from '../theme/typography';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface LoadingSpinnerProps {
  /** RN ActivityIndicator size – defaults to 'large' when undefined */
  size?: 'small' | 'large' | number;
  /** Optional label rendered below the spinner */
  text?: string;
  /** Render inline (false) or full‑screen centred (true) */
  fullScreen?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size,
  text,
  fullScreen = true,
}) => {
  // Guard against undefined size prop – default to 'large'
  const safeSize: 'small' | 'large' | number = size ?? 'large';

  const spinner = (
    <ActivityIndicator
      size={safeSize}
      color={Colors.dark.primary}
      accessibilityLabel="Loading"
    />
  );

  const label = text ? (
    <Text style={[styles.text, FONTS.bodySmall]}>{text}</Text>
  ) : null;

  if (!fullScreen) {
    return (
      <View style={styles.inlineContainer}>
        {spinner}
        {label}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {spinner}
      {label}
    </View>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
  },
  inlineContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.lg,
  },
  text: {
    color: Colors.dark.textMuted,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
});
