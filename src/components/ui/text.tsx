import { Text, type TextProps } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { fonts } from '@/theme/tokens';

export type TextVariant =
  | 'h1'
  | 'h2'
  | 'title'
  | 'subtitle'
  | 'body'
  | 'bodySm'
  | 'caption'
  | 'label';
export type TextTone = 'primary' | 'secondary' | 'accent' | 'danger' | 'warm' | 'onAccent';

type Props = TextProps & {
  variant?: TextVariant;
  tone?: TextTone;
  /** 숫자 폭을 고정한다 (타이머·무게처럼 값이 바뀌는 숫자) */
  numeric?: boolean;
};

const NUMERIC_FAMILY: Record<TextVariant, keyof typeof fonts> = {
  h1: 'numBold',
  h2: 'numBold',
  title: 'numBold',
  subtitle: 'numSemibold',
  body: 'numRegular',
  bodySm: 'numRegular',
  caption: 'numMedium',
  label: 'numSemibold',
};

export function AppText({
  variant = 'body',
  tone = 'primary',
  numeric = false,
  style,
  ...props
}: Props) {
  styles.useVariants({ variant, tone });
  return (
    <Text
      {...props}
      style={[
        styles.text,
        numeric && { fontFamily: fonts[NUMERIC_FAMILY[variant]], fontVariant: ['tabular-nums'] },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create((theme) => ({
  text: {
    variants: {
      variant: {
        h1: {
          fontSize: 26,
          includeFontPadding: false,
          fontFamily: theme.fonts.bold,
          letterSpacing: -0.26,
          lineHeight: 34,
        },
        h2: {
          fontSize: 22,
          includeFontPadding: false,
          fontFamily: theme.fonts.bold,
          lineHeight: 29,
        },
        title: {
          fontSize: 17,
          includeFontPadding: false,
          fontFamily: theme.fonts.bold,
          lineHeight: 23,
        },
        subtitle: {
          fontSize: 15,
          includeFontPadding: false,
          fontFamily: theme.fonts.semibold,
          lineHeight: 21,
        },
        body: {
          fontSize: 15,
          includeFontPadding: false,
          fontFamily: theme.fonts.regular,
          lineHeight: 22,
        },
        bodySm: {
          fontSize: 13,
          includeFontPadding: false,
          fontFamily: theme.fonts.regular,
          lineHeight: 19,
        },
        caption: {
          fontSize: 12,
          includeFontPadding: false,
          fontFamily: theme.fonts.medium,
          lineHeight: 16,
        },
        label: {
          fontSize: 13,
          includeFontPadding: false,
          fontFamily: theme.fonts.semibold,
          lineHeight: 18,
        },
      },
      tone: {
        primary: { color: theme.colors.text },
        secondary: { color: theme.colors.text2 },
        accent: { color: theme.colors.accentText },
        danger: { color: theme.colors.danger },
        warm: { color: theme.colors.warm },
        onAccent: { color: theme.colors.onAccent },
      },
    },
  },
}));
