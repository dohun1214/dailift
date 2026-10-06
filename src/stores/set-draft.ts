import { create } from 'zustand';

import { type Amount, type FoodItem, LIMITS, type SetItem } from '@/domain/diet';

type SetDraftState = {
  items: SetItem[];
  /** 세트 화면을 열 때 담겨 있던 음식으로 시작한다 */
  start: (items: readonly SetItem[]) => void;
  /** 맨 뒤에 담는다. 가득 찼으면 담지 않고 false */
  add: (item: FoodItem, amount: Amount) => boolean;
  /** 방금 담은 것을 되돌린다(맨 뒤 하나) */
  removeLast: () => void;
  setAmount: (index: number, amount: Amount) => void;
  removeAt: (index: number) => void;
};

/**
 * 만들거나 고치는 중인 세트에 담은 음식. 세트 화면과 '세트에 담기'(음식 찾기) 화면이 같이 쓴다.
 * 저장하기 전의 임시 값이라 기기에 남기지 않는다.
 */
export const useSetDraft = create<SetDraftState>()((set, get) => ({
  items: [],
  start: (items) => set({ items: [...items] }),
  add: (item, amount) => {
    if (get().items.length >= LIMITS.setItems) return false;
    set((s) => ({ items: [...s.items, { item, amount }] }));
    return true;
  },
  removeLast: () => set((s) => ({ items: s.items.slice(0, -1) })),
  setAmount: (index, amount) =>
    set((s) => ({ items: s.items.map((it, i) => (i === index ? { ...it, amount } : it)) })),
  removeAt: (index) => set((s) => ({ items: s.items.filter((_, i) => i !== index) })),
}));
