import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { Supplement } from '@/domain/supplements';
import { useAppLanguage } from '@/i18n/use-app-language';

/** 영양제 화면에서 같이 쓰는 글자: 시각(오전 9:00), 시간(1시간 30분), 언제 먹는지, 목록의 둘째 줄 */
export function useSupplementFormat() {
  const { t } = useTranslation();
  const lang = useAppLanguage();
  return useMemo(() => {
    const locale = lang === 'ko' ? 'ko-KR' : 'en-US';
    const timeFmt = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' });
    const clock = (timeMin: number) =>
      timeFmt.format(new Date(2000, 0, 1, Math.floor(timeMin / 60), timeMin % 60));
    const duration = (min: number) => {
      if (min < 60) return t('supplements.minutes', { count: min });
      if (min % 60 === 0) return t('supplements.hours', { count: min / 60 });
      return t('supplements.hoursMinutes', { hours: Math.floor(min / 60), minutes: min % 60 });
    };
    const when = (s: Pick<Supplement, 'timing' | 'timeMin' | 'afterMin'>) => {
      if (s.timing === 'time') return clock(s.timeMin);
      if (s.afterMin === 0) return t('supplements.afterNow');
      return t('supplements.afterWorkout', { time: duration(s.afterMin) });
    };
    const line = (s: Supplement) => (s.dose ? `${s.dose} · ${when(s)}` : when(s));
    return { locale, clock, duration, when, line };
  }, [t, lang]);
}
