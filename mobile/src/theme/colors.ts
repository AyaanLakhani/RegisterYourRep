// Colour tokens for the RegisterYourRep app.
// Dark theme only: cool graphite surfaces with one electric-blue accent.
// Blue means "do this next", green means done, amber means needs attention.
export const colors = {
  background: '#0B0D12',
  surface: '#151820',
  surfaceSunken: '#10131A',
  raised: '#1C2029',
  raisedHigh: '#2A303B', // selected segment, swipe Swap action
  surfaceMuted: '#191C24', // disabled buttons, rest-day pills
  tabBar: '#0E1016',
  border: '#252A35',
  borderStrong: '#353C49',

  accent: '#4C8DFF', // text, icons, active tab
  accentText: '#7AABFF', // links and tags on dark
  accentSoft: '#13223D', // selected chip and day backgrounds
  accentFill: '#2F6BFF', // primary buttons (white text)
  accentTextLight: '#A9C8FF', // labels on accentSoft (set tracker)
  coach: '#F7A21B', // the coach's dumbbell icon
  coachSoft: '#3D2412', // background behind the coach icon

  done: '#2DA25F',
  doneText: '#4CC483', // "Done"/"Applied" text and "+" lines
  doneSoft: '#12291C', // done pill and applied banner backgrounds
  attention: '#F3BC3F',
  attentionSoft: '#2A2410', // moved/pending pill backgrounds
  attentionStrong: '#3A2C0C', // swipe Skip action background
  skipped: '#6B7280',

  text: '#FFFFFF',
  textMuted: '#E2E5EB',
  textSubtle: '#BEC3CC', // skipped/declined pill text, form cues
  textSecondary: '#A3A9B5',
  textTertiary: '#8A909C',
} as const;

export type ColorToken = keyof typeof colors;
