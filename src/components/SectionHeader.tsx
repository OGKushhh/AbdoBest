import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {Colors} from '../theme/colors';
import {Typography} from '../theme/typography';
import {useTranslation} from 'react-i18next';

interface SectionHeaderProps {
  title: string;
  onSeeAll?: () => void;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({title, onSeeAll}) => {
  const {t} = useTranslation();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {onSeeAll && (
        <TouchableOpacity onPress={onSeeAll}>
          <Text style={styles.seeAll}>{t('all')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  title: {
    color: Colors.dark.text,
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold,
  },
  seeAll: {
    color: Colors.dark.primary,
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.medium,
  },
});
