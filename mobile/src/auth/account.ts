// Who is logged in, for Profile and the Home avatar.
//
// AuthProvider fills this in from Privy when login is on. With login off
// (Expo Go, web, no Privy ids) it stays at NO_ACCOUNT: no name or email, and
// no signOut.
import { createContext, useContext } from 'react';

export type Account = {
  name?: string;
  email?: string;
  /** How they signed in. */
  method?: 'email' | 'google';
  /** Undefined when login is off. */
  signOut?: () => Promise<void>;
};

export const NO_ACCOUNT: Account = {};

export const AccountContext = createContext<Account>(NO_ACCOUNT);

export const useAccount = () => useContext(AccountContext);

/** "Ada Lovelace" -> "AL", "ada@example.com" -> "A", nothing -> "Me". */
export function initialsOf(nameOrEmail: string | undefined): string {
  const source = (nameOrEmail ?? '').split('@')[0].trim();
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return 'Me';
  const first = parts[0][0];
  const last = nameOrEmail?.includes('@') || parts.length < 2 ? '' : parts[parts.length - 1][0];
  return (first + last).toUpperCase();
}
