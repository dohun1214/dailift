import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { TextButton } from '@/components/ui/text-button';

type Props = {
  /** 지금 입력 중인 칸 (예: "3세트 · 횟수") */
  label: string;
  /** 이 값을 따라 받는 세트 안내 (예: "2–3세트에도 적용") */
  note?: string;
  onNext: () => void;
  onDone: () => void;
};

/** 숫자 키보드 바로 위에 붙는 줄: 지금 칸 이름 · 다음 · 완료 */
export function KeyboardBar({ label, note, onNext, onDone }: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.bar}>
      <Text style={styles.label} numberOfLines={1}>
        {label}
        {note ? <Text style={styles.note}> · {note}</Text> : null}
      </Text>
      <TextButton label={t('workout.keyboard.next')} tone="muted" onPress={onNext} />
      <TextButton label={t('workout.keyboard.done')} onPress={onDone} />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  bar: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 16,
    paddingRight: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.line,
    backgroundColor: theme.colors.surface,
  },
  label: {
    flex: 1,
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.medium,
    color: theme.colors.text2,
  },
  note: { fontFamily: theme.fonts.semibold, color: theme.colors.text },
}));
