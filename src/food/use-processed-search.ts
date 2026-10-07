import { useCallback, useEffect, useRef, useState } from 'react';

import {
  PROCESSED_PAGE,
  type ProcessedFood,
  processedQuery,
  type ServerFoodSrc,
} from '@/domain/processed-food';

import { searchProcessedFoods } from './processed-remote';

/** 글자를 치는 동안에는 기다렸다가 멈추면 찾는다 */
const DEBOUNCE_MS = 350;

type State = {
  /** idle: 찾지 않음(검색어가 짧다) / loading: 찾는 중 / ready: 받음 / failed: 못 받음(인터넷 없음 등) */
  status: 'idle' | 'loading' | 'ready' | 'failed';
  rows: ProcessedFood[];
  /** 더 받을 것이 있을 수 있다 */
  more: boolean;
  loadingMore: boolean;
};
const IDLE: State = { status: 'idle', rows: [], more: false, loadingMore: false };

/**
 * 가공식품 검색(서버). `enabled`가 false면(그 출처를 보이지 않는 지역 · 검색어) 아무것도 하지 않는다.
 * 검색어가 바뀌면 앞의 요청 결과는 버린다.
 */
export function useProcessedSearch(text: string, enabled: boolean, src: ServerFoodSrc = 'mfdsp') {
  const query = enabled ? processedQuery(text) : null;
  const [state, setState] = useState<State>(IDLE);
  // 지금 보여 줄 검색어의 번호. 늦게 온 옛 응답을 거른다.
  const turn = useRef(0);
  // 다시 시도를 누를 때마다 올린다(같은 검색어로 다시 찾는다).
  const [attempt, setAttempt] = useState(0);
  const lastAttempt = useRef(0);

  useEffect(() => {
    turn.current += 1;
    const mine = turn.current;
    if (query === null) {
      setState(IDLE);
      return;
    }
    setState({ status: 'loading', rows: [], more: false, loadingMore: false });
    const timer = setTimeout(
      () => {
        searchProcessedFoods(query, 0, src)
          .then((rows) => {
            if (turn.current !== mine) return;
            setState({
              status: 'ready',
              rows,
              more: rows.length >= PROCESSED_PAGE,
              loadingMore: false,
            });
          })
          .catch(() => {
            if (turn.current === mine) setState({ ...IDLE, status: 'failed' });
          });
      },
      // 다시 시도는 기다리지 않고 바로 찾는다.
      attempt === lastAttempt.current ? DEBOUNCE_MS : 0,
    );
    lastAttempt.current = attempt;
    return () => clearTimeout(timer);
  }, [query, src, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const loadMore = useCallback(() => {
    if (query === null) return;
    const mine = turn.current;
    setState((cur) => {
      if (cur.status !== 'ready' || !cur.more || cur.loadingMore) return cur;
      searchProcessedFoods(query, cur.rows.length, src)
        .then((rows) => {
          if (turn.current !== mine) return;
          setState((now) => {
            const have = new Set(now.rows.map((r) => r.sid));
            return {
              status: 'ready',
              rows: [...now.rows, ...rows.filter((r) => !have.has(r.sid))],
              more: rows.length >= PROCESSED_PAGE,
              loadingMore: false,
            };
          });
        })
        .catch(() => {
          // 더 받기만 실패했으면 받은 것은 그대로 두고 다시 누를 수 있게 한다.
          if (turn.current === mine) setState((now) => ({ ...now, loadingMore: false }));
        });
      return { ...cur, loadingMore: true };
    });
  }, [query, src]);

  return { ...state, loadMore, retry };
}
