import { PROCESSED_PAGE, type ProcessedFood } from '@/domain/processed-food';
import { supabase } from '@/lib/supabase';

/**
 * 가공식품은 서버 표 `processed_foods`에 있다(약 31만 개 — 앱에 넣기에는 크다). 누구나 읽을 수 있다(로그인 불필요).
 * 표와 찾는 함수는 `supabase/migrations/20261007000004_processed_foods.sql`.
 */
const COLUMNS = 'sid, name, maker, basis, kcal, protein, carb, fat, size, serv';

type Raw = Omit<ProcessedFood, 'basis'> & { basis: string };
const clean = (r: Raw): ProcessedFood => ({
  sid: r.sid,
  name: r.name,
  maker: r.maker ?? '',
  basis: r.basis === 'ml' ? 'ml' : 'g',
  kcal: Number(r.kcal) || 0,
  protein: Number(r.protein) || 0,
  carb: Number(r.carb) || 0,
  fat: Number(r.fat) || 0,
  size: r.size === null ? null : Number(r.size),
  serv: r.serv === null ? null : Number(r.serv),
});

/** 이름 · 제조사에 낱말이 모두 든 가공식품. `offset`부터 한 쪽(30개) */
export async function searchProcessedFoods(query: string, offset = 0): Promise<ProcessedFood[]> {
  const { data, error } = await supabase.rpc('search_processed_foods', {
    q: query,
    lim: PROCESSED_PAGE,
    off: offset,
  });
  if (error) throw error;
  return ((data ?? []) as Raw[]).map(clean);
}

/** 식품코드로 받기(다른 기기에서 즐겨찾기한 것처럼 이 기기에 사본이 없을 때) */
export async function fetchProcessedFoods(sids: readonly string[]): Promise<ProcessedFood[]> {
  if (sids.length === 0) return [];
  const { data, error } = await supabase
    .from('processed_foods')
    .select(COLUMNS)
    .in('sid', sids.slice(0, 200));
  if (error) throw error;
  return ((data ?? []) as Raw[]).map(clean);
}
