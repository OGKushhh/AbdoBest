import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Image, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { scrapeHome } from '../services/faselhdScraper';

export default function HomeScreen() {
  const [data, setData] = useState(null);
  const navigation = useNavigation();

  useEffect(() => { scrapeHome().then(setData); }, []);

  const Card = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Details', { url: item.id })}>
      <Image source={{ uri: item.poster }} style={styles.img} />
      <Text style={styles.txt} numberOfLines={2}>{item.title}</Text>
    </TouchableOpacity>
  );

  if (!data) return <ActivityIndicator style={styles.load} />;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Latest Movies</Text>
      <FlatList horizontal data={data.movies} renderItem={({item}) => <Card item={item} />} keyExtractor={item => item.id} />
      
      <Text style={styles.header}>Latest Episodes</Text>
      <FlatList horizontal data={data.episodes} renderItem={({item}) => <Card item={item} />} keyExtractor={item => item.id} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#141414', padding: 10 },
  load: { marginTop: 50 },
  header: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginVertical: 10 },
  card: { width: 120, marginRight: 10 },
  img: { width: 120, height: 180, borderRadius: 8 },
  txt: { color: '#ccc', marginTop: 5, fontSize: 12 }
});
