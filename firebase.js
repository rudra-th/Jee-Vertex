import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  deleteUser,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  getDoc,
  deleteDoc,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

let auth = null;
let db = null;
let currentUser = undefined; // undefined = not yet resolved; null = resolved as logged-out; object = logged-in
let configured = false;
const authListeners = [];

function isConfigured() {
  return firebaseConfig.apiKey && firebaseConfig.apiKey !== 'YOUR_API_KEY';
}

export function initFirebase() {
  if (!isConfigured()) {
    // Firebase not configured
    return false;
  }
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  configured = true;
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    authListeners.forEach((cb) => cb(user));
  });
  return true;
}

export function onAuthReady(cb) {
  if (!configured) {
    // Firebase not set up — treat as logged-out immediately
    cb(null);
    return;
  }
  // If onAuthStateChanged has already fired (currentUser is no longer undefined),
  // call the callback synchronously so late registrants don't miss the event.
  if (currentUser !== undefined) {
    cb(currentUser);
    return;
  }
  // Still waiting for Firebase to resolve — queue the callback
  authListeners.push(cb);
}

export function getCurrentUser() {
  // Return null for both "not configured" and "not logged in" states
  return currentUser ?? null;
}

export function isFirebaseReady() {
  return configured && !!db;
}

export async function signInWithGoogle() {
  if (!auth) throw new Error('Firebase Auth is not initialized');
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
}

export async function signOutUser() {
  if (!auth) return;
  return signOut(auth);
}

export async function syncUserStats(stats) {
  if (!db || !currentUser) return;
  const answered = stats.answered || 0;
  const correct = stats.correct || 0;
  const accuracy = answered ? Math.round((correct / answered) * 100) : 0;
  const displayName = cleanDisplayName(stats.leaderboardName || currentUser.displayName);
  await setDoc(
    doc(db, 'users', currentUser.uid),
    {
      uid: currentUser.uid,
      displayName,
      photoURL: currentUser.photoURL || '',
      email: currentUser.email || '',
      provider: 'google.com',
      totalSolved: stats.totalSolved ?? answered,
      level: stats.level ?? 1,
      xp: stats.xp ?? 0,
      bestStreak: stats.bestStreak ?? 0,
      accuracy,
      answered,
      correct,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function getUserProfile() {
  if (!db || !currentUser) return null;
  const snap = await getDoc(doc(db, 'users', currentUser.uid));
  return snap.exists() ? snap.data() : null;
}

export async function updateLeaderboardName(displayName, stats = {}) {
  if (!db || !currentUser) return;
  // Must include all stats fields — Firestore rules enforce validStatsShape() on every write
  const answered = stats.answered || 0;
  const correct  = stats.correct  || 0;
  const accuracy = answered ? Math.round((correct / answered) * 100) : 0;
  const finalName = cleanDisplayName(displayName || currentUser.displayName);
  await setDoc(
    doc(db, 'users', currentUser.uid),
    {
      uid:               currentUser.uid,
      displayName:       finalName,
      photoURL:          currentUser.photoURL || '',
      email:             currentUser.email || '',
      provider:          'google.com',
      totalSolved:       stats.totalSolved ?? answered,
      level:             stats.level       ?? 1,
      xp:                stats.xp          ?? 0,
      bestStreak:        stats.bestStreak  ?? 0,
      accuracy,
      answered,
      correct,
      updatedAt:         serverTimestamp(),
    },
    { merge: true },
  );
}

export async function fetchLeaderboard(field, topN = 100) {
  if (!db) return [];
  const q = query(collection(db, 'users'), orderBy(field, 'desc'), limit(topN));
  const snap = await getDocs(q);
  return snap.docs.map((d, i) => ({
    rank: i + 1,
    id: d.id,
    ...d.data(),
  }));
}

export async function wipeFirestoreData() {
  if (!db || !currentUser) return;
  try {
    await deleteDoc(doc(db, 'users', currentUser.uid));
    return true;
  } catch {
    return false;
  }
}

export async function deleteUserAccount() {
  if (!db || !currentUser) return;
  const uid = currentUser.uid;
  try {
    await deleteDoc(doc(db, 'users', uid));
    await deleteUser(currentUser);
    return true;
  } catch (e) {
    throw e;
  }
}

function cleanDisplayName(name) {
  return String(name || 'Vertex Student').trim().slice(0, 32) || 'Vertex Student';
}
