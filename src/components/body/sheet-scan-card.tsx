import { Camera, FileText, Image as ImageIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Card } from '@/components/ui';
import type { SheetSource } from '@/lib/sheet-scan';

export type SheetScanState =
  | { kind: 'idle' }
  | { kind: 'reading'; uri: string }
  /** count: 채운 값의 수(날짜는 세지 않는다) */
  | { kind: 'done'; uri: string; count: number };

type Props = {
  state: SheetScanState;
  onPick: (source: SheetSource) => void;
  /** '다시 고르기' */
  onAgain: () => void;
  /** 사진을 길게 누르면: 읽은 글자를 내보낸다(인식이 틀릴 때 살펴보는 용도) */
  onShareRaw?: () => void;
};

/** 체성분 기록 화면 맨 위: 인바디 결과지 사진을 찍거나 골라 값을 채운다. */
export function SheetScanCard({ state, onPick, onAgain, onShareRaw }: Props) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();

  if (state.kind === 'idle') {
    return (
      <Card padding="md" style={styles.card}>
        <View style={styles.row}>
          <View style={styles.icon}>
            <FileText size={20} color={theme.colors.text} strokeWidth={1.8} />
          </View>
          <View style={styles.text}>
            <Text style={styles.title}>{t('body.scan.title')}</Text>
            <Text style={styles.sub}>{t('body.scan.sub')}</Text>
          </View>
        </View>
        <View style={styles.buttons}>
          <Pressable
            accessibilityRole="button"
            onPress={() => onPick('camera')}
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          >
            <Camera size={16} color={theme.colors.text} strokeWidth={1.8} />
            <Text style={styles.buttonText} numberOfLines={1}>
              {t('body.scan.camera')}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => onPick('library')}
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          >
            <ImageIcon size={16} color={theme.colors.text} strokeWidth={1.8} />
            <Text style={styles.buttonText} numberOfLines={1}>
              {t('body.scan.library')}
            </Text>
          </Pressable>
        </View>
      </Card>
    );
  }

  const thumb = (
    <Image source={{ uri: state.uri }} style={styles.thumb} accessibilityIgnoresInvertColors />
  );

  if (state.kind === 'reading') {
    return (
      <Card padding="md" style={styles.card}>
        <View style={styles.row} accessible accessibilityLiveRegion="polite">
          {thumb}
          <View style={styles.text}>
            <Text style={styles.title}>{t('body.scan.reading')}</Text>
            <Text style={styles.sub}>{t('body.scan.readingSub')}</Text>
          </View>
          <ActivityIndicator color={theme.colors.text} />
        </View>
      </Card>
    );
  }

  return (
    <Card padding="md" style={styles.card}>
      <View style={styles.row}>
        <Pressable
          accessibilityLabel={t('body.scan.photoA11y')}
          onLongPress={onShareRaw}
          delayLongPress={800}
        >
          {thumb}
        </Pressable>
        <View style={styles.text} accessible accessibilityLiveRegion="polite">
          <Text style={styles.title}>{t('body.scan.done', { count: state.count })}</Text>
          <Text style={styles.sub}>{t('body.scan.doneSub')}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={onAgain}
          style={({ pressed }) => [styles.again, pressed && styles.pressed]}
        >
          <Text style={styles.againText}>{t('body.scan.again')}</Text>
        </Pressable>
      </View>
      <View style={styles.legend}>
        <View style={styles.dot} />
        <Text style={styles.sub}>{t('body.scan.legend')}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create((theme) => ({
  pressed: { opacity: 0.6 },
  card: { gap: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface2,
  },
  text: { flex: 1, minWidth: 0, gap: 2 },
  title: {
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  sub: {
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  buttons: { flexDirection: 'row', gap: 8 },
  button: {
    flex: 1,
    minWidth: 0,
    height: theme.hitSize,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: theme.colors.surface2,
  },
  buttonText: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 19,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  thumb: {
    width: 44,
    height: 58,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.surface2,
  },
  again: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface2,
  },
  againText: {
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text,
  },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.accent },
}));
