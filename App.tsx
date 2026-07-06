import React, {useEffect, useRef, useState} from 'react';
import {AppState, AppStateStatus, StatusBar, LogBox, View} from 'react-native';
import {SafeAreaProvider, initialWindowMetrics} from 'react-native-safe-area-context';
import {AppNavigator} from './src/navigation/AppNavigator';
import {UpdateModal} from './src/components/UpdateModal';
import {checkForUpdate, skipVersion, openUpdateUrl, ReleaseInfo} from './src/services/updateService';
import {restoreDownloads} from './src/services/downloadService';
import {wakeServer} from './src/services/metadataService';
import {retrySyncViews} from './src/services/viewService';
import {APP_VERSION} from './src/constants/endpoints';
import {storage} from './src/storage/Storage';
import {Colors} from './src/theme/colors';
import {ThemeProvider} from './src/hooks/useTheme';
import {AdProvider} from './src/ads/AdContext';
import {initCounters, recordLaunchAndCheckReward} from './src/ads/adManager';
import RewardAdPopup from './src/ads/RewardAdPopup';
import {CacheSyncOverlay, useCacheSync} from './src/components/CacheSyncOverlay';
import './src/i18n';
import {initAuth, onAuthStateChanged} from './src/services/authService';
import {fetchCollections} from './src/services/favoritesService';
import {initFCM, setupForegroundHandler, setupNotificationOpenedHandler} from './src/services/fcmService';

LogBox.ignoreLogs([
  'ViewPropTypes will be removed',
  'NativeWind',
  'Non-serializable values were found in the navigation state',
  'VirtualizedLists should never be nested',
]);

const App: React.FC = () => {
  const [ready, setReady] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<ReleaseInfo | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showRewardPopup, setShowRewardPopup] = useState(false);
  const { running: syncRunning, progress: syncProgress, start: startSync } = useCacheSync();
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const unsubForegroundRef = useRef<(() => void) | null>(null);

  // Retry any queued view counts when app comes to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        retrySyncViews().catch(() => {});
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    // Wake the HF Spaces server immediately — before storage.init() — so the
    // container boot time overlaps with local init work rather than adding to it.
    wakeServer();
    let timer: ReturnType<typeof setTimeout> | undefined;
    storage.init().then(() => {
      initCounters();
      const shouldShowReward = recordLaunchAndCheckReward();
      setReady(true);
      // Auth + FCM init
      initAuth();
      // Register FCM token immediately for all users (even before sign-in)
      initFCM().catch(() => {});
      const unsubAuth = onAuthStateChanged(user => {
        if (user) {
          fetchCollections().catch(() => {});
          // Re-register after sign-in to also link token to user account
          initFCM().catch(() => {});
        }
      });
      setupNotificationOpenedHandler(data => {
        // data.content_id + data.category — navigation handled after navigator mounts
        console.log('[FCM] Notification tapped:', data);
      });
      // Foreground pushes: content sync happens inside setupForegroundHandler itself;
      // this callback is just for an optional in-app banner later.
      unsubForegroundRef.current = setupForegroundHandler((title, body, data) => {
        console.log('[FCM] Foreground notification:', title, body, data);
      });
      restoreDownloads().catch(() => {});
      retrySyncViews().catch(() => {});
      // Start cache sync immediately — overlay shows automatically.
      // The reward popup is chained onto its completion (not a blind timer)
      // so it never interrupts the initial category fetch / home screen load.
      startSync(false).then(() => {
        if (shouldShowReward) {
          setTimeout(() => setShowRewardPopup(true), 800);
        }
      });
      timer = setTimeout(async () => {
        const update = await checkForUpdate();
        if (update) {
          setUpdateInfo(update);
          setTimeout(() => setShowUpdateModal(true), 500);
        }
      }, 3000);
    });
    // Cleanup is returned directly to React so it fires on unmount
    return () => {
      clearTimeout(timer);
      unsubForegroundRef.current?.();
    };
  }, []);

  if (!ready) {
    return (
      <View style={{flex: 1, backgroundColor: Colors.dark.background}} />
    );
  }

  return (
    <ThemeProvider>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <AdProvider>
          <StatusBar
            barStyle="light-content"
            backgroundColor={Colors.dark.background}
            translucent={false}
          />
          <AppNavigator />
          <UpdateModal
            visible={showUpdateModal}
            release={updateInfo}
            currentVersion={APP_VERSION}
            onDownload={(url: string) => { setShowUpdateModal(false); openUpdateUrl(url); }}
            onSkip={(version: string) => { skipVersion(version); setShowUpdateModal(false); }}
            onDismiss={() => setShowUpdateModal(false)}
          />
          <RewardAdPopup
            visible={showRewardPopup}
            onClose={() => setShowRewardPopup(false)}
          />
          {/* Cache sync overlay — shown on launch while downloading database */}
          <CacheSyncOverlay visible={syncRunning} progress={syncProgress} />
        </AdProvider>
      </SafeAreaProvider>
    </ThemeProvider>
  );
};

export default App;
