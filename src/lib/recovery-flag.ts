/**
 * "진행 중인 운동이 있어요" 안내를 이번 실행에서 이미 했는지(또는 할 필요가 없는지).
 * 앱이 운동 화면으로 바로 열렸으면(잠금 화면의 휴식 표시를 눌러서) 묻지 않는다.
 */
let asked = false;

export const recoveryAsked = () => asked;
export const markRecoveryAsked = () => {
  asked = true;
};
