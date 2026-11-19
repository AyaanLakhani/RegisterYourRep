// Wraps the app in Privy login when it's enabled (see ./config).
//
// Logged out: the login screen is shown instead of the app.
// Logged in: the API client sends the Privy access token as a bearer token
// on every request (the server accepts it once RYR-34 is in). A new account
// has no profile, so Home sends it to onboarding.
//
// Privy is loaded with require() only when login is enabled, so Expo Go never
// loads its native modules.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { setTokenProvider, usingMocks } from '../api';
import { mockDataSource } from '../api/mock';
import { colors } from '../theme';
import { AccountContext, type Account } from './account';
import { loginEnabled, loginOffReason, PRIVY_APP_ID, PRIVY_CLIENT_ID } from './config';
import { LoginScreen } from './LoginScreen';
import { hasFinishedOnboarding, setCurrentUser } from './onboardingMemory';

type PrivyModule = typeof import('@privy-io/expo');

export function AuthProvider({ children }: { children: ReactNode }) {
  if (!loginEnabled) {
    if (__DEV__) console.info(`Login is off: ${loginOffReason}. Running without Privy.`);
    return <>{children}</>;
  }

  // Loaded lazily on purpose: Expo Go must never load Privy's native modules.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrivyProvider } = require('@privy-io/expo') as PrivyModule;
  return (
    <PrivyProvider appId={PRIVY_APP_ID} clientId={PRIVY_CLIENT_ID}>
      <LoginGate>{children}</LoginGate>
    </PrivyProvider>
  );
}

function LoginGate({ children }: { children: ReactNode }) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy, see AuthProvider
  const { usePrivy } = require('@privy-io/expo') as PrivyModule;
  const { user, isReady, getAccessToken, logout } = usePrivy();

  // Name, email and sign-in method from the account's linked logins.
  const account = useMemo<Account>(() => {
    const linked = user?.linked_accounts ?? [];
    const google = linked.find((a) => a.type === 'google_oauth');
    const email = linked.find((a) => a.type === 'email');
    return {
      name: google?.name ?? undefined,
      email: google?.email ?? email?.address,
      method: google ? 'google' : email ? 'email' : undefined,
      signOut: logout,
    };
  }, [user, logout]);

  // Requests carry the token while someone is logged in. getAccessToken
  // refreshes it when it's close to expiring, so it's called per request.
  useEffect(() => {
    setTokenProvider(user ? () => getAccessToken() : async () => null);
  }, [user, getAccessToken]);

  // The account the app is set up for. On mock data, an account this phone
  // hasn't seen finish onboarding starts with no profile (a new user), so it
  // goes through onboarding; one that finished it goes straight to Home.
  const userId = user?.id ?? null;
  const [preparedFor, setPreparedFor] = useState<string | null>(null);
  useEffect(() => {
    setCurrentUser(userId);
    if (!userId) return;
    let cancelled = false;
    (async () => {
      if (usingMocks && !(await hasFinishedOnboarding(userId))) mockDataSource.startAsNewUser();
      if (!cancelled) setPreparedFor(userId);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!isReady || (user && preparedFor !== user.id)) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (!user) return <LoginScreen />;
  return <AccountContext.Provider value={account}>{children}</AccountContext.Provider>;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
