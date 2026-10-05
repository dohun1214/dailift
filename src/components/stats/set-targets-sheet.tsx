import { Minus, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { BottomSheet, Button } from '@/components/ui';
import {
  MAX_SET_TARGET,
  MIN_SET_TARGET,
  recommendedSetTargets,
  resolveSetTargets,
  TARGET_GROUPS,
} from '@/domain/set-targets';
import { useProfile } from '@/stores/profile';
import { useSettings } from '@/stores/settings';

type Props = { visible: boolean; onClose: () => void };

/** 부위별 주간 목표 세트를 바꾸는 창. 바꾸는 즉시 저장된다 */
export function SetTargetsSheet({ visible, onClose }: Props) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const experience = useProfile((s) => s.experience);
  const custom = useSettings((s) => s.setTargets);
  const setTarget = useSettings((s) => s.setSetTarget);
  const reset = useSettings((s) => s.resetSetTargets);
  const recommended = recommendedSetTargets(experience);
  const targets = resolveSetTargets(experience, custom);
  const changed = TARGET_GROUPS.some((g) => targets[g] !== recommended[g]);

  return (
    <BottomSheet
      visible={visible}
      title={t('stats.targets.title')}
      subtitle={t('stats.targets.sub')}
      closeLabel={t('common.close')}
      onClose={onClose}
    >
      <View style={styles.card}>
        {TARGET_GROUPS.map((g, i) => {
          const name = t(`exercises.group.${g}`);
          const value = targets[g];
          return (
            <View key={g} style={[styles.row, i > 0 && styles.line]}>
              <View style={styles.body}>
                <Text style={styles.name}>{name}</Text>
                {value !== recommended[g] ? (
                  <Text style={styles.note}>
                    {t('stats.targets.recommended', { value: recommended[g] })}
                  </Text>
                ) : null}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('stats.targets.decA11y', { name })}
                disabled={value <= MIN_SET_TARGET}
                onPress={() => setTarget(g, value - 1)}
                style={({ pressed }) => [
                  styles.step,
                  pressed && styles.pressed,
                  value <= MIN_SET_TARGET && styles.disabled,
                ]}
              >
                <Minus size={18} color={theme.colors.text} strokeWidth={1.8} />
              </Pressable>
              <Text style={styles.value} accessibilityLabel={`${name} ${value}`}>
                {value}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('stats.targets.incA11y', { name })}
                disabled={value >= MAX_SET_TARGET}
                onPress={() => setTarget(g, value + 1)}
                style={({ pressed }) => [
                  styles.step,
                  pressed && styles.pressed,
                  value >= MAX_SET_TARGET && styles.disabled,
                ]}
              >
                <Plus size={18} color={theme.colors.text} strokeWidth={1.8} />
              </Pressable>
            </View>
          );
        })}
      </View>
      <View style={styles.actions}>
        <Button label={t('stats.targets.done')} onPress={onClose} />
        <Button
          label={t('stats.targets.reset')}
          variant="ghost"
          size="sm"
          disabled={!changed}
          onPress={reset}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    paddingVertical: 2,
    paddingLeft: 18,
    paddingRight: 14,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
  },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 8 },
  line: { borderTopWidth: 1, borderTopColor: theme.colors.line },
  body: { flex: 1, gap: 2 },
  name: {
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
  disabled: { opacity: 0.35 },
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
  actions: { gap: 4 },
}));
