// Firebase（Google ログイン + Firestore）で記録を保存・同期する（money_manage の sync.js と同じ方式）
// - 記録は Firestore の users/<ユーザーID> に { data: 記録のJSON, updatedAt, device } で保存
// - ほかの端末で保存された内容は onSnapshot で受け取って反映する
// - 通信を軽くするため、Firebase の部品は「ログインするとき」か「前回ログインしていたとき」だけ読み込む
import { FIREBASE_CONFIG } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/12.18.0/';
const FLAG = 'it_legends.cloud'; // 前回ログインしていたか
const flag = {
  get: () => { try { return localStorage.getItem(FLAG) === '1'; } catch { return false; } },
  set: (on) => { try { on ? localStorage.setItem(FLAG, '1') : localStorage.removeItem(FLAG); } catch {} },
};

// この端末の印（自分が書いた変更を、自分で読み込み直さないため）
const device = Math.random().toString(36).slice(2);
let fb = null;
let hooks = null; // { getState, applyState, decide, onStatus }
let user = null;
let unsubscribe = null;
let timer = null;
let dirty = false;

export const currentUser = () => user;
const status = (text, cls) => hooks?.onStatus(text, cls);

async function load() {
  if (fb) return fb;
  const [{ initializeApp }, auth, store] = await Promise.all([
    import(`${SDK}firebase-app.js`),
    import(`${SDK}firebase-auth.js`),
    import(`${SDK}firebase-firestore.js`),
  ]);
  const app = initializeApp(FIREBASE_CONFIG);
  fb = { auth, store, a: auth.getAuth(app), db: store.getFirestore(app) };
  auth.onAuthStateChanged(fb.a, onUser);
  return fb;
}

// 起動時に呼ぶ。前回ログインしていたら Firebase を読んでログイン状態を戻す
export function init(h) {
  hooks = h;
  if (flag.get()) {
    status('読み込み中', 'busy');
    load().catch((e) => {
      console.error(e);
      status('つながりません', 'error');
    });
  } else {
    status('ログイン', 'login');
  }
}

async function upload() {
  clearTimeout(timer);
  timer = null;
  if (!user || !dirty) return;
  dirty = false;
  status('保存中', 'busy');
  try {
    await fb.store.setDoc(fb.store.doc(fb.db, 'users', user.uid), {
      data: JSON.stringify(hooks.getState()),
      updatedAt: Date.now(),
      device,
    });
    status('保存済み', 'ok');
  } catch (e) {
    console.error(e);
    dirty = true;
    status('保存できません', 'error');
  }
}

// 記録が変わったら呼ぶ。少し待ってからまとめて保存する
export function changed() {
  if (!user) return;
  dirty = true;
  status('保存中', 'busy');
  clearTimeout(timer);
  timer = setTimeout(upload, 2000);
}

// すぐ保存する（画面を閉じるときなど）
export const flush = () => upload();

async function onUser(u) {
  user = u;
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  if (!u) {
    flag.set(false);
    status('ログイン', 'login');
    return;
  }
  flag.set(true);
  status('読み込み中', 'busy');
  const { store, db } = fb;
  const ref = store.doc(db, 'users', u.uid);
  try {
    const snap = await store.getDoc(ref);
    const remote = snap.exists() ? parse(snap.data().data) : null;
    // クラウドとこの端末のどちらの記録を使うか（main.js が決める）
    if (remote && (await hooks.decide(remote)) === 'remote') {
      hooks.applyState(remote);
      status('保存済み', 'ok');
    } else if (hooks.getState()) {
      dirty = true;
      await upload();
    } else {
      status('保存済み', 'ok');
    }
    // ほかの端末で保存された内容を反映する
    unsubscribe = store.onSnapshot(ref, (s) => {
      if (!s.exists() || s.metadata.hasPendingWrites) return;
      const d = s.data();
      if (d.device === device) return;
      const st = parse(d.data);
      if (!st) return;
      hooks.applyState(st);
      status('保存済み', 'ok');
    });
  } catch (e) {
    console.error(e);
    status('読み込めません', 'error');
  }
}

function parse(json) {
  try {
    const s = JSON.parse(json);
    return s?.v === 1 ? s : null;
  } catch {
    return null;
  }
}

// ボタンに触れた時点で Firebase を読み始める（ログインの窓をすぐ開けるように）
export const warmUp = () => load().catch(() => {});

export async function login() {
  const ready = Boolean(fb);
  status('ログイン中', 'busy');
  const { auth, a } = await load();
  const provider = new auth.GoogleAuthProvider();
  try {
    await auth.signInWithPopup(a, provider);
  } catch (e) {
    if (e.code === 'auth/popup-blocked' && !ready) {
      // 読み込みを待つ間にブラウザが窓を止めた。次のタップではすぐ開ける
      status('もう一度タップ', 'login');
    } else if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
      flag.set(true); // 戻ってきたときに Firebase を読み込むため
      await auth.signInWithRedirect(a, provider);
    } else {
      status('ログイン', 'login');
      if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
        alert(`ログインできませんでした（${e.code || e.message}）`);
      }
    }
  }
}

export async function logout() {
  await upload();
  await fb.auth.signOut(fb.a);
}

// 記録を消す（最初からやり直すとき）
export async function clear() {
  if (!user) return;
  clearTimeout(timer);
  dirty = false;
  await fb.store.setDoc(fb.store.doc(fb.db, 'users', user.uid), { data: 'null', updatedAt: Date.now(), device });
}
