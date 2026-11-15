import { Link, type Href } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { colors, type } from '../theme';
import { Screen } from './Screen';

type Props = {
  title: string;
  issue: string;
  links?: { label: string; href: Href }[];
  tab?: boolean;
};

// Temporary screen body until each screen's own issue replaces it.
export function Placeholder({ title, issue, links = [], tab = false }: Props) {
  return (
    <Screen edges={tab ? ['top'] : ['top', 'bottom']}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.note}>Built in {issue}.</Text>
      <View style={styles.links}>
        {links.map((l) => (
          <Link key={l.label} href={l.href} style={styles.link}>
            {l.label}
          </Link>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...type.screenTitle, color: colors.text },
  note: { ...type.bodySmall, color: colors.textSecondary },
  links: { gap: 4 },
  link: { ...type.label, color: colors.accentText, paddingVertical: 12 },
});
