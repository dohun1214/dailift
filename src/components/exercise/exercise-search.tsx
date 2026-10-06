import { Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { SearchField } from '@/components/ui';

const NAME_MAX = 40;

/** 검색어를 새 종목 이름으로 쓸 때의 글자(앞뒤 공백 제거, 길이 제한). 빈 검색어면 null */
export function creatableName(query: string): string | null {
  return query.trim().slice(0, NAME_MAX) || null;
}

type RowProps = {
  query: string;
  onChangeQuery: (v: string) => void;
  /** '만들기'를 눌렀을 때 */
  onCreate: () => void;
};

/** 종목 검색칸 + 오른쪽 '만들기' 버튼 */
export function ExerciseSearchRow({ query, onChangeQuery, onCreate }: RowProps) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  return (
    <View style={styles.row}>
      <View style={styles.flex}>
        <SearchField
          label={t('exercises.search')}
          placeholder={t('exercises.searchPlaceholder')}
          value={query}
          onChangeText={onChangeQuery}
          onClear={() => onChangeQuery('')}
          clearLabel={t('exerciseList.clear')}
        />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('exercises.create')}
        onPress={onCreate}
        style={({ pressed }) => [styles.make, pressed && styles.pressed]}
      >
        <Plus size={18} color={theme.colors.text} strokeWidth={1.8} />
        <Text style={styles.makeText}>{t('exercises.createShort')}</Text>
      </Pressable>
    </View>
  );
}

type NoneProps = {
  query: string;
  /** 이름을 채워서(가능하면) 종목 만들기를 연다 */
  onCreate: (name: string | null) => void;
};

/** 검색 결과가 없을 때: 그 이름으로 바로 만들기 */
export function NoExerciseCard({ query, onCreate }: NoneProps) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const name = creatableName(query);
  return (
    <View style={styles.card}>
      <View style={styles.text}>
        <Text style={styles.title}>{t('exercises.noMatchTitle', { query: query.trim() })}</Text>
        <Text style={styles.body}>{t('exercises.noMatchBody')}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => onCreate(name)}
        style={({ pressed }) => [styles.create, pressed && styles.pressed]}
      >
        <Plus size={18} color={theme.colors.onAccent} strokeWidth={1.8} />
        <Text style={styles.createText} numberOfLines={1}>
          {name ? t('exercises.createNamed', { name }) : t('exercises.create')}
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
