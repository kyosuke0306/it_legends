// Google ログインで記録を保存するための Firebase の設定。
// Firebase のコンソールで「ウェブアプリを追加」したときに表示される値をそのまま貼る。
// （この値は公開してよいもの。記録を守るのは firestore.rules の読み書きルール）
// 空のままだと、ログインのボタンは「準備中」と表示される
export const FIREBASE_CONFIG = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  appId: '',
};
