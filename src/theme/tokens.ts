/**
 * 디자인 토큰. 시안의 색 값을 그대로 옮긴 것으로, 화면 코드에서는 색을 직접 쓰지 않고 이 토큰만 참조한다.
 * 의미색: warm = 워밍업·밸런스 이탈(주황), pr = PR 배지(빨강), prefill = 자동 프리필 값(회색).
 */

export type Mode = 'light' | 'dark';
export type Accent = 'mono' | 'blue' | 'lime';

const base = {
  light: {
    bg: '#FFFFFF',
    surface: '#F4F5F7',
    surface2: '#FFFFFF',
    line: '#E4E6EA',
    text: '#15171A',
    text2: '#5C626B',
    prefill: '#70767F',
    warm: '#B4560A',
    warmSoft: '#FCE9D6',
    warmFill: '#E8872B',
    pr: '#D92D20',
    onPr: '#FFFFFF',
    track: '#E6E8EC',
    danger: '#C5281C',
  },
  dark: {
    bg: '#0F1012',
    surface: '#1A1C20',
    surface2: '#262930',
    line: '#2C2F36',
    text: '#F2F3F5',
    text2: '#A2A7B0',
    prefill: '#858A93',
    warm: '#F2994A',
    warmSoft: '#3A2A1C',
    warmFill: '#F2994A',
    pr: '#FF5A52',
    onPr: '#1A0504',
    track: '#2C2F36',
    danger: '#FF6B63',
  },
} as const;

type AccentColors = {
  accent: string;
  onAccent: string;
  accentText: string;
  accentSoft: string;
  band: string;
  /** 차트·매크로 구분색 3개 (1: 체중·단백질, 2: 골격근량·탄수화물, 3: 체지방률·지방) */
  data: readonly [string, string, string];
  /** 모노 테마는 색 대신 선 종류로 구분한다. */
  dash: readonly [readonly number[], readonly number[], readonly number[]];
};

const SOLID = [[], [], []] as const;

const accents: Record<Accent, Record<Mode, AccentColors>> = {
  mono: {
    light: {
      accent: '#15171A',
      onAccent: '#FFFFFF',
      accentText: '#15171A',
      accentSoft: '#E6E8EC',
      band: '#CDD1D7',
      data: ['#15171A', '#15171A', '#15171A'],
      dash: [[], [6, 5], [2, 5]],
    },
    dark: {
      accent: '#F2F3F5',
      onAccent: '#0F1012',
      accentText: '#F2F3F5',
      accentSoft: '#2C2F36',
      band: '#454A53',
      data: ['#F2F3F5', '#F2F3F5', '#F2F3F5'],
      dash: [[], [6, 5], [2, 5]],
    },
  },
  blue: {
    light: {
      accent: '#2B63F0',
      onAccent: '#FFFFFF',
      accentText: '#2457D6',
      accentSoft: '#E6EEFF',
      band: '#C9DAFF',
      data: ['#2B63F0', '#0E9C9C', '#8B5CF6'],
      dash: SOLID,
    },
    dark: {
      accent: '#7AA5FF',
      onAccent: '#081A40',
      accentText: '#8FB3FF',
      accentSoft: '#1A2744',
      band: '#2A3D6B',
      data: ['#7AA5FF', '#4FD1C5', '#B79CFF'],
      dash: SOLID,
    },
  },
  lime: {
    light: {
      accent: '#D3F253',
      onAccent: '#15171A',
      accentText: '#15171A',
      accentSoft: '#F0FAC8',
      band: '#E3F4A0',
      data: ['#6F8F00', '#0E9C9C', '#8B5CF6'],
      dash: SOLID,
    },
    dark: {
      accent: '#D3F253',
      onAccent: '#10130A',
      accentText: '#D3F253',
      accentSoft: '#2A3016',
      band: '#424B22',
      data: ['#D3F253', '#4FD1C5', '#B79CFF'],
      dash: SOLID,
    },
  },
};

export const radius = { sm: 10, md: 14, lg: 20, xl: 24, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;
export const fontSize = { caption: 12, body: 15, title: 17, h2: 22, h1: 26 } as const;
/**
 * 서체. 시안은 Onest(라틴) + IBM Plex Sans KR(한글)인데 RN은 두 사용자 서체를 섞어 쓰지 못한다.
 * 그래서 글은 IBM Plex Sans KR(라틴 글리프 포함), 숫자와 워드마크는 Onest를 쓴다.
 * 사용자 서체는 fontWeight 대신 굵기별 fontFamily로 지정해야 한다(안드로이드 가짜 볼드 방지).
 */
export const fonts = {
  regular: 'IBMPlexSansKR_400Regular',
  medium: 'IBMPlexSansKR_500Medium',
  semibold: 'IBMPlexSansKR_600SemiBold',
  bold: 'IBMPlexSansKR_700Bold',
  numRegular: 'Onest_400Regular',
  numMedium: 'Onest_500Medium',
  numSemibold: 'Onest_600SemiBold',
  numBold: 'Onest_700Bold',
} as const;

/** 터치 영역 최소 크기 */
export const hitSize = 44;

function makeTheme(accent: Accent, mode: Mode) {
  return {
    mode,
    accentName: accent,
    colors: { ...base[mode], ...accents[accent][mode] },
    radius,
    space,
    fontSize,
    fonts,
    hitSize,
  };
}

export type AppTheme = ReturnType<typeof makeTheme>;
export type ThemeName = `${Accent}-${Mode}`;

export const ACCENTS: readonly Accent[] = ['mono', 'blue', 'lime'];
export const MODES: readonly Mode[] = ['light', 'dark'];

export const themes = Object.fromEntries(
  ACCENTS.flatMap((a) => MODES.map((m) => [`${a}-${m}`, makeTheme(a, m)] as const)),
) as Record<ThemeName, AppTheme>;

export type ThemePreference = 'system' | Mode;

/** 설정값(테마·포인트 색)과 시스템 모드로 실제 테마 이름을 정한다. */
export function resolveThemeName(
  preference: ThemePreference,
  accent: Accent,
  systemMode: Mode | null | undefined,
): ThemeName {
  const mode: Mode = preference === 'system' ? (systemMode ?? 'light') : preference;
  return `${accent}-${mode}`;
}
