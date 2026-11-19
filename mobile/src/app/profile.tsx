// Profile and settings, opened from the avatar on Home.
//
// Account (from Privy), the training setup saved in onboarding, a way to
// change it (onboarding again, prefilled, which builds a new plan), the app
// version and sign out. Account deletion is not here yet.
import { nativeApplicationVersion, nativeBuildVersion } from 'expo-application';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';

import { api, useQuery, usingMocks, type Profile } from '../api';
import { initialsOf, useAccount } from '../auth/account';
import { loginEnabled } from '../auth/config';
import { Button, Card, Screen, ScreenHeader, SectionTitle } from '../components';
import {
  EQUIPMENT,
  GOALS,
  GYM_TYPES,
  HISTORY,
  labelOf,
  LEVELS,
  WEEKDAYS,
} from '../features/onboarding/options';
import { colors, fonts, radius, type } from '../theme';

function scheduleText(p: Profile) {
  const days = WEEKDAYS.filter((d) => p.trainingDays.includes(d.value)).map((d) => d.label);
  return `${days.join(', ')} · ${p.sessionMinutes} min`;
}

function equipmentText(p: Profile) {
  const names = EQUIPMENT.filter((e) => p.equipment.includes(e.value)).map((e) => e.label);
  return names.length ? names.join(', ') : 'None';
}

function levelText(p: Profile) {
  const level = labelOf(LEVELS, p.level);
  return p.level === p.suggestedLevel ? level : `${level} (suggested ${labelOf(LEVELS, p.suggestedLevel)})`;
}

export default function ProfileScreen() {
  const account = useAccount();
  const profile = useQuery(() => api.getProfile(), []);
  const [signingOut, setSigningOut] = useState(false);

  const displayName = account.name ?? profile.data?.displayName;
  const methodText =
    account.method === 'google' ? 'Signed in with Google' : account.method === 'email' ? 'Signed in with email' : undefined;

  const confirmSignOut = () => {
    const signOut = account.signOut;
    if (!signOut) return;
    Alert.alert('Sign out?', 'Your plan and progress stay saved to your account.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          try {
            // The login screen replaces the app once Privy clears the user.
            await signOut();
          } catch {
            setSigningOut(false);
            Alert.alert("Couldn't sign out", 'Please try again.');
          }
        },
      },
    ]);
  };

  const version = [nativeApplicationVersion, nativeBuildVersion && `(${nativeBuildVersion})`].filter(Boolean).join(' ');

  return (
    <Screen scroll>
      <ScreenHeader title="Profile" onBack={() => router.back()} />

      <Card variant="raised" style={styles.accountCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initialsOf(displayName ?? account.email)}</Text>
        </View>
        <View style={styles.accountText}>
          <Text style={styles.name} numberOfLines={1}>
            {displayName ?? account.email ?? 'Your account'}
          </Text>
          {displayName && account.email ? (
            <Text style={styles.meta} numberOfLines={1}>
              {account.email}
            </Text>
          ) : null}
          {methodText ? <Text style={styles.meta}>{methodText}</Text> : null}
          {!loginEnabled ? <Text style={styles.meta}>Login is off in this build</Text> : null}
        </View>
      </Card>

      <Card>
        <SectionTitle>Training setup</SectionTitle>
        {profile.data ? (
          <View>
            <Row label="Goal" value={labelOf(GOALS, profile.data.goals[0])} />
            <Row label="Schedule" value={scheduleText(profile.data)} />
            <Row label="Where you train" value={labelOf(GYM_TYPES, profile.data.gymType)} />
            <Row label="Equipment" value={equipmentText(profile.data)} />
            <Row label="Training history" value={labelOf(HISTORY, profile.data.trainingHistory)} />
            <Row label="Level" value={levelText(profile.data)} />
            <Row label="Work around" value={profile.data.limitations || 'Nothing'} last />
          </View>
        ) : profile.error ? (
          <View style={styles.inline}>
            <Text style={styles.error}>{"Couldn't load your training setup."}</Text>
            <Button label="Try again" variant="text" size="sm" onPress={profile.refetch} />
          </View>
        ) : profile.data === null ? (
          <Text style={styles.meta}>{"You haven't set up training yet."}</Text>
        ) : (
          <ActivityIndicator color={colors.accent} style={styles.spinner} />
        )}
        <Text style={styles.helper}>
          Changing these builds you a new plan. Your current plan stays until you start the new one.
        </Text>
        <Button
          label="Update training setup"
          variant="secondary"
          size="compact"
          disabled={!profile.data}
          onPress={() => router.push({ pathname: '/onboarding', params: { edit: '1' } })}
        />
      </Card>

      {account.signOut ? (
        <Button
          label={signingOut ? 'Signing out…' : 'Sign out'}
          variant="secondary"
          onPress={confirmSignOut}
          disabled={signingOut}
        />
      ) : null}

      <Text style={styles.footer}>
        RegisterYourRep{version ? ` ${version}` : ''}
        {__DEV__ && usingMocks ? ' · mock data' : ''}
      </Text>
    </Screen>
  );
}

function Row({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.rowDivider]} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  accountCard: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.semibold, fontSize: 18, color: colors.accentTextLight },
  accountText: { flex: 1, gap: 2 },
  name: { ...type.heading, color: colors.text },
  meta: { ...type.bodySmall, color: colors.textSecondary },

  row: { paddingVertical: 10, gap: 2 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowLabel: { ...type.caption, color: colors.textTertiary },
  rowValue: { ...type.body, color: colors.text },

  helper: { ...type.caption, color: colors.textSecondary },
  inline: { gap: 4, alignItems: 'flex-start' },
  error: { ...type.bodySmall, color: colors.attention },
  spinner: { paddingVertical: 16 },
  footer: { ...type.caption, color: colors.textTertiary, textAlign: 'center', paddingTop: 8 },
});
