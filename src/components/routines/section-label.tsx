import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

type Props = {
  label: string;
  /** 위쪽 추가 여백(시안: 묶음 0 · 단독 8 · 추천 12) */
  top?: 0 | 8 | 12;
  trailing?: ReactNode;
};

/** 루틴 목록의 소제목(묶음 이름, 단독 루틴, 추천 루틴) */
export function SectionLabel({ label, top = 0, trailing }: Props) {
  return (
    <View style={[styles.row, { paddingTop: top }]}>
      <Text style={styles.label} numberOfLines={1} accessibilityRole="header">
        {label}
      </Text>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 6 },
  label: {
    flex: 1,
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text2,
  },
}));
