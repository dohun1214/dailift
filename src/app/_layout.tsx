import '@/i18n';

import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useUnistyles } from 'react-native-unistyles';

import { DatabaseProvider } from '@/db/provider';
import { useAppFonts } from '@/theme/use-app-fonts';
import { useApplyTheme } from '@/theme/use-apply-theme';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useApplyTheme();
  const { theme } = useUnistyles();
  const fontsReady = useAppFonts();

  useEffect(() => {
    if (fontsReady) void SplashScreen.hideAsync();
  }, [fontsReady]);

  if (!fontsReady) return null;

  return (
    <DatabaseProvider>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
      </Stack>
    </DatabaseProvider>
  );
}
