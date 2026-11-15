import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { colors, screenGutter } from '../theme';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  // Tab screens leave the bottom edge to the tab bar.
  edges?: Edge[];
  contentStyle?: ViewStyle;
};

export function Screen({ children, scroll = false, edges = ['top', 'bottom'], contentStyle }: Props) {
  return (
    <SafeAreaView style={styles.root} edges={edges}>
      {scroll ? (
        <ScrollView contentContainerStyle={[styles.content, contentStyle]} showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.fill, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  fill: { flex: 1 },
  content: { paddingHorizontal: screenGutter, paddingVertical: 16, gap: 16 },
});
