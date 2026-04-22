import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import CookieGrabber from './src/components/CookieGrabber';
import { setCookies } from './src/services/faselhdScraper';
import HomeScreen from './src/screens/HomeScreen';
import DiscoveryScreen from './src/screens/DiscoveryScreen';
import DetailsScreen from './src/screens/DetailsScreen';
import PlayerScreen from './src/screens/PlayerScreen';
import PlaceholderScreen from './src/screens/PlaceholderScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function HomeTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, tabBarActiveTintColor: '#E50914' }}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Search" component={DiscoveryScreen} />
      <Tab.Screen name="My List" component={() => <PlaceholderScreen title="My List" />} />
      <Tab.Screen name="Settings" component={() => <PlaceholderScreen title="Settings" />} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [isReady, setIsReady] = useState(false);

  const handleCookiesReady = (cookies) => {
    setCookies(cookies);
    setIsReady(true);
  };

  if (!isReady) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#E50914" />
        <CookieGrabber onDone={handleCookiesReady} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#000' }, headerTintColor: '#fff' }}>
        <Stack.Screen name="MainTabs" component={HomeTabs} options={{ headerShown: false }} />
        <Stack.Screen name="Details" component={DetailsScreen} />
        <Stack.Screen name="Player" component={PlayerScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }
});
