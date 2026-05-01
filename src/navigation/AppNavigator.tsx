import React, { useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Colors } from '../theme/colors';
import { FONTS } from '../theme/typography';
import { HomeScreen } from '../screens/HomeScreen';
import { CategoryScreen } from '../screens/CategoryScreen';
import { DetailsScreen } from '../screens/DetailsScreen';
import { PlayerScreen } from '../screens/PlayerScreen';
import { DownloadsScreen } from '../screens/DownloadsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { useTranslation } from 'react-i18next';

// =============================================================================
// Local PNG icon assets — verified to exist under /assets/icons/
// =============================================================================
const TabIcons = {
  home: require('../../assets/icons/tv.png'),
  browse: require('../../assets/icons/browsing.png'),
  downloads: require('../../assets/icons/files.png'),
  settings: require('../../assets/icons/settings.png'),
} as const;

// =============================================================================
// Navigator types
// =============================================================================
export type RootStackParamList = {
  Home: undefined;
  Category: { category?: string };
  Details: { id: string };
  Player: { id: string };
};

export type HomeTabParamList = {
  HomeTab: undefined;
  BrowseTab: undefined;
  DownloadsTab: undefined;
  SettingsTab: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<HomeTabParamList>();

// =============================================================================
// Tab icon component — 24×24 with tintColor
// =============================================================================
const TabIcon: React.FC<{
  source: typeof TabIcons.home;
  color: string;
}> = ({ source, color }) => (
  <Image
    source={source}
    style={[styles.tabIcon, { tintColor: color }]}
    resizeMode="contain"
  />
);

// =============================================================================
// Tab Navigator (HomeTabs) — wrapped in error boundary guard
// =============================================================================
const HomeTabs: React.FC = () => {
  const { t } = useTranslation();

  const tabScreenOptions = useMemo(
    () => ({
      tabBarStyle: {
        backgroundColor: Colors.dark.tabBar,
        borderTopColor: Colors.dark.tabBarBorder,
        borderTopWidth: 0.5,
        height: 68,
        paddingBottom: 10,
        paddingTop: 6,
        // Subtle upward shadow sitting above the tab bar
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: -1 } as {
          width: number;
          height: number;
        },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 8,
      } as const,
      tabBarActiveTintColor: Colors.dark.tabBarActive,
      tabBarInactiveTintColor: Colors.dark.tabBarInactive,
      tabBarLabelStyle: {
        fontSize: FONTS.caption.fontSize, // 12
        fontWeight: '600' as const,
        fontFamily: 'Rubik',
        marginTop: 2,
      },
      headerShown: false,
    }),
    [],
  );

  try {
    return (
      <Tab.Navigator screenOptions={tabScreenOptions}>
        <Tab.Screen
          name="HomeTab"
          component={HomeScreen}
          options={{
            tabBarLabel: t('home'),
            tabBarIcon: ({ color }) => (
              <TabIcon source={TabIcons.home} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="BrowseTab"
          component={CategoryScreen}
          initialParams={{ category: 'movies' }}
          options={{
            tabBarLabel: t('browse'),
            tabBarIcon: ({ color }) => (
              <TabIcon source={TabIcons.browse} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="DownloadsTab"
          component={DownloadsScreen}
          options={{
            tabBarLabel: t('downloads'),
            tabBarIcon: ({ color }) => (
              <TabIcon source={TabIcons.downloads} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="SettingsTab"
          component={SettingsScreen}
          options={{
            tabBarLabel: t('settings'),
            tabBarIcon: ({ color }) => (
              <TabIcon source={TabIcons.settings} color={color} />
            ),
          }}
        />
      </Tab.Navigator>
    );
  } catch (error) {
    // Fallback render — prevents the entire navigator from crashing if a tab
    // icon asset is missing or an unexpected error occurs during rendering.
    console.error('[AppNavigator] HomeTabs render error:', error);
    return (
      <View style={styles.fallbackContainer}>
        <Tab.Navigator screenOptions={tabScreenOptions}>
          <Tab.Screen
            name="HomeTab"
            component={HomeScreen}
            options={{ tabBarLabel: t('home') }}
          />
          <Tab.Screen
            name="BrowseTab"
            component={CategoryScreen}
            options={{ tabBarLabel: t('browse') }}
          />
          <Tab.Screen
            name="DownloadsTab"
            component={DownloadsScreen}
            options={{ tabBarLabel: t('downloads') }}
          />
          <Tab.Screen
            name="SettingsTab"
            component={SettingsScreen}
            options={{ tabBarLabel: t('settings') }}
          />
        </Tab.Navigator>
      </View>
    );
  }
};

// =============================================================================
// Navigation theme — dark palette matching AbdoBest design tokens
// =============================================================================
const AbdoBestTheme = {
  ...DarkTheme,
  dark: true,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.dark.primary,
    background: Colors.dark.background,
    card: Colors.dark.surface,
    text: Colors.dark.text,
    border: Colors.dark.border,
    notification: Colors.dark.error,
  },
};

// =============================================================================
// AppNavigator — root stack
// =============================================================================
export const AppNavigator: React.FC = () => {
  return (
    <NavigationContainer theme={AbdoBestTheme}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
          contentStyle: { backgroundColor: Colors.dark.background },
        }}
      >
        {/* Tab hub */}
        <Stack.Screen name="Home" component={HomeTabs} />

        {/* Category / browse listing */}
        <Stack.Screen
          name="Category"
          component={CategoryScreen}
          options={{
            animation: 'slide_from_right',
            animationDuration: 220,
          }}
        />

        {/* Content details — rises from bottom */}
        <Stack.Screen
          name="Details"
          component={DetailsScreen}
          options={{
            animation: 'fade_from_bottom',
            animationDuration: 280,
          }}
        />

        {/* Full-screen player — supports all orientations */}
        <Stack.Screen
          name="Player"
          component={PlayerScreen}
          options={{
            animation: 'fade',
            animationDuration: 180,
            orientation: 'all',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

// =============================================================================
// Styles
// =============================================================================
const styles = StyleSheet.create({
  tabIcon: {
    width: 24,
    height: 24,
  },
  fallbackContainer: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
});
