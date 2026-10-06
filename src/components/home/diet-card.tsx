import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { BigMacro, SmallMacro } from '@/components/diet/macro';
import { useDietFormat } from '@/components/diet/use-diet-format';
import { useDietDay, useDietTargets, useHasDietLogs } from '@/db/use-diet';
import { dateKey } from '@/domain/date-key';

/**
 * 홈의 '오늘 식단' 카드: 칼로리 · 단백질을 크게, 탄수화물 · 지방은 작게.
 * 식단을 한 번이라도 적은 사람에게만 보인다. 누르면 식단 화면으로 간다.
 */
export function DietCard({ now }: { now: Date }) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const fmt = useDietFormat();
  const has = useHasDietLogs();
  const { total } = useDietDay(dateKey(now));
  const targets = useDietTargets();
  if (!has) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('diet.home.a11y', {
        kcal: fmt.int(total.kcal),
        protein: fmt.int(total.protein),
      })}
      onPress={() => router.navigate({ pathname: '/nutrition', params: { view: 'diet' } })}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.head}>
        <Text style={styles.title}>{t('diet.home.title')}</Text>
        <ChevronRight size={18} color={theme.colors.text2} strokeWidth={1.8} />
      </View>
      <View style={styles.row}>
        <BigMacro
          label={t('diet.kcal')}
          value={total.kcal}
          target={targets.kcal}
          unit="kcal"
          compact
        />
        <BigMacro
          label={t('diet.protein')}
          value={total.protein}
          target={targets.protein}
          unit="g"
          moreIsFine
          compact
        />
      </View>
      <View style={styles.row}>
        <SmallMacro label={t('diet.carb')} value={total.carb} target={targets.carb} />
        <SmallMacro label={t('diet.fat')} value={total.fat} target={targets.fat} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    gap: 12,
    padding: 16,
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
  row: { flexDirection: 'row', gap: 16 },
}));
