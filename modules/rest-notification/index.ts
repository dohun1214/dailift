import { requireOptionalNativeModule } from 'expo';

type RestNotificationModule = {
  /** 남은 시간이 줄어드는 진행 중 알림을 띄운다. 권한이 없거나 이미 끝났으면 false */
  show(endsAt: number, title: string, body: string, channelName: string, url: string): boolean;
  hide(): void;
};

/** 안드로이드 전용. 이 모듈이 들어 있지 않은 빌드(예전 개발용 빌드, iOS)에서는 null */
export default requireOptionalNativeModule<RestNotificationModule>('RestNotification');
