// Remembers, on this phone, which logged-in accounts finished onboarding.
//
// Only used while the app runs on mock data: the mock has no server to keep a
// profile per account, so without this every launch would look like a new
// user. With the real API, "has a profile" comes from the server instead
// (GET profile returns null for a new account) and this is not used.
import * as SecureStore from 'expo-secure-store';

import { usingMocks } from '../api';

let currentUserId: string | null = null;

export function setCurrentUser(userId: string | null) {
  currentUserId = userId;
}

// SecureStore keys may only contain letters, digits, ".", "-" and "_";
// Privy ids look like "did:privy:abc123".
const keyFor = (userId: string) => `ryr.onboarded.${userId.replace(/[^A-Za-z0-9._-]/g, '_')}`;

export async function hasFinishedOnboarding(userId: string): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(keyFor(userId))) === '1';
  } catch {
    return false;
  }
}

/** Call after the onboarding answers are saved. No-op outside mock mode or when logged out. */
export async function rememberOnboardingFinished(): Promise<void> {
  if (!usingMocks || !currentUserId) return;
  try {
    await SecureStore.setItemAsync(keyFor(currentUserId), '1');
  } catch {
    // Not fatal: the account just sees onboarding again next launch.
  }
}
