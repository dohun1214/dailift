import { router } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Card, Chip, Screen, TextButton, TextField, TopBar } from '@/components/ui';
import { MUSCLES } from '@/data/muscles';
import { db } from '@/db/client';
import { createCustomExercise } from '@/db/routine-editor';
import type { Equipment, ExerciseType } from '@/db/schema';
import { useAppLanguage } from '@/i18n/use-app-language';
import { deliverCreatedExercise } from '@/stores/exercise-picker';

const TYPES: readonly ExerciseType[] = ['weight_reps', 'bodyweight_reps', 'time'];
const EQUIPMENT: readonly Equipment[] = [
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'bodyweight',
  'band',
  'kettlebell',
];

/** 커스텀 종목 만들기: 이름, 기록 방식, 주동근(필수), 협응근, 기구 */
export default function ExerciseNewScreen() {
  const { t } = useTranslation();
  const lang = useAppLanguage();
  const [name, setName] = useState('');
  const [type, setType] = useState<ExerciseType>('weight_reps');
  const [primary, setPrimary] = useState<string[]>([]);
  const [secondary, setSecondary] = useState<string[]>([]);
  const [equipment, setEquipment] = useState<Equipment>('barbell');
  const [error, setError] = useState<'name' | 'primary' | null>(null);

  const togglePrimary = (id: string) => {
    setError(null);
    setPrimary((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
    setSecondary((s) => s.filter((x) => x !== id));
  };
  const toggleSecondary = (id: string) => {
    setSecondary((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    setPrimary((p) => p.filter((x) => x !== id));
  };

  const save = () => {
    if (!name.trim()) return setError('name');
    if (primary.length === 0) return setError('primary');
    const id = createCustomExercise(db, { name, type, equipment, primary, secondary });
    deliverCreatedExercise(id);
    router.back();
  };

  return (
    <Screen
      header={
        <TopBar
          title={t('exercises.new.title')}
          leading="close"
          trailing={<TextButton label={t('common.save')} onPress={save} />}
        />
      }
    >
      <Card style={styles.first}>
        <TextField
          label={t('exercises.new.name')}
          value={name}
          placeholder={t('exercises.new.namePlaceholder')}
          maxLength={40}
          error={error === 'name' ? t('exercises.new.nameRequired') : undefined}
          onChangeText={(v) => {
            setError(null);
            setName(v);
          }}
        />
      </Card>
      <Card>
        <Group title={t('exercises.new.type')}>
          {TYPES.map((x) => (
            <Chip
              key={x}
              tone="raised"
              label={t(`exercises.type.${x}`)}
              selected={type === x}
              accessibilityRole="radio"
              accessibilityState={{ checked: type === x }}
              onPress={() => {
                setType(x);
                if (x !== 'weight_reps' && equipment === 'barbell') setEquipment('bodyweight');
              }}
            />
          ))}
        </Group>
      </Card>
      <Card style={styles.muscles}>
        <Group
          title={t('exercises.new.primary')}
          error={error === 'primary' ? t('exercises.new.primaryRequired') : undefined}
        >
          {MUSCLES.map((m) => (
            <Chip
              key={m.id}
              tone="raised"
              label={m[lang]}
              selected={primary.includes(m.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: primary.includes(m.id) }}
              onPress={() => togglePrimary(m.id)}
            />
          ))}
        </Group>
        <Group title={t('exercises.new.secondary')}>
          {MUSCLES.map((m) => (
            <Chip
              key={m.id}
              tone="raised"
              label={m[lang]}
              selected={secondary.includes(m.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: secondary.includes(m.id) }}
              onPress={() => toggleSecondary(m.id)}
            />
          ))}
        </Group>
      </Card>
      <Card>
        <Group title={t('exercises.new.equipment')}>
          {EQUIPMENT.map((x) => (
            <Chip
              key={x}
              tone="raised"
              label={t(`exercises.equipment.${x}`)}
              selected={equipment === x}
              accessibilityRole="radio"
              accessibilityState={{ checked: equipment === x }}
              onPress={() => setEquipment(x)}
            />
          ))}
        </Group>
      </Card>
    </Screen>
  );
}

function Group({ title, error, children }: { title: string; error?: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle} accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.wrap}>{children}</View>
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  first: { marginTop: 8 },
  muscles: { gap: 18 },
  group: { gap: 8 },
  groupTitle: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.medium,
    color: theme.colors.text2,
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  error: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.danger,
  },
}));
