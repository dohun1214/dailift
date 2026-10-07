import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Card } from '@/components/ui';

type Props = {
  ns: 'dietBackup' | 'bodyBackup';
  /** '기기에만 둘게요' */
  onDismiss: () => void;
  /** '자세히 보기' — 동의 화면으로 */
  onMore: () => void;
};

/** '계정에 백업할까요?' 안내 카드(식단 · 체성분이 같이 쓴다) */
export function BackupAskCard({ ns, onDismiss, onMore }: Props) {
  const { t } = useTranslation();
  return (
    <Card style={styles.card}>
      <View style={styles.text}>
        <Text style={styles.title}>{t(`${ns}.askTitle`)}</Text>
        <Text style={styles.body}>{t(`${ns}.askBody`)}</Text>
      </View>
      <View style={styles.buttons}>
        <Pressable
          accessibilityRole="button"
          onPress={onDismiss}
          style={({ pressed }) => [styles.button, styles.later, pressed && styles.pressed]}
        >
          <Text style={styles.laterText} numberOfLines={1}>
            {t(`${ns}.keepOnDevice`)}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onMore}
          style={({ pressed }) => [styles.button, styles.more, pressed && styles.pressed]}
        >
          <Text style={styles.moreText} numberOfLines={1}>
            {t(`${ns}.more`)}
          </Text>
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create((theme) => ({
  pressed: { opacity: 0.6 },
  card: { gap: 14 },
  text: { gap: 4 },
  buttons: { flexDirection: 'row', gap: 8 },
  button: {
    flex: 1,
    minWidth: 0,
    height: theme.hitSize,
    paddingHorizontal: 8,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  later: { backgroundColor: theme.colors.surface2 },
  more: { backgroundColor: theme.colors.accent },
  laterText: {
    fontSize: 14,
    lineHeight: 19,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  moreText: {
    fontSize: 14,
    lineHeight: 19,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.onAccent,
  },
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
}));
