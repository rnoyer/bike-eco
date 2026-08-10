const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const GLOBAL_NAME = '$RNFirebaseDisableSPM';

/**
 * react-native-firebase 26 resolves firebase-ios-sdk through Swift Package Manager.
 * That package only ships dynamic products, so `pod install` hard-fails under
 * CocoaPods' default static linkage ("SPM + static linkage is not supported").
 *
 * Switching the whole app to `useFrameworks: "dynamic"` is not a viable escape:
 * expo-build-properties writes `ios.useFrameworks` into Podfile.properties.json, but
 * React Native's podspecs gate their framework header layout on the `USE_FRAMEWORKS`
 * *environment variable* (see React/React-RCTFabric.podspec), which stays unset. The
 * pods then build as frameworks while headers keep the static layout, and imports of
 * `<React/RCTSurfaceTouchHandler.h>` from react-native-screens, react-native-gesture-handler
 * and @expo/ui stop resolving.
 *
 * So keep the standard static pod setup and opt Firebase out of SPM instead — it falls
 * back to CocoaPods, which works with static linkage. The `modular_headers` entries for
 * GoogleUtilities and RecaptchaInterop in app.json are what that path needs.
 */
const withRNFirebaseDisableSPM = (config) =>
  withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      const podfile = fs.readFileSync(podfilePath, 'utf8');

      if (podfile.includes(GLOBAL_NAME)) {
        return config;
      }

      // The global has to be set before any target block for RNFirebase to see it.
      const targetIndex = podfile.search(/^target /m);
      if (targetIndex === -1) {
        throw new Error(
          '[withRNFirebaseDisableSPM] no target block found in the generated Podfile'
        );
      }

      const contents = [
        podfile.slice(0, targetIndex),
        "# Resolve firebase-ios-sdk via CocoaPods instead of SPM: the Swift Package only ships\n",
        "# dynamic products, which cannot be installed under CocoaPods' default static linkage.\n",
        `${GLOBAL_NAME} = true\n\n`,
        podfile.slice(targetIndex),
      ].join('');

      fs.writeFileSync(podfilePath, contents);
      return config;
    },
  ]);

module.exports = withRNFirebaseDisableSPM;
