/**
 * 개발 빌드 전용 컴포넌트 미리보기. `dailift://dev/ui`로 연다.
 * 사용자에게 보이지 않는 화면이라 문자열을 번역 파일에 넣지 않는다.
 */
import { Redirect } from 'expo-router';
import { Camera, Copy, Ellipsis, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import {
  AppText,
  Badge,
  Button,
  Card,
  Checkbox,
  Chip,
  IconButton,
  ListRow,
  ListSection,
  Screen,
  Segmented,
  TextField,
  Toggle,
  TopBar,
} from '@/components/ui';
import { useSettings } from '@/stores/settings';
import type { Accent, ThemePreference } from '@/theme/tokens';

export default function UiPreview() {
  const themePreference = useSettings((s) => s.themePreference);
  const accent = useSettings((s) => s.accent);
  const setThemePreference = useSettings((s) => s.setThemePreference);
  const setAccent = useSettings((s) => s.setAccent);
  const [tab, setTab] = useState<'a' | 'b'>('a');
  const [chip, setChip] = useState('chest');
  const [on, setOn] = useState(true);
  const [checked, setChecked] = useState(true);
  const [weight, setWeight] = useState('62.5');

  if (!__DEV__) return <Redirect href="/" />;

  return (
    <Screen
      header={<TopBar title="컴포넌트" trailing={<IconButton icon={Ellipsis} label="더보기" />} />}
      footer={<Button label="운동 완료" />}
    >
      <Segmented<ThemePreference>
        options={[
          { value: 'system', label: '시스템' },
          { value: 'light', label: '라이트' },
          { value: 'dark', label: '다크' },
        ]}
        value={themePreference}
        onChange={setThemePreference}
      />
      <Segmented<Accent>
        options={[
          { value: 'mono', label: '모노' },
          { value: 'blue', label: '블루' },
          { value: 'lime', label: '라임' },
        ]}
        value={accent}
        onChange={setAccent}
      />

      <AppText variant="h1">제목 H1</AppText>
      <AppText variant="h2">제목 H2 · 83.3 kg</AppText>
      <AppText variant="body" tone="secondary">
        지난번 3세트 모두 10회 성공. 오늘은 62.5kg 어때요?
      </AppText>

      <View style={styles.row}>
        <Badge label="오늘" />
        <Badge label="오늘" kind="solid" />
        <Badge label="PR" kind="pr" />
      </View>

      <View style={styles.row}>
        {['all', 'chest', 'back', 'legs'].map((c) => (
          <Chip
            key={c}
            label={{ all: '전체', chest: '가슴', back: '등', legs: '하체' }[c] ?? c}
            selected={chip === c}
            onPress={() => setChip(c)}
          />
        ))}
      </View>

      <Card>
        <AppText variant="title">Push A</AppText>
        <AppText variant="bodySm" tone="secondary">
          벤치프레스 · 인클라인 덤벨 프레스 · 오버헤드 프레스 외 2
        </AppText>
        <View style={styles.row}>
          <TextField
            label="무게"
            unit="kg"
            value={weight}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
          />
          <TextField label="횟수" unit="회" value="9" muted />
        </View>
        <Button label="운동 시작" />
      </Card>

      <Segmented
        options={[
          { value: 'a', label: '히스토리' },
          { value: 'b', label: '통계' },
        ]}
        value={tab}
        onChange={setTab}
      />

      <ListSection title="운동">
        <ListRow label="바 무게" value="20kg" onPress={() => {}} />
        <ListRow
          label="운동 중 화면 켜두기"
          trailing={
            <Toggle value={on} onValueChange={setOn} accessibilityLabel="운동 중 화면 켜두기" />
          }
        />
        <ListRow
          label="벤치프레스 선택"
          trailing={
            <Checkbox checked={checked} onChange={setChecked} accessibilityLabel="벤치프레스" />
          }
        />
        <ListRow label="모든 데이터 삭제" destructive onPress={() => {}} />
      </ListSection>

      <View style={styles.row}>
        <IconButton icon={Plus} label="추가" />
        <IconButton icon={Camera} label="사진" tone="plain" />
      </View>
      <Button label="직접 종목 만들기" variant="secondary" icon={Plus} />
      <Button label="내 루틴으로 복사" icon={Copy} size="md" />
      <Button label="운동 기록만 백업" variant="ghost" size="sm" />
      <Button label="계정과 모든 데이터 삭제" variant="danger" />
      <Button label="비활성" disabled />
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: theme.space.sm },
}));
