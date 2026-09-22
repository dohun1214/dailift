import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { type ReactNode, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import migrations from '../../drizzle/migrations';
import { db } from './client';
import { seedReferenceData } from './seed';

/** 마이그레이션과 참조 데이터 시드가 끝난 뒤에 앱을 그린다. */
export function DatabaseProvider({ children }: { children: ReactNode }) {
  const { success, error } = useMigrations(db, migrations);
  const [seeded, setSeeded] = useState(false);
  const [seedError, setSeedError] = useState<Error | null>(null);

  useEffect(() => {
    if (!success || seeded) return;
    try {
      seedReferenceData(db);
      setSeeded(true);
    } catch (e) {
      setSeedError(e instanceof Error ? e : new Error(String(e)));
    }
  }, [success, seeded]);

  const failure = error ?? seedError;
  if (failure) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{failure.message}</Text>
      </View>
    );
  }
  if (!seeded) return <View style={styles.center} />;
  return children;
}

const styles = StyleSheet.create((theme) => ({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.space.xl,
    backgroundColor: theme.colors.bg,
  },
  error: {
    color: theme.colors.danger,
    fontSize: theme.fontSize.body,
    fontFamily: theme.fonts.regular,
  },
}));
