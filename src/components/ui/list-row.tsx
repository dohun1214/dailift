import { ChevronRight } from 'lucide-react-native';
import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Card } from './card';

type RowProps = {
  label: string;
  /** 오른쪽에 회색으로 보이는 현재 값 */
  value?: string;
  /** 값 대신 넣을 요소 (토글, 세그먼트 등) */
  trailing?: ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  /** ListSection이 마지막 행에 넣어 준다 (구분선 없음) */
  last?: boolean;
};

export function ListRow({ label, value, trailing, onPress, destructive, last }: RowProps) {
  const { theme } = useUnistyles();
  styles.useVariants({ last: !!last, destructive: !!destructive });

  const content = (
    <>
      <Text style={styles.label} numberOfLines={2}>
        {label}
      </Text>
      {trailing ?? (value ? <Text style={styles.value}>{value}</Text> : null)}
      {onPress && !trailing ? <ChevronRight size={16} color={theme.colors.text2} /> : null}
    </>
  );

  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={value}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

/** 제목 + 카드 안에 ListRow를 모은 묶음. 마지막 행의 구분선은 자동으로 뺀다. */
export function ListSection({ title, children }: { title?: string; children: ReactNode }) {
  const rows = Children.toArray(children).filter(isValidElement) as ReactElement<RowProps>[];
  return (
    <View style={styles.section}>
      {title ? (
        <Text style={styles.sectionTitle} accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      <Card padding="list">
        {rows.map((row, i) => cloneElement(row, { last: i === rows.length - 1 }))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 52,
    paddingVertical: 8,
    variants: {
      last: {
        true: {},
        false: { borderBottomWidth: 1, borderBottomColor: theme.colors.line },
      },
    },
  },
  label: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    variants: {
      destructive: {
        true: { color: theme.colors.danger },
        false: { color: theme.colors.text },
      },
    },
  },
  value: { fontSize: 14, color: theme.colors.text2 },
  pressed: { opacity: 0.6 },
  section: { gap: theme.space.sm },
  sectionTitle: {
    paddingHorizontal: 6,
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text2,
  },
}));
