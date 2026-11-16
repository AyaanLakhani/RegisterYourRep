// Program proposal (RYR-22): the plan the coach built, Recommended vs As you asked.
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api, useQuery, usingMocks, type ProposalOption, type ProposalOptionKind } from '../api';
import { Button, Card, CoachAvatar, SegmentedControl } from '../components';
import { formatMuscles, WEEKDAY_LETTER, WEEKDAY_ORDER, WEEKDAY_SHORT } from '../lib/format';
import { colors, fonts, radius, screenGutter, type } from '../theme';

const OPTIONS = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'as_asked', label: 'As you asked' },
] as const;

export default function ProposalScreen() {
  const params = useLocalSearchParams<{ proposalId?: string }>();
  const proposalId = typeof params.proposalId === 'string' && params.proposalId ? params.proposalId : undefined;

  const { data: proposal, error, loading, refetch } = useQuery(
    () => (proposalId ? api.getProposal(proposalId) : Promise.resolve(undefined)),
    [proposalId],
  );
  const [choice, setChoice] = useState<ProposalOptionKind>('recommended');
  const [accepting, setAccepting] = useState(false);

  const option = proposal ? (choice === 'recommended' ? proposal.recommended : proposal.asAsked) : undefined;

  const accept = async () => {
    if (!proposal || accepting) return;
    setAccepting(true);
    try {
      await api.acceptProposal(proposal.id, { choice });
      router.replace('/');
    } catch (err) {
      setAccepting(false);
      Alert.alert("Couldn't start this plan", err instanceof Error ? err.message : 'Please try again.');
    }
  };

  const tweak = () => {
    if (!option) return;
    router.push({
      pathname: '/coach',
      params: {
        prefill: `I'd like to tweak the ${option.name} plan before I start.`,
        ...(proposal ? { proposalId: proposal.id } : {}),
      },
    });
  };

  let body;
  if (!proposalId) {
    body = <MissingProposal />;
  } else if (loading && !proposal) {
    body = (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  } else if (error || !proposal || !option) {
    body = (
      <View style={styles.center}>
        <Text style={styles.errorText}>We couldn't load your plan.</Text>
        <Button label="Try again" variant="secondary" size="compact" onPress={refetch} />
      </View>
    );
  } else {
    body = (
      <>
        <View style={styles.coachNote}>
          <CoachAvatar size={32} />
          <Text style={styles.coachText}>{proposal.coachNote}</Text>
        </View>
        <SegmentedControl options={OPTIONS} value={choice} onChange={setChoice} accessibilityLabel="Plan version" />
        <PlanCard option={option} />
      </>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.step}>Step 6 of 6</Text>
          <Text style={styles.title} accessibilityRole="header">
            Here's your plan
          </Text>
        </View>
        <View style={styles.main}>{body}</View>
      </ScrollView>
      {proposal && option ? (
        <View style={styles.footer}>
          <Button label="Tweak" variant="secondary" onPress={tweak} disabled={accepting} style={styles.tweak} />
          <Button
            label={accepting ? 'Starting…' : 'Start this plan'}
            onPress={accept}
            disabled={accepting}
            style={styles.start}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function PlanCard({ option }: { option: ProposalOption }) {
  const days = [...option.days].sort((a, b) => WEEKDAY_ORDER.indexOf(a.weekday) - WEEKDAY_ORDER.indexOf(b.weekday));
  const training = new Set(days.map((d) => d.weekday));
  return (
    <Card gap={4}>
      <View style={styles.planHeader}>
        <Text style={styles.planName} accessibilityRole="header">
          {option.name}
        </Text>
        <Text style={styles.planMeta}>
          {days.length} {days.length === 1 ? 'day' : 'days'}
        </Text>
      </View>
      <View
        style={styles.strip}
        accessible
        accessibilityLabel={`Training on ${days.map((d) => WEEKDAY_SHORT[d.weekday]).join(', ')}`}
      >
        {WEEKDAY_ORDER.map((wd) => {
          const on = training.has(wd);
          return (
            <View key={wd} style={[styles.stripDay, on ? styles.stripOn : styles.stripOff]}>
              <Text style={[styles.stripText, on ? styles.stripTextOn : styles.stripTextOff]}>{WEEKDAY_LETTER[wd]}</Text>
            </View>
          );
        })}
      </View>
      {days.map((d) => (
        <View key={d.weekday} style={styles.dayRow} accessible>
          <Text style={styles.dayName}>
            {WEEKDAY_SHORT[d.weekday]} · {d.name}
          </Text>
          <Text style={styles.dayMuscles} numberOfLines={1}>
            {formatMuscles(d.focus)}
          </Text>
        </View>
      ))}
    </Card>
  );
}

// No proposalId: there is no "latest proposal" endpoint, so explain and offer a way back.
function MissingProposal() {
  const [generating, setGenerating] = useState(false);

  // Dev + mock only: build a sample proposal so the screen can be opened directly.
  const generateSample = async () => {
    setGenerating(true);
    try {
      let job = await api.startGeneration();
      while (job.status !== 'done' && job.status !== 'failed') {
        await new Promise((r) => setTimeout(r, 1000));
        job = await api.getGenerationJob(job.id);
      }
      if (job.proposalId) router.setParams({ proposalId: job.proposalId });
      else throw new Error(job.error ?? 'Generation failed');
    } catch (err) {
      Alert.alert('Could not build a sample plan', err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <View style={styles.center}>
      <Text style={styles.errorText}>We couldn't find a plan to show.</Text>
      <Button label="Answer the questions again" variant="secondary" size="compact" onPress={() => router.replace('/onboarding')} />
      {__DEV__ && usingMocks ? (
        <Button
          label={generating ? 'Building…' : 'Build a sample plan (dev)'}
          variant="text"
          size="sm"
          disabled={generating}
          onPress={generateSample}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, paddingBottom: 8 },
  header: { gap: 6, paddingTop: 20, paddingHorizontal: screenGutter, paddingBottom: 8 },
  step: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, color: colors.textSecondary },
  title: { ...type.screenTitle, color: colors.text },
  main: { flexGrow: 1, gap: 14, paddingVertical: 8, paddingHorizontal: screenGutter },
  coachNote: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  coachText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.textMuted },
  planHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  planName: { ...type.heading, flexShrink: 1, color: colors.text },
  planMeta: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
  strip: { flexDirection: 'row', gap: 4, marginTop: 10, marginBottom: 8 },
  stripDay: { flex: 1, height: 32, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  stripOn: { backgroundColor: colors.accentSoft },
  stripOff: { backgroundColor: colors.surfaceMuted },
  stripText: { fontSize: 12 },
  stripTextOn: { fontFamily: fonts.semibold, color: colors.accentText },
  stripTextOff: { fontFamily: fonts.regular, color: colors.textTertiary },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  dayName: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  dayMuscles: { flexShrink: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary },
  footer: { flexDirection: 'row', gap: 8, paddingTop: 12, paddingHorizontal: screenGutter, paddingBottom: 12 },
  tweak: { flex: 1 },
  start: { flex: 2 },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 40 },
  errorText: { ...type.body, color: colors.textSecondary, textAlign: 'center' },
});
