// When Privy login is on.
//
// Privy only accepts logins from apps whose identifier is registered on the
// mobile client in the Privy dashboard (registeryourrep.app, set as the iOS
// bundleIdentifier and Android package in app.json). So login runs only when
// the running app *is* that app: a development or store build.
//
// In Expo Go the running app is Expo Go itself (host.exp.exponent), which
// Privy rejects ("Native app ID not allowed"). There, and on web until we
// check Privy's web support, the app skips login and runs on mock data, so
// the screens can still be clicked through.
//
// The app id and client id are public values (they ship inside the app). Set
// them in mobile/.env.local:
//   EXPO_PUBLIC_PRIVY_APP_ID=...      same app as the web (one user id everywhere)
//   EXPO_PUBLIC_PRIVY_CLIENT_ID=...   the mobile client of that app
import { applicationId } from 'expo-application';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const PRIVY_APP_ID = process.env.EXPO_PUBLIC_PRIVY_APP_ID ?? '';
export const PRIVY_CLIENT_ID = process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID ?? '';

// The identifiers this app is built with (app.json).
const OUR_APP_IDS = [Constants.expoConfig?.android?.package, Constants.expoConfig?.ios?.bundleIdentifier].filter(
  (id): id is string => Boolean(id),
);

function reasonLoginIsOff(): string | null {
  if (Platform.OS === 'web') return 'web build (Privy web support not checked yet)';
  if (!applicationId || !OUR_APP_IDS.includes(applicationId)) {
    return `running as "${applicationId ?? 'unknown'}", not this app (${OUR_APP_IDS.join(' / ') || 'no id in app.json'}). In Expo Go, use a development build to log in`;
  }
  if (!PRIVY_APP_ID || !PRIVY_CLIENT_ID) return 'EXPO_PUBLIC_PRIVY_APP_ID / EXPO_PUBLIC_PRIVY_CLIENT_ID not set';
  return null;
}

export const loginOffReason = reasonLoginIsOff();
export const loginEnabled = loginOffReason === null;
