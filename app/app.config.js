/** @type {import('expo/config').ExpoConfig} */
const appJson = require('./app.json');

/** True when generating the iOS native project (EAS or `expo prebuild --platform ios`). */
function isIosNativeBuild() {
  if (process.env.EAS_BUILD_PLATFORM === 'ios') return true;
  const platformIdx = process.argv.indexOf('--platform');
  if (platformIdx >= 0 && process.argv[platformIdx + 1] === 'ios') return true;
  return false;
}

const HEALTHKIT_PLUGIN = [
  '@kingstinct/react-native-healthkit',
  {
    NSHealthShareUsageDescription:
      'Healthings reads blood glucose from Apple Health so CareSens Air and other CGM apps can power your chart and coach.',
    // Apple requires this key if any linked HealthKit API can write (ITMS-90683), even when we only read.
    NSHealthUpdateUsageDescription:
      'Healthings only reads blood glucose from Apple Health. It does not save or change your health records.',
    background: false,
  },
];

function pluginsForPlatform() {
  const base = [...(appJson.expo.plugins ?? [])];
  if (isIosNativeBuild()) {
    const withoutHc = base.filter((entry) => {
      const name = typeof entry === 'string' ? entry : entry[0];
      return name !== 'react-native-health-connect';
    });
    return [...withoutHc, HEALTHKIT_PLUGIN];
  }
  return base.filter((entry) => {
    const name = typeof entry === 'string' ? entry : entry[0];
    return name !== '@kingstinct/react-native-healthkit';
  });
}

module.exports = {
  expo: {
    ...appJson.expo,
    version: '1.2.35',
    plugins: pluginsForPlatform(),
    ios: {
      ...appJson.expo.ios,
      buildNumber: '66',
      infoPlist: {
        CFBundleURLTypes: [
          {
            CFBundleURLSchemes: ['healthings-medilab'],
          },
        ],
        ITSAppUsesNonExemptEncryption: false,
        NSHealthUpdateUsageDescription:
          'Healthings only reads blood glucose from Apple Health. It does not save or change your health records.',
      },
    },
    android: {
      ...appJson.expo.android,
      versionCode: 64,
      /**
       * expo-dev-client pulls in SYSTEM_ALERT_WINDOW for its dev-menu overlay, and the
       * plugin ships in every build. Nothing in the app draws over other apps, and Play
       * treats it as sensitive — so keep it out of release. The debug and debugOptimized
       * source sets declare it themselves, so the dev client is unaffected.
       *
       * This entry only takes effect when the native project is regenerated; the
       * committed main/AndroidManifest.xml is what the current build reads. Both are
       * needed so `expo prebuild` cannot silently put it back.
       */
      blockedPermissions: ['android.permission.SYSTEM_ALERT_WINDOW'],
    },
    extra: {
      eas: {
        projectId: '656a032f-cd57-470c-8caa-5d99a06bc34c',
      },
    },
  },
};
