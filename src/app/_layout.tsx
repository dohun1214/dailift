import '@/i18n';

import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useUnistyles } from 'react-native-unistyles';

import { AccountSwitchDialog } from '@/components/account-switch-dialog';
import { DatabaseProvider } from '@/db/provider';
import { startAuth } from '@/lib/auth';
import { configureNotifications } from '@/lib/notifications';
import { useSupplementNotifications } from '@/lib/use-supplement-notifications';
import { useRestTimerAlarm } from '@/stores/use-rest-timer-alarm';
import { startSync } from '@/sync/manager';
import { useAppFonts } from '@/theme/use-app-fonts';
import { useApplyTheme } from '@/theme/use-apply-theme';

startAuth();
startSync();

void SplashScreen.preventAutoHideAsync();
configureNotifications();

/** 영양제 알림 맞추기 · 알림을 눌렀을 때 화면 열기. DB가 준비된 뒤에 돌아야 해서 DatabaseProvider 안에 둔다. */
function SupplementNotifications() {
  useSupplementNotifications();
  return null;
}

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
          <Stack.Screen name="supplement/[id]" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="food/[id]" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="diet-goal" options={{ animation: 'slide_from_bottom' }} />
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
        <AccountSwitchDialog />
        <SupplementNotifications />
      </DatabaseProvider>
    </GestureHandlerRootView>
  );
}
