import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

/** 화면이 구현되기 전까지 탭 자리를 채우는 임시 화면. */
export function PlaceholderScreen({ title }: { title: string }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{t('common.comingSoon')}</Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    paddingHorizontal: theme.space.xl,
    gap: theme.space.sm,
    backgroundColor: theme.colors.bg,
  },
  title: {
    fontSize: theme.fontSize.h1,
    fontWeight: '700',
    color: theme.colors.text,
  },
  body: {
    fontSize: theme.fontSize.body,
    color: theme.colors.text2,
  },
}));
