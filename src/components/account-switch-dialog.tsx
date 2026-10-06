import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ConfirmDialog } from '@/components/ui';
import { signOut } from '@/lib/auth';
import { useRestTimer } from '@/stores/rest-timer';
import { replaceWithCurrentAccount, useSync } from '@/sync/manager';

/**
 * 다른 계정의 기록이 남아 있는 기기에 로그인했을 때 묻는다:
 * 기기 기록을 지우고 지금 계정의 기록을 받을지, 로그인을 그만둘지.
 */
export function AccountSwitchDialog() {
  const { t } = useTranslation();
  const otherAccount = useSync((s) => s.otherAccount);
  const [busy, setBusy] = useState(false);

  return (
    <ConfirmDialog
      // 로그인 창이 닫히는 도중에도 반드시 보이도록 화면 위에 그대로 그린다.
      inline
      visible={otherAccount && !busy}
      title={t('auth.switch.title')}
      body={t('auth.switch.body')}
      cancelLabel={t('auth.account.signOut')}
      confirmLabel={t('auth.switch.replace')}
      destructive
      onCancel={() => {
        signOut().catch((e) => console.warn('[auth] sign-out failed', e));
      }}
      onConfirm={() => {
        setBusy(true);
        useRestTimer.getState().stop();
        replaceWithCurrentAccount().finally(() => setBusy(false));
      }}
      // 바깥을 눌러서는 닫히지 않는다(둘 중 하나를 골라야 동기화가 다시 돈다).
      onDismiss={() => undefined}
    />
  );
}
