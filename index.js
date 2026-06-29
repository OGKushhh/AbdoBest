import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import {registerBackgroundHandler} from './src/services/fcmService';

// Must be called before AppRegistry — handles FCM messages when app is closed
registerBackgroundHandler();

AppRegistry.registerComponent(appName, () => App);
