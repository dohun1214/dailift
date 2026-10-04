import { Clock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { BottomSheet, Button } from '@/components/ui';

type Props = {
  visible: boolean;
  /** 운동 이름 */
  name: string;
  /** 언제 시작했는지 (예: "6일 전") */
  ago: string;
  completedSets: number;
  /** 마지막 기록 시각(기록이 없으면 시작 시각)을 읽기 좋게 */
  when: string;
  /** 마지막 기록 시각에 마치면 저장될 운동 시간(분) */
  minutes: number;
  onFinish: () => void;
  onResume: () => void;
  onDiscard: () => void;
  onClose: () => void;
};

/**
 * 오래 열려 있던 운동을 어떻게 할지 묻는 시트.
 * 기록한 세트가 있으면 마지막 기록 시각에 마칠 수 있고, 없으면 이어서 하거나 버린다.
 */
export function StaleWorkoutSheet({
  visible,
  name,
  ago,
  completedSets,
  when,
  minutes,
  onFinish,
  onResume,
  onDiscard,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const hasRecord = completedSets > 0;
  return (
    <BottomSheet
      visible={visible}
      title={t('workout.stale.title')}
      subtitle={
        hasRecord
          ? t('workout.stale.body', {
              ago,
              duration: t('workout.stale.minutes', { count: minutes }),
            })
          : t('workout.stale.bodyEmpty', { ago })
      }
      closeLabel={t('workout.stale.close')}
      onClose={onClose}
    >
      <View style={styles.info}>
        <View style={styles.icon}>
          <Clock size={18} color={theme.colors.text2} strokeWidth={1.8} />
        </View>
        <View style={styles.infoText}>
          <Text style={styles.infoTitle} numberOfLines={1}>
            {hasRecord ? t('workout.stale.info', { name, count: completedSets }) : name}
          </Text>
          <Text style={styles.infoSub} numberOfLines={1}>
            {t(hasRecord ? 'workout.stale.last' : 'workout.stale.started', { when })}
          </Text>
        </View>
      </View>
      <View style={styles.buttons}>
        {hasRecord ? <Button label={t('workout.stale.finish')} onPress={onFinish} /> : null}
        <Button
          label={t('workout.stale.resume')}
          variant={hasRecord ? 'secondary' : 'primary'}
          size={hasRecord ? 'md' : 'lg'}
          onPress={onResume}
        />
        <Pressable
          accessibilityRole="button"
          onPress={onDiscard}
          style={({ pressed }) => [styles.discard, pressed && styles.pressed]}
        >
          <Text style={styles.discardText}>{t('workout.stale.discard')}</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create((theme) => ({
  info: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
    paddingHorizontal: 16,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface2,
  },
  infoText: { flex: 1, gap: 2 },
  infoTitle: {
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  infoSub: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  buttons: { gap: 8 },
  discard: {
    height: 52,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  pressed: { opacity: 0.7 },
  discardText: {
    fontSize: 16,
    lineHeight: 21,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.danger,
  },
}));
