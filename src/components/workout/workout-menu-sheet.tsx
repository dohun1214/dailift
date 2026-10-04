import type { LucideIcon } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { BottomSheet, Button } from '@/components/ui';

export type MenuItem = {
  label: string;
  icon: LucideIcon;
  onPress: () => void;
  destructive?: boolean;
};

type Props = {
  visible: boolean;
  title: string;
  items: readonly MenuItem[];
  cancelLabel: string;
  onClose: () => void;
};

/** 운동 중 더보기 메뉴: 아이콘이 붙은 항목 목록. 항목을 누르면 닫힌 뒤 실행된다. */
export function WorkoutMenuSheet({ visible, title, items, cancelLabel, onClose }: Props) {
  const { theme } = useUnistyles();
  return (
    <BottomSheet visible={visible} title={title} closeLabel={cancelLabel} onClose={onClose}>
      <View style={styles.card}>
        {items.map((item, i) => {
          const color = item.destructive ? theme.colors.danger : theme.colors.text;
          return (
            <Pressable
              key={item.label}
              accessibilityRole="button"
              onPress={() => {
                onClose();
                // 시트가 닫힌 뒤에 실행한다(다른 창·화면을 여는 동작과 겹치지 않게).
                setTimeout(item.onPress, 250);
              }}
              style={({ pressed }) => [
                styles.item,
                i > 0 && styles.line,
                pressed && styles.pressed,
              ]}
            >
              <item.icon size={20} color={color} strokeWidth={1.8} />
              <Text style={[styles.label, { color }]} numberOfLines={1}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Button label={cancelLabel} variant="ghost" size="sm" onPress={onClose} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    paddingVertical: 2,
    paddingHorizontal: 18,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
  },
  item: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12 },
  line: { borderTopWidth: 1, borderTopColor: theme.colors.line },
  pressed: { opacity: 0.7 },
  label: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
  },
}));
