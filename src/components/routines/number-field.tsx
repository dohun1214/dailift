import { useEffect, useState } from 'react';

import { TextField } from '@/components/ui';
import { parseDecimal } from '@/lib/number';

type Props = {
  label: string;
  unit?: string;
  value: number;
  onChange: (value: number) => void;
  decimal?: boolean;
  error?: string;
  invalid?: boolean;
};

/**
 * 숫자 입력칸. 입력 중에는 글자를 그대로 두고, 숫자로 읽히면 바로 값에 반영한다.
 * 읽히지 않는 글자(빈칸 등)는 NaN으로 넘겨 저장 전 검사에서 걸리게 한다.
 */
export function NumberField({
  label,
  unit,
  value,
  onChange,
  decimal = false,
  error,
  invalid,
}: Props) {
  const [text, setText] = useState(() => format(value));

  // 밖에서 값이 바뀌면(초기화 등) 글자도 맞춘다.
  useEffect(() => {
    setText((prev) => (sameNumber(read(prev, decimal), value) ? prev : format(value)));
  }, [value, decimal]);

  return (
    <TextField
      label={label}
      unit={unit}
      value={text}
      keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
      inputMode={decimal ? 'decimal' : 'numeric'}
      error={error}
      invalid={invalid}
      selectTextOnFocus
      onChangeText={(next) => {
        setText(next);
        onChange(read(next, decimal));
      }}
    />
  );
}

function format(value: number): string {
  return Number.isFinite(value) ? String(value) : '';
}

function read(text: string, decimal: boolean): number {
  if (decimal) return parseDecimal(text) ?? Number.NaN;
  return /^\d+$/.test(text.trim()) ? Number.parseInt(text, 10) : Number.NaN;
}

function sameNumber(a: number, b: number) {
  return a === b || (Number.isNaN(a) && Number.isNaN(b));
}
