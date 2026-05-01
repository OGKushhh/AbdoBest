import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';
import {ar} from './ar';
import {en} from './en';

// Read saved language preference from storage (MMKV must be initialized before this module loads).
// Falls back to 'ar' if storage isn't ready or no preference is saved.
let savedLang = 'ar';
try {
  // Lazy: storage may not be initialized at module load time, so i18n starts with 'ar'
  // and SettingsScreen calls i18n.changeLanguage() after storage is ready.
  const {storage} = require('../storage');
  if (storage) {
    const stored = storage.getString('settings');
    if (stored) {
      try { savedLang = JSON.parse(stored).language || 'ar'; } catch { /* ignore */ }
    }
  }
} catch { /* storage not ready yet, will use fallback */ }

i18n.use(initReactI18next).init({
  resources: {
    ar: {translation: ar},
    en: {translation: en},
  },
  lng: savedLang,
  fallbackLng: 'ar',
  interpolation: {escapeValue: false},
});

export default i18n;
