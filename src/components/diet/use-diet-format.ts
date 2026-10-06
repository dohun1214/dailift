import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { FoodSrc, Meal } from '@/db/schema';
import { type Amount, type FoodUnit, unitCount, unitNoun } from '@/domain/diet';
import { useAppLanguage } from '@/i18n/use-app-language';

/** 식단 화면에서 같이 쓰는 글자: 숫자, 양("1.5공기 (315 g)"), 단위 이름, 날짜, 끼니 */
export function useDietFormat() {
  const { t } = useTranslation();
  const lang = useAppLanguage();
  return useMemo(() => {
    const locale = lang === 'ko' ? 'ko-KR' : 'en-US';
    /** 정수로 (칼로리 · 합계) */
    const int = (n: number) => Math.round(n).toLocaleString(locale);
    /** 소수 둘째 자리까지 (양 · 개수) */
    const num = (n: number) => n.toLocaleString(locale, { maximumFractionDigits: 2 });
    /** 단위 고르는 칩: "1공기", 이름 없는 1회 양은 "1인분" */
    const unitName = (u: FoodUnit) => u.name ?? t('diet.unit.serving');
    const unitChip = (u: FoodUnit, basis: string) => `${unitName(u)} (${num(u.grams)} ${basis})`;
    /** 큰 숫자 옆의 단위: "공기", "cup", "× 3 oz" */
    const unitSuffix = (u: FoodUnit) => {
      if (u.name === null) return t('diet.unit.servingNoun');
      return unitNoun(u.name) ?? `× ${u.name}`;
    };
    /** "1.5공기", "2 cups"는 만들지 않고 "2 cup", 1로 시작하지 않는 단위는 "2 × 3 oz" */
    const countLabel = (count: number, u: FoodUnit) => {
      if (count === 1) return unitName(u);
      if (u.name === null) return t('diet.unit.servings', { n: num(count) });
      const noun = unitNoun(u.name);
      if (!noun) return `${num(count)} × ${u.name}`;
      return `${num(count)}${/^1\s/.test(u.name.trim()) ? ' ' : ''}${noun}`;
    };
    /** 기록 줄에 쓰는 양: "150 g", "1공기 (210 g)" */
    const amount = (a: Amount, basis: string) => {
      const grams = `${num(Math.round(a.grams * 10) / 10)} ${basis}`;
      return a.unit ? `${countLabel(unitCount(a), a.unit)} (${grams})` : grams;
    };
    const dayFmt = new Intl.DateTimeFormat(locale, {
      month: lang === 'ko' ? 'long' : 'short',
      day: 'numeric',
      weekday: 'short',
    });
    const monthFmt = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' });
    const fullDayFmt = new Intl.DateTimeFormat(locale, {
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    });
    const weekdayFmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    const meal = (m: Meal) => t(`diet.meal.${m}`);
    const source = (src: FoodSrc) => t(`diet.source.${src}`);
    return {
      locale,
      int,
      num,
      unitName,
      unitChip,
      unitSuffix,
      amount,
      day: (d: Date) => dayFmt.format(d),
      fullDay: (d: Date) => fullDayFmt.format(d),
      month: (d: Date) => monthFmt.format(d),
      weekday: (d: Date) => weekdayFmt.format(d),
      meal,
      source,
    };
  }, [t, lang]);
}

export type DietFormat = ReturnType<typeof useDietFormat>;
