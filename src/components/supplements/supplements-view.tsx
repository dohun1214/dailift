import { router } from 'expo-router';
import { Check, ChevronRight, Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Badge, Button, Card, NoticeDialog } from '@/components/ui';
import { db } from '@/db/client';
import { canAddSupplement, setSupplementTaken } from '@/db/supplements';
import { useSupplements } from '@/db/use-supplements';
import { LIMITS } from '@/domain/supplements';
import { useToday } from '@/lib/use-today';

import { useSupplementFormat } from './use-supplement-format';

/** 영양 탭의 '영양제' 구간: 오늘 복용 체크, 지난 7일, 사용 안 하는 영양제 */
export function SupplementsView() {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const now = useToday();
  const fmt = useSupplementFormat();
  const { todayKey, active, inactive, done, total, week } = useSupplements(now);
  const [full, setFull] = useState(false);
  const dowFmt = useMemo(() => new Intl.DateTimeFormat(fmt.locale, { weekday: 'short' }), [fmt]);
  const dayFmt = useMemo(
    () => new Intl.DateTimeFormat(fmt.locale, { month: 'long', day: 'numeric', weekday: 'long' }),
    [fmt],
  );

  const add = () => {
    if (!canAddSupplement(db)) return setFull(true);
    router.push({ pathname: '/supplement/[id]', params: { id: 'new' } });
  };
  const edit = (id: string) => router.push({ pathname: '/supplement/[id]', params: { id } });

  const limit = (
    <NoticeDialog
      visible={full}
      title={t('supplements.limitTitle', { max: LIMITS.supplements })}
      body={t('supplements.limitBody')}
      okLabel={t('common.ok')}
      onClose={() => setFull(false)}
    />
  );

  if (active.length === 0 && inactive.length === 0) {
    return (
      <>
        <View style={styles.emptyCard}>
          <View style={styles.emptyText}>
            <Text style={styles.emptyTitle}>{t('supplements.emptyTitle')}</Text>
            <Text style={styles.emptyBody}>{t('supplements.emptyBody')}</Text>
          </View>
          <Button label={t('supplements.add')} size="sm" icon={Plus} onPress={add} />
        </View>
        <Text style={styles.disclaimer}>{t('supplements.disclaimer')}</Text>
        {limit}
      </>
    );
  }

  return (
    <>
      {total > 0 ? (
        <>
          <View style={styles.head}>
            <Text style={styles.headTitle} accessibilityRole="header">
              {t('supplements.today')}
            </Text>
            {done === total ? (
              <Badge label={t('supplements.allDone')} kind="solid" />
            ) : (
              <Text style={styles.progress}>{t('supplements.progress', { done, total })}</Text>
            )}
          </View>
          <View style={styles.list}>
            {active.map((s, i) => (
              <View key={s.id} style={[styles.row, i < active.length - 1 && styles.line]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${s.name}, ${fmt.line(s)}`}
                  accessibilityHint={t('supplements.rowHint')}
                  onPress={() => edit(s.id)}
                  style={({ pressed }) => [styles.rowBody, pressed && styles.pressed]}
                >
                  <Text style={styles.name} numberOfLines={1}>
                    {s.name}
                  </Text>
                  <Text style={styles.sub} numberOfLines={1}>
                    {fmt.line(s)}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityLabel={t('supplements.checkA11y', { name: s.name })}
                  accessibilityState={{ checked: s.taken }}
                  onPress={() => setSupplementTaken(db, s.id, todayKey, !s.taken)}
                  style={styles.checkHit}
                >
                  {s.taken ? (
                    <View style={[styles.check, styles.checkOn]}>
                      <Check size={16} color={theme.colors.onAccent} strokeWidth={2.6} />
                    </View>
                  ) : (
                    <View style={[styles.check, styles.checkOff]} />
                  )}
                </Pressable>
              </View>
            ))}
          </View>
          <Card>
            <View style={styles.weekHead}>
              <Text style={styles.weekTitle} accessibilityRole="header">
                {t('supplements.week')}
              </Text>
              <Text style={styles.weekNote}>
                {t('supplements.weekDone', { count: week.filter((d) => d.complete).length })}
              </Text>
            </View>
            <View style={styles.week}>
              {week.map((d) => (
                <View
                  key={d.date.getTime()}
                  style={styles.day}
                  accessible
                  accessibilityLabel={t('supplements.weekDayA11y', {
                    date: dayFmt.format(d.date),
                    count: d.count,
                  })}
                >
                  <Text style={styles.dow}>{dowFmt.format(d.date)}</Text>
                  <View style={[styles.dot, d.complete && styles.dotOn]}>
                    <Text
                      style={[
                        styles.dotText,
                        d.count === 0 && styles.dotZero,
                        d.complete && styles.dotTextOn,
                      ]}
                    >
                      {d.count}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </Card>
        </>
      ) : null}

      {inactive.length > 0 ? (
        <>
          <Text style={styles.section} accessibilityRole="header">
            {t('supplements.inactive')}
          </Text>
          <View style={styles.offList}>
            {inactive.map((s, i) => (
              <Pressable
                key={s.id}
                accessibilityRole="button"
                accessibilityLabel={`${s.name}, ${fmt.line(s)}`}
                accessibilityHint={t('supplements.rowHint')}
                onPress={() => edit(s.id)}
                style={({ pressed }) => [
                  styles.offRow,
                  i < inactive.length - 1 && styles.line,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.rowBody}>
                  <Text style={[styles.name, styles.nameOff]} numberOfLines={1}>
                    {s.name}
                  </Text>
                  <Text style={styles.sub} numberOfLines={1}>
                    {fmt.line(s)}
                  </Text>
                </View>
                <ChevronRight size={18} color={theme.colors.text2} strokeWidth={1.8} />
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      <Button
        label={t('supplements.add')}
        variant="secondary"
        size="md"
        icon={Plus}
        onPress={add}
      />
      <Text style={styles.disclaimer}>{t('supplements.disclaimer')}</Text>
      {limit}
    </>
  );
}

const styles = StyleSheet.create((theme) => ({
  head: { flexDirection: 'row', alignItems: 'center', paddingTop: 8, paddingHorizontal: 6 },
  headTitle: {
    flex: 1,
    fontSize: 16,
    lineHeight: 21,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  progress: {
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.numRegular,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text2,
  },
  list: {
    paddingVertical: 2,
    paddingLeft: 18,
    paddingRight: 12,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
  },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 10 },
  line: { borderBottomWidth: 1, borderBottomColor: theme.colors.line },
  rowBody: { flex: 1, gap: 2, justifyContent: 'center', alignSelf: 'stretch' },
  pressed: { opacity: 0.6 },
  name: {
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text,
  },
  nameOff: { color: theme.colors.text2 },
  sub: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  checkHit: {
    width: theme.hitSize,
    height: theme.hitSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: theme.colors.accent },
  checkOff: { borderWidth: 2, borderColor: theme.colors.text2 },
  weekHead: { flexDirection: 'row', alignItems: 'baseline' },
  weekTitle: {
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  weekNote: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  week: { flexDirection: 'row', gap: 4 },
  day: { flex: 1, alignItems: 'center', gap: 6 },
  dow: {
    fontSize: 11,
    lineHeight: 14,
    includeFontPadding: false,
    fontFamily: theme.fonts.medium,
    color: theme.colors.text2,
  },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface2,
  },
  dotOn: { backgroundColor: theme.colors.accent },
  dotText: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.numBold,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text,
  },
  dotZero: { color: theme.colors.text2 },
  dotTextOn: { color: theme.colors.onAccent },
  section: {
    paddingTop: 8,
    paddingHorizontal: 6,
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text2,
  },
  offList: {
    paddingVertical: 2,
    paddingLeft: 18,
    paddingRight: 16,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
  },
  offRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10 },
  disclaimer: {
    paddingHorizontal: 6,
    fontSize: 12,
    lineHeight: 19.2,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  emptyCard: {
    gap: 14,
    paddingTop: 20,
    paddingHorizontal: 18,
    paddingBottom: 18,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
  },
  emptyText: { gap: 4 },
  emptyTitle: {
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  emptyBody: {
    fontSize: 13,
    lineHeight: 19.5,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
}));
