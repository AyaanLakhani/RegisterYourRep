import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, sizes } from '../theme';
import { Icon, type IconName } from './Icon';

const ICONS: Record<string, IconName> = {
  index: 'home',
  week: 'week',
  progress: 'progress',
  plan: 'plan',
};

// Bottom tab bar from the design: 4 equal columns, icon above a 12px label,
// active tab in the accent colour.
export function TabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]} accessibilityRole="tablist">
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = options.title ?? route.name;
        const focused = state.index === index;
        const color = focused ? colors.accent : colors.textTertiary;

        const onPress = () => {
          const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigateToTab(route.key);
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
            style={styles.tab}
          >
            <Icon name={ICONS[route.name] ?? 'home'} size={sizes.tabIcon} color={color} />
            <Text style={[styles.label, { color, fontFamily: focused ? fonts.semibold : fonts.medium }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.tabBar,
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  label: {
    fontSize: 12,
  },
});
