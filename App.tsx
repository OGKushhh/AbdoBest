import React, {useEffect, useState} from 'react';
import {StatusBar, LogBox} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {AppNavigator} from './src/navigation/AppNavigator';
import {UpdateModal} from './src/components/UpdateModal';
import {checkForUpdate, skipVersion, openUpdateUrl, ReleaseInfo} from './src/services/updateService';
import {APP_VERSION} from './src/constants/endpoints';
import './src/i18n';

LogBox.ignoreLogs([
  'ViewPropTypes will be removed',
  'NativeWind',
  'Non-serializable values were found in the navigation state',
]);

const App: React.FC = () => {
  const [updateInfo, setUpdateInfo] = useState<ReleaseInfo | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  useEffect(() => {
    // Check for updates after 3 seconds (don't block app launch)
    const timer = setTimeout(async () => {
      const update = await checkForUpdate();
      if (update) {
        setUpdateInfo(update);
        // Small delay before showing modal for smooth UX
        setTimeout(() => setShowUpdateModal(true), 500);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const handleDownloadUpdate = (url: string) => {
    setShowUpdateModal(false);
    openUpdateUrl(url);
  };

  const handleSkipVersion = (version: string) => {
    skipVersion(version);
    setShowUpdateModal(false);
  };

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <AppNavigator />
      <UpdateModal
        visible={showUpdateModal}
        release={updateInfo}
        currentVersion={APP_VERSION}
        onDownload={handleDownloadUpdate}
        onSkip={handleSkipVersion}
        onDismiss={() => setShowUpdateModal(false)}
      />
    </SafeAreaProvider>
  );
};

export default App;
