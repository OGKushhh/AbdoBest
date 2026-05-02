import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { getSettings, saveSettings } from '../storage';
import { Colors, ThemeMode } from '../theme/colors';

// Match the same structure as used in SettingsScreen / PlayerScreen
export interface ThemeColors {
  background: string;
  surface: string;
  surfaceLight: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  error: string;
  success: string;
  warning: string;
  primary: string;
  primaryLight: string;
  accent: string;
  accentLight: string;
  primaryGradient: readonly [string, string];
  accentGradient: readonly [string, string];
  gradientAbdo: readonly [string, string];
  gradientBest: readonly [string, string];
  badge: {
    quality: string;
    category: string;
    categoryText: string;
    rating: string;
    views: string;
  };
}

interface ThemeContextType {
  mode: ThemeMode;
  colors: ThemeColors;
  setDarkMode: (enabled: boolean) => void;
  toggleDarkMode: () => void;
  primaryGradient: readonly [string, string];
  accentGradient: readonly [string, string];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<ThemeMode>('dark');

  useEffect(() => {
    const settings = getSettings();
    const isDark = settings.dark_mode !== undefined ? settings.dark_mode : true;
    setMode(isDark ? 'dark' : 'light');
  }, []);

  const setDarkMode = (enabled: boolean) => {
    const newMode = enabled ? 'dark' : 'light';
    setMode(newMode);
    const settings = getSettings();
    settings.dark_mode = enabled;
    saveSettings(settings);
  };

  const toggleDarkMode = () => setDarkMode(mode !== 'dark');

  const colors = useMemo(() => {
    return mode === 'dark' ? Colors.dark : Colors.light;
  }, [mode]);

  const primaryGradient = colors.primaryGradient;
  const accentGradient = colors.accentGradient;

  return (
    <ThemeContext.Provider
      value={{
        mode,
        colors,
        setDarkMode,
        toggleDarkMode,
        primaryGradient,
        accentGradient,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
};