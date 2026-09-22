import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { db } from '@/db/client';
import { exportAllTables, exportSetRows } from '@/db/export';
import { buildWorkoutCsv, fileDate } from '@/domain/export';
import type { AppLanguage } from '@/i18n/resolve-language';
import { useProfile } from '@/stores/profile';
import { useSettings } from '@/stores/settings';

export type ExportKind = 'csv' | 'json';

function writeCache(name: string, content: string): File {
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.write(content);
  return file;
}

/** 파일을 만들어 공유 시트를 연다. 공유할 수 없는 기기면 false */
export async function exportData(kind: ExportKind, lang: AppLanguage, now = Date.now()) {
  if (!(await Sharing.isAvailableAsync())) return false;
  const stamp = fileDate(now);
  let file: File;
  if (kind === 'csv') {
    file = writeCache(`dailift-workouts-${stamp}.csv`, buildWorkoutCsv(exportSetRows(db, lang)));
    await Sharing.shareAsync(file.uri, {
      mimeType: 'text/csv',
      UTI: 'public.comma-separated-values-text',
    });
  } else {
    const { weightUnit, barWeights, plates, dumbbellMode, defaultRestSec } = useSettings.getState();
    const { experience, daysPerWeek, goal, heightCm, weight, bodyType } = useProfile.getState();
    const backup = {
      app: 'Dailift',
      version: Constants.expoConfig?.version ?? '',
      exportedAt: new Date(now).toISOString(),
      note: 'Times are Unix milliseconds. Weights are stored in the unit they were entered.',
      settings: { weightUnit, barWeights, plates, dumbbellMode, defaultRestSec },
      profile: { experience, daysPerWeek, goal, heightCm, weight, bodyType },
      data: exportAllTables(db),
    };
    file = writeCache(`dailift-backup-${stamp}.json`, JSON.stringify(backup, null, 2));
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json' });
  }
  return true;
}
