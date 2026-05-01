import { TextStyle } from 'react-native';

/**
 * AbdoBest Typography System
 *
 * A complete type scale built on the 'Rubik' font family.
 * Every style (except mono) includes fontFamily: 'Rubik' so it can be
 * spread directly into a <Text style={…}> without extra wrapping.
 *
 * Usage:
 *   import { FONTS, heading1, body } from '@/theme/typography';
 *   <Text style={heading1}>Screen Title</Text>
 *   <Text style={{ ...body, color: 'gray' }}>Description</Text>
 */

// ---------------------------------------------------------------------------
// FONTS – the single source of truth for every text style in the app
// ---------------------------------------------------------------------------
export const FONTS: Record<string, TextStyle> = {
  /** Screen titles – bold, slightly tight tracking */
  heading1: {
    fontFamily: 'Rubik',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 34,
  },

  /** Section headers – prominent but lighter than heading1 */
  heading2: {
    fontFamily: 'Rubik',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    lineHeight: 28,
  },

  /** Card titles – compact bold headings */
  heading3: {
    fontFamily: 'Rubik',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
    lineHeight: 24,
  },

  /** Large body text – primary readable content */
  bodyLarge: {
    fontFamily: 'Rubik',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
  },

  /** Default body text – descriptions, paragraphs */
  body: {
    fontFamily: 'Rubik',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },

  /** Small body text – metadata, secondary info */
  bodySmall: {
    fontFamily: 'Rubik',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
  },

  /** Caption – labels, badges, chips */
  caption: {
    fontFamily: 'Rubik',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },

  /** Small uppercase caption – section labels, category chips */
  captionSmall: {
    fontFamily: 'Rubik',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as TextStyle['textTransform'],
  },

  /** Micro text – tiny labels, legal disclaimers */
  micro: {
    fontFamily: 'Rubik',
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 13,
  },

  /** Monospace – time codes, timestamps, technical values */
  mono: {
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
};

// ---------------------------------------------------------------------------
// Individual named exports for convenient direct imports
// ---------------------------------------------------------------------------
export const heading1 = FONTS.heading1;
export const heading2 = FONTS.heading2;
export const heading3 = FONTS.heading3;
export const bodyLarge = FONTS.bodyLarge;
export const body = FONTS.body;
export const bodySmall = FONTS.bodySmall;
export const caption = FONTS.caption;
export const captionSmall = FONTS.captionSmall;
export const micro = FONTS.micro;
export const mono = FONTS.mono;
