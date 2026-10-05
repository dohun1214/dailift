import { type ReactNode, useRef } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import { useKeyboardReveal } from '@/lib/use-keyboard-reveal';

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
  /**
   * 글자를 입력하는 화면이면 true: iOS에서 키보드가 올라올 때 내용과 하단 버튼이 가려지지 않게 하고,
   * 입력 중인 칸이 키보드 뒤에 있으면 보이는 곳까지 스크롤한다.
   */
  avoidKeyboard?: boolean;
  /** 키보드 처리를 화면이 직접 할 때(밖에서 KeyboardAvoidingView로 감쌌을 때): 가려진 입력칸만 올려 준다 */
  revealInputs?: boolean;
  /** 검색 화면이면 true: 목록을 끌면 키보드가 내려간다 */
  dismissKeyboardOnDrag?: boolean;
};

export function Screen({
  children,
  header,
  footer,
  scroll = true,
  inTabs = false,
  avoidKeyboard = false,
  dismissKeyboardOnDrag = false,
  revealInputs = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  useKeyboardReveal(scrollRef, avoidKeyboard || revealInputs);
  const bottom = inTabs ? 0 : insets.bottom;

  const body = (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {header}
      {scroll ? (
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={[
            styles.content,
            !header && styles.noHeader,
            { paddingBottom: footer ? 16 : bottom + 28 },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={dismissKeyboardOnDrag ? 'on-drag' : 'none'}
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
  if (!avoidKeyboard) return body;
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {body}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  flex: { flex: 1 },
  content: { paddingHorizontal: theme.space.lg, gap: theme.space.md },
  noHeader: { paddingTop: theme.space.xl },
  footer: { paddingHorizontal: theme.space.lg, paddingTop: theme.space.md, gap: theme.space.sm },
}));
