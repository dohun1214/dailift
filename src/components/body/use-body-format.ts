import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { WeightUnit } from '@/db/schema';
import { type BodyEntry, type BodyMetric, metricValue } from '@/domain/body';
import { dateKey } from '@/domain/date-key';
import { useAppLanguage } from '@/i18n/use-app-language';

/** 체성분 화면에서 같이 쓰는 글자: 값(소수 한 자리), 날짜, 기록 한 줄 요약 */
export function useBodyFormat(unit: WeightUnit) {
  const { t } = useTranslation();
  const lang = useAppLanguage();
  return useMemo(() => {
    const locale = lang === 'ko' ? 'ko-KR' : 'en-US';
    const num = (n: number) => n.toFixed(1);
    const unitOf = (metric: BodyMetric) => (metric === 'fat' ? '%' : unit);
    const withUnit = (metric: BodyMetric, n: number) => `${num(n)} ${unitOf(metric)}`;
    const date = (at: number, now = Date.now()) => {
      const d = new Date(at);
      return d.toLocaleDateString(locale, {
        year: d.getFullYear() === new Date(now).getFullYear() ? undefined : 'numeric',
        month: lang === 'ko' ? 'long' : 'short',
        day: 'numeric',
      });
    };
    /** 오늘이면 "10월 7일 (오늘)" */
    const day = (at: number, now = Date.now()) =>
      dateKey(new Date(at)) === dateKey(new Date(now))
        ? t('body.today', { date: date(at, now) })
        : date(at, now);
    /** "68.5 kg · 골격근 32.1 kg · 체지방 16.8 %" — 적은 것만 */
    const line = (e: BodyEntry) =>
      (['weight', 'muscle', 'fat'] as const)
        .map((m) => {
          const v = metricValue(e, m, unit);
          return v === null ? null : t(`body.row.${m}`, { value: num(v), unit });
        })
        .filter((x): x is string => x !== null)
        .join(' · ');
    return { locale, num, unitOf, withUnit, date, day, line };
  }, [t, lang, unit]);
}
