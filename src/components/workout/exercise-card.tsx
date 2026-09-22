import { ChevronDown, Plus } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { ExerciseType } from '@/db/schema';

type CardProps = {
  position: string;
  name: string;
  type: ExerciseType;
  suggestion: ReactNode;
  children: ReactNode;
  onAddSet: () => void;
  /** 종목 이름을 누르면 종목 상세로 */
  onNamePress?: () => void;
};

/** 지금 하는 종목 카드: 위치·부위 / 이름 / 증량 제안 / 컬럼 헤더 / 세트 행들 / 세트 추가 */
export function ActiveExerciseCard({
  position,
  name,
  type,
  suggestion,
  children,
  onAddSet,
  onNamePress,
}: CardProps) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Pressable
          style={styles.headText}
          disabled={!onNamePress}
          onPress={onNamePress}
          accessibilityRole={onNamePress ? 'link' : 'header'}
          accessibilityLabel={`${position}, ${name}`}
        >
          <Text style={styles.position}>{position}</Text>
          <Text style={styles.name}>{name}</Text>
        </Pressable>
      </View>
      {suggestion}
      <View style={styles.columns} importantForAccessibility="no-hide-descendants">
        <Text style={[styles.col, styles.colSet]}>{t('workout.colSet')}</Text>
        {type === 'time' ? (
          <Text style={[styles.col, styles.colFlex]}>{t('workout.colTime')}</Text>
        ) : (
          <>
            <Text style={[styles.col, styles.colFlex]}>
              {type === 'bodyweight_reps' ? t('workout.colAdded') : t('workout.colWeight')}
            </Text>
            <Text style={[styles.col, styles.colFlex]}>{t('workout.colReps')}</Text>
          </>
        )}
        <View style={styles.colCheck} />
      </View>
      {children}
      <Pressable
        accessibilityRole="button"
        onPress={onAddSet}
        style={({ pressed }) => [styles.addSet, pressed && styles.pressed]}
      >
        <Plus size={18} color={theme.colors.text} strokeWidth={1.8} />
        <Text style={styles.addSetText}>{t('workout.addSet')}</Text>
      </Pressable>
    </View>
  );
}

type CollapsedProps = { name: string; meta: string; onPress: () => void };

/** 접힌 종목 카드 */
export function CollapsedExerciseCard({ name, meta, onPress }: CollapsedProps) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${meta}`}
      accessibilityHint={t('workout.expandA11y', { name })}
      onPress={onPress}
      style={({ pressed }) => [styles.collapsed, pressed && styles.pressed]}
    >
      <View style={styles.collapsedBody}>
        <Text style={styles.collapsedName} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.collapsedMeta} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      <ChevronDown size={20} color={theme.colors.text2} strokeWidth={1.8} />
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    gap: 8,
    paddingTop: 18,
    paddingRight: 12,
    paddingBottom: 8,
    paddingLeft: 16,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 4 },
  headText: { flex: 1, gap: 2 },
  position: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.medium,
    color: theme.colors.text2,
  },
  name: {
    fontSize: 24,
    lineHeight: 31,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  columns: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  col: {
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 14,
    includeFontPadding: false,
    fontFamily: theme.fonts.medium,
    color: theme.colors.text2,
  },
  colSet: { width: 30 },
  colFlex: { flex: 1 },
  colCheck: { width: 44 },
  addSet: {
    height: 44,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addSetText: {
    fontSize: 14,
    lineHeight: 18,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  pressed: { opacity: 0.7 },
  collapsed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
  },
  collapsedBody: { flex: 1, gap: 2 },
  collapsedName: {
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text,
  },
  collapsedMeta: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
}));
