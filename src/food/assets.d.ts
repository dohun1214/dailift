/** 앱에 넣는 SQLite 파일. Metro가 자산으로 다루고 `require`는 자산 번호를 돌려준다. */
declare module '*.db' {
  const assetId: number;
  export default assetId;
}
