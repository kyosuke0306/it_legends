// Firebase（Google ログイン + Firestore）で記録を保存・同期する（money_manage の sync.js と同じ方式）
// - 記録は Firestore の users/<ユーザーID> に { data: 記録のJSON, updatedAt, device } で保存
// - ほかの端末で保存された内容は onSnapshot で受け取って反映する
// - Firebase の部品は、画面の表示が終わって落ち着いてから読み込む（ゲームの表示を遅らせない）
// - 通信を少なくするため、画面が裏に回ったら保存してから通信を切り、戻ったらつなぎ直す（sleep / wake）
import { FIREBASE_CONFIG } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/12.18.0/';
const FLAG = 'it_legends.cloud'; // 前回ログインしていたか
const REDIRECT = 'it_legends.redirect'; // ページを切り替えてログインしている途中か
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
let asleep = false; // 裏に回って通信を切っているか
let lastSent = ''; // 最後に保存した中身（同じなら送らない）

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
  // ページを切り替えてログインしたときの失敗を知らせる
  if (sessionStorage.getItem(REDIRECT)) {
    sessionStorage.removeItem(REDIRECT);
    auth.getRedirectResult(fb.a).catch((e) => showError(e));
  }
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
    // ボタンを押した瞬間にログインの窓を開けるよう、画面が落ち着いたら先に読んでおく
    // （押してから読むと、iPhone の Safari では窓が止められることがある）
    const idle = window.requestIdleCallback ?? ((f) => setTimeout(f, 1500));
    setTimeout(() => idle(() => load().catch(() => {})), 2000);
  }
}

async function upload() {
  clearTimeout(timer);
  timer = null;
  if (!user || !dirty) return;
  dirty = false;
  // 保存した時刻だけが違うときは送らない
  const state = hooks.getState();
  const same = JSON.stringify({ ...state, savedAt: 0, time: 0 });
  if (same === lastSent) return status('保存済み', 'ok');
  status('保存中', 'busy');
  try {
    await fb.store.setDoc(fb.store.doc(fb.db, 'users', user.uid), {
      data: JSON.stringify(state),
      updatedAt: Date.now(),
      device,
    });
    lastSent = same;
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
  timer = setTimeout(upload, 10000); // 続けて操作したときは1回にまとめる（裏に回るときはすぐ保存する）
}


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
    hooks.onSynced?.();
    if (!asleep) listen();
  } catch (e) {
    console.error(e);
    status('読み込めません', 'error');
  }
}

// ほかの端末で保存された内容を受け取って反映する（つないだ直後にも最新の内容が1回届く）
function listen() {
  if (unsubscribe || !user) return;
  unsubscribe = fb.store.onSnapshot(fb.store.doc(fb.db, 'users', user.uid), (s) => {
    if (!s.exists() || s.metadata.hasPendingWrites) return;
    const d = s.data();
    if (d.device === device) return;
    const st = parse(d.data);
    if (!st) return;
    hooks.applyState(st);
    status('保存済み', 'ok');
  });
}

// 画面が裏に回ったとき：いまの記録を保存してから、通信を切る
export async function sleep() {
  if (!fb || asleep) return;
  asleep = true;
  await upload();
  if (!asleep) return; // 保存している間に画面に戻ってきた
  unsubscribe?.();
  unsubscribe = null;
  await fb.store.disableNetwork(fb.db).catch(() => {});
}

// 画面に戻ってきたとき：つなぎ直して、ほかの端末の変更を受け取る
export async function wake() {
  if (!fb || !asleep) return;
  asleep = false;
  await fb.store.enableNetwork(fb.db).catch(() => {});
  listen();
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

function showError(e) {
  console.error(e);
  status('ログインできません', 'error');
  alert(`ログインできませんでした（${e.code || e.message}）`);
}

export async function login() {
  const ready = Boolean(fb);
  status('ログイン中', 'busy');
  const { auth, a } = await load();
  const provider = new auth.GoogleAuthProvider();
  try {
    await auth.signInWithPopup(a, provider);
  } catch (e) {
    if (e.code === 'auth/popup-blocked') {
      // ブラウザが窓を止めた。ページを切り替える方法は iPhone の Safari では結果が戻らないので使わず、もう一度押してもらう
      status(ready ? 'ポップアップを許可して再タップ' : 'もう一度タップ', 'login');
    } else if (e.code === 'auth/operation-not-supported-in-this-environment') {
      flag.set(true); // 戻ってきたときに Firebase を読み込むため
      sessionStorage.setItem(REDIRECT, '1');
      await auth.signInWithRedirect(a, provider);
    } else if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') {
      status('ログイン', 'login');
    } else {
      showError(e);
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
