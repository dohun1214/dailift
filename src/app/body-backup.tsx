import { BackupConsentScreen } from '@/components/consent/backup-consent-screen';
import { useHealthConsent } from '@/stores/health-consent';
import { setBodyBackup } from '@/sync/manager';

/** 체성분 기록 백업 동의 화면 */
export default function BodyBackupScreen() {
  const acceptedAt = useHealthConsent((s) => s.bodyAcceptedAt);
  return (
    <BackupConsentScreen
      ns="bodyBackup"
      acceptedAt={acceptedAt}
      onChange={setBodyBackup}
      onDismiss={() => useHealthConsent.getState().dismissBodyAsk()}
    />
  );
}
