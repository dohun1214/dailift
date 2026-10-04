import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Keyboard, Platform, type TextInput } from 'react-native';

/**
 * 세트 입력칸 사이를 옮겨 다니기 위한 연결 고리.
 * 숫자 키패드에는 '다음·완료' 키가 없어서, 키보드 위에 붙는 줄(KeyboardBar)이 이 정보를 쓴다.
 */
type FieldNav = {
  register: (key: string, input: TextInput | null) => void;
  focused: (key: string, label: string) => void;
  blurred: (key: string) => void;
};

const noop: FieldNav = { register: () => {}, focused: () => {}, blurred: () => {} };
const FieldNavContext = createContext<FieldNav>(noop);

export const FieldNavProvider = FieldNavContext.Provider;
export const useFieldNavTarget = () => useContext(FieldNavContext);

/** 순서(order) 안에서 지금 칸 다음에 있는, 화면에 있는 칸 */
export function nextFieldKey(
  order: readonly string[],
  current: string | null,
  available: (key: string) => boolean,
): string | null {
  if (current === null) return null;
  const at = order.indexOf(current);
  if (at === -1) return null;
  for (let i = at + 1; i < order.length; i++) {
    const key = order[i];
    if (key !== undefined && available(key)) return key;
  }
  return null;
}

/**
 * order: 화면에 보이는 입력칸 key를 위에서 아래 순으로.
 * current: 지금 입력 중인 칸(없으면 null), next: 다음 칸으로(없으면 키보드를 닫는다).
 */
export function useFieldNav(order: readonly string[]) {
  const inputs = useRef(new Map<string, TextInput>());
  const [current, setCurrent] = useState<{ key: string; label: string } | null>(null);
  const orderRef = useRef(order);
  orderRef.current = order;

  const nav = useMemo<FieldNav>(
    () => ({
      register: (key, input) => {
        if (input) inputs.current.set(key, input);
        else inputs.current.delete(key);
      },
      focused: (key, label) => setCurrent({ key, label }),
      blurred: (key) => setCurrent((c) => (c?.key === key ? null : c)),
    }),
    [],
  );

  const currentKey = current?.key ?? null;
  const next = useCallback(() => {
    const key = nextFieldKey(orderRef.current, currentKey, (k) => inputs.current.has(k));
    if (key) inputs.current.get(key)?.focus();
    else Keyboard.dismiss();
  }, [currentKey]);

  return { nav, current, next, done: Keyboard.dismiss };
}

/** 키보드가 올라와 있는지 */
export function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    // iOS는 올라오기 시작할 때 알려 줘서 줄이 키보드와 함께 움직인다.
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, () => setVisible(true));
    const hide = Keyboard.addListener(hideEvent, () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}
