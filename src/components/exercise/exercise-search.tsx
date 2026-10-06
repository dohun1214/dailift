import { useTranslation } from 'react-i18next';

import { NoMatchCard, SearchCreateRow } from '@/components/ui';

const NAME_MAX = 40;

/** 검색어를 새 종목 이름으로 쓸 때의 글자(앞뒤 공백 제거, 길이 제한). 빈 검색어면 null */
export function creatableName(query: string): string | null {
  return query.trim().slice(0, NAME_MAX) || null;
}

type RowProps = {
  query: string;
  onChangeQuery: (v: string) => void;
  /** '만들기'를 눌렀을 때 */
  onCreate: () => void;
};

/** 종목 검색칸 + 오른쪽 '만들기' 버튼 */
export function ExerciseSearchRow({ query, onChangeQuery, onCreate }: RowProps) {
  const { t } = useTranslation();
  return (
    <SearchCreateRow
      query={query}
      onChangeQuery={onChangeQuery}
      onCreate={onCreate}
      searchLabel={t('exercises.search')}
      placeholder={t('exercises.searchPlaceholder')}
      clearLabel={t('exerciseList.clear')}
      createLabel={t('exercises.createShort')}
      createA11y={t('exercises.create')}
    />
  );
}

type NoneProps = {
  query: string;
  /** 이름을 채워서(가능하면) 종목 만들기를 연다 */
  onCreate: (name: string | null) => void;
};

/** 검색 결과가 없을 때: 그 이름으로 바로 만들기 */
export function NoExerciseCard({ query, onCreate }: NoneProps) {
  const { t } = useTranslation();
  const name = creatableName(query);
  return (
    <NoMatchCard
      title={t('exercises.noMatchTitle', { query: query.trim() })}
      body={t('exercises.noMatchBody')}
      createLabel={name ? t('exercises.createNamed', { name }) : t('exercises.create')}
      onCreate={() => onCreate(name)}
    />
  );
}
