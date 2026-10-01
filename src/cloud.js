// Google ログインでの記録の保存（Firebase）。
// 通信を軽くするため、Firebase の部品はログインするときだけ読み込む（ログインしない人は一切読み込まない）
// 書き込みは「変化があってから 1 分後にまとめて 1 回」と「画面を閉じる・切り替えるとき」だけ
import { FIREBASE_CONFIG } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/11.0.2/';
const FLAG = 'it_legends.cloud'; // 前回ログインしていたか（起動時に Firebase を読むかどうかの目印）
export const cloudReady = Boolean(FIREBASE_CONFIG.apiKey);

let fb;
async function load() {
  if (fb) return fb;
  const [{ initializeApp }, auth, store] = await Promise.all([
    import(`${SDK}firebase-app.js`),
    import(`${SDK}firebase-auth.js`),
    import(`${SDK}firebase-firestore-lite.js`),
  ]);
  const app = initializeApp(FIREBASE_CONFIG);
  fb = { auth, store, a: auth.getAuth(app), db: store.getFirestore(app) };
  return fb;
}

const flag = {
  get: () => { try { return localStorage.getItem(FLAG) === '1'; } catch { return false; } },
  set: (on) => { try { on ? localStorage.setItem(FLAG, '1') : localStorage.removeItem(FLAG); } catch {} },
};

// 前回ログインしていたら、ログイン状態を戻す。ユーザー（いなければ null）を返す
export async function restoreUser() {
  if (!cloudReady || !flag.get()) return null;
  const f = await load();
  await f.a.authStateReady();
  return f.a.currentUser;
}

export async function signIn() {
  const f = await load();
  const { user } = await f.auth.signInWithPopup(f.a, new f.auth.GoogleAuthProvider());
  flag.set(true);
  return user;
}

export async function signOut() {
  flushSoon.cancel?.();
  const f = await load();
  await f.auth.signOut(f.a);
  flag.set(false);
}

// クラウドの記録 { state(文字列), savedAt } か null
export async function fetchSave(uid) {
  const f = await load();
  const snap = await f.store.getDoc(f.store.doc(f.db, 'saves', uid));
  return snap.exists() ? snap.data() : null;
}

export async function pushSave(uid, stateJson) {
  const f = await load();
  await f.store.setDoc(f.store.doc(f.db, 'saves', uid), { state: stateJson, savedAt: Date.now() });
}

// 変化があったら呼ぶ。1分ためてから1回だけ送る
let timer = null;
let pending = null;
export function flushSoon(uid, getJson, onDone) {
  pending = { uid, getJson, onDone };
  timer ??= setTimeout(flush, 60_000);
}
flushSoon.cancel = () => {
  clearTimeout(timer);
  timer = null;
  pending = null;
};
export async function flush() {
  clearTimeout(timer);
  timer = null;
  if (!pending) return;
  const { uid, getJson, onDone } = pending;
  pending = null;
  try {
    await pushSave(uid, getJson());
    onDone?.(null);
  } catch (e) {
    onDone?.(e);
  }
}
