jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    SafeAreaProvider: ({ children }: { children: unknown }) => children,
    useSafeAreaInsets: () => insets,
  };
});

jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() } }));
