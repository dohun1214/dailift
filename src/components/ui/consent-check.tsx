import { Check } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

type Props = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

/** 약관 동의처럼 문장과 함께 쓰는 체크 (시안: 로그인 화면 하단) */
export function ConsentCheck({ label, checked, onChange }: Props) {
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
      <Text style={styles.label}>{label}</Text>
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
}));
