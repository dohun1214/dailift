import { Check } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

type Props = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** 문장 안에서 눌러 열 수 있는 부분(예: 이용약관) */
  links?: { text: string; onPress: () => void }[];
};

type Segment = { text: string; onPress?: () => void };

/** 문장을 링크 부분과 나머지로 나눈다. 링크 문구가 문장에 없으면 무시한다. */
export function splitLinks(label: string, links: Props['links'] = []): Segment[] {
  const found = links
    .map((l) => ({ ...l, at: label.indexOf(l.text) }))
    .filter((l) => l.text && l.at >= 0)
    .sort((a, b) => a.at - b.at);
  const out: Segment[] = [];
  let i = 0;
  for (const l of found) {
    if (l.at < i) continue;
    if (l.at > i) out.push({ text: label.slice(i, l.at) });
    out.push({ text: l.text, onPress: l.onPress });
    i = l.at + l.text.length;
  }
  if (i < label.length) out.push({ text: label.slice(i) });
  return out;
}

/** 약관 동의처럼 문장과 함께 쓰는 체크 (시안: 로그인 화면 하단) */
export function ConsentCheck({ label, checked, onChange, links }: Props) {
  const { theme } = useUnistyles();
  styles.useVariants({ checked });
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={() => onChange(!checked)}
      style={styles.row}
    >
      <View style={styles.box}>
        {checked ? <Check size={14} strokeWidth={2.6} color={theme.colors.onAccent} /> : null}
      </View>
      <Text style={styles.label}>
        {splitLinks(label, links).map((seg) =>
          seg.onPress ? (
            <Text key={seg.text} accessibilityRole="link" onPress={seg.onPress} style={styles.link}>
              {seg.text}
            </Text>
          ) : (
            seg.text
          ),
        )}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: theme.hitSize },
  box: {
    width: 22,
    height: 22,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    variants: {
      checked: {
        true: { backgroundColor: theme.colors.accent },
        false: { borderWidth: 2, borderColor: theme.colors.text2 },
      },
    },
  },
  label: {
    flex: 1,
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  link: { textDecorationLine: 'underline' },
}));
