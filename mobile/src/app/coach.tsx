// Ask Coach (RYR-29): chat with the coach, who can propose a program change that
// the user applies, declines or undoes. Design: board "10 · Ask Coach" (project/Coach.dc.html).
//
// Optional search param `prefill`: text to put in the message box, e.g.
//   router.push({ pathname: '/coach', params: { prefill: 'Swap cable fly' } })
//
// The conversation lives in screen state for now; persisting chat history is out of scope.
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewInstance,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, useQuery, type CoachChangeProposal, type CoachChangeResult, type CoachMessage } from '../api';
import { ChatBubble, CoachAvatar, CoachChangeCard, IconButton } from '../components';
import { colors, fonts, radius, screenGutter } from '../theme';

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Thu, Nov 12" from a YYYY-MM-DD calendar day. */
function formatDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${WEEKDAY_SHORT[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

function localDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

type ChangeAction = 'apply' | 'decline' | 'undo';

export default function CoachScreen() {
  const params = useLocalSearchParams<{ prefill?: string | string[] }>();
  const prefill = Array.isArray(params.prefill) ? params.prefill[0] : params.prefill;

  const program = useQuery(() => api.getProgram(), []);
  // The date new versions start from ("Creates plan v3 from Thu, Nov 12").
  const today = useQuery(() => api.getToday(), []);
  const reduceMotion = useReduceMotion();
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [text, setText] = useState(prefill ?? '');
  const [typing, setTyping] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [planVersion, setPlanVersion] = useState<number | undefined>();
  const [busyChange, setBusyChange] = useState<string | null>(null);
  const [changeErrors, setChangeErrors] = useState<Record<string, string>>({});
  const [keyboardShown, setKeyboardShown] = useState(false);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const localId = useRef(0);

  // A new prefill (screen opened again from elsewhere) replaces the draft.
  useEffect(() => {
    if (prefill) setText(prefill);
  }, [prefill]);

  useEffect(() => {
    if (program.data) setPlanVersion((v) => v ?? program.data!.current.version);
  }, [program.data]);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardShown(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardShown(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const scrollToEnd = useCallback(() => {
    scrollRef.current?.scrollToEnd({ animated: !reduceMotion });
  }, [reduceMotion]);

  const trimmed = text.trim();
  const canSend = trimmed.length > 0 && !typing;

  const send = async () => {
    if (!canSend) return;
    const optimistic: CoachMessage = {
      id: `local-${++localId.current}`,
      role: 'user',
      text: trimmed,
      createdAt: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);
    setText('');
    setSendError(null);
    setTyping(true);
    try {
      const { message, reply } = await api.sendCoachMessage({ text: trimmed });
      setMessages((m) => [...m.filter((x) => x.id !== optimistic.id), message, reply]);
      AccessibilityInfo.announceForAccessibility(`Coach: ${reply.text}`);
    } catch (err) {
      // Put the text back so nothing is lost.
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
      setText((t) => t || trimmed);
      setSendError(errorText(err, "Couldn't reach your coach. Try again."));
    } finally {
      setTyping(false);
    }
  };

  const runChange = async (change: CoachChangeProposal, action: ChangeAction) => {
    if (busyChange) return;
    setBusyChange(change.id);
    setChangeErrors(({ [change.id]: _, ...rest }) => rest);
    try {
      const call: Record<ChangeAction, (id: string) => Promise<CoachChangeResult>> = {
        apply: api.applyChange,
        decline: api.declineChange,
        undo: api.undoChange,
      };
      const result = await call[action](change.id);
      setMessages((m) => m.map((msg) => (msg.change?.id === result.change.id ? { ...msg, change: result.change } : msg)));
      setPlanVersion(result.program.version);
      AccessibilityInfo.announceForAccessibility(
        action === 'apply'
          ? `Change applied. Plan v${result.program.version} is live.`
          : action === 'decline'
            ? 'Change declined.'
            : `Undone. The change is pending again.`,
      );
    } catch (err) {
      setChangeErrors((e) => ({ ...e, [change.id]: errorText(err, "Couldn't update the change. Try again.") }));
    } finally {
      setBusyChange(null);
    }
  };

  const goBack = () => router.dismissTo('/plan');

  const fromDate = today.data ? formatDay(today.data.date) : undefined;
  const footnote = (change: CoachChangeProposal) => {
    const from = fromDate ?? formatDay(localDay(change.createdAt));
    if (change.status === 'applied') {
      return `Created plan v${change.resultingProgramVersion ?? planVersion} from ${from}. Past sessions stay as they were.`;
    }
    if (change.status === 'declined') {
      return `Not applied. Plan v${planVersion ?? change.baseProgramVersion} stays as it is.`;
    }
    return `Creates plan v${(planVersion ?? change.baseProgramVersion) + 1} from ${from}. Past sessions stay as they were.`;
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <IconButton icon="back" accessibilityLabel="Back to plan" onPress={goBack} />
        <View style={styles.headerText}>
          <Text style={styles.title} accessibilityRole="header">
            Ask Coach
          </Text>
          <Text style={styles.subtitle}>
            {planVersion ? `Changes apply to plan v${planVersion}` : program.error ? "Couldn't load your plan" : 'Loading your plan…'}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.chat}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onContentSizeChange={scrollToEnd}
          onLayout={scrollToEnd}
        >
          {messages.length === 0 && !typing ? (
            <ChatBubble
              from="coach"
              text="Hi! Tell me what you'd like to change about your plan, like a shorter session, a swap or a different day."
            />
          ) : null}

          {messages.map((m) => (
            <View key={m.id} style={styles.messageGroup}>
              <ChatBubble from={m.role} text={m.text} />
              {m.change ? (
                <View style={styles.changeWrap}>
                  <CoachChangeCard
                    lines={m.change.lines}
                    status={m.change.status}
                    footnote={footnote(m.change)}
                    onApply={() => runChange(m.change!, 'apply')}
                    onDecline={() => runChange(m.change!, 'decline')}
                    onUndo={() => runChange(m.change!, 'undo')}
                  />
                  {busyChange === m.change.id ? <Text style={styles.note}>Updating your plan…</Text> : null}
                  {changeErrors[m.change.id] ? (
                    <Text style={[styles.note, styles.error]} accessibilityRole="alert">
                      {changeErrors[m.change.id]}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          ))}

          {typing ? <TypingIndicator reduceMotion={reduceMotion} /> : null}

          {sendError ? (
            <Text style={[styles.note, styles.error]} accessibilityRole="alert">
              {sendError}
            </Text>
          ) : null}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: keyboardShown ? 12 : Math.max(insets.bottom, 12) + 8 }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Ask for a change…"
            placeholderTextColor={colors.textTertiary}
            accessibilityLabel="Message your coach"
            style={styles.input}
            returnKeyType="send"
            onSubmitEditing={send}
            submitBehavior="submit"
            onFocus={scrollToEnd}
            maxLength={2000}
            selectionColor={colors.accent}
            cursorColor={colors.accent}
          />
          <IconButton
            icon="send"
            accessibilityLabel="Send"
            onPress={send}
            disabled={!canSend}
            style={[styles.send, !canSend && styles.sendDisabled]}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Three bouncing dots while the coach replies. Static when Reduce Motion is on.
function TypingIndicator({ reduceMotion }: { reduceMotion: boolean }) {
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (reduceMotion) {
      dots.forEach((d) => d.setValue(0.5));
      return;
    }
    const loops = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(d, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(d, { toValue: 0, duration: 400, useNativeDriver: true }),
          Animated.delay(200 - i * 150 + 300),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [reduceMotion, dots]);

  return (
    <View style={styles.typingRow} accessible accessibilityLabel="Coach is typing" accessibilityLiveRegion="polite">
      <CoachAvatar />
      <View style={styles.typingBubble}>
        {dots.map((d, i) => (
          <Animated.View
            key={i}
            style={[
              styles.dot,
              {
                opacity: d.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
                transform: [{ translateY: d.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: screenGutter,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerText: { flex: 1 },
  title: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22, color: colors.text },
  subtitle: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.textSecondary },

  chat: { flexGrow: 1, gap: 14, paddingHorizontal: screenGutter, paddingVertical: 16 },
  messageGroup: { gap: 14 },
  changeWrap: { marginLeft: 42, gap: 6 },
  note: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.textSecondary },
  error: { color: colors.attention },

  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  typingBubble: {
    flexDirection: 'row',
    gap: 5,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    borderBottomLeftRadius: 4,
    backgroundColor: colors.surface,
  },
  dot: { width: 7, height: 7, borderRadius: radius.pill, backgroundColor: colors.textMuted },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: screenGutter,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    height: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  send: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.accentFill },
  sendDisabled: { backgroundColor: colors.surfaceMuted },
});
