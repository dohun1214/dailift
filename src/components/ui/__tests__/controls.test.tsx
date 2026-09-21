import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { Button } from '../button';
import { Checkbox } from '../checkbox';
import { ListRow, ListSection } from '../list-row';
import { Segmented } from '../segmented';
import { TextField } from '../text-field';
import { Toggle } from '../toggle';

describe('Button', () => {
  it('누르면 onPress를 부른다', async () => {
    const onPress = jest.fn();
    await render(<Button label="운동 시작" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: '운동 시작' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('비활성이면 누를 수 없고 상태를 알린다', async () => {
    const onPress = jest.fn();
    await render(<Button label="저장" onPress={onPress} disabled />);
    const button = screen.getByRole('button', { name: '저장' });
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(button).toBeDisabled();
  });
});

describe('Toggle', () => {
  function Harness() {
    const [on, setOn] = useState(false);
    return <Toggle value={on} onValueChange={setOn} accessibilityLabel="화면 켜두기" />;
  }

  it('누를 때마다 켜짐/꺼짐이 바뀌고 스위치 상태를 알린다', async () => {
    await render(<Harness />);
    const toggle = screen.getByRole('switch', { name: '화면 켜두기' });
    expect(toggle).not.toBeChecked();
    await fireEvent.press(toggle);
    expect(screen.getByRole('switch', { name: '화면 켜두기' })).toBeChecked();
  });
});

describe('Checkbox', () => {
  it('누르면 반대 값으로 onChange를 부른다', async () => {
    const onChange = jest.fn();
    await render(<Checkbox checked={false} onChange={onChange} accessibilityLabel="벤치프레스" />);
    await fireEvent.press(screen.getByRole('checkbox', { name: '벤치프레스' }));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe('Segmented', () => {
  it('선택된 탭을 알리고, 다른 탭을 누르면 그 값을 넘긴다', async () => {
    const onChange = jest.fn();
    await render(
      <Segmented
        options={[
          { value: 'history', label: '히스토리' },
          { value: 'stats', label: '통계' },
        ]}
        value="history"
        onChange={onChange}
      />,
    );
    expect(screen.getByRole('tab', { name: '히스토리' })).toBeSelected();
    await fireEvent.press(screen.getByRole('tab', { name: '통계' }));
    expect(onChange).toHaveBeenCalledWith('stats');
  });
});

describe('TextField', () => {
  it('라벨로 찾을 수 있고 입력을 넘긴다', async () => {
    const onChangeText = jest.fn();
    await render(<TextField label="무게" unit="kg" value="" onChangeText={onChangeText} />);
    await fireEvent.changeText(screen.getByLabelText('무게'), '62.5');
    expect(onChangeText).toHaveBeenCalledWith('62.5');
    expect(screen.getByText('kg')).toBeOnTheScreen();
  });

  it('오류 문구를 보여준다', async () => {
    await render(<TextField label="이름" value="" error="이름을 입력해 주세요" />);
    expect(screen.getByText('이름을 입력해 주세요')).toBeOnTheScreen();
  });
});

describe('ListSection', () => {
  it('제목과 행을 그리고, 누를 수 있는 행은 버튼이다', async () => {
    const onPress = jest.fn();
    await render(
      <ListSection title="운동">
        <ListRow label="바 무게" value="20kg" onPress={onPress} />
        <ListRow label="버전" value="1.0.0" />
      </ListSection>,
    );
    expect(screen.getByRole('header', { name: '운동' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: '바 무게 20kg' }));
    expect(onPress).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /버전/ })).toBeNull();
  });
});
