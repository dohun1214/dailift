import { Redirect } from 'expo-router';
import { TabList, TabSlot, Tabs, TabTrigger } from 'expo-router/ui';
import { ChartNoAxesColumn, House, ListChecks, User, Utensils } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUnistyles } from 'react-native-unistyles';

import { TabButton } from '@/components/ui/tab-button';
import { useProfile } from '@/stores/profile';

export default function TabsLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  // TabList는 서드파티 컴포넌트라 Unistyles가 직접 갱신하지 못하므로 훅으로 리렌더한다.
  const { theme } = useUnistyles();
  const consented = useProfile((s) => s.consentAcceptedAt !== null);
  const onboarded = useProfile((s) => s.onboardingCompleted);

  // 처음 켜면 시작 화면(약관·연령 동의) → 온보딩을 거쳐야 탭으로 들어온다.
  if (!consented) return <Redirect href="/welcome" />;
  if (!onboarded) return <Redirect href="/onboarding" />;

  return (
    <Tabs>
      <TabSlot />
      {/* TabList는 Tabs의 직계 자식이어야 트리거를 인식한다. */}
      <TabList
        style={{
          flexDirection: 'row',
          marginHorizontal: theme.space.lg,
          marginTop: theme.space.sm,
          marginBottom: Math.max(insets.bottom, 12),
          padding: 6,
          borderRadius: theme.radius.xl,
          backgroundColor: theme.colors.surface,
        }}
      >
        <TabTrigger name="home" href="/" asChild>
          <TabButton icon={House} label={t('tabs.home')} />
        </TabTrigger>
        <TabTrigger name="routines" href="/routines" asChild>
          <TabButton icon={ListChecks} label={t('tabs.routines')} />
        </TabTrigger>
        <TabTrigger name="log" href="/log" asChild>
          <TabButton icon={ChartNoAxesColumn} label={t('tabs.log')} />
        </TabTrigger>
        <TabTrigger name="nutrition" href="/nutrition" asChild>
          <TabButton icon={Utensils} label={t('tabs.nutrition')} />
        </TabTrigger>
        <TabTrigger name="me" href="/me" asChild>
          <TabButton icon={User} label={t('tabs.me')} />
        </TabTrigger>
      </TabList>
    </Tabs>
  );
}
