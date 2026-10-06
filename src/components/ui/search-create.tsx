import { Plus } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { SearchField } from './search-field';

type RowProps = {
  query: string;
  onChangeQuery: (v: string) => void;
  /** '만들기'를 눌렀을 때 */
  onCreate: () => void;
  searchLabel: string;
  placeholder: string;
  clearLabel: string;
  /** 버튼 글자("만들기")와 스크린리더용 이름("종목 직접 만들기") */
  createLabel: string;
  createA11y: string;
};

/** 검색칸 + 오른쪽 '만들기' 버튼 (종목 찾기 · 음식 찾기) */
export function SearchCreateRow({
  query,
  onChangeQuery,
  onCreate,
  searchLabel,
  placeholder,
  clearLabel,
  createLabel,
  createA11y,
}: RowProps) {
  const { theme } = useUnistyles();
  return (
    <View style={styles.row}>
      <View style={styles.flex}>
        <SearchField
          label={searchLabel}
          placeholder={placeholder}
          value={query}
          onChangeText={onChangeQuery}
          onClear={() => onChangeQuery('')}
          clearLabel={clearLabel}
        />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={createA11y}
        onPress={onCreate}
        style={({ pressed }) => [styles.make, pressed && styles.pressed]}
      >
        <Plus size={18} color={theme.colors.text} strokeWidth={1.8} />
        <Text style={styles.makeText}>{createLabel}</Text>
      </Pressable>
    </View>
  );
}

type NoneProps = {
  title: string;
  body: string;
  createLabel: string;
  onCreate: () => void;
};

/** 검색 결과가 없을 때: 그 이름으로 바로 만들기 */
export function NoMatchCard({ title, body, createLabel, onCreate }: NoneProps) {
  const { theme } = useUnistyles();
  return (
    <View style={styles.card}>
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={onCreate}
        style={({ pressed }) => [styles.create, pressed && styles.pressed]}
      >
        <Plus size={18} color={theme.colors.onAccent} strokeWidth={1.8} />
        <Text style={styles.createText} numberOfLines={1}>
          {createLabel}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  row: { flexDirection: 'row', gap: 8 },
  make: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 12,
    paddingRight: 14,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
  },
  makeText: {
    fontSize: 14,
    lineHeight: 18,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  card: {
    gap: 14,
    paddingTop: 20,
    paddingHorizontal: 18,
    paddingBottom: 18,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
  },
  text: { gap: 4 },
  title: {
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  body: {
    fontSize: 13,
    lineHeight: 19.5,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  create: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: theme.colors.accent,
  },
  createText: {
    flexShrink: 1,
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.onAccent,
  },
}));
