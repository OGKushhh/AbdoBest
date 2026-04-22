import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function PlaceholderScreen({ title }) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{title} - Coming Soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#141414' },
  text: { color: '#fff', fontSize: 18 }
});
