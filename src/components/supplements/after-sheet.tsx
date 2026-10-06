import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { BottomSheet, Button } from '@/components/ui';
import { AFTER_OPTIONS } from '@/domain/supplements';

import { useSupplementFormat } from './use-supplement-format';

type Props = {
  visible: boolean;
  /** 운동을 마치고 몇 분 뒤 */
  value: number;
  onChange: (afterMin: number) => void;
  onClose: () => void;
};

/** 운동을 마친 뒤 몇 분 후에 알릴지 고르기. 고르는 대로 반영하고 '완료'로 닫는다. */
export function AfterSheet({ visible, value, onChange, onClose }: Props) {
  const { t } = useTranslation();
  const fmt = useSupplementFormat();
  return (
    <BottomSheet
      visible={visible}
      title={t('supplements.afterSheet.title')}
      subtitle={t('supplements.afterSheet.sub')}
      closeLabel={t('common.close')}
      onClose={onClose}
    >
      <View style={styles.grid}>
        {AFTER_OPTIONS.map((min) => {
          const on = min === value;
          return (
            <Pressable
              key={min}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => onChange(min)}
              style={({ pressed }) => [
                styles.option,
                on && styles.optionOn,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.optionText, on && styles.optionTextOn]}>
                {min === 0 ? t('supplements.afterSheet.now') : fmt.duration(min)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Button label={t('supplements.afterSheet.done')} onPress={onClose} />
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
}));
