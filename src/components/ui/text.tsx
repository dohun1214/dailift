import { Text, type TextProps } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

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

export function AppText({
  variant = 'body',
  tone = 'primary',
  numeric = false,
  style,
  ...props
}: Props) {
  styles.useVariants({ variant, tone });
  return <Text {...props} style={[styles.text, numeric && styles.numeric, style]} />;
}

const styles = StyleSheet.create((theme) => ({
  text: {
    variants: {
      variant: {
        h1: { fontSize: 26, fontWeight: '700', letterSpacing: -0.3, lineHeight: 34 },
        h2: { fontSize: 22, fontWeight: '700', lineHeight: 29 },
        title: { fontSize: 17, fontWeight: '700', lineHeight: 23 },
        subtitle: { fontSize: 15, fontWeight: '600', lineHeight: 21 },
        body: { fontSize: 15, fontWeight: '400', lineHeight: 22 },
        bodySm: { fontSize: 13, fontWeight: '400', lineHeight: 19 },
        caption: { fontSize: 12, fontWeight: '500', lineHeight: 16 },
        label: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
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
  numeric: { fontVariant: ['tabular-nums'] },
}));
