// Login with an emailed one-time code (Privy). Shown by AuthProvider while
// nobody is logged in. There's no design for this screen yet, so it uses the
// theme and the shared Button with a plain layout.
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Screen } from '../components';
import { colors, fonts, radius, sizes, spacing, type } from '../theme';

type PrivyModule = typeof import('@privy-io/expo');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function friendlyError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err ?? '');
  // In development builds, show and log Privy's own message: it usually names
  // the setup problem (app identifier, client id, login method not enabled).
  if (__DEV__) {
    console.warn('Privy login error:', message);
    return `Login failed: ${message || 'unknown error'}`;
  }
  if (/invalid.*code|code.*invalid|incorrect/i.test(message)) return "That code didn't work. Check it and try again.";
  if (/network|fetch/i.test(message)) return "Couldn't reach the server. Check your connection and try again.";
  return 'Something went wrong. Please try again.';
}

export function LoginScreen() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy, see AuthProvider
  const { useLoginWithEmail, useLoginWithOAuth } = require('@privy-io/expo') as PrivyModule;
  const { sendCode, loginWithCode } = useLoginWithEmail();
  const { login: loginWithOAuth } = useLoginWithOAuth();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const trimmedEmail = email.trim();
  const emailValid = EMAIL_PATTERN.test(trimmedEmail);

  async function onSendCode() {
    if (!emailValid || busy) return;
    setBusy(true);
    setError('');
    try {
      await sendCode({ email: trimmedEmail });
      setStep('code');
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  // Google: Privy opens the Google sign-in in a browser sheet and returns to
  // the app through its URL scheme (app.json "scheme"). Google must be enabled
  // as a login method in the Privy dashboard.
  async function onGoogle() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await loginWithOAuth({ provider: 'google' });
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  }

  async function onVerify() {
    if (code.trim().length < 6 || busy) return;
    setBusy(true);
    setError('');
    try {
      // On success Privy sets the user and AuthProvider shows the app.
      await loginWithCode({ code: code.trim(), email: trimmedEmail });
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.body}>
          <Text style={styles.overline}>RegisterYourRep</Text>
          <Text style={styles.title}>{step === 'email' ? 'Sign in' : 'Check your email'}</Text>
          <Text style={styles.subtitle}>
            {step === 'email'
              ? "Enter your email and we'll send you a code. Same account as the website."
              : `We sent a 6-digit code to ${trimmedEmail}.`}
          </Text>

          {step === 'email' ? (
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              textContentType="emailAddress"
              returnKeyType="send"
              onSubmitEditing={onSendCode}
              editable={!busy}
              accessibilityLabel="Email address"
            />
          ) : (
            <TextInput
              style={[styles.input, styles.codeInput]}
              value={code}
              onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              placeholderTextColor={colors.textTertiary}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              returnKeyType="done"
              onSubmitEditing={onVerify}
              editable={!busy}
              autoFocus
              accessibilityLabel="Login code"
            />
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        <View style={styles.actions}>
          {step === 'email' ? (
            <>
              <Button label={busy ? 'Sending…' : 'Send code'} onPress={onSendCode} disabled={!emailValid || busy} />
              <Button label="Continue with Google" variant="secondary" onPress={onGoogle} disabled={busy} />
            </>
          ) : (
            <>
              <Button label={busy ? 'Checking…' : 'Sign in'} onPress={onVerify} disabled={code.length < 6 || busy} />
              <Button
                label="Use a different email"
                variant="text"
                size="sm"
                disabled={busy}
                onPress={() => {
                  setStep('email');
                  setCode('');
                  setError('');
                }}
              />
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  body: { flex: 1, justifyContent: 'center', gap: spacing.md },
  overline: { ...type.overline, color: colors.accent },
  title: { ...type.display, color: colors.text },
  subtitle: {
    ...type.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  input: {
    height: sizes.inputHeight,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceSunken,
    paddingHorizontal: spacing.lg,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 16,
  },
  codeInput: {
    fontFamily: fonts.semibold,
    fontSize: 22,
    letterSpacing: 8,
    textAlign: 'center',
  },
  error: { ...type.bodySmall, color: colors.attention },
  actions: { gap: spacing.sm, paddingBottom: spacing.lg },
});
