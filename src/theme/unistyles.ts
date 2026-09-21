import { StyleSheet } from 'react-native-unistyles';

import { type AppTheme, type ThemeName, themes } from './tokens';

type AppThemes = Record<ThemeName, AppTheme>;

declare module 'react-native-unistyles' {
  export interface UnistylesThemes extends AppThemes {}
}

StyleSheet.configure({
  themes,
  settings: {
    // 시스템 모드 + 사용자가 고른 포인트 색을 직접 조합하므로 자동 전환은 끈다. (useApplyTheme 참고)
    adaptiveThemes: false,
    initialTheme: 'mono-light',
  },
});
