import { BackupConsentScreen } from '@/components/consent/backup-consent-screen';
import { useHealthConsent } from '@/stores/health-consent';
import { setDietBackup } from '@/sync/manager';

/** 식단 기록 백업 동의 화면 */
export default function DietBackupScreen() {
  const acceptedAt = useHealthConsent((s) => s.dietAcceptedAt);
  return (
    <BackupConsentScreen
      ns="dietBackup"
      acceptedAt={acceptedAt}
      onChange={setDietBackup}
      onDismiss={() => useHealthConsent.getState().dismissDietAsk()}
    />
  );
}
