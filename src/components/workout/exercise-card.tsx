import { ChevronDown, ChevronUp, Disc, Ellipsis, Plus, Timer } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { IconButton } from '@/components/ui/icon-button';
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
  /** 바벨 종목이면 원판 계산기 버튼 */
  onPlatesPress?: () => void;
  /** 무게 컬럼 제목을 바꿀 때 (덤벨 한 손/합계) */
  weightColumn?: string;
  /** 지금 하는 종목이 아닌데 펼쳐 둔 카드면 접기 버튼 */
  onCollapse?: () => void;
  /** 종목별 휴식 시간 칩 (예: "휴식 1분 30초"). 누르면 시간을 고른다 */
  restLabel?: string;
  onRestPress?: () => void;
  /** 카드의 빈 곳(이름 포함)을 꾹 누르면 종목 편집(순서 · 삭제) */
  onLongPress?: () => void;
  /** ⋯ 버튼: 이 종목을 다른 종목으로 변경 · 빼기 */
  onMenuPress?: () => void;
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
  onPlatesPress,
  weightColumn,
  onCollapse,
  restLabel,
  onRestPress,
  onLongPress,
  onMenuPress,
}: CardProps) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  return (
    // 입력칸 · 버튼이 아닌 빈 곳을 꾹 눌러도 종목 편집으로 간다(자식의 누르기가 먼저다).
    <Pressable
      style={styles.card}
      accessible={false}
      disabled={!onLongPress}
      onLongPress={onLongPress}
      delayLongPress={350}
    >
      <View style={styles.head}>
        <Pressable
          style={styles.headText}
          disabled={!onNamePress && !onLongPress}
          onPress={onNamePress}
          onLongPress={onLongPress}
          delayLongPress={350}
          accessibilityRole={onNamePress ? 'link' : 'header'}
          accessibilityLabel={`${position}, ${name}`}
        >
          <Text style={styles.position}>{position}</Text>
          <Text style={styles.name}>{name}</Text>
        </Pressable>
        {onPlatesPress ? (
          <IconButton
            icon={Disc}
            tone="raised"
            label={t('workout.plates')}
            onPress={onPlatesPress}
          />
        ) : null}
        {onMenuPress ? (
          <IconButton
            icon={Ellipsis}
            tone="raised"
            label={t('workout.menu.exerciseA11y', { name })}
            onPress={onMenuPress}
          />
        ) : null}
        {onCollapse ? (
          <IconButton
            icon={ChevronUp}
            tone="raised"
            label={t('workout.collapseCard', { name })}
            onPress={onCollapse}
          />
        ) : null}
      </View>
      {suggestion}
      {restLabel ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={restLabel}
          accessibilityHint={t('workout.restSheet.hint')}
          disabled={!onRestPress}
          onPress={onRestPress}
          style={({ pressed }) => [styles.rest, pressed && styles.pressed]}
        >
          <Timer size={16} color={theme.colors.text2} strokeWidth={1.8} />
          <Text style={styles.restText}>{restLabel}</Text>
          <ChevronDown size={14} color={theme.colors.text2} strokeWidth={1.8} />
        </Pressable>
      ) : null}
      <View style={styles.columns} importantForAccessibility="no-hide-descendants">
        <Text style={[styles.col, styles.colSet]}>{t('workout.colSet')}</Text>
        {type === 'time' ? (
          <Text style={[styles.col, styles.colFlex]}>{t('workout.colTime')}</Text>
        ) : (
          <>
            <Text style={[styles.col, styles.colFlex]}>
              {type === 'bodyweight_reps'
                ? t('workout.colAdded')
                : (weightColumn ?? t('workout.colWeight'))}
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
    </Pressable>
  );
}

type CollapsedProps = {
  name: string;
  meta: string;
  onPress: () => void;
  onLongPress?: () => void;
  onMenuPress?: () => void;
};

/** 접힌 종목 카드 */
export function CollapsedExerciseCard({
  name,
  meta,
  onPress,
  onLongPress,
  onMenuPress,
}: CollapsedProps) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  return (
    // 메뉴 버튼이 안에 있어서 카드 전체를 한 덩어리로 읽히면 VoiceOver에서 메뉴에 닿을 수 없다.
    // 카드는 누르기만 받고, 읽는 단위는 이름 칸과 메뉴 버튼 둘로 나눈다.
    <Pressable
      accessible={false}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={({ pressed }) => [styles.collapsed, pressed && styles.pressed]}
    >
      <View
        style={styles.collapsedBody}
        accessible
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${meta}`}
        accessibilityHint={t('workout.expandA11y', { name })}
        onAccessibilityTap={onPress}
      >
        <Text style={styles.collapsedName} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.collapsedMeta} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      {onMenuPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('workout.menu.exerciseA11y', { name })}
          onPress={onMenuPress}
          hitSlop={4}
          style={({ pressed }) => [styles.collapsedMenu, pressed && styles.pressed]}
        >
          <Ellipsis size={20} color={theme.colors.text2} strokeWidth={1.8} />
        </Pressable>
      ) : null}
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
  rest: {
    alignSelf: 'flex-start',
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 10,
    paddingRight: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface2,
  },
  restText: {
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
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
  // 카드 높이를 늘리지 않게 위아래로 조금 넘친다(누르는 면적 44).
  collapsedMenu: {
    width: 44,
    height: 44,
    marginVertical: -8,
    marginRight: -8,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
