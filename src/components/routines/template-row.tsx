import { ChevronRight } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Badge } from '@/components/ui';

type Props = {
  code: string;
  name: string;
  subtitle: string;
  /** 추천 배지 문구. 없으면 배지를 숨긴다 */
  badge?: string;
  onPress: () => void;
};

/** 추천 루틴 한 줄: 코드 상자 · 이름/설명 · 추천 배지 · 화살표 */
export function TemplateRow({ code, name, subtitle, badge, onPress }: Props) {
  const { theme } = useUnistyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[name, subtitle, badge].filter(Boolean).join(', ')}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.code}>
        <Text style={styles.codeText}>{code}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      {badge ? <Badge label={badge} /> : null}
      <ChevronRight size={18} color={theme.colors.text2} strokeWidth={1.8} />
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
  },
  pressed: { opacity: 0.7 },
  code: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface2,
  },
  codeText: {
    fontSize: 16,
    lineHeight: 21,
    includeFontPadding: false,
    fontFamily: theme.fonts.numBold,
    color: theme.colors.text,
  },
  body: { flex: 1, gap: 2 },
  name: {
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  sub: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
}));
