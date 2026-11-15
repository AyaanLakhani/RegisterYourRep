// Colour tokens from the RegisterYourRep app design (Components board).
// Dark theme only. Red means "do this next", never "you failed".
export const colors = {
  background: '#0F0F0F',
  surface: '#1A1A1A',
  surfaceSunken: '#141414',
  raised: '#222222',
  tabBar: '#121212',
  border: '#2A2A2A',
  borderStrong: '#3A3A3A',

  accent: '#F45D0F', // text, icons, active tab
  accentText: '#F7834A', // links and tags on dark
  accentSoft: '#2E1A0E', // selected chip and day backgrounds
  accentFill: '#CA1712', // primary buttons

  done: '#2DA25F',
  attention: '#F3BC3F',
  skipped: '#6B6B6B',

  text: '#FFFFFF',
  textMuted: '#DDDDDD',
  textSecondary: '#A3A3A3',
  textTertiary: '#8A8A8A',
} as const;

export type ColorToken = keyof typeof colors;
