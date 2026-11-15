// "See every muscle" from the Progress tab (RYR-27). No design yet: a plain
// list of muscle bars, grouped by body area, from ProgressStats.muscleDetail.
import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';

import { api, useQuery, type MuscleGroup } from '../api';
import { Card, MuscleBar, Screen, ScreenHeader, SectionTitle } from '../components';
import { GROUP_LABEL, MUSCLE_LABEL, ratio, UNDER_TRAINED } from '../features/progress/model';
import { colors, fonts } from '../theme';

const GROUPS: MuscleGroup[] = ['upper', 'lower', 'core'];

export default function MusclesScreen() {
  const { data, error, loading } = useQuery(() => api.getProgress(), []);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/progress'));

  return (
    <Screen scroll>
      <ScreenHeader title="Every muscle" subtitle="Sessions vs. target · last 4 weeks" onBack={back} />
      {!data && loading ? (
        <ActivityIndicator color={colors.accent} />
      ) : !data ? (
        <Text style={styles.note}>Couldn't load your progress. {error?.message}</Text>
      ) : (
        GROUPS.map((group) => {
          const detail = data.muscleDetail?.filter((m) => m.group === group) ?? [];
          const summary = data.muscleBalance.find((b) => b.group === group);
          if (detail.length === 0 && !summary) return null;
          return (
            <Card key={group} gap={10}>
              <SectionTitle right={summary ? `${summary.actual}/${summary.target}` : undefined}>
                {GROUP_LABEL[group]}
              </SectionTitle>
              {detail.length > 0 ? (
                detail.map((m) => (
                  <MuscleBar
                    key={m.muscle}
                    label={MUSCLE_LABEL[m.muscle]}
                    value={m.actual}
                    max={m.target}
                    labelWidth={84}
                    tone={ratio(m.actual, m.target) < UNDER_TRAINED ? 'attention' : 'accent'}
                  />
                ))
              ) : summary ? (
                <MuscleBar
                  label={GROUP_LABEL[group]}
                  value={summary.actual}
                  max={summary.target}
                  labelWidth={84}
                  tone={ratio(summary.actual, summary.target) < UNDER_TRAINED ? 'attention' : 'accent'}
                />
              ) : null}
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textSecondary },
});
