import React, {useState, useEffect} from 'react';
import {View, TextInput, StyleSheet, TouchableOpacity} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {Colors} from '../theme/colors';
import {Typography} from '../theme/typography';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({value, onChangeText, placeholder, onSubmit}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.container, isFocused && styles.focused]}>
      <Icon name="search" size={20} color={Colors.dark.textSecondary} style={styles.icon} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        placeholderTextColor={Colors.dark.textMuted}
        returnKeyType="search"
        onSubmitEditing={onSubmit}
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={() => onChangeText('')} style={styles.clearButton}>
          <Icon name="close-circle" size={20} color={Colors.dark.textSecondary} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    height: 48,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  focused: {
    borderColor: Colors.dark.primary,
    borderWidth: 2,
  },
  icon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: Colors.dark.text,
    fontSize: Typography.sizes.md,
    padding: 0,
    height: '100%',
  },
  clearButton: {
    marginLeft: 8,
  },
});
