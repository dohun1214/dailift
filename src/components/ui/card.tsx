import { View, type ViewProps } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

type Props = ViewProps & {
  /** md: 일반 카드, list: 리스트 행을 담는 카드(좌우만 여백), none: 여백 없음 */
  padding?: 'md' | 'lg' | 'list' | 'none';
  radius?: 'lg' | 'xl';
};

export function Card({ padding = 'md', radius = 'xl', style, ...props }: Props) {
  styles.useVariants({ padding, radius });
  return <View {...props} style={[styles.card, style]} />;
}

const styles = StyleSheet.create((theme) => ({
  card: {
    backgroundColor: theme.colors.surface,
    variants: {
      padding: {
        md: { padding: 18, gap: theme.space.md },
        lg: { padding: theme.space.xl, gap: theme.space.lg },
        list: { paddingHorizontal: 18, paddingVertical: 2 },
        none: {},
      },
      radius: {
        lg: { borderRadius: theme.radius.lg },
        xl: { borderRadius: theme.radius.xl },
      },
    },
  },
}));
