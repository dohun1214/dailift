import '@/i18n';

import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useUnistyles } from 'react-native-unistyles';

import { DatabaseProvider } from '@/db/provider';
import { startAuth } from '@/lib/auth';
import { configureNotifications } from '@/lib/notifications';
import { useRestTimerAlarm } from '@/stores/use-rest-timer-alarm';
import { useAppFonts } from '@/theme/use-app-fonts';
import { useApplyTheme } from '@/theme/use-apply-theme';

startAuth();

void SplashScreen.preventAutoHideAsync();
configureNotifications();

export default function RootLayout() {
  useApplyTheme();
  useRestTimerAlarm();
  const { theme } = useUnistyles();
  const fontsReady = useAppFonts();

  useEffect(() => {
    if (fontsReady) void SplashScreen.hideAsync();
  }, [fontsReady]);

  if (!fontsReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
          {/* 닫기(X)로 나가는 편집 화면은 아래에서 올라온다 */}
          <Stack.Screen name="routine/[id]" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="exercise-picker" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="exercise-new" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen
            name="workout"
            options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
          />
          <Stack.Screen name="workout-summary/[id]" options={{ animation: 'fade' }} />
          <Stack.Screen name="workout-edit/[id]" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="plate-calculator" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="account-link" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="account-delete" />
        </Stack>
      </DatabaseProvider>
    </GestureHandlerRootView>
  );
}
