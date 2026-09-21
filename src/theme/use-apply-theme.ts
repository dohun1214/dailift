import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { UnistylesRuntime } from 'react-native-unistyles';

import { useSettings } from '@/stores/settings';

import { type Mode, resolveThemeName } from './tokens';

/** 설정(테마·포인트 색)이나 시스템 모드가 바뀌면 실제 테마를 바꾼다. 루트 레이아웃에서 한 번만 호출한다. */
export function useApplyTheme() {
  const scheme = useColorScheme();
  const preference = useSettings((s) => s.themePreference);
  const accent = useSettings((s) => s.accent);

  useEffect(() => {
    const systemMode: Mode = scheme === 'dark' ? 'dark' : 'light';
    const name = resolveThemeName(preference, accent, systemMode);
    if (UnistylesRuntime.themeName !== name) {
      UnistylesRuntime.setTheme(name);
    }
  }, [scheme, preference, accent]);
}
