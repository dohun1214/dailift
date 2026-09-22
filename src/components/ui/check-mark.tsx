import { Check } from 'lucide-react-native';
import { View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

/** 목록 오른쪽 선택 표시 (24px, 반경 8). 누르는 동작은 행이 맡는다. */
export function CheckMark({ checked }: { checked: boolean }) {
  const { theme } = useUnistyles();
  return (
    <View style={[styles.box, checked ? styles.on : styles.off]}>
      {checked ? <Check size={15} color={theme.colors.onAccent} strokeWidth={2.6} /> : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  box: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  on: { backgroundColor: theme.colors.accent },
  off: { borderWidth: 2, borderColor: theme.colors.line },
}));
