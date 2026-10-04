import { ChevronRight, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Badge, BottomSheet, Button } from '@/components/ui';

export type PickRoutine = { id: string; name: string; meta: string; today: boolean };

type Props = {
  visible: boolean;
  /** 오늘 루틴이 맨 위에 오도록 정렬된 내 루틴 */
  routines: readonly PickRoutine[];
  onPick: (routine: PickRoutine) => void;
  /** 루틴 없이 빈 운동으로 시작 */
  onEmpty: () => void;
  onClose: () => void;
};

/** 운동 시작: 할 루틴을 고르거나 빈 운동으로 시작한다. */
export function RoutinePickSheet({ visible, routines, onPick, onEmpty, onClose }: Props) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const run = (action: () => void) => {
    onClose();
    action();
  };
  return (
    <BottomSheet
      visible={visible}
      title={t('home.pick.title')}
      closeLabel={t('home.pick.cancel')}
      onClose={onClose}
    >
      {routines.length > 0 ? (
        <ScrollView style={styles.scroll} bounces={false}>
          <View style={styles.card}>
            {routines.map((r, i) => (
              <Pressable
                key={r.id}
                accessibilityRole="button"
                accessibilityLabel={`${r.name}, ${r.meta}`}
                onPress={() => run(() => onPick(r))}
                style={({ pressed }) => [
                  styles.row,
                  i > 0 && styles.line,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.body}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name} numberOfLines={1}>
                      {r.name}
                    </Text>
                    {r.today ? <Badge label={t('home.today')} kind="solid" /> : null}
                  </View>
                  <Text style={styles.meta} numberOfLines={1}>
                    {r.meta}
                  </Text>
                </View>
                <ChevronRight size={16} color={theme.colors.text2} strokeWidth={1.8} />
              </Pressable>
            ))}
          </View>
        </ScrollView>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('home.pick.empty')}, ${t('home.pick.emptySub')}`}
        onPress={() => run(onEmpty)}
        style={({ pressed }) => [styles.empty, pressed && styles.pressed]}
      >
        <View style={styles.plus}>
          <Plus size={18} color={theme.colors.text} strokeWidth={1.8} />
        </View>
        <View style={styles.body}>
          <Text style={styles.name}>{t('home.pick.empty')}</Text>
          <Text style={styles.meta}>{t('home.pick.emptySub')}</Text>
        </View>
      </Pressable>
      <Button label={t('home.pick.cancel')} variant="ghost" size="sm" onPress={onClose} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create((theme) => ({
  // 루틴이 많으면 목록만 스크롤된다(행 60 × 5.5개).
  scroll: { maxHeight: 334, flexGrow: 0 },
  card: {
    paddingVertical: 2,
    paddingHorizontal: 18,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
  },
  row: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10 },
  line: { borderTopWidth: 1, borderTopColor: theme.colors.line },
  pressed: { opacity: 0.7 },
  body: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: {
    flexShrink: 1,
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  meta: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  empty: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
  },
  plus: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface2,
  },
}));
