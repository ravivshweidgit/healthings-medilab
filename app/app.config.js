/** @type {import('expo/config').ExpoConfig} */
const appJson = require('./app.json');

/** True when generating the iOS native project (EAS or `expo prebuild --platform ios`). */
function isIosNativeBuild() {
  if (process.env.EAS_BUILD_PLATFORM === 'ios') return true;
  const platformIdx = process.argv.indexOf('--platform');
  if (platformIdx >= 0 && process.argv[platformIdx + 1] === 'ios') return true;
  return false;
}

function pluginsForPlatform() {
  const base = appJson.expo.plugins ?? [];
  if (isIosNativeBuild()) {
    return base.filter((entry) => {
      const name = typeof entry === 'string' ? entry : entry[0];
      return name !== 'react-native-health-connect';
    });
  }
  return base;
}

module.exports = {
  expo: {
    ...appJson.expo,
    version: '1.2.2',
    plugins: pluginsForPlatform(),
    ios: {
      ...appJson.expo.ios,
      buildNumber: '19',
      infoPlist: {
        CFBundleURLTypes: [
          {
            CFBundleURLSchemes: ['healthings-medilab'],
          },
        ],
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      ...appJson.expo.android,
      versionCode: 19,
    },
    extra: {
      eas: {
        projectId: '656a032f-cd57-470c-8caa-5d99a06bc34c',
      },
    },
  },
};
