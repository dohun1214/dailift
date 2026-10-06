import { Minus, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { BottomSheet, Button, Segmented } from '@/components/ui';
import { joinTime, splitTime, TIME_STEP_MIN } from '@/domain/supplements';

import { useSupplementFormat } from './use-supplement-format';

type Props = {
  visible: boolean;
  /** 자정부터 몇 분째 */
  value: number;
  onChange: (timeMin: number) => void;
  onClose: () => void;
};

/** 복용 시각 고르기: 오전/오후 · 시 · 분(5분 단위). 바꾸는 대로 반영하고 '완료'로 닫는다. */
export function TimeSheet({ visible, value, onChange, onClose }: Props) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const fmt = useSupplementFormat();
  const { pm, hour12, minute } = splitTime(value);
  const [, clock = ''] = /(\d{1,2}:\d{2})/.exec(fmt.clock(value)) ?? [];

  const setHour = (delta: number) => {
    const next = ((hour12 - 1 + delta + 12) % 12) + 1;
    onChange(joinTime(pm, next, minute));
  };
  const setMinute = (delta: number) => {
    onChange(joinTime(pm, hour12, (minute + delta * TIME_STEP_MIN + 60) % 60));
  };

  const row = (label: string, shown: string, step: (delta: number) => void, note?: string) => (
    <View style={styles.row}>
      <View style={styles.rowBody}>
        <Text style={styles.label}>{label}</Text>
        {note ? <Text style={styles.note}>{note}</Text> : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('supplements.timeSheet.dec', { label })}
        onPress={() => step(-1)}
        style={({ pressed }) => [styles.step, pressed && styles.pressed]}
      >
        <Minus size={18} color={theme.colors.text} strokeWidth={1.8} />
      </Pressable>
      <Text style={styles.value} accessibilityLabel={`${label} ${shown}`}>
        {shown}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('supplements.timeSheet.inc', { label })}
        onPress={() => step(1)}
        style={({ pressed }) => [styles.step, pressed && styles.pressed]}
      >
        <Plus size={18} color={theme.colors.text} strokeWidth={1.8} />
      </Pressable>
    </View>
  );

  return (
    <BottomSheet
      visible={visible}
      title={t('supplements.timeSheet.title')}
      closeLabel={t('common.close')}
      onClose={onClose}
    >
      <View style={styles.big} accessible accessibilityLabel={fmt.clock(value)}>
        <Text style={styles.ampm}>{t(`supplements.timeSheet.${pm ? 'pm' : 'am'}`)}</Text>
        <Text style={styles.clock}>{clock}</Text>
      </View>
      <Segmented
        accessibilityLabel={t('supplements.timeSheet.ampmA11y')}
        options={[
          { value: 'am', label: t('supplements.timeSheet.am') },
          { value: 'pm', label: t('supplements.timeSheet.pm') },
        ]}
        value={pm ? 'pm' : 'am'}
        onChange={(v) => onChange(joinTime(v === 'pm', hour12, minute))}
      />
      <View style={styles.card}>
        {row(t('supplements.timeSheet.hour'), String(hour12), setHour)}
        <View style={styles.line} />
        {row(
          t('supplements.timeSheet.minute'),
          String(minute).padStart(2, '0'),
          setMinute,
          t('supplements.timeSheet.minuteNote'),
        )}
      </View>
      <Button label={t('supplements.timeSheet.done')} onPress={onClose} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create((theme) => ({
  big: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  ampm: {
    fontSize: 16,
    lineHeight: 21,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text2,
  },
  clock: {
    fontSize: 40,
    lineHeight: 48,
    letterSpacing: -0.4,
    includeFontPadding: false,
    fontFamily: theme.fonts.numBold,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text,
  },
  card: {
    paddingVertical: 2,
    paddingLeft: 18,
    paddingRight: 14,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
  },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 8 },
  line: { height: 1, backgroundColor: theme.colors.line },
  rowBody: { flex: 1, gap: 2 },
  label: {
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text,
  },
  note: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  step: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface2,
  },
  pressed: { opacity: 0.7 },
  value: {
    width: 44,
    textAlign: 'center',
    fontSize: 18,
    lineHeight: 24,
    includeFontPadding: false,
    fontFamily: theme.fonts.numBold,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text,
  },
}));
