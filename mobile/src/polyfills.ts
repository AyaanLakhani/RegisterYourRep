// Globals Privy's SDK expects, loaded before anything else (see index.js).
import 'fast-text-encoding';
import { getRandomValues } from 'expo-crypto';

const g = globalThis as { crypto?: { getRandomValues?: unknown } };
if (!g.crypto) g.crypto = {};
if (!g.crypto.getRandomValues) g.crypto.getRandomValues = getRandomValues;
