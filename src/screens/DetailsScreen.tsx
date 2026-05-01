/**
 * DetailsScreen
 *
 * Play flow:
 *   1. User taps Play
 *   2. Show "Connecting…" status immediately
 *   3. POST /extract { url: item.Source }  (always — no hasSource gate)
 *   4. On success → navigate to Player
 *   5. On error   → show dismissable error banner with Retry
 *
 * The /extract endpoint handles everything server-side.
 * We never disable the Play button based on Source field presence.
 */

import React, {useState, useCallback, useMemo} from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Share, Dimensions, StatusBar, Image,
} from 'react-native';
import {useRoute, useNavigation} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import FastImage from 'react-native-fast-image';
import {ContentItem} from '../types';
import {extractVideoUrl} from '../services/api';
import {recordPlay} from '../services/viewService';
import {Colors} from '../theme/colors';
import {useTranslation} from 'react-i18next';

const {width: SW} = Dimensions.get('window');
const POSTER_W = Math.min(SW * 0.50, 210);
const POSTER_H = POSTER_W * 1.52;

// ── Reusable info table row ─────────────────────────────────────────
interface InfoRowProps {
  label: string;
  value: string;
  accent?: boolean;
}
const InfoRow: React.FC<InfoRowProps> = ({label, value, accent}) => (
  <View style={rowS.row}>
    <Text style={rowS.label}>{label}</Text>
    <Text style={[rowS.value, accent && rowS.valueAccent]} numberOfLines={2}>{value}</Text>
  </View>
);

const rowS = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.dark.border,
  },
  label: {
    flex: 1.1,
    color: Colors.dark.textSecondary,
    fontSize: 13.5,
    fontFamily: 'Rubik',
  },
  value: {
    flex: 2,
    color: Colors.dark.text,
    fontSize: 13.5,
    fontFamily: 'Rubik',
    textAlign: 'right',
  },
  valueAccent: {
    color: Colors.dark.accentLight,
  },
});

// ── Status messages during extraction ──────────────────────────────
const EXTRACT_STATUSES = [
  'Connecting to server…',
  'Fetching page…',
  'Extracting stream URL…',
  'Almost there…',
];

export const DetailsScreen: React.FC = () => {
  const route      = useRoute<any>();
  const navigation = useNavigation<any>();
  const {t, i18n} = useTranslation();
  const insets     = useSafeAreaInsets();

  const item: ContentItem = route.params?.item;

  const [extracting,    setExtracting]    = useState(false);
  const [statusIdx,     setStatusIdx]     = useState(0);
  const [extractError,  setExtractError]  = useState<string | null>(null);
  const [qualityChoice, setQualityChoice] = useState<string | null>(null);

  const lang = i18n.language === 'ar' ? 'ar' : 'en';

  if (!item) {
    return (
      <View style={S.container}>
        <TouchableOpacity style={[S.navBtn, {margin: 20, marginTop: insets.top + 20}]} onPress={() => navigation.goBack()}>
          <Image source={require('../../assets/icons/arrow.png')} style={S.iconNav} />
        </TouchableOpacity>
        <Text style={{color: Colors.dark.textMuted, textAlign: 'center', fontFamily: 'Rubik'}}>{t('error_loading')}</Text>
      </View>
    );
  }

  // ── Resolve source URL ──────────────────────────────────────────
  const sourceUrl: string = useMemo(() => {
    const s = (item as any).Source || (item as any).source || '';
    return Array.isArray(s) ? (s[0] ?? '') : s;
  }, [item]);

  // ── Helpers ─────────────────────────────────────────────────────
  const genresDisplay = useMemo(() => {
    const list = lang === 'ar'
      ? (item.GenresAr?.length ? item.GenresAr : item.Genres)
      : (item.Genres?.length   ? item.Genres   : item.GenresAr);
    return (list || []).join(' • ');
  }, [item.Genres, item.GenresAr, lang]);

  const directors = useMemo(() => {
    const d = (item as any).Directors || (item as any).directors || [];
    return (Array.isArray(d) ? d : [d]).filter(Boolean).join('  ');
  }, [item]);

  const description = lang === 'ar'
    ? (item.DescriptionAr || item.Description || '')
    : (item.Description   || item.DescriptionAr   || '');

  const formatRuntime = (min: number | null) => {
    if (!min) return '';
    const h = Math.floor(min / 60), m = min % 60;
    return h > 0 ? (m > 0 ? `${h}h ${m}min` : `${h}h`) : `${m}min`;
  };

  const rating     = (item as any).Rating     || '';
  const views      = (item as any).Views      || '';
  const year       = (item as any).Year       || '';
  const country    = item.Country             || '';
  const language   = (item as any).Language   || '';
  const format     = item.Format              || '';
  const numEps     = (item as any)['Number Of Episodes'] ?? null;
  const runtime    = formatRuntime(item.Runtime);

  // ── Play handler ─────────────────────────────────────────────────
  // NO hasSource gate — the server handles extraction
  const handlePlay = useCallback(async () => {
    setExtracting(true);
    setExtractError(null);
    setStatusIdx(0);

    // Rotate status message every ~4 s to show progress
    const rotateTimer = setInterval(() => {
      setStatusIdx(prev => (prev + 1) % EXTRACT_STATUSES.length);
    }, 4000);

    try {
      const result = await extractVideoUrl(sourceUrl || item.id);

      clearInterval(rotateTimer);
      setExtracting(false);

      // Record play for view tracking (fire-and-forget)
      recordPlay(item.id, item.Category || 'movies');

      navigation.navigate('Player', {
        url:       result.video_url,
        qualities: result.quality_options,
        title:     item.Title,
        contentId: item.id,
        category:  item.Category || 'movies',
      });
    } catch (err: any) {
      clearInterval(rotateTimer);
      setExtractError(err.message || t('server_error'));
      setExtracting(false);
    }
  }, [sourceUrl, item, navigation, t]);

  const handleShare = () =>
    Share.share({message: `${item.Title} — AbdoBest`, url: sourceUrl || ''});

  // ── Render ───────────────────────────────────────────────────────
  return (
    <View style={S.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.dark.background} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[S.scroll, {paddingBottom: insets.bottom + 60}]}
      >
        {/* Nav row */}
        <View style={[S.topNav, {paddingTop: insets.top + 10}]}>
          <TouchableOpacity style={S.navBtn} onPress={() => navigation.goBack()}>
            <Image source={require('../../assets/icons/arrow.png')} style={S.iconNav} />
          </TouchableOpacity>
          <TouchableOpacity style={S.navBtn} onPress={handleShare}>
            <Image source={require('../../assets/icons/share.png')} style={S.iconNav} />
          </TouchableOpacity>
        </View>

        {/* Full title (can include original/extra info) */}
        <Text style={S.title} numberOfLines={4}>{item.Title}</Text>

        {/* Poster */}
        <View style={S.posterWrap}>
          {item['Image Source'] ? (
            <FastImage
              source={{uri: item['Image Source']}}
              style={S.poster}
              resizeMode={FastImage.resizeMode.cover}
              fallback
            />
          ) : (
            <View style={[S.poster, S.posterPlaceholder]}>
              <Image source={require('../../assets/icons/clapboard.png')} style={{width: 52, height: 52, tintColor: Colors.dark.textMuted}} />
            </View>
          )}
          {format ? (
            <View style={S.formatChip}>
              <Text style={S.formatChipText}>{format}</Text>
            </View>
          ) : null}
        </View>

        {/* Rating + Views pills */}
        {(rating || views) ? (
          <View style={S.metaRow}>
            {rating ? (
              <View style={S.pill}>
                <Image source={require('../../assets/icons/star.png')} style={S.iconPill} />
                <Text style={S.pillRating}>{rating}</Text>
                <Text style={S.pillSub}>{t('of_10') || '/ 10'}</Text>
              </View>
            ) : null}
            {views ? (
              <View style={S.pill}>
                <Image source={require('../../assets/icons/eyes.png')} style={S.iconPill} />
                <Text style={S.pillViews}>{views}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Action buttons */}
        <View style={S.actions}>
          {/* PLAY — always enabled */}
          <TouchableOpacity
            style={S.playBtn}
            onPress={handlePlay}
            disabled={extracting}
            activeOpacity={0.82}
          >
            {extracting ? (
              <>
                <ActivityIndicator color="#fff" size="small" style={{marginRight: 8}} />
                <Text style={S.playBtnText} numberOfLines={1}>
                  {EXTRACT_STATUSES[statusIdx]}
                </Text>
              </>
            ) : (
              <>
                <Text style={S.playIcon}>▶</Text>
                <Text style={S.playBtnText}>{t('play')}</Text>
              </>
            )}
          </TouchableOpacity>

          {/* DOWNLOAD */}
          <TouchableOpacity
            style={S.dlBtn}
            disabled={extracting}
            onPress={() => {/* TODO */}}
            activeOpacity={0.82}
          >
            <Image
              source={require('../../assets/icons/files.png')}
              style={[S.iconMed, {tintColor: Colors.dark.accentLight}]}
            />
            <Text style={S.dlBtnText}>{t('download')}</Text>
          </TouchableOpacity>
        </View>

        {/* Extraction error */}
        {extractError ? (
          <View style={S.errorBanner}>
            <Text style={S.errorText} numberOfLines={3}>{extractError}</Text>
            <TouchableOpacity style={S.retryBtn} onPress={handlePlay}>
              <Image source={require('../../assets/icons/undoreturn.png')} style={{width: 14, height: 14, tintColor: Colors.dark.primary}} />
              <Text style={S.retryText}>{t('retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Description */}
        {description ? (
          <View style={S.descBox}>
            <Text style={S.descText}>{description}</Text>
          </View>
        ) : null}

        {/* ── Info table (matches screenshot) ── */}
        <View style={S.infoTable}>
          {year        ? <InfoRow label={t('year')        || 'سنة الإنتاج'} value={year}        accent /> : null}
          {item.Category ? <InfoRow label={t('category')   || 'القسم'}       value={item.Category} accent /> : null}
          {genresDisplay ? <InfoRow label={t('genres')}                       value={genresDisplay} accent /> : null}
          {language    ? <InfoRow label={t('language')    || 'اللغة'}        value={language}              /> : null}
          {format      ? <InfoRow label={t('quality')}                       value={format}                /> : null}
          {country     ? <InfoRow label={t('country')}                       value={country}       accent /> : null}
          {directors   ? <InfoRow label={t('directors')   || 'المخرجين'}     value={directors}     accent /> : null}
          {numEps      ? <InfoRow label={t('episodes')}                      value={String(numEps)}        /> : null}
          {runtime     ? <InfoRow label={t('duration')}                      value={runtime}               /> : null}
          {/* Rating row — custom with star icon */}
          {rating ? (
            <View style={rowS.row}>
              <Text style={rowS.label}>{t('rating') || 'التقييم'}</Text>
              <View style={{flex: 2, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 6}}>
                <Text style={rowS.value}>{rating} {t('of_10') || 'من 10'}</Text>
                <Image source={require('../../assets/icons/star.png')} style={{width: 16, height: 16, tintColor: '#FFD700'}} />
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
};

// ── Styles ───────────────────────────────────────────────────────────
const S = StyleSheet.create({
  container:  {flex: 1, backgroundColor: Colors.dark.background},
  scroll:     {paddingTop: 0},
  topNav:     {flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12},
  navBtn:     {width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.dark.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.dark.border},
  iconNav:    {width: 20, height: 20, tintColor: Colors.dark.text},
  iconPill:   {width: 13, height: 13, tintColor: Colors.dark.text},
  iconMed:    {width: 20, height: 20},
  title: {
    color: Colors.dark.text,
    fontSize: 21,
    fontWeight: '800',
    textAlign: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
    fontFamily: 'Rubik',
    lineHeight: 29,
  },
  posterWrap: {alignSelf: 'center', marginBottom: 16, position: 'relative'},
  poster: {
    width: POSTER_W,
    height: POSTER_H,
    borderRadius: 16,
    backgroundColor: Colors.dark.surfaceLight,
    elevation: 14,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.55,
    shadowRadius: 16,
  },
  posterPlaceholder: {justifyContent: 'center', alignItems: 'center'},
  formatChip: {
    position: 'absolute',
    bottom: 10, right: 10,
    backgroundColor: 'rgba(0,0,0,0.87)',
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  formatChipText: {color: '#FFFFFF', fontSize: 11, fontWeight: '700', fontFamily: 'Rubik'},
  metaRow: {
    flexDirection: 'row', justifyContent: 'center',
    gap: 10, marginBottom: 18, paddingHorizontal: 20,
  },
  pill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 22, gap: 5,
    borderWidth: 1, borderColor: Colors.dark.border,
  },
  pillRating: {color: '#FFD700', fontSize: 13, fontWeight: '700', fontFamily: 'Rubik'},
  pillSub:    {color: Colors.dark.textMuted, fontSize: 11, fontFamily: 'Rubik'},
  pillViews:  {color: Colors.dark.textSecondary, fontSize: 13, fontWeight: '600', fontFamily: 'Rubik'},
  actions:    {flexDirection: 'row', paddingHorizontal: 18, marginBottom: 12, gap: 12},
  playBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 54, borderRadius: 16,
    backgroundColor: Colors.dark.primary,
    gap: 8, elevation: 8,
    shadowColor: Colors.dark.primary,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.5, shadowRadius: 10,
  },
  playIcon:    {color: '#fff', fontSize: 15},
  playBtnText: {color: '#fff', fontSize: 15, fontWeight: '700', fontFamily: 'Rubik', flexShrink: 1},
  dlBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 54, borderRadius: 16,
    backgroundColor: Colors.dark.surface,
    gap: 8, borderWidth: 1.5,
    borderColor: Colors.dark.accentLight,
  },
  dlBtnText: {color: Colors.dark.accentLight, fontSize: 15, fontWeight: '700', fontFamily: 'Rubik'},
  errorBanner: {
    marginHorizontal: 18, marginBottom: 12,
    backgroundColor: `${Colors.dark.error}16`,
    borderRadius: 12, padding: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: `${Colors.dark.error}30`,
    gap: 10,
  },
  errorText:  {flex: 1, color: Colors.dark.error, fontSize: 13, fontFamily: 'Rubik'},
  retryBtn:   {flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9, backgroundColor: `${Colors.dark.primary}22`},
  retryText:  {color: Colors.dark.primary, fontSize: 13, fontWeight: '700', fontFamily: 'Rubik'},
  descBox:    {marginHorizontal: 16, marginBottom: 14, backgroundColor: Colors.dark.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.dark.border},
  descText:   {color: Colors.dark.textSecondary, fontSize: 14, lineHeight: 22, fontFamily: 'Rubik'},
  infoTable:  {marginHorizontal: 16, backgroundColor: Colors.dark.surface, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: Colors.dark.border, marginBottom: 24},
});
