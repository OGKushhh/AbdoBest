import {useState, useEffect} from 'react';
import {AppState, AppStateStatus} from 'react-native';

export const useAppState = () => {
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      setAppState(nextAppState);
    });
    return () => subscription.remove();
  }, []);

  return appState;
};
