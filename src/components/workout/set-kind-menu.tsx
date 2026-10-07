import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ActionSheet } from '@/components/ui';
import { SHEET_NEXT_MS } from '@/components/ui/use-sheet-motion';
import type { SetKind } from '@/db/schema';

const SET_KINDS: readonly SetKind[] = ['working', 'warmup', 'drop', 'failure'];
const RPE_VALUES = [10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6];

export type SetKindTarget = { id: string; kind: SetKind; rpe: number | null };

type Props = {
  /** 메뉴를 띄울 세트. null이면 닫힌다 */
  target: SetKindTarget | null;
  onClose: () => void;
  onChange: (setId: string, patch: { kind: SetKind } | { rpe: number | null }) => void;
};

/**
 * 세트 번호를 눌렀을 때의 메뉴: 세트 종류(본세트 · 워밍업 · 드롭 · 실패)와 RPE.
 * 운동 중 화면과 기록 수정 화면이 같이 쓴다('세트 종류 · RPE 적기' 설정을 켰을 때).
 */
export function SetKindMenu({ target, onClose, onChange }: Props) {
  const { t } = useTranslation();
  const [rpeFor, setRpeFor] = useState<{ id: string; rpe: number | null } | null>(null);

  return (
    <>
      <ActionSheet
        visible={target !== null}
        title={t('workout.setMenu.title')}
        cancelLabel={t('workout.menu.cancel')}
        onClose={onClose}
        actions={[
          ...SET_KINDS.map((kind) => ({
            label: t(`workout.setMenu.kind.${kind}`),
            selected: target?.kind === kind,
            onPress: () => {
              if (target) onChange(target.id, { kind });
            },
          })),
          {
            label: t('workout.setMenu.rpe'),
            onPress: () => {
              const next = target ? { id: target.id, rpe: target.rpe } : null;
              // 앞 시트가 닫힌 뒤에 연다(모달 두 개가 겹치면 안드로이드에서 안 뜬다)
              setTimeout(() => setRpeFor(next), SHEET_NEXT_MS);
            },
          },
        ]}
      />

      <ActionSheet
        visible={rpeFor !== null}
        title={t('workout.setMenu.rpeTitle')}
        cancelLabel={t('workout.menu.cancel')}
        onClose={() => setRpeFor(null)}
        actions={[
          ...RPE_VALUES.map((v) => ({
            label: String(v),
            selected: rpeFor?.rpe === v,
            onPress: () => {
              if (rpeFor) onChange(rpeFor.id, { rpe: v });
            },
          })),
          {
            label: t('workout.setMenu.rpeClear'),
            onPress: () => {
              if (rpeFor) onChange(rpeFor.id, { rpe: null });
            },
          },
        ]}
      />
    </>
  );
}
