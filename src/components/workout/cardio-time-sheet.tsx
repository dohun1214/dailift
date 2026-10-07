import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { BottomSheet, Button, TextField } from '@/components/ui';
import { clockToSec } from '@/domain/cardio';

type Props = {
  visible: boolean;
  /** 종목 이름 */
  name: string;
  /** 지금 적혀 있는 시간(초). 없으면 null */
  value: number | null;
  onClose: () => void;
  onSave: (durationSec: number) => void;
};

const digits = (text: string) => text.replace(/\D/g, '');
const toInt = (text: string) => (text === '' ? null : Number.parseInt(text, 10));

/** 유산소 시간을 직접 적거나 고치는 창: 분 · 초 */
export function CardioTimeSheet({ visible, name, value, onClose, onSave }: Props) {
  const { t } = useTranslation();
  const [min, setMin] = useState('');
  const [sec, setSec] = useState('');
  const [bad, setBad] = useState(false);

  // 열 때마다 지금 값으로 맞춘다.
  useEffect(() => {
    if (!visible) return;
    setMin(value && value >= 60 ? String(Math.floor(value / 60)) : '');
    setSec(value && value % 60 > 0 ? String(value % 60) : '');
    setBad(false);
  }, [visible, value]);

  const save = () => {
    const total = clockToSec(toInt(min), toInt(sec));
    if (total === null) return setBad(true);
    onSave(total);
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      title={t('cardio.timeSheet.title', { name })}
      subtitle={t('cardio.timeSheet.subtitle')}
      closeLabel={t('workout.menu.cancel')}
      onClose={onClose}
      avoidKeyboard
    >
      <View style={styles.row}>
        <TextField
          label={t('cardio.timeSheet.minutes')}
          unit={t('cardio.timeSheet.minUnit')}
          value={min}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={4}
          autoFocus
          selectTextOnFocus
          autoComplete="off"
          importantForAutofill="no"
          invalid={bad}
          onChangeText={(v) => {
            setBad(false);
            setMin(digits(v));
          }}
        />
        <TextField
          label={t('cardio.timeSheet.seconds')}
          unit={t('cardio.timeSheet.secUnit')}
          value={sec}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={2}
          selectTextOnFocus
          autoComplete="off"
          importantForAutofill="no"
          invalid={bad}
          error={bad ? t('cardio.timeSheet.invalid') : undefined}
          onChangeText={(v) => {
            setBad(false);
            setSec(digits(v));
          }}
        />
      </View>
      <Button label={t('cardio.timeSheet.save')} onPress={save} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create((theme) => ({
  // 입력칸이 창 바탕과 같은 색이라 카드 위에 올린다.
  row: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
  },
}));
