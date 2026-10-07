import { Check, Ellipsis, Pause, Play } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Button, TextButton } from '@/components/ui';
import { IconButton } from '@/components/ui/icon-button';
import { clampExtra } from '@/domain/cardio';
import { formatClock } from '@/domain/rest-timer';

import { SetField } from './set-field';

export type CardioField = 'distance' | 'speed' | 'incline';
/** idle: 아직 안 잼 / running: 재는 중 / paused: 일시정지 / done: 기록함 */
export type CardioState = 'idle' | 'running' | 'paused' | 'done';

/** 입력칸 이동용 key (키보드 위 '다음 · 완료' 줄이 쓴다) */
export const cardioFieldKey = (setId: string, field: CardioField) => `${setId}:${field}`;
export const cardioFieldKeys = (setId: string): string[] => [
  cardioFieldKey(setId, 'distance'),
  cardioFieldKey(setId, 'speed'),
  cardioFieldKey(setId, 'incline'),
];

type Props = {
  position: string;
  name: string;
  state: CardioState;
  /** 보여 줄 시간(초): 재는 중이면 지금까지, 끝냈으면 기록한 시간 */
  seconds: number;
  /** 루틴에서 정한 목표 시간(초). 없으면 0 */
  targetSec: number;
  distanceUnit: string;
  values: Record<CardioField, number | null>;
  /** 입력칸 이동용 세트 id */
  navId: string;
  onChange: (field: CardioField, value: number | null) => void;
  onStart: () => void;
  onPause: () => void;
  /** 재던 것을 끝내고 기록 */
  onFinish: () => void;
  /** 기록한 뒤 이어서 재기 */
  onContinue: () => void;
  /** 시간을 직접 적거나 고치기 */
  onEditTime: () => void;
  onNamePress?: () => void;
  onLongPress?: () => void;
  onMenuPress?: () => void;
  /** 지난 기록을 고칠 때: 스톱워치 없이 시간을 직접 적는다 */
  manual?: boolean;
  /** 지난 기록에서 이 유산소를 뺀다(manual일 때만 보인다) */
  onRemove?: () => void;
};

/**
 * 운동 중 유산소 카드: 큰 시간 + 시작 · 일시정지 · 끝내기. 세트 줄이 없다.
 * 거리 · 속도 · 경사는 재기 시작한 뒤에 보이고, 적지 않아도 된다.
 */
export function CardioCard({
  position,
  name,
  state,
  seconds,
  targetSec,
  distanceUnit,
  values,
  navId,
  onChange,
  onStart,
  onPause,
  onFinish,
  onContinue,
  onEditTime,
  onNamePress,
  onLongPress,
  onMenuPress,
  manual = false,
  onRemove,
}: Props) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const done = state === 'done';
  const clock = formatClock(seconds);
  // 루틴에서 정한 목표 시간. 재는 동안에도 상태 글자 뒤에 같이 보여 준다.
  const target = targetSec > 0 ? t('cardio.target', { minutes: Math.round(targetSec / 60) }) : null;
  const withTarget = (status: string) => (target ? `${status} · ${target}` : status);
  const fields: { field: CardioField; label: string; unit: string }[] = [
    { field: 'distance', label: t('cardio.distance'), unit: distanceUnit },
    { field: 'speed', label: t('cardio.speed'), unit: `${distanceUnit}/h` },
    { field: 'incline', label: t('cardio.incline'), unit: '%' },
  ];

  return (
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
        {onMenuPress ? (
          <IconButton
            icon={Ellipsis}
            tone="raised"
            label={t('workout.menu.exerciseA11y', { name })}
            onPress={onMenuPress}
          />
        ) : null}
      </View>

      <Pressable
        accessibilityRole={done ? 'button' : 'timer'}
        accessibilityLabel={t('cardio.timeA11y', { time: clock })}
        accessibilityHint={done ? t('cardio.editHint') : undefined}
        disabled={!done}
        onPress={onEditTime}
        style={({ pressed }) => [styles.timeWrap, pressed && styles.pressed]}
      >
        <Text style={[styles.time, state === 'idle' && styles.timeIdle]}>{clock}</Text>
        {state === 'running' ? (
          <View style={styles.statusRow}>
            <View style={styles.dot} />
            <Text style={styles.status}>{withTarget(t('cardio.running'))}</Text>
          </View>
        ) : state === 'paused' ? (
          <Text style={styles.status}>{withTarget(t('cardio.paused'))}</Text>
        ) : done ? (
          <View style={styles.statusRow}>
            <View style={styles.doneMark}>
              <Check size={11} color={theme.colors.onAccent} strokeWidth={3} />
            </View>
            <Text style={styles.statusDone}>{t('cardio.recorded')}</Text>
          </View>
        ) : target ? (
          <Text style={styles.status}>{target}</Text>
        ) : null}
      </Pressable>

      {state === 'idle' ? (
        manual ? (
          <Pressable
            accessibilityRole="button"
            onPress={onEditTime}
            style={({ pressed }) => [styles.raised, styles.raisedFull, pressed && styles.pressed]}
          >
            <Text style={styles.raisedText}>{t('cardio.enterTime')}</Text>
          </Pressable>
        ) : (
          <>
            <Button label={t('cardio.start')} icon={Play} onPress={onStart} />
            <TextButton label={t('cardio.enterTime')} onPress={onEditTime} />
          </>
        )
      ) : (
        <>
          {done ? null : (
            <View style={styles.buttons}>
              {/* 카드 바탕과 구분되게 한 단계 밝은 바탕을 쓴다(기본 보조 버튼은 카드와 같은 색이다) */}
              <Pressable
                accessibilityRole="button"
                onPress={state === 'running' ? onPause : onStart}
                style={({ pressed }) => [styles.raised, pressed && styles.pressed]}
              >
                {state === 'running' ? (
                  <Pause size={18} color={theme.colors.text} strokeWidth={2} />
                ) : (
                  <Play size={18} color={theme.colors.text} strokeWidth={2} />
                )}
                <Text style={styles.raisedText}>
                  {t(state === 'running' ? 'cardio.pause' : 'cardio.resume')}
                </Text>
              </Pressable>
              <View style={styles.flex}>
                <Button label={t('cardio.finish')} icon={Check} onPress={onFinish} />
              </View>
            </View>
          )}
          <View style={styles.columns} importantForAccessibility="no-hide-descendants">
            {fields.map((f) => (
              <Text key={f.field} style={styles.col}>
                {f.label}
              </Text>
            ))}
          </View>
          <View style={styles.fields}>
            {fields.map((f) => (
              <SetField
                key={f.field}
                label={t('cardio.fieldA11y', { name, field: f.label })}
                value={values[f.field]}
                unit={f.unit}
                decimal
                muted={false}
                onChange={(v) => onChange(f.field, clampExtra(f.field, v))}
                navKey={cardioFieldKey(navId, f.field)}
                navLabel={t('cardio.fieldNav', { name, field: f.label })}
              />
            ))}
          </View>
          <Text style={styles.optional}>{t('cardio.optional')}</Text>
          {done && !manual ? (
            <TextButton label={t('cardio.continue')} onPress={onContinue} />
          ) : null}
          {done && manual && onRemove ? (
            <TextButton label={t('cardio.remove')} onPress={onRemove} />
          ) : null}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    gap: 10,
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
  },
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
  timeWrap: { alignItems: 'center', gap: 4, paddingTop: 4, paddingBottom: 2 },
  time: {
    fontSize: 52,
    lineHeight: 58,
    includeFontPadding: false,
    fontFamily: theme.fonts.numBold,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text,
  },
  timeIdle: { color: theme.colors.prefill },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.warmFill },
  doneMark: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accent,
  },
  status: {
    fontSize: 13,
    lineHeight: 18,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  statusDone: {
    fontSize: 13,
    lineHeight: 18,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text,
  },
  buttons: { flexDirection: 'row', gap: 8 },
  raised: {
    flex: 1,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.surface2,
  },
  raisedFull: { flex: 0 },
  raisedText: {
    fontSize: 16,
    lineHeight: 21,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  columns: { flexDirection: 'row', gap: 8, paddingTop: 4 },
  col: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 14,
    includeFontPadding: false,
    fontFamily: theme.fonts.medium,
    color: theme.colors.text2,
  },
  fields: { flexDirection: 'row', gap: 8 },
  optional: {
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  pressed: { opacity: 0.7 },
}));
