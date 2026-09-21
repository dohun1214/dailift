import { TabList, TabSlot, Tabs, TabTrigger } from 'expo-router/ui';
import { ChartNoAxesColumn, House, ListChecks, User, Utensils } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import { TabButton } from '@/components/ui/tab-button';

export default function TabsLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Tabs>
      <TabSlot />
      <View style={[styles.barWrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TabList style={styles.bar}>
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
      </View>
    </Tabs>
  );
}

const styles = StyleSheet.create((theme) => ({
  barWrap: {
    paddingHorizontal: theme.space.lg,
    paddingTop: theme.space.sm,
    backgroundColor: theme.colors.bg,
  },
  bar: {
    flexDirection: 'row',
    padding: 6,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
  },
}));
