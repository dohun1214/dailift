import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { HistoryRow } from '@/components/history/history-row';
import { ActionSheet, Screen, Segmented } from '@/components/ui';
import { db } from '@/db/client';
import { deleteWorkout } from '@/db/history';
import { useHistory } from '@/db/use-history';
import type { HistoryItem } from '@/domain/history';
import { useAppLanguage } from '@/i18n/use-app-language';
import { removePhotoFile } from '@/lib/photos';
import { useSettings } from '@/stores/settings';

type View_ = 'history' | 'stats';

/** 기록 탭: 히스토리 | 통계 세그먼트. 통계는 #10에서 채운다. */
export default function LogScreen() {
  const { t } = useTranslation();
  const lang = useAppLanguage();
  const unit = useSettings((s) => s.weightUnit);
  const [view, setView] = useState<View_>('history');
  const { months, ready } = useHistory(unit);
  const [selected, setSelected] = useState<HistoryItem | null>(null);
  const locale = lang === 'ko' ? 'ko-KR' : 'en-US';
  const monthFmt = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' });
  const dowFmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  const dateFmt = new Intl.DateTimeFormat(locale, {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  const meta = (i: HistoryItem) =>
    t('history.meta', {
      minutes: i.minutes,
      sets: i.sets,
      volume: `${i.volume.toLocaleString(locale)}${unit}`,
    });

  const confirmDelete = (item: HistoryItem) =>
    Alert.alert(t('history.deleteTitle'), t('history.deleteBody'), [
      { text: t('history.actions.cancel'), style: 'cancel' },
      {
        text: t('history.deleteConfirm'),
        style: 'destructive',
        onPress: () => {
          for (const path of deleteWorkout(db, item.id)) removePhotoFile(path);
        },
      },
    ]);

  return (
    <Screen inTabs>
      <Segmented
        accessibilityLabel={t('history.segA11y')}
        options={[
          { value: 'history', label: t('history.segHistory') },
          { value: 'stats', label: t('history.segStats') },
        ]}
        value={view}
        onChange={setView}
      />

      {view === 'stats' ? <Text style={styles.empty}>{t('history.statsSoon')}</Text> : null}

      {view === 'history' && ready && months.length === 0 ? (
        <Text style={styles.empty}>{t('history.empty')}</Text>
      ) : null}

      {view === 'history'
        ? months.map((m) => (
            <View key={m.key} style={styles.month}>
              <View style={styles.monthHead}>
                <Text style={styles.monthTitle} accessibilityRole="header">
                  {monthFmt.format(new Date(m.year, m.month - 1, 1))}
                </Text>
                <Text style={styles.monthCount}>
                  {t('history.count', { count: m.items.length })}
                </Text>
              </View>
              {m.items.map((item) => {
                const d = new Date(item.startedAt);
                const line = meta(item);
                return (
                  <HistoryRow
                    key={item.id}
                    weekday={dowFmt.format(d)}
                    day={d.getDate()}
                    name={item.name}
                    meta={line}
                    pr={
                      item.prCount > 0 ? t('history.prBadge', { count: item.prCount }) : undefined
                    }
                    a11yLabel={t('history.rowA11y', {
                      date: dateFmt.format(d),
                      name: item.name,
                      meta: line,
                    })}
                    a11yHint={t('history.rowHint')}
                    onPress={() =>
                      router.push({ pathname: '/workout-summary/[id]', params: { id: item.id } })
                    }
                    onLongPress={() => setSelected(item)}
                  />
                );
              })}
            </View>
          ))
        : null}

      <ActionSheet
        visible={selected !== null}
        title={
          selected
            ? `${selected.name} · ${dateFmt.format(new Date(selected.startedAt))}`
            : undefined
        }
        cancelLabel={t('history.actions.cancel')}
        onClose={() => setSelected(null)}
        actions={
          selected
            ? [
                {
                  label: t('history.actions.edit'),
                  onPress: () =>
                    router.push({ pathname: '/workout-edit/[id]', params: { id: selected.id } }),
                },
                {
                  label: t('history.actions.delete'),
                  destructive: true,
                  onPress: () => confirmDelete(selected),
                },
              ]
            : []
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  month: { gap: 10 },
  monthHead: { flexDirection: 'row', alignItems: 'center', paddingTop: 8, paddingHorizontal: 6 },
  monthTitle: {
    flex: 1,
    fontSize: 16,
    lineHeight: 21,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  monthCount: {
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  empty: {
    paddingHorizontal: 6,
    paddingTop: 8,
    fontSize: 14,
    lineHeight: 21,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
}));
