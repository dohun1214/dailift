import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { BottomSheet, Button, Toggle } from '@/components/ui';
import { REST_OPTIONS } from '@/domain/rest-timer';

type Props = {
  visible: boolean;
  /** 종목 이름 */
  name: string;
  /** 지금 휴식 시간(초) */
  value: number;
  /** 운동을 시작한 루틴 이름. 없으면(빈 운동) '루틴에도 저장'을 숨긴다 */
  routineName: string | null;
  formatDuration: (sec: number) => string;
  onClose: () => void;
  onSave: (restSec: number, saveToRoutine: boolean) => void;
};

/** 종목별 휴식 시간 고르기 */
export function RestSheet({
  visible,
  name,
  value,
  routineName,
  formatDuration,
  onClose,
  onSave,
}: Props) {
  const { t } = useTranslation();
  const [picked, setPicked] = useState(value);
  const [toRoutine, setToRoutine] = useState(true);

  // 열 때마다 지금 값으로 맞춘다.
  useEffect(() => {
    if (visible) {
      setPicked(value);
      setToRoutine(true);
    }
  }, [visible, value]);

  return (
    <BottomSheet
      visible={visible}
      title={t('workout.restSheet.title', { name })}
      subtitle={t('workout.restSheet.subtitle')}
      closeLabel={t('workout.menu.cancel')}
      onClose={onClose}
    >
      <View style={styles.grid}>
        {REST_OPTIONS.map((sec) => {
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
                {formatDuration(sec)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {routineName ? (
        <View style={styles.routine}>
          <View style={styles.routineText}>
            <Text style={styles.routineTitle}>{t('workout.restSheet.saveToRoutine')}</Text>
            <Text style={styles.routineSub}>
              {t('workout.restSheet.saveToRoutineSub', { name: routineName })}
            </Text>
          </View>
          <Toggle
            value={toRoutine}
            onValueChange={setToRoutine}
            accessibilityLabel={t('workout.restSheet.saveToRoutine')}
          />
        </View>
      ) : null}
      <Button
        label={t('workout.restSheet.done')}
        onPress={() => {
          onSave(picked, !!routineName && toRoutine);
          onClose();
        }}
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
  routine: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingLeft: 18,
    paddingRight: 12,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
  },
  routineText: { flex: 1, gap: 2 },
  routineTitle: {
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text,
  },
  routineSub: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
}));
