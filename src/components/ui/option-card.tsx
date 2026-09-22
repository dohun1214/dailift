import { Check } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

type Props = {
  title: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
};

/** 여러 보기 중 하나를 고르는 카드 (시안: 온보딩 선택지) */
export function OptionCard({ title, subtitle, selected, onPress }: Props) {
  const { theme } = useUnistyles();
  styles.useVariants({ selected });
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      onPress={onPress}
      style={styles.card}
    >
      <View style={styles.texts}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.mark}>
        {selected ? <Check size={14} strokeWidth={2.6} color={theme.colors.onAccent} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
    padding: 18,
    borderRadius: theme.radius.lg,
    borderWidth: 2,
    backgroundColor: theme.colors.surface,
    variants: {
      selected: {
        true: { borderColor: theme.colors.accent },
        false: { borderColor: 'transparent' },
      },
    },
  },
  texts: { flex: 1, gap: 4 },
  title: {
    fontSize: 17,
    lineHeight: 22,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  mark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    variants: {
      selected: {
        true: { backgroundColor: theme.colors.accent },
        false: { borderWidth: 2, borderColor: theme.colors.line },
      },
    },
  },
}));
