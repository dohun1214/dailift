import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { useSupplements } from '@/db/use-supplements';

/** 홈의 '오늘 영양제' 한 줄. 사용 중인 영양제가 있을 때만 보인다. 누르면 영양제 화면으로 간다. */
export function SupplementCard({ now }: { now: Date }) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const { active, done, total } = useSupplements(now);
  if (total === 0) return null;
  const left = active.filter((s) => !s.taken).map((s) => s.name);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('supplements.home.a11y', { done, total })}
      onPress={() => router.navigate({ pathname: '/nutrition', params: { view: 'supplements' } })}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.body}>
        <Text style={styles.title}>{t('supplements.home.title')}</Text>
        <Text style={styles.sub} numberOfLines={1}>
          {left.length === 0
            ? t('supplements.home.allDone')
            : t('supplements.home.left', { names: left.join(', ') })}
        </Text>
      </View>
      <Text style={styles.count}>
        {done}
        <Text style={styles.total}> / {total}</Text>
      </Text>
      <ChevronRight size={18} color={theme.colors.text2} strokeWidth={1.8} />
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
  },
  pressed: { opacity: 0.7 },
  body: { flex: 1, gap: 2 },
  title: {
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  sub: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  count: {
    fontSize: 17,
    lineHeight: 22,
    includeFontPadding: false,
    fontFamily: theme.fonts.numBold,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text,
  },
  total: { fontSize: 13, fontFamily: theme.fonts.numMedium, color: theme.colors.text2 },
}));
