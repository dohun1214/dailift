import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

type Props = {
  label: string;
  /** soft: 옅은 포인트색, solid: 포인트색, pr: PR 빨강 */
  kind?: 'soft' | 'solid' | 'pr';
};

export function Badge({ label, kind = 'soft' }: Props) {
  styles.useVariants({ kind });
  return (
    <View style={styles.badge}>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: theme.radius.pill,
    variants: {
      kind: {
        soft: { backgroundColor: theme.colors.accentSoft },
        solid: { backgroundColor: theme.colors.accent },
        pr: { backgroundColor: theme.colors.pr },
      },
    },
  },
  label: {
    fontSize: 11,
    lineHeight: 14,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    variants: {
      kind: {
        soft: { color: theme.colors.accentText },
        solid: { color: theme.colors.onAccent },
        pr: { color: theme.colors.onPr },
      },
    },
  },
}));
