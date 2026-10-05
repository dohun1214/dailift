import { Search, X } from 'lucide-react-native';
import { Pressable, TextInput, type TextInputProps, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

type Props = Omit<TextInputProps, 'style'> & {
  label: string;
  /** 넘기면 글자가 있을 때 지우기 단추를 보여 준다 */
  onClear?: () => void;
  clearLabel?: string;
};

/** 검색 입력칸 (높이 48, 반경 16, 카드색) */
export function SearchField({ label, onClear, clearLabel, ...props }: Props) {
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
      {onClear && props.value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={clearLabel}
          hitSlop={8}
          onPress={onClear}
          style={styles.clear}
        >
          <X size={14} color={theme.colors.text2} strokeWidth={2.2} />
        </Pressable>
      ) : null}
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
  clear: {
    width: 28,
    height: 28,
    marginRight: -4,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.track,
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
