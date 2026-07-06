/**
 * deviceCountry.ts
 * Best-effort detection of the user's country (ISO2) from native locale
 * info, without pulling in an extra dependency like react-native-localize.
 * Falls back to Egypt ('EG') if detection fails, since it is the app's
 * primary market.
 */
import {NativeModules, Platform} from 'react-native';

const FALLBACK_ISO2 = 'EG';

function extractRegion(localeTag?: string | null): string | null {
  if (!localeTag) return null;
  // Examples: "ar_EG", "en-US", "ar-EG@calendar=..."
  const cleaned = localeTag.split('@')[0].replace('_', '-');
  const parts = cleaned.split('-');
  const region = parts[1];
  if (region && /^[A-Za-z]{2}$/.test(region)) {
    return region.toUpperCase();
  }
  return null;
}

export function getDeviceCountryISO2(): string {
  try {
    if (Platform.OS === 'ios') {
      const settings = NativeModules.SettingsManager?.settings;
      const localeTag: string | undefined =
        settings?.AppleLocale ?? settings?.AppleLanguages?.[0];
      const region = extractRegion(localeTag);
      if (region) return region;
    } else if (Platform.OS === 'android') {
      const localeTag: string | undefined =
        NativeModules.I18nManager?.localeIdentifier;
      const region = extractRegion(localeTag);
      if (region) return region;
    }
  } catch {
    // ignore — fall through to fallback
  }
  return FALLBACK_ISO2;
}
