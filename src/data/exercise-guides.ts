/**
 * 기본 종목 동작 설명 5단계 (한/영). 키는 기본 종목 key.
 * 일반적인 자세 안내이며 의학적 조언이 아니다. 커스텀 종목에는 설명이 없다.
 */
export type ExerciseGuide = { ko: readonly string[]; en: readonly string[] };

export const EXERCISE_GUIDES: Readonly<Record<string, ExerciseGuide>> = {
  bench_press: {
    ko: [
      '벤치에 누워 눈이 바 바로 아래에 오게 해요.',
      '어깨너비보다 조금 넓게 바를 잡고 견갑을 모아요.',
      '바를 들어 가슴 위에서 팔을 곧게 펴요.',
      '가슴 중앙으로 천천히 내려요. 팔꿈치는 45도 정도로.',
      '발로 바닥을 밀며 시작 위치까지 밀어 올려요.',
    ],
    en: [
      'Lie on the bench with your eyes directly under the bar.',
      'Grip slightly wider than shoulder width and pull your shoulder blades together.',
      'Unrack the bar and hold it over your chest with straight arms.',
      'Lower it slowly to mid-chest, elbows at about 45 degrees.',
      'Drive your feet into the floor and press back to the start.',
    ],
  },
  incline_bench_press: {
    ko: [
      '벤치 등받이를 30–45도로 세우고 누워요.',
      '어깨너비보다 조금 넓게 바를 잡고 견갑을 모아요.',
      '바를 들어 윗가슴 위에서 팔을 펴요.',
      '쇄골 바로 아래로 천천히 내려요.',
      '윗가슴에 힘을 주며 밀어 올려요.',
    ],
    en: [
      'Set the bench to 30–45 degrees and lie back.',
      'Grip slightly wider than shoulder width and set your shoulder blades.',
      'Unrack and hold the bar over your upper chest.',
      'Lower it slowly to just below your collarbone.',
      'Press back up, focusing on your upper chest.',
    ],
  },
  dumbbell_bench_press: {
    ko: [
      '덤벨을 허벅지에 올리고 벤치에 앉아요.',
      '누우면서 덤벨을 가슴 옆으로 가져와요.',
      '견갑을 모으고 덤벨을 가슴 위로 밀어 올려요.',
      '팔꿈치를 45도 정도로 벌리며 천천히 내려요.',
      '가슴을 조이듯 다시 밀어 올려요.',
    ],
    en: [
      'Sit on the bench with the dumbbells on your thighs.',
      'Lie back and bring the dumbbells beside your chest.',
      'Set your shoulder blades and press the weights up over your chest.',
      'Lower slowly with elbows at about 45 degrees.',
      'Squeeze your chest and press back up.',
    ],
  },
  incline_dumbbell_press: {
    ko: [
      '벤치를 30–45도로 세우고 덤벨을 들고 앉아요.',
      '누우면서 덤벨을 어깨 앞쪽으로 가져와요.',
      '윗가슴 위로 덤벨을 밀어 올려요.',
      '팔꿈치를 살짝 모은 채 천천히 내려요.',
      '윗가슴에 힘을 주며 다시 밀어요.',
    ],
    en: [
      'Set the bench to 30–45 degrees and sit with the dumbbells.',
      'Lie back and bring the dumbbells to the front of your shoulders.',
      'Press them up over your upper chest.',
      'Lower slowly with elbows slightly tucked.',
      'Press back up through your upper chest.',
    ],
  },
  cable_fly: {
    ko: [
      '도르래를 어깨 높이쯤에 맞추고 손잡이를 잡아요.',
      '한 발 앞으로 나와 상체를 살짝 숙여요.',
      '팔꿈치를 살짝 굽힌 채 팔을 옆으로 벌려요.',
      '큰 원을 그리듯 손을 가슴 앞으로 모아요.',
      '가슴이 늘어나는 느낌으로 천천히 되돌려요.',
    ],
    en: [
      'Set the pulleys around shoulder height and grab the handles.',
      'Step forward and lean your torso slightly.',
      'Open your arms wide with a slight bend in the elbows.',
      'Bring your hands together in front of your chest in a wide arc.',
      'Return slowly, feeling the stretch in your chest.',
    ],
  },
  push_up: {
    ko: [
      '손을 어깨너비보다 조금 넓게 바닥에 짚어요.',
      '머리부터 발끝까지 일직선을 만들어요.',
      '배에 힘을 주고 엉덩이가 처지지 않게 해요.',
      '가슴이 바닥 가까이 갈 때까지 내려요.',
      '바닥을 밀어 팔을 펴며 올라와요.',
    ],
    en: [
      'Place your hands slightly wider than shoulder width.',
      'Make a straight line from head to heels.',
      'Brace your core and keep your hips from sagging.',
      'Lower until your chest is close to the floor.',
      'Push the floor away and straighten your arms.',
    ],
  },
  dips: {
    ko: [
      '평행봉을 잡고 팔을 펴서 몸을 들어 올려요.',
      '어깨를 내리고 가슴을 펴요.',
      '상체를 살짝 앞으로 기울여요.',
      '팔꿈치가 90도 정도 될 때까지 내려요.',
      '손바닥으로 봉을 밀며 올라와요.',
    ],
    en: [
      'Grip the bars and lift yourself up with straight arms.',
      'Keep your shoulders down and chest open.',
      'Lean your torso slightly forward.',
      'Lower until your elbows reach about 90 degrees.',
      'Press through your palms to come back up.',
    ],
  },
  overhead_press: {
    ko: [
      '바를 쇄골 위에 두고 어깨너비로 잡아요.',
      '발을 골반 너비로 벌리고 엉덩이와 배에 힘을 줘요.',
      '턱을 살짝 당기고 바를 머리 위로 밀어요.',
      '바가 머리를 지나면 머리를 앞으로 넣어요.',
      '천천히 쇄골 위치로 내려요.',
    ],
    en: [
      'Hold the bar on your collarbone with a shoulder-width grip.',
      'Stand hip-width apart and brace your glutes and core.',
      'Tuck your chin slightly and press the bar overhead.',
      'Once the bar passes your head, move your head forward.',
      'Lower slowly back to your collarbone.',
    ],
  },
  dumbbell_shoulder_press: {
    ko: [
      '등받이를 세운 벤치에 앉아 덤벨을 어깨 높이로 들어요.',
      '손바닥이 앞을 보게 하고 등을 붙여요.',
      '덤벨을 머리 위로 밀어 올려요.',
      '위에서 팔꿈치를 완전히 잠그지 않아요.',
      '천천히 어깨 높이로 내려요.',
    ],
    en: [
      'Sit on an upright bench and hold the dumbbells at shoulder height.',
      'Palms face forward and your back stays against the pad.',
      'Press the dumbbells overhead.',
      "Don't fully lock your elbows at the top.",
      'Lower slowly to shoulder height.',
    ],
  },
  lateral_raise: {
    ko: [
      '덤벨을 옆에 들고 곧게 서요.',
      '팔꿈치를 살짝 굽혀 고정해요.',
      '팔을 옆으로 어깨 높이까지 들어 올려요.',
      '어깨가 으쓱 올라가지 않게 해요.',
      '천천히 내려 다음 반복을 준비해요.',
    ],
    en: [
      'Stand tall with dumbbells at your sides.',
      'Keep a slight, fixed bend in your elbows.',
      'Raise your arms out to the side up to shoulder height.',
      "Don't let your shoulders shrug up.",
      'Lower slowly and repeat.',
    ],
  },
  face_pull: {
    ko: [
      '도르래를 얼굴 높이로 맞추고 로프를 잡아요.',
      '한 걸음 뒤로 물러나 팔을 펴요.',
      '로프를 얼굴 쪽으로 당기며 양손을 벌려요.',
      '팔꿈치는 높게, 견갑을 모아요.',
      '천천히 팔을 펴며 되돌려요.',
    ],
    en: [
      'Set the pulley at face height and grab the rope.',
      'Step back so your arms are straight.',
      'Pull the rope toward your face, spreading your hands apart.',
      'Keep your elbows high and squeeze your shoulder blades.',
      'Straighten your arms slowly to return.',
    ],
  },
  shrug: {
    ko: [
      '바를 어깨너비로 잡고 곧게 서요.',
      '팔은 편 채로 힘을 빼요.',
      '어깨를 귀 쪽으로 곧게 들어 올려요.',
      '위에서 잠깐 멈춰요.',
      '천천히 내려요. 어깨를 돌리지 않아요.',
    ],
    en: [
      'Hold the bar with a shoulder-width grip and stand tall.',
      'Keep your arms straight and relaxed.',
      'Lift your shoulders straight up toward your ears.',
      'Pause briefly at the top.',
      'Lower slowly without rolling your shoulders.',
    ],
  },
  deadlift: {
    ko: [
      '바가 발 중앙 위에 오게 서요.',
      '엉덩이를 뒤로 빼며 몸을 숙여 바를 잡아요.',
      '가슴을 펴고 등을 곧게, 배에 힘을 줘요.',
      '다리로 바닥을 밀며 바를 몸 가까이 붙여 일어서요.',
      '엉덩이를 뒤로 빼며 같은 길로 내려요.',
    ],
    en: [
      'Stand with the bar over the middle of your feet.',
      'Hinge at the hips and grip the bar.',
      'Lift your chest, keep your back flat, and brace your core.',
      'Push the floor away and stand up with the bar close to your body.',
      'Hinge back and lower it along the same path.',
    ],
  },
  barbell_row: {
    ko: [
      '바를 어깨너비로 잡고 무릎을 살짝 굽혀요.',
      '엉덩이를 뒤로 빼 상체를 45도 정도 숙여요.',
      '등을 곧게 유지하고 배에 힘을 줘요.',
      '팔꿈치를 뒤로 보내며 바를 배꼽 쪽으로 당겨요.',
      '천천히 팔을 펴며 내려요.',
    ],
    en: [
      'Grip the bar at shoulder width with a slight knee bend.',
      'Hinge forward to about 45 degrees.',
      'Keep your back flat and core braced.',
      'Drive your elbows back and pull the bar toward your belly button.',
      'Lower slowly by straightening your arms.',
    ],
  },
  dumbbell_row: {
    ko: [
      '한 손과 한쪽 무릎을 벤치에 올려요.',
      '반대 손으로 덤벨을 들고 등을 평평하게 해요.',
      '팔꿈치를 뒤로 보내며 덤벨을 옆구리로 당겨요.',
      '위에서 등을 조여요.',
      '천천히 팔을 펴며 내려요.',
    ],
    en: [
      'Place one hand and knee on the bench.',
      'Hold the dumbbell in the other hand with a flat back.',
      'Drive your elbow back and pull the dumbbell to your hip.',
      'Squeeze your back at the top.',
      'Lower slowly by straightening your arm.',
    ],
  },
  pull_up: {
    ko: [
      '손바닥이 앞을 보게 어깨너비보다 넓게 봉을 잡아요.',
      '팔을 펴고 매달려 어깨를 아래로 내려요.',
      '가슴을 봉 쪽으로 끌어올려요.',
      '턱이 봉을 넘을 때까지 당겨요.',
      '천천히 팔을 펴며 내려와요.',
    ],
    en: [
      'Grip the bar wider than shoulder width, palms facing forward.',
      'Hang with straight arms and pull your shoulders down.',
      'Pull your chest up toward the bar.',
      'Keep pulling until your chin clears the bar.',
      'Lower yourself slowly until your arms are straight.',
    ],
  },
  chin_up: {
    ko: [
      '손바닥이 나를 보게 어깨너비로 봉을 잡아요.',
      '팔을 펴고 매달려 배에 힘을 줘요.',
      '팔꿈치를 옆구리로 당기며 올라가요.',
      '턱이 봉을 넘을 때까지 당겨요.',
      '천천히 내려와요.',
    ],
    en: [
      'Grip the bar at shoulder width, palms facing you.',
      'Hang with straight arms and brace your core.',
      'Pull your elbows toward your sides to rise.',
      'Keep pulling until your chin clears the bar.',
      'Lower yourself slowly.',
    ],
  },
  lat_pulldown: {
    ko: [
      '허벅지를 패드에 고정하고 앉아요.',
      '어깨너비보다 넓게 바를 잡아요.',
      '가슴을 펴고 상체를 살짝 뒤로 기울여요.',
      '팔꿈치를 아래로 당겨 바를 윗가슴까지 내려요.',
      '천천히 팔을 펴며 되돌려요.',
    ],
    en: [
      'Sit with your thighs secured under the pad.',
      'Grip the bar wider than shoulder width.',
      'Lift your chest and lean back slightly.',
      'Pull your elbows down to bring the bar to your upper chest.',
      'Return slowly by straightening your arms.',
    ],
  },
  seated_cable_row: {
    ko: [
      '발을 발판에 두고 손잡이를 잡아 앉아요.',
      '등을 곧게 세우고 무릎을 살짝 굽혀요.',
      '팔꿈치를 뒤로 보내며 손잡이를 배 쪽으로 당겨요.',
      '견갑을 모아 잠깐 멈춰요.',
      '상체를 유지한 채 천천히 팔을 펴요.',
    ],
    en: [
      'Sit with your feet on the platform and grab the handle.',
      'Keep your back upright and knees slightly bent.',
      'Drive your elbows back and pull the handle to your stomach.',
      'Squeeze your shoulder blades and pause.',
      'Straighten your arms slowly without leaning.',
    ],
  },
  squat: {
    ko: [
      '바를 등 윗부분에 얹고 발을 어깨너비로 벌려요.',
      '숨을 들이마시고 배에 힘을 줘요.',
      '엉덩이를 뒤로 빼며 무릎을 발끝 방향으로 굽혀요.',
      '허벅지가 바닥과 평행해질 때까지 앉아요.',
      '발 전체로 바닥을 밀며 일어서요.',
    ],
    en: [
      'Rest the bar on your upper back with feet shoulder-width apart.',
      'Breathe in and brace your core.',
      'Sit your hips back and bend your knees in line with your toes.',
      'Go down until your thighs are parallel to the floor.',
      'Push through your whole foot to stand back up.',
    ],
  },
  leg_press: {
    ko: [
      '등과 엉덩이를 등받이에 붙이고 앉아요.',
      '발을 발판 가운데에 어깨너비로 올려요.',
      '안전 장치를 풀고 무릎을 천천히 굽혀요.',
      '엉덩이가 들리지 않는 깊이까지 내려요.',
      '발바닥으로 밀어 무릎을 잠그지 않을 만큼 펴요.',
    ],
    en: [
      'Sit with your back and hips against the pad.',
      'Place your feet shoulder-width apart in the middle of the platform.',
      'Release the safeties and bend your knees slowly.',
      'Go as deep as you can without your hips lifting.',
      'Press through your feet, stopping just short of locking your knees.',
    ],
  },
  romanian_deadlift: {
    ko: [
      '바를 어깨너비로 잡고 곧게 서요.',
      '무릎을 살짝 굽혀 고정해요.',
      '엉덩이를 뒤로 빼며 바를 허벅지를 따라 내려요.',
      '햄스트링이 늘어나는 곳까지 내려요. 등은 곧게.',
      '엉덩이를 앞으로 밀며 일어서요.',
    ],
    en: [
      'Hold the bar at shoulder width and stand tall.',
      'Keep a slight, fixed bend in your knees.',
      'Push your hips back and slide the bar down your thighs.',
      'Lower until you feel a hamstring stretch, back flat.',
      'Drive your hips forward to stand up.',
    ],
  },
  bulgarian_split_squat: {
    ko: [
      '벤치를 등지고 한 발을 뒤로 벤치에 올려요.',
      '앞발은 한 걸음 앞에 두고 덤벨을 들어요.',
      '상체를 세우고 뒷무릎을 바닥 쪽으로 내려요.',
      '앞 허벅지가 바닥과 평행할 때까지 내려요.',
      '앞발로 밀어 올라와요. 반대쪽도 해요.',
    ],
    en: [
      'Stand facing away from a bench and rest one foot on it behind you.',
      'Place your front foot a stride ahead and hold the dumbbells.',
      'Keep your torso upright and lower your back knee toward the floor.',
      'Go down until your front thigh is parallel to the floor.',
      'Push through your front foot to rise. Switch sides.',
    ],
  },
  lunge: {
    ko: [
      '덤벨을 들고 곧게 서요.',
      '한 발을 크게 앞으로 내디뎌요.',
      '두 무릎이 90도 정도 될 때까지 내려요.',
      '앞무릎이 안쪽으로 모이지 않게 해요.',
      '앞발로 밀어 제자리로 돌아와요. 번갈아 해요.',
    ],
    en: [
      'Stand tall holding the dumbbells.',
      'Take a long step forward with one leg.',
      'Lower until both knees are at about 90 degrees.',
      "Don't let your front knee cave inward.",
      'Push off your front foot to return. Alternate legs.',
    ],
  },
  leg_extension: {
    ko: [
      '무릎이 기계의 회전축에 맞게 앉아요.',
      '발목 앞에 패드를 대고 손잡이를 잡아요.',
      '허벅지 앞에 힘을 주며 다리를 펴요.',
      '위에서 잠깐 멈춰요.',
      '천천히 내려요.',
    ],
    en: [
      "Sit so your knees line up with the machine's pivot.",
      'Put the pad in front of your ankles and hold the handles.',
      'Straighten your legs by squeezing your quads.',
      'Pause briefly at the top.',
      'Lower slowly.',
    ],
  },
  leg_curl: {
    ko: [
      '무릎이 기계의 회전축에 맞게 자리를 잡아요.',
      '발목 뒤에 패드를 대요.',
      '허벅지 뒤에 힘을 주며 무릎을 굽혀요.',
      '끝에서 잠깐 멈춰요.',
      '천천히 다리를 펴요.',
    ],
    en: [
      "Position your knees in line with the machine's pivot.",
      'Put the pad behind your ankles.',
      'Bend your knees by squeezing your hamstrings.',
      'Pause briefly at the end.',
      'Straighten your legs slowly.',
    ],
  },
  hip_thrust: {
    ko: [
      '벤치에 등 윗부분을 기대고 바를 골반 위에 올려요.',
      '발을 어깨너비로 바닥에 두고 무릎을 굽혀요.',
      '턱을 당기고 배에 힘을 줘요.',
      '엉덩이를 조이며 골반을 들어 몸을 일직선으로.',
      '천천히 엉덩이를 내려요.',
    ],
    en: [
      'Rest your upper back on a bench with the bar over your hips.',
      'Place your feet shoulder-width apart with knees bent.',
      'Tuck your chin and brace your core.',
      'Squeeze your glutes and lift your hips into a straight line.',
      'Lower your hips slowly.',
    ],
  },
  calf_raise: {
    ko: [
      '발 앞꿈치를 발판 끝에 올려요.',
      '무릎은 편 채로 곧게 서요.',
      '뒤꿈치를 최대한 높이 들어 올려요.',
      '위에서 잠깐 멈춰요.',
      '종아리가 늘어나도록 천천히 내려요.',
    ],
    en: [
      'Place the balls of your feet on the edge of the platform.',
      'Stand tall with your knees straight.',
      'Raise your heels as high as you can.',
      'Pause briefly at the top.',
      'Lower slowly to stretch your calves.',
    ],
  },
  barbell_curl: {
    ko: [
      '바를 어깨너비로, 손바닥이 앞을 보게 잡아요.',
      '팔꿈치를 옆구리에 붙이고 곧게 서요.',
      '팔꿈치를 고정한 채 바를 들어 올려요.',
      '몸을 흔들어 반동을 쓰지 않아요.',
      '천천히 팔을 펴며 내려요.',
    ],
    en: [
      'Grip the bar at shoulder width, palms facing forward.',
      'Stand tall with elbows at your sides.',
      'Curl the bar up while keeping your elbows fixed.',
      "Don't swing your body for momentum.",
      'Lower slowly until your arms are straight.',
    ],
  },
  dumbbell_curl: {
    ko: [
      '덤벨을 옆에 들고 손바닥이 앞을 보게 서요.',
      '팔꿈치를 옆구리에 붙여요.',
      '팔꿈치를 고정한 채 덤벨을 들어 올려요.',
      '위에서 이두를 조여요.',
      '천천히 내려요.',
    ],
    en: [
      'Stand with dumbbells at your sides, palms forward.',
      'Keep your elbows close to your sides.',
      'Curl the dumbbells up with your elbows fixed.',
      'Squeeze your biceps at the top.',
      'Lower slowly.',
    ],
  },
  hammer_curl: {
    ko: [
      '덤벨을 옆에 들고 손바닥이 몸을 보게 서요.',
      '팔꿈치를 옆구리에 붙여요.',
      '손목 방향을 유지한 채 덤벨을 들어 올려요.',
      '위에서 잠깐 멈춰요.',
      '천천히 내려요.',
    ],
    en: [
      'Stand with dumbbells at your sides, palms facing your body.',
      'Keep your elbows close to your sides.',
      'Curl the dumbbells up without rotating your wrists.',
      'Pause briefly at the top.',
      'Lower slowly.',
    ],
  },
  triceps_pushdown: {
    ko: [
      '높은 도르래에 바나 로프를 걸고 잡아요.',
      '팔꿈치를 옆구리에 붙이고 상체를 살짝 숙여요.',
      '팔꿈치를 고정한 채 손을 아래로 밀어 팔을 펴요.',
      '아래에서 삼두를 조여요.',
      '천천히 팔꿈치를 굽혀 되돌려요.',
    ],
    en: [
      'Attach a bar or rope to a high pulley and grab it.',
      'Keep your elbows at your sides and lean forward slightly.',
      'Push down until your arms are straight, elbows fixed.',
      'Squeeze your triceps at the bottom.',
      'Bend your elbows slowly to return.',
    ],
  },
  overhead_triceps_extension: {
    ko: [
      '낮은 도르래에 로프를 걸고 등을 돌려 서요.',
      '로프를 머리 뒤로 들고 팔꿈치를 위로 향해요.',
      '팔꿈치를 고정한 채 머리 위로 팔을 펴요.',
      '위에서 삼두를 조여요.',
      '천천히 머리 뒤로 내려요.',
    ],
    en: [
      'Attach a rope to a low pulley and stand facing away.',
      'Hold the rope behind your head with elbows pointing up.',
      'Extend your arms overhead with your elbows fixed.',
      'Squeeze your triceps at the top.',
      'Lower slowly behind your head.',
    ],
  },
  plank: {
    ko: [
      '팔꿈치를 어깨 바로 아래에 두고 엎드려요.',
      '발끝으로 몸을 들어 머리부터 발끝까지 일직선을 만들어요.',
      '배와 엉덩이에 힘을 줘요.',
      '허리가 처지거나 엉덩이가 들리지 않게 해요.',
      '숨을 고르게 쉬며 버텨요.',
    ],
    en: [
      'Lie face down with your elbows directly under your shoulders.',
      'Lift onto your toes to form a straight line from head to heels.',
      'Brace your core and squeeze your glutes.',
      "Don't let your lower back sag or your hips rise.",
      'Breathe steadily and hold.',
    ],
  },
};

export function guideFor(exerciseId: string): ExerciseGuide | undefined {
  const key = exerciseId.startsWith('base:') ? exerciseId.slice(5) : null;
  return key ? EXERCISE_GUIDES[key] : undefined;
}
