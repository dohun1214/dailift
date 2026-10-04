import { ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

type Props = {
  /** 부위 이름과 이번 주 세트 수 (보여 줄 순서대로) */
  rows: readonly { name: string; value: number }[];
  onPress: () => void;
};

/** 홈의 '이번 주 부위별 세트' 카드. 가장 많은 부위를 꽉 찬 막대로 삼는다. 누르면 통계로 간다. */
export function MuscleSetsCard({ rows, onPress }: Props) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const top = Math.max(1, ...rows.map((r) => r.value));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('home.muscleA11y')}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.head}>
        <Text style={styles.title}>{t('home.muscleTitle')}</Text>
        <Text style={styles.link}>{t('home.muscleLink')}</Text>
        <ChevronRight size={18} color={theme.colors.text2} strokeWidth={1.8} />
      </View>
      <View style={styles.rows}>
        {rows.map((r) => {
          const shown = Number.isInteger(r.value) ? String(r.value) : r.value.toFixed(1);
          return (
            <View
              key={r.name}
              style={styles.row}
              accessible
              accessibilityLabel={t('home.muscleRowA11y', { name: r.name, value: shown })}
            >
              <Text style={[styles.name, r.value === 0 && styles.muted]} numberOfLines={1}>
                {r.name}
              </Text>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${(r.value / top) * 100}%` }]} />
              </View>
              <Text style={[styles.value, r.value === 0 && styles.muted]}>{shown}</Text>
            </View>
          );
        })}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    gap: 14,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 18,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
  },
  pressed: { opacity: 0.7 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  link: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  rows: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: {
    width: 34,
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text,
  },
  muted: { color: theme.colors.text2 },
  track: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: theme.colors.track,
  },
  fill: { height: 8, borderRadius: 4, backgroundColor: theme.colors.accent },
  value: {
    width: 28,
    textAlign: 'right',
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.numSemibold,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text,
  },
}));
