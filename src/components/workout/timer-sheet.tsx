import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { BottomSheet, Button, Segmented } from '@/components/ui';
import { limitLabel } from '@/stores/cardio-timer';

/** 운동 중 타이머에서 고를 수 있는 시간(초) */
export const TIMER_OPTIONS = [30, 60, 90, 120, 180, 300, 600, 900] as const;

type Tab = 'timer' | 'stopwatch';

type Props = {
  visible: boolean;
  /** 지난번에 고른 타이머 시간(초) — 목록에 있으면 골라져 있다 */
  lastSec: number;
  onClose: () => void;
  onStartTimer: (seconds: number) => void;
  onStartStopwatch: () => void;
  /** '직접 정하기': 분 · 초를 넣는 창을 연다(이 창은 닫힌다) */
  onCustom: () => void;
};

/** 운동 중 위쪽 타이머 버튼을 누르면 뜨는 창: [타이머 | 스톱워치] */
export function TimerSheet({
  visible,
  lastSec,
  onClose,
  onStartTimer,
  onStartStopwatch,
  onCustom,
}: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('timer');
  const [picked, setPicked] = useState(lastSec);

  // 열 때마다 타이머 칸 · 지난번 시간으로 맞춘다.
  useEffect(() => {
    if (!visible) return;
    setTab('timer');
    setPicked((TIMER_OPTIONS as readonly number[]).includes(lastSec) ? lastSec : 120);
  }, [visible, lastSec]);

  const start = () => {
    onClose();
    if (tab === 'timer') onStartTimer(picked);
    else onStartStopwatch();
  };

  return (
    <BottomSheet
      visible={visible}
      title={t('workout.timer.title')}
      closeLabel={t('workout.menu.cancel')}
      onClose={onClose}
    >
      <Segmented
        options={[
          { value: 'timer', label: t('workout.timer.tabTimer') },
          { value: 'stopwatch', label: t('workout.timer.tabStopwatch') },
        ]}
        value={tab}
        onChange={setTab}
        accessibilityLabel={t('workout.timer.title')}
      />
      {tab === 'timer' ? (
        <View style={styles.grid}>
          {TIMER_OPTIONS.map((sec) => {
            const on = sec === picked;
            return (
              <Pressable
                key={sec}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => setPicked(sec)}
                style={({ pressed }) => [
                  styles.option,
                  on && styles.optionOn,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.optionText, on && styles.optionTextOn]}>
                  {limitLabel(sec)}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            accessibilityRole="button"
            onPress={onCustom}
            style={({ pressed }) => [styles.option, pressed && styles.pressed]}
          >
            <Text style={styles.optionText}>{t('workout.timer.custom')}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.clockCard}>
          <Text style={styles.clock}>0:00</Text>
          <Text style={styles.clockHint}>{t('workout.timer.stopwatchHint')}</Text>
        </View>
      )}
      <Text style={styles.note}>
        {t(tab === 'timer' ? 'workout.timer.timerNote' : 'workout.timer.stopwatchNote')}
      </Text>
      <Button
        label={
          tab === 'timer'
            ? t('workout.timer.startTimer', { time: limitLabel(picked) })
            : t('workout.timer.startStopwatch')
        }
        onPress={start}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create((theme) => ({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: {
    // 3칸: (100% - 간격 2개) / 3
    flexBasis: '30%',
    flexGrow: 1,
    height: 48,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  optionOn: { backgroundColor: theme.colors.accent },
  pressed: { opacity: 0.7 },
  optionText: {
    fontSize: 14,
    lineHeight: 18,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text,
  },
  optionTextOn: { color: theme.colors.onAccent },
  clockCard: {
    alignItems: 'center',
    gap: 4,
    paddingTop: 18,
    paddingBottom: 14,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
  },
  clock: {
    fontSize: 48,
    lineHeight: 56,
    includeFontPadding: false,
    fontFamily: theme.fonts.numBold,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text,
  },
  clockHint: {
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  note: {
    paddingHorizontal: 4,
    fontSize: 13,
    lineHeight: 19,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
}));
