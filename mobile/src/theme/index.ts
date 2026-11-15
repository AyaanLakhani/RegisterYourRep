export { colors } from './colors';
export type { ColorToken } from './colors';
export { fonts, type } from './typography';

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

// Horizontal padding for every screen.
export const screenGutter = 20;

export const radius = {
  sm: 8,
  md: 12, // buttons, inputs
  lg: 14, // small cards
  xl: 16, // cards
  xxl: 18, // hero cards
  pill: 999, // chips
} as const;

export const sizes = {
  minTapTarget: 44,
  buttonHeight: 52,
  inputHeight: 48,
  tabIcon: 24,
} as const;
