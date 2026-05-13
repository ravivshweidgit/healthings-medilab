import { registerRootComponent } from 'expo';

import { WITHINGS_CALLBACK_URL } from './src/config/env';
import App from './App';

if (__DEV__) {
  console.warn(
    '\n[Withings] redirect_uri / openAuthSessionAsync redirect (must match Withings portal & .env WITHINGS_CALLBACK_URL):\n' +
      WITHINGS_CALLBACK_URL +
      '\n',
  );
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
