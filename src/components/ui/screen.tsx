import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

type Props = {
  children: ReactNode;
  /** 상단 고정 영역 (TopBar 등). 없으면 상태바 아래 여백만 둔다 */
  header?: ReactNode;
  /** 하단 고정 영역 (주요 버튼 등) */
  footer?: ReactNode;
  /** 기본은 스크롤. 운동 중 화면처럼 직접 배치하면 false */
  scroll?: boolean;
  /** 하단 탭 위에 놓이는 화면이면 true (하단 안전 영역을 탭 바가 처리) */
  inTabs?: boolean;
};

export function Screen({ children, header, footer, scroll = true, inTabs = false }: Props) {
  const insets = useSafeAreaInsets();
  const bottom = inTabs ? 0 : insets.bottom;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {header}
      {scroll ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            styles.content,
            !header && styles.noHeader,
            { paddingBottom: footer ? 16 : bottom + 28 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, styles.content, !header && styles.noHeader]}>{children}</View>
      )}
      {footer ? (
        <View style={[styles.footer, { paddingBottom: bottom + 16 }]}>{footer}</View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  flex: { flex: 1 },
  content: { paddingHorizontal: theme.space.lg, gap: theme.space.md },
  noHeader: { paddingTop: theme.space.xl },
  footer: { paddingHorizontal: theme.space.lg, paddingTop: theme.space.md, gap: theme.space.sm },
}));
