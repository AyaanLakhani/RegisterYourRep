import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { colors } from '../theme';

// Stroke icons drawn in the app design (24×24 viewBox, 2px stroke).
export type IconName =
  | 'home'
  | 'week'
  | 'progress'
  | 'plan'
  | 'back'
  | 'forward'
  | 'close'
  | 'more'
  | 'check'
  | 'coach'
  | 'swap'
  | 'skip'
  | 'send'
  | 'move'
  | 'restart';

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export function Icon({ name, size = 24, color = colors.text, strokeWidth = 2 }: Props) {
  const stroke = {
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {renderPaths(name, stroke, color)}
    </Svg>
  );
}

function renderPaths(name: IconName, s: Record<string, unknown>, color: string) {
  switch (name) {
    case 'home':
      return <Path {...s} d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />;
    case 'week':
      return (
        <>
          <Rect {...s} x="3" y="4" width="18" height="17" rx="2" />
          <Path {...s} d="M8 2v4M16 2v4M3 10h18" />
        </>
      );
    case 'progress':
      return <Path {...s} d="M3 20h18M6 16v-5M11 16V6M16 16v-8" />;
    case 'plan':
      return (
        <>
          <Rect {...s} x="5" y="3" width="14" height="18" rx="2" />
          <Path {...s} d="M9 8h6M9 12h6M9 16h4" />
        </>
      );
    case 'back':
      return <Path {...s} d="M15 18 9 12l6-6" />;
    case 'forward':
      return <Path {...s} d="m9 18 6-6-6-6" />;
    case 'close':
      return <Path {...s} d="M18 6 6 18M6 6l12 12" />;
    case 'more':
      return (
        <>
          <Circle cx="5" cy="12" r="1.8" fill={color} />
          <Circle cx="12" cy="12" r="1.8" fill={color} />
          <Circle cx="19" cy="12" r="1.8" fill={color} />
        </>
      );
    case 'check':
      return <Path {...s} d="M5 12.5 10 17 19 7" />;
    case 'coach':
      // Solid dumbbell (design update, Nov 15): plates either side of a short bar.
      return (
        <>
          <Rect x="1" y="10.4" width="1.8" height="3.2" rx="0.9" fill={color} />
          <Rect x="3.1" y="7.6" width="2.9" height="8.8" rx="1.45" fill={color} />
          <Rect x="6.4" y="5.4" width="3.3" height="13.2" rx="1.65" fill={color} />
          <Rect x="9.7" y="10.9" width="4.6" height="2.2" fill={color} />
          <Rect x="14.3" y="5.4" width="3.3" height="13.2" rx="1.65" fill={color} />
          <Rect x="18" y="7.6" width="2.9" height="8.8" rx="1.45" fill={color} />
          <Rect x="21.2" y="10.4" width="1.8" height="3.2" rx="0.9" fill={color} />
        </>
      );
    case 'swap':
      return <Path {...s} d="M17 3l4 4-4 4M3 7h18M7 21l-4-4 4-4M21 17H3" />;
    case 'skip':
      return <Path {...s} d="M5 4l10 8-10 8V4zM19 5v14" />;
    case 'send':
      return <Path {...s} d="M22 2 11 13M22 2l-7 20-4-9-9-4z" />;
    case 'move':
      return <Path {...s} d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3" />;
    case 'restart':
      return <Path {...s} d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" />;
  }
}
