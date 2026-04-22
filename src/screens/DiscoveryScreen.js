import React, { useState } from 'react';
import { View, TextInput, FlatList, Image, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { search } from '../services/faselhdScraper';

export default function DiscoveryScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const navigation = useNavigation();

  const handleSearch = async () => {
    const res = await search(query);
    setResults(res);
  };

  return (
    <View style={styles.container}>
      <TextInput 
        style={styles.input} 
        placeholder="Search..." 
        placeholderTextColor="#888"
        value={query} 
        onChangeText={setQuery} 
        onSubmitEditing={handleSearch} 
      />
      <FlatList 
        numColumns={3} 
        data={results} 
        keyExtractor={item => item.id}
        renderItem={({item}) => (
          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Details', { url: item.id })}>
            <Image source={{ uri: item.poster }} style={styles.img} />
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#141414', padding: 10 },
  input: { backgroundColor: '#333', color: '#fff', padding: 10, borderRadius: 8, marginBottom: 20 },
  card: { flex: 1, margin: 5 },
  img: { width: '100%', height: 150, borderRadius: 5 }
});
