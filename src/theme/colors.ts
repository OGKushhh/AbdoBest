// =============================================================================
// AbdoBest Design System — Color Foundation
// Dark navy streaming theme with red/cyan accent palette
// =============================================================================

// ---------------------------------------------------------------------------
// Spacing Scale
// ---------------------------------------------------------------------------
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export type SpacingKey = keyof typeof SPACING;

// ---------------------------------------------------------------------------
// Border Radius
// ---------------------------------------------------------------------------
export const RADIUS = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
} as const;

export type RadiusKey = keyof typeof RADIUS;

// ---------------------------------------------------------------------------
// Shadow Presets
// ---------------------------------------------------------------------------
export const Shadows = {
  shadowSm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 } as { width: number; height: number },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  shadowMd: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 } as { width: number; height: number },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  shadowLg: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 } as { width: number; height: number },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 16,
  },
  shadowGlow: {
    shadowColor: '#E53935',
    shadowOffset: { width: 0, height: 4 } as { width: number; height: number },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 12,
  },
} as const;

export type ShadowPreset = keyof typeof Shadows;

// ---------------------------------------------------------------------------
// Badge Chip Presets
// ---------------------------------------------------------------------------
export const BadgeColors = {
  quality: { backgroundColor: '#E5393520', color: '#FF5252' },
  genre: { backgroundColor: '#29B6F620', color: '#29B6F6' },
  rating: { backgroundColor: '#FFD70020', color: '#FFD700' },
} as const;

export type BadgeVariant = keyof typeof BadgeColors;

// ---------------------------------------------------------------------------
// Main Colors Export
// ---------------------------------------------------------------------------
export const Colors = {
  // -------------------------------------------------------------------------
  // Dark Theme (primary)
  // -------------------------------------------------------------------------
  dark: {
    // ── Base Palette ──────────────────────────────────────────────────
    background: '#0B0E14',
    surface: '#141820',
    surfaceElevated: '#1A1F2B',
    border: '#1E2530',

    // ── Text ──────────────────────────────────────────────────────────
    text: '#FFFFFF',
    textSecondary: '#9CA3AF',
    textMuted: '#6B7280',

    // ── Accent — Primary Red ──────────────────────────────────────────
    primary: '#E53935',
    primaryLight: '#FF5252',
    primaryGradient: ['#E53935', '#FF5252'] as const,

    // ── Accent — Cyan ─────────────────────────────────────────────────
    accent: '#29B6F6',
    accentGradient: ['#1565C0', '#29B6F6'] as const,

    // ── Status ────────────────────────────────────────────────────────
    success: '#4CAF50',
    warning: '#FFC107',
    error: '#EF5350',

    // ── Rating / Gold ─────────────────────────────────────────────────
    rating: '#FFD700',

    // ── UI Helpers ────────────────────────────────────────────────────
    overlay: 'rgba(0,0,0,0.75)',

    // ── Tab Bar ───────────────────────────────────────────────────────
    tabBar: '#0F1219',
    tabBarBorder: '#1A1F2B',
    tabBarActive: '#E53935',
    tabBarInactive: '#4B5563',

    // ── Badge Chips ───────────────────────────────────────────────────
    badge: {
      quality: { backgroundColor: '#E5393520', color: '#FF5252' },
      genre: { backgroundColor: '#29B6F620', color: '#29B6F6' },
      rating: { backgroundColor: '#FFD70020', color: '#FFD700' },
    },

    // ── Shadows ───────────────────────────────────────────────────────
    shadowSm: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 4,
    },
    shadowMd: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 8,
    },
    shadowLg: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.5,
      shadowRadius: 16,
      elevation: 16,
    },
    shadowGlow: {
      shadowColor: '#E53935',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.6,
      shadowRadius: 12,
      elevation: 12,
    },

    // ── Brand Gradients (kept for backward compatibility) ──────────────
    gradientAbdo: ['#E53935', '#FF5252'] as const,
    gradientBest: ['#1565C0', '#29B6F6'] as const,

    // ── Backward Compatibility Aliases ─────────────────────────────────
    card: '#141820',
    surfaceLight: '#1A1F2B',
    accentLight: '#29B6F6',
  },

  // -------------------------------------------------------------------------
  // Light Theme (secondary — updated to match new palette)
  // -------------------------------------------------------------------------
  light: {
    background: '#F5F7FC',
    surface: '#FFFFFF',
    surfaceElevated: '#EEF1F8',
    border: '#DDE3F0',

    text: '#0A0D14',
    textSecondary: '#4A5270',
    textMuted: '#8B95B0',

    primary: '#E53935',
    primaryLight: '#FF5252',
    primaryGradient: ['#E53935', '#FF5252'] as const,

    accent: '#29B6F6',
    accentGradient: ['#1565C0', '#29B6F6'] as const,

    success: '#4CAF50',
    warning: '#FFC107',
    error: '#EF5350',

    rating: '#FFD700',

    overlay: 'rgba(255,255,255,0.8)',

    tabBar: '#FFFFFF',
    tabBarBorder: '#DDE3F0',
    tabBarActive: '#E53935',
    tabBarInactive: '#9CA3AF',

    badge: {
      quality: { backgroundColor: '#E5393520', color: '#E53935' },
      genre: { backgroundColor: '#29B6F620', color: '#1565C0' },
      rating: { backgroundColor: '#FFD70020', color: '#E65100' },
    },

    shadowSm: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
    shadowMd: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 4,
    },
    shadowLg: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.16,
      shadowRadius: 16,
      elevation: 8,
    },
    shadowGlow: {
      shadowColor: '#E53935',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 8,
    },

    gradientAbdo: ['#E53935', '#FF5252'] as const,
    gradientBest: ['#1565C0', '#29B6F6'] as const,
  },
};

export type ThemeMode = 'dark' | 'light';
