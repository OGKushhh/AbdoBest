import React, {useState, useRef, useEffect, useCallback, useMemo} from 'react';
import {
  View, StyleSheet, Dimensions, TouchableOpacity, Text,
  ActivityIndicator, StatusBar, Modal, Image, Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import Video from 'react-native-video';
import {useRoute, useNavigation} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Colors} from '../theme/colors';
import {useTranslation} from 'react-i18next';
import {recordPlay} from '../services/viewService';

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');

const HLS_QUALITIES = [
  {label: 'Auto',  bitrate: 0},
  {label: '1080p', bitrate: 8000000},
  {label: '720p',  bitrate: 3000000},
  {label: '480p',  bitrate: 1500000},
  {label: '360p',  bitrate: 800000},
];

export const PlayerScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const {url, title, contentId, category, qualities: paramQualities} = route.params || {};
  const {t} = useTranslation();
  const insets = useSafeAreaInsets();

  const videoRef: any = useRef(null);
  const [playing, setPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffering, setBuffering] = useState(true);
  const [loading, setLoading] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const qualityList = useMemo(() => {
    if (paramQualities && paramQualities.length > 0) {
      return paramQualities.map((label: string) => {
        const match = HLS_QUALITIES.find(q => q.label === label);
        return match || {label, bitrate: 0};
      });
    }
    return HLS_QUALITIES;
  }, [paramQualities]);

  const [selectedQuality, setSelectedQuality] = useState(qualityList[0] || HLS_QUALITIES[0]);
  const [showQualityPicker, setShowQualityPicker] = useState(false);
  const hideTimer = useRef<any>(null);
  const viewTracked = useRef(false);

  // Build source — NO type prop!
  // react-native-video v5 uses type:'m3u8', v6 uses type:'hls'.
  // Omitting type entirely lets the library auto-detect (works for BOTH versions).
  // CRITICAL: The CDN (scdns.io) requires Referer + Origin headers or it returns 403.
  const videoSource = useMemo(() => {
    if (!url) return undefined;
    return {
      uri: url,
      headers: {
        'Referer': 'https://www.fasel-hd.cam/',
        'Origin': 'https://www.fasel-hd.cam',
      },
    };
  }, [url]);

  // Track view
  useEffect(() => {
    if (contentId && category && !viewTracked.current) {
      viewTracked.current = true;
      recordPlay(contentId, category);
    }
  }, [contentId, category]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  const triggerHideControls = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 4000);
  }, []);

  const toggleControls = useCallback(() => {
    setShowControls(prev => {
      if (!prev) triggerHideControls();
      return !prev;
    });
  }, [triggerHideControls]);

  const handleProgress = useCallback((data: any) => {
    if (data?.currentTime !== undefined) setCurrentTime(data.currentTime);
  }, []);

  const handleLoadStart = useCallback(() => {
    console.log('[Player] Load started for:', url?.substring(0, 100));
    setLoading(true);
    setBuffering(true);
  }, [url]);

  const handleLoad = useCallback((meta: any) => {
    console.log('[Player] Video loaded, duration:', meta?.duration);
    if (meta?.duration !== undefined) setDuration(meta.duration);
    setLoading(false);
    setBuffering(false);
    triggerHideControls();
  }, [triggerHideControls]);

  // onReadyForDisplay: v6-only callback (silently ignored in v5.2.1).
  // Kept for forward-compatibility — will fire when upgrading to v6.
  const handleReadyForDisplay = useCallback(() => {
    console.log('[Player] Video surface ready for display');
  }, []);

  const handleBuffer = useCallback((data: any) => {
    const isBuf = data?.isBuffering ?? data?.buffering ?? false;
    setBuffering(isBuf);
  }, []);

  const handleEnd = useCallback(() => {
    setPlaying(false);
    setShowControls(true);
  }, []);

  const handleError = useCallback((err: any) => {
    // ExoPlayer (Android) error structures vary across react-native-video versions.
    // Must check multiple paths to avoid showing "[object Object]".
    let errStr = '';
    const e = err?.error ?? err;
    if (typeof e === 'string') {
      errStr = e;
    } else if (e?.errorString) {
      errStr = e.errorString;
    } else if (e?.message) {
      errStr = e.message;
    } else if (e?.localizedFailureReason) {
      errStr = e.localizedFailureReason;
    } else if (e?.code) {
      errStr = `Error code: ${e.code}`;
    } else {
      try { errStr = JSON.stringify(e); } catch { errStr = 'Unknown playback error'; }
    }
    console.error('[Player] Video error:', errStr, '| raw:', JSON.stringify(err)?.substring(0, 300));
    setErrorMsg(errStr);
    setError(t('video_unavailable'));
    setBuffering(false);
    setLoading(false);
  }, [t]);

  const handleRetry = useCallback(() => {
    setError(null);
    setErrorMsg('');
    setBuffering(true);
    setLoading(true);
    setPlaying(false);
    setTimeout(() => setPlaying(true), 100);
  }, []);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? currentTime / duration : 0;

  const handleSeekBarPress = (e: any) => {
    const {locationX} = e.nativeEvent;
    const seekWidth = SCREEN_WIDTH - 32;
    const seekTime = (locationX / seekWidth) * duration;
    const clamped = Math.max(0, Math.min(seekTime, duration));
    videoRef.current?.seek(clamped);
    setCurrentTime(clamped);
  };

  const handleQualitySelect = (q: any) => {
    setSelectedQuality(q);
    setShowQualityPicker(false);
    triggerHideControls();
  };

  // ── Error / No URL states ──
  if (!url) {
    return (
      <View style={styles.errorContainer}>
        <StatusBar hidden />
        <Image source={require('../../assets/icons/nlp.png')} style={{width: 56, height: 56, tintColor: Colors.dark.error}} />
        <Text style={styles.errorText}>{t('video_unavailable')}</Text>
        <Text style={styles.errorSub}>No URL provided</Text>
        <TouchableOpacity style={styles.errorButton} onPress={() => navigation.goBack()}>
          <Text style={styles.errorButtonText}>{t('retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <StatusBar hidden />
        <Image source={require('../../assets/icons/nlp.png')} style={{width: 56, height: 56, tintColor: Colors.dark.error}} />
        <Text style={styles.errorText}>{error === 'timeout' ? 'Playback Timeout' : error}</Text>
        {errorMsg ? <Text style={styles.errorSub} numberOfLines={5}>{errorMsg}</Text> : null}
        <View style={styles.errorActions}>
          <TouchableOpacity style={styles.errorButton} onPress={handleRetry}>
            <Text style={styles.errorButtonText}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.errorButton, {backgroundColor: Colors.dark.surface, borderWidth: 1, borderColor: Colors.dark.border}]} onPress={() => navigation.goBack()}>
            <Text style={[styles.errorButtonText, {color: Colors.dark.text}]}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Main player ──
  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* TouchableWithoutFeedback wraps ONLY the video — no visual overlay.
          The gesture responder system prevents double-firing with control buttons above. */}
      <TouchableWithoutFeedback onPress={toggleControls} style={StyleSheet.absoluteFill}>
        <View style={styles.videoContainer}>
          <Video
            ref={videoRef}
            source={videoSource}
            resizeMode="contain"
            onProgress={handleProgress}
            onLoadStart={handleLoadStart}
            onLoad={handleLoad}
            // onReadyForDisplay: v6-only, safely ignored in v5.2.1
            {...(Platform.OS === 'ios' ? {onReadyForDisplay: handleReadyForDisplay} : {})}
            onBuffer={handleBuffer}
            onEnd={handleEnd}
            onError={handleError}
            playInBackground={false}
            playWhenInactive={false}
            paused={!playing}
            style={styles.video}
            repeat={false}
            controls={false}
            bufferConfig={
              Platform.OS === 'android'
                ? {
                    minBufferMs: 15000,
                    maxBufferMs: 50000,
                    bufferForPlaybackMs: 2500,
                    bufferForPlaybackAfterRebufferMs: 5000,
                  }
                : undefined
            }
          />
        </View>
      </TouchableWithoutFeedback>

      {/* Buffering — rendered OUTSIDE the touchable so it doesn't interfere */}
      {(buffering || loading) && (
        <View style={styles.bufferingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={Colors.dark.primary} />
          <Text style={styles.bufferingText}>{loading ? 'Connecting...' : 'Buffering...'}</Text>
        </View>
      )}

      {/* Controls overlay — pointerEvents="box-none" lets taps on empty areas
          fall through to the TouchableWithoutFeedback below for toggle. */}
      {showControls && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {/* Top bar */}
          <View style={[styles.topControls, {paddingTop: insets.top + 4}]}>
            <TouchableOpacity style={styles.topButton} onPress={() => navigation.goBack()}>
              <Image source={require('../../assets/icons/arrow.png')} style={{width: 26, height: 26, tintColor: '#fff'}} />
            </TouchableOpacity>
            <Text style={styles.titleText} numberOfLines={1}>{title}</Text>
            <TouchableOpacity
              style={styles.qualityButton}
              onPress={() => {
                setShowQualityPicker(true);
                if (hideTimer.current) clearTimeout(hideTimer.current);
              }}
            >
              <Text style={styles.qualityButtonText}>{selectedQuality.label}</Text>
              <Image source={require('../../assets/icons/arrow.png')} style={{width: 14, height: 14, tintColor: '#00E5FF', transform: [{rotate: '90deg'}]}} />
            </TouchableOpacity>
          </View>

          {/* Bottom controls */}
          <View style={[styles.bottomControls, {paddingBottom: insets.bottom + 16}]}>
            <TouchableOpacity
              style={styles.seekBarContainer}
              onPress={handleSeekBarPress}
              activeOpacity={0.9}
            >
              <View style={styles.seekBarTrack}>
                <View style={[styles.seekBarProgress, {width: `${progress * 100}%`}]}>
                  <View style={styles.seekBarThumb} />
                </View>
              </View>
            </TouchableOpacity>

            <View style={styles.timeRow}>
              <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
              <Text style={styles.timeText}>{formatTime(duration)}</Text>
            </View>

            <View style={styles.playbackRow}>
              <TouchableOpacity
                style={styles.skipButton}
                onPress={() => videoRef.current?.seek(Math.max(currentTime - 10, 0))}
              >
                <Image source={require('../../assets/icons/arrow.png')} style={{width: 24, height: 24, tintColor: '#fff', transform: [{scaleX: -1}]}} />
                <Text style={styles.skipLabel}>10</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.playPauseButton}
                onPress={() => { setPlaying(!playing); triggerHideControls(); }}
              >
                <Text style={{color: '#fff', fontSize: 30, textAlign: 'center', lineHeight: 34}}>
                  {playing ? '\u275A\u275A' : '\u25B6'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.skipButton}
                onPress={() => videoRef.current?.seek(Math.min(currentTime + 10, duration))}
              >
                <Image source={require('../../assets/icons/arrow.png')} style={{width: 24, height: 24, tintColor: '#fff'}} />
                <Text style={styles.skipLabel}>10</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Quality Picker Modal */}
      <Modal
        visible={showQualityPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowQualityPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowQualityPicker(false)}
        >
          <View style={styles.qualityModal}>
            <Text style={styles.qualityModalTitle}>{t('select_quality')}</Text>
            {qualityList.map((q: any) => (
              <TouchableOpacity
                key={q.label}
                style={[
                  styles.qualityOption,
                  selectedQuality.label === q.label && styles.qualityOptionActive,
                ]}
                onPress={() => handleQualitySelect(q)}
              >
                <Text
                  style={[
                    styles.qualityOptionText,
                    selectedQuality.label === q.label && styles.qualityOptionTextActive,
                  ]}
                >
                  {q.label}
                </Text>
                {selectedQuality.label === q.label && (
                  <Text style={{color: Colors.dark.primary, fontSize: 16, fontWeight: '700'}}>{'\u2713'}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  videoContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
  },
  video: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#000',
  },
  bufferingOverlay: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  bufferingText: {
    color: 'rgba(255,255,255,0.8)',
    marginTop: 10,
    fontSize: 14,
    fontFamily: 'Rubik',
  },
  topControls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  topButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleText: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginHorizontal: 8,
    fontFamily: 'Rubik',
  },
  qualityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00E5FF50',
    gap: 4,
  },
  qualityButtonText: {
    color: '#00E5FF',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Rubik',
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  seekBarContainer: {
    width: '100%',
    height: 28,
    justifyContent: 'center',
    marginBottom: 2,
  },
  seekBarTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  seekBarProgress: {
    height: '100%',
    backgroundColor: Colors.dark.primary,
    borderRadius: 2,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  seekBarThumb: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#fff',
    marginRight: -7,
    shadowColor: Colors.dark.primary,
    shadowRadius: 4,
    shadowOpacity: 0.8,
    elevation: 4,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  timeText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontFamily: 'Rubik',
  },
  playbackRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 28,
  },
  skipButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipLabel: {
    color: '#fff',
    fontSize: 10,
    marginTop: -2,
    fontFamily: 'Rubik',
  },
  playPauseButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(229,9,20,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.dark.primary,
    shadowRadius: 8,
    shadowOpacity: 0.6,
    elevation: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qualityModal: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 20,
    width: 240,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  qualityModalTitle: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Rubik',
    marginBottom: 14,
    textAlign: 'center',
  },
  qualityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 4,
  },
  qualityOptionActive: {
    backgroundColor: `${Colors.dark.primary}20`,
    borderWidth: 1,
    borderColor: `${Colors.dark.primary}60`,
  },
  qualityOptionText: {
    color: Colors.dark.textSecondary,
    fontSize: 15,
    fontFamily: 'Rubik',
  },
  qualityOptionTextActive: {
    color: Colors.dark.primary,
    fontWeight: '700',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 32,
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
    fontFamily: 'Rubik',
  },
  errorSub: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    fontFamily: 'Rubik',
    marginHorizontal: 20,
  },
  errorActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 22,
  },
  errorButton: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    backgroundColor: Colors.dark.primary,
    borderRadius: 10,
  },
  errorButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'Rubik',
  },
});
