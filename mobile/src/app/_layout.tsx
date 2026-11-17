import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '../auth/AuthProvider';
import { colors } from '../theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AuthProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="(tabs)" />
          {/* Full-screen flows outside the tab bar */}
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="generating" options={{ gestureEnabled: false }} />
          <Stack.Screen name="proposal" />
          <Stack.Screen name="workout" options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="workout-complete" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
          <Stack.Screen name="coach" />
          {/* Dev-only component gallery; the screen redirects home outside __DEV__ */}
          <Stack.Screen name="dev/components" />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
