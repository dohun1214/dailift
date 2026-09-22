import { Search } from 'lucide-react-native';
import { TextInput, type TextInputProps, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

type Props = Omit<TextInputProps, 'style'> & { label: string };

/** 검색 입력칸 (높이 48, 반경 16, 카드색) */
export function SearchField({ label, ...props }: Props) {
  const { theme } = useUnistyles();
  return (
    <View style={styles.box}>
      <Search size={20} color={theme.colors.text2} strokeWidth={1.8} />
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.colors.text2}
        selectionColor={theme.colors.accentText}
        returnKeyType="search"
        autoCorrect={false}
        {...props}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  box: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
  },
  input: {
    flex: 1,
    height: 48,
    paddingVertical: 0,
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text,
  },
}));
