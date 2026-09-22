import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { ListRow, ListSection, Screen, Toggle, TopBar } from '@/components/ui';
import { PLATE_OPTIONS } from '@/domain/plates';
import { useSettings } from '@/stores/settings';

const fmt = (n: number) => String(Math.round(n * 100) / 100);

/** 보유 원판: 지금 단위의 원판마다 켜고 끈다. */
export default function PlatesSettingsScreen() {
  const { t } = useTranslation();
  const unit = useSettings((s) => s.weightUnit);
  const owned = useSettings((s) => s.plates[unit]);
  const setPlates = useSettings((s) => s.setPlates);

  const toggle = (plate: number, on: boolean) =>
    setPlates(unit, on ? [...owned, plate] : owned.filter((p) => p !== plate));

  return (
    <Screen header={<TopBar title={t('settings.platesTitle')} />}>
      <Text style={styles.hint}>{t('settings.platesHint')}</Text>
      <ListSection>
        {PLATE_OPTIONS[unit].map((plate) => {
          const label = `${fmt(plate)} ${unit}`;
          return (
            <ListRow
              key={plate}
              label={label}
              trailing={
                <Toggle
                  value={owned.includes(plate)}
                  onValueChange={(on) => toggle(plate, on)}
                  accessibilityLabel={t('settings.plateA11y', { value: fmt(plate), unit })}
                />
              }
            />
          );
        })}
      </ListSection>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  hint: {
    paddingHorizontal: 6,
    fontSize: 13,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
}));
