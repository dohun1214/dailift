import { router } from 'expo-router';
import { ChevronLeft, X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { IconButton } from './icon-button';

type Props = {
  title?: string;
  /** back: 뒤로(기본), close: 닫기(모달), none: 버튼 없음, 또는 직접 넣은 요소 */
  leading?: 'back' | 'close' | 'none' | ReactNode;
  trailing?: ReactNode;
  onLeadingPress?: () => void;
};

export function TopBar({ title, leading = 'back', trailing, onLeadingPress }: Props) {
  const { t } = useTranslation();
  const onPress = onLeadingPress ?? (() => router.back());

  let lead: ReactNode = <View style={styles.slot} />;
  if (leading === 'back') {
    lead = <IconButton icon={ChevronLeft} label={t('common.back')} onPress={onPress} />;
  } else if (leading === 'close') {
    lead = <IconButton icon={X} label={t('common.close')} onPress={onPress} />;
  } else if (leading !== 'none') {
    lead = leading;
  }

  return (
    <View style={styles.bar}>
      {lead}
      <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
        {title}
      </Text>
      {trailing ?? <View style={styles.slot} />}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
    paddingTop: theme.space.md,
    paddingBottom: theme.space.sm,
    paddingHorizontal: theme.space.lg,
  },
  slot: { width: theme.hitSize, height: theme.hitSize },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 21,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
}));
