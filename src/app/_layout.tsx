import '@/i18n';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useUnistyles } from 'react-native-unistyles';

import { DatabaseProvider } from '@/db/provider';
import { useApplyTheme } from '@/theme/use-apply-theme';

export default function RootLayout() {
  useApplyTheme();
  const { theme } = useUnistyles();

  return (
    <DatabaseProvider>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.bg },
        }}
      />
    </DatabaseProvider>
  );
}
