import React, { useState, useCallback } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Image,
  Text,
  I18nManager,
} from 'react-native';
import { Colors, RADIUS, SPACING } from '../theme/colors';
import { FONTS } from '../theme/typography';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface SearchBarProps {
  /** Current search text */
  value: string;
  /** Fires on every keystroke – guarded against undefined */
  onChangeText?: (text: string) => void;
  /** Placeholder label */
  placeholder?: string;
  /** Fires when the user presses the search key on the keyboard */
  onSubmit?: () => void;
  /** Whether the full bar is visible (collapsed = icon‑only) */
  show?: boolean;
  /** Toggle between collapsed icon and expanded bar */
  onToggle?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChangeText,
  placeholder,
  onSubmit,
  show = true,
  onToggle,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const isRTL = I18nManager.isRTL;

  // Gracefully handle undefined onChangeText
  const handleChangeText = useCallback(
    (text: string) => onChangeText?.(text),
    [onChangeText],
  );

  const handleClear = useCallback(() => {
    handleChangeText('');
  }, [handleChangeText]);

  const handleToggle = useCallback(() => {
    handleChangeText('');
    onToggle?.();
  }, [handleChangeText, onToggle]);

  // ── Collapsed state: icon‑only button ──────────────────────────────────
  if (!show && !isFocused) {
    return (
      <TouchableOpacity
        style={styles.iconButton}
        onPress={onToggle}
        activeOpacity={0.7}
        accessibilityLabel="Open search"
        accessibilityRole="button">
        <Image
          source={require('../../assets/icons/search.png')}
          style={[styles.iconImg, { tintColor: Colors.dark.textSecondary }]}
        />
      </TouchableOpacity>
    );
  }

  // ── Expanded state: full search bar ────────────────────────────────────
  return (
    <View style={[styles.container, isFocused && styles.focused]}>
      <Image
        source={require('../../assets/icons/search.png')}
        style={[
          styles.iconImg,
          {
            tintColor: isFocused
              ? Colors.dark.primary
              : Colors.dark.textSecondary,
            marginRight: isRTL ? 0 : SPACING.md,
            marginLeft: isRTL ? SPACING.md : 0,
          },
        ]}
      />

      <TextInput
        style={[styles.input, isRTL && styles.inputRTL]}
        value={value}
        onChangeText={handleChangeText}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        placeholderTextColor={Colors.dark.textMuted}
        returnKeyType="search"
        onSubmitEditing={onSubmit}
        autoCorrect={false}
        accessibilityLabel="Search input"
      />

      {value.length > 0 && (
        <TouchableOpacity
          onPress={handleClear}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          accessibilityLabel="Clear search"
          accessibilityRole="button">
          <Text style={styles.clearText}>✕</Text>
        </TouchableOpacity>
      )}

      {/* Collapse button when bar is toggled open */}
      {!value.length && onToggle && (
        <TouchableOpacity
          onPress={handleToggle}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          accessibilityLabel="Close search"
          accessibilityRole="button">
          <Text style={styles.clearText}>✕</Text>
        </TouchableOpacity>
      )}
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
    backgroundColor: Colors.dark.surface,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingHorizontal: SPACING.md,
    height: 44,
  },
  focused: {
    borderColor: Colors.dark.primary,
    borderWidth: 1.5,
  },
  iconImg: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
  },
  input: {
    flex: 1,
    ...FONTS.body,
    color: Colors.dark.text,
    paddingVertical: 0,
    padding: 0,
    height: '100%',
    textAlign: 'left',
  },
  inputRTL: {
    textAlign: 'right',
  },
  clearText: {
    color: Colors.dark.textSecondary,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  iconButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
