import { Check, ChevronsDown } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { TextButton } from '@/components/ui/text-button';

type Props = {
  /** 지금 입력 중인 칸 (예: "3세트 · 횟수") */
  label: string;
  /** 있으면 '남은 세트에도 적용' 버튼을 보인다 (아래 세트와 값이 다를 때) */
  onApply?: () => void;
  /** 방금 적용했다는 안내 (예: "2–3세트에 적용했어요") */
  applied?: string;
  onNext: () => void;
  onDone: () => void;
};

/** 줄의 높이(styles.bar와 같아야 한다) */
export const KEYBOARD_BAR_HEIGHT = 48;

/** 숫자 키보드 바로 위에 붙는 줄: 지금 칸 이름 · 남은 세트에도 적용 · 다음 · 완료 */
export function KeyboardBar({ label, onApply, applied, onNext, onDone }: Props) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  // 키보드보다 조금 먼저 제자리에 나타나므로 살짝 떠오르듯 보인다.
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
  }, [opacity]);
  return (
    <Animated.View style={[styles.bar, { opacity }]}>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.middle}>
        {onApply ? (
          <Pressable
            accessibilityRole="button"
            onPress={onApply}
            hitSlop={6}
            style={({ pressed }) => [styles.apply, pressed && styles.pressed]}
          >
            <ChevronsDown size={16} color={theme.colors.onAccent} strokeWidth={2.2} />
            <Text style={styles.applyText} numberOfLines={1}>
              {t('workout.keyboard.apply')}
            </Text>
          </Pressable>
        ) : applied ? (
          <View style={styles.applied} accessibilityLiveRegion="polite">
            <Check size={15} color={theme.colors.text} strokeWidth={2.4} />
            <Text style={styles.appliedText} numberOfLines={1}>
              {applied}
            </Text>
          </View>
        ) : null}
      </View>
      <TextButton label={t('workout.keyboard.next')} tone="muted" onPress={onNext} />
      <TextButton label={t('workout.keyboard.done')} onPress={onDone} />
    </Animated.View>
  );
}

const styles = StyleSheet.create((theme) => ({
  bar: {
    height: KEYBOARD_BAR_HEIGHT,
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
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.medium,
    color: theme.colors.text2,
  },
  middle: { flex: 1, minWidth: 0, flexDirection: 'row', paddingLeft: 8 },
  apply: {
    flexShrink: 1,
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 10,
    paddingRight: 12,
    borderRadius: 12,
    backgroundColor: theme.colors.accent,
  },
  pressed: { opacity: 0.8 },
  applyText: {
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.onAccent,
  },
  applied: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  appliedText: {
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text,
  },
}));
