import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Colors, ThemeMode, ThemeColors } from '../theme/colors';
import { getSettings, saveSettings } from '../storage';

interface ThemeContextValue {
  mode: ThemeMode;
  colors: ThemeColors;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const settings = getSettings();
    // Use darkMode or dark_mode – check your storage keys
    return settings.darkMode !== false ? 'dark' : 'light';
  });

  const toggleTheme = useCallback(() => {
    const newMode = mode === 'dark' ? 'light' : 'dark';
    setMode(newMode);
    const settings = getSettings();
    saveSettings({ ...settings, darkMode: newMode === 'dark' });
  }, [mode]);

  const colors = mode === 'dark' ? Colors.dark : Colors.light;

  return (
    <ThemeContext.Provider value={{ mode, colors, toggleTheme, isDark: mode === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};