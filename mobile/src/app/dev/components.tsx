import { Redirect, router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  Button,
  Card,
  ChatBubble,
  Chip,
  CoachAvatar,
  CoachChangeCard,
  ExerciseRow,
  IconButton,
  MissedWeekPrompt,
  MuscleBar,
  Screen,
  ScreenHeader,
  SectionTitle,
  SegmentedControl,
  SessionCard,
  StatTile,
  StepProgress,
  SuccessBanner,
  type ChangeStatus,
} from '../../components';
import { colors, type } from '../../theme';

// Dev-only gallery of every shared component in every state (mirrors the design's Components board).
// Open at /dev/components. Redirects home in production builds.
export default function ComponentsPreview() {
  if (!__DEV__) return <Redirect href="/" />;
  return <Gallery />;
}

const noop = () => {};

function Board({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <SectionTitle>{title}</SectionTitle>
      {children}
    </Card>
  );
}

function Gallery() {
  const [chips, setChips] = useState<Record<string, boolean>>({
    Squat: true,
    'Bench press': true,
    Deadlift: false,
    'Cable row': false,
  });
  const [plan, setPlan] = useState<'recommended' | 'asked'>('recommended');
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [change, setChange] = useState<ChangeStatus>('pending');

  return (
    <Screen scroll>
      <ScreenHeader
        title="Components"
        subtitle="Dev preview · RYR-19"
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        right={<IconButton icon="more" accessibilityLabel="More options" onPress={noop} />}
      />

      <Board title="Buttons">
        <Button label="Start workout" onPress={noop} />
        <Button label="Tweak plan" variant="secondary" onPress={noop} />
        <View style={styles.row}>
          <Button label="Not today" variant="text" size="compact" onPress={noop} style={styles.flex} />
          <Button label="Disabled" size="compact" disabled style={styles.flex} />
        </View>
        <View style={styles.row}>
          <Button label="Small primary" size="sm" onPress={noop} style={styles.flex} />
          <Button label="Small secondary" size="sm" variant="secondary" onPress={noop} style={styles.flex} />
        </View>
        <Button label="Link to Home (href)" variant="secondary" href="/" />
        <View style={styles.row}>
          <IconButton icon="back" accessibilityLabel="Back" onPress={noop} />
          <IconButton icon="forward" accessibilityLabel="Next week" onPress={noop} />
          <IconButton icon="move" tone="raised" accessibilityLabel="Move session" onPress={noop} />
          <IconButton icon="forward" accessibilityLabel="Next week" disabled />
        </View>
      </Board>

      <Board title="Chips">
        <View style={styles.wrap}>
          {Object.entries(chips).map(([label, selected]) => (
            <Chip key={label} label={label} selected={selected} onPress={() => setChips({ ...chips, [label]: !selected })} />
          ))}
        </View>
      </Board>

      <Board title="Segmented control">
        <SegmentedControl
          accessibilityLabel="Plan version"
          value={plan}
          onChange={setPlan}
          options={[
            { value: 'recommended', label: 'Recommended' },
            { value: 'asked', label: 'As you asked' },
          ]}
        />
      </Board>

      <Board title="Step progress">
        <Text style={styles.caption}>Onboarding · step 3 of 6</Text>
        <StepProgress steps={['filled', 'filled', 'filled', 'empty', 'empty', 'empty']} accessibilityLabel="Step 3 of 6" />
        <Text style={styles.caption}>Workout · 2 done, 1 skipped, current, 2 to do</Text>
        <StepProgress steps={['done', 'done', 'skipped', 'current', 'todo', 'todo']} />
      </Board>

      <Board title="Session card · states">
        <SessionCard day="Thu" date={12} title="Push B · Chest & triceps" subtitle="6 exercises · 55 min" status="today" onPress={noop} />
        <SessionCard day="Mon" date={9} title="Push A · Chest & triceps" subtitle="6 of 6 done" status="done" onPress={noop} />
        <SessionCard day="Sat" date={14} title="Legs & abs" subtitle="5 exercises · 50 min" status="moved" statusLabel="Moved from Wed" />
        <SessionCard day="Tue" date={3} title="Pull A · Back & biceps" subtitle="Carried over to this week" status="skipped" />
        <SessionCard
          day="Fri"
          date={13}
          title="Pull"
          subtitle="6 exercises · 50 min"
          onPress={noop}
          action={{ icon: 'move', accessibilityLabel: 'Move Pull to another day', onPress: noop }}
        />
        <SessionCard day="Wed" date={11} status="rest" />
      </Board>

      <Board title="Stat tile · muscle bar">
        <View style={styles.row}>
          <StatTile value="6 wks" label="consistent" />
          <StatTile value="87%" label="sessions done" />
        </View>
        <View style={styles.row}>
          <StatTile variant="inline" value="2" label="sessions done" />
          <StatTile variant="inline" value="11/12" label="exercises" />
          <StatTile variant="inline" value="3" label="to go" />
        </View>
        <MuscleBar label="Chest" value={8} max={9} />
        <MuscleBar label="Legs" value={4} max={10} tone="attention" />
      </Board>

      <Board title="Exercise row · states">
        <ExerciseRow name="Bench press" dose="4 × 8" state="done" />
        <ExerciseRow
          name="Overhead triceps extension"
          dose="3 × 12"
          detail="3 sets × 12 reps · rest 60s"
          cue="Keep your elbows pointing up and close to your head. Lower slowly for 2 seconds, then press."
          state="active"
          sets={[12, null, null]}
          onSetPress={noop}
          onDone={noop}
          onSkip={noop}
          onSwap={noop}
        />
        <ExerciseRow name="Cable fly" dose="3 × 12" state="skipped" skipReason="didn't know it" />
        <ExerciseRow name="Lateral raise" dose="3 × 15" state="todo" />
        <Text style={styles.caption}>Swipe left or tap to reveal Swap and Skip:</Text>
        {[
          { id: 'dips', name: 'Dips', dose: '3 × max' },
          { id: 'lat', name: 'Lateral raise', dose: '3 × 15' },
        ].map((r) => (
          <ExerciseRow
            key={r.id}
            name={r.name}
            dose={r.dose}
            state="todo"
            onSkip={noop}
            onSwap={noop}
            actionsOpen={openRow === r.id}
            onActionsOpenChange={(open) => setOpenRow(open ? r.id : null)}
          />
        ))}
      </Board>

      <Board title="Missed-week prompt">
        <MissedWeekPrompt onContinue={noop} onStartFresh={noop} onLighterWeek={noop} />
        <MissedWeekPrompt
          onContinue={noop}
          onStartFresh={noop}
          message="3 sessions didn't happen. Pick up where you left off, or start this week fresh?"
        />
      </Board>

      <Board title="Coach change card">
        <CoachChangeCard
          status={change}
          lines={[
            { kind: 'remove', text: 'Cable fly (3 × 12) on Push B' },
            { kind: 'add', text: 'Rest 60s on accessories (was 90s)' },
            { kind: 'result', text: 'Est. time 55 → 40 min' },
          ]}
          footnote="Creates plan v3 · applies from Thu 12 · past sessions unchanged"
          onApply={() => setChange('applied')}
          onDecline={() => setChange('declined')}
          onUndo={() => setChange('pending')}
        />
        <CoachChangeCard status="declined" lines={[{ kind: 'remove', text: 'Leg press' }]} />
        <SuccessBanner label="Applied · plan v3 is live" />
      </Board>

      <Board title="Coach chat">
        <View style={styles.row}>
          <CoachAvatar />
          <CoachAvatar size={44} />
        </View>
        <ChatBubble from="user" text="Can we make Thursday shorter? I only have 40 minutes." />
        <ChatBubble
          from="coach"
          text="Sure. I'll drop cable fly (you've skipped it 4 times anyway) and shorten rest on the accessory lifts."
        />
        <ChatBubble from="user" tone="muted" text="Build muscle · 5 days a week · about an hour" />
      </Board>

      <Board title="Cards">
        <Card variant="sunken">
          <SectionTitle right="120 min so far">Activity</SectionTitle>
          <Text style={styles.body}>Sunken card (section panels)</Text>
        </Card>
        <Card variant="raised">
          <Text style={styles.body}>Raised card (prompts)</Text>
        </Card>
        <Card variant="highlight">
          <Text style={styles.body}>Highlight card (do this next)</Text>
        </Card>
      </Board>

      <Board title="Screen header">
        <ScreenHeader title="This week" subtitle="Nov 9 – 15 · Upper · Lower · PPL v2" right={
          <>
            <IconButton icon="back" accessibilityLabel="Previous week" onPress={noop} />
            <IconButton icon="forward" accessibilityLabel="Next week" onPress={noop} />
          </>
        } />
        <ScreenHeader eyebrow="Thursday, Nov 12" title="Good evening" />
      </Board>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  flex: { flex: 1 },
  caption: { ...type.caption, color: colors.textSecondary },
  body: { ...type.bodySmall, color: colors.textMuted },
});
