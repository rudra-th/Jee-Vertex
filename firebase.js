import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
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
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

let auth = null;
let db = null;
let currentUser = undefined;
let configured = false;
const authListeners = [];

function isConfigured() {
  return firebaseConfig.apiKey && firebaseConfig.apiKey !== 'YOUR_API_KEY';
}

export function initFirebase() {
  if (!isConfigured()) {
    console.warn('[Vertex] Firebase not configured — edit firebase-config.js');
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
    cb(null);
    return;
  }
  // If auth has already resolved (user is known), fire immediately so callers
  // registered after initFirebase() don't miss the event.
  if (currentUser !== undefined) {
    cb(currentUser);
    return;
  }
  authListeners.push(cb);
}

export function getCurrentUser() {
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

export async function updateLeaderboardName(displayName) {
  if (!db || !currentUser) return;
  await setDoc(
    doc(db, 'users', currentUser.uid),
    {
      uid: currentUser.uid,
      displayName: cleanDisplayName(displayName || currentUser.displayName),
      photoURL: currentUser.photoURL || '',
      email: currentUser.email || '',
      provider: 'google.com',
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function fetchLeaderboard(field, topN = 50) {
  if (!db) return [];
  const q = query(collection(db, 'users'), orderBy(field, 'desc'), limit(topN));
  const snap = await getDocs(q);
  return snap.docs.map((d, i) => ({
    rank: i + 1,
    id: d.id,
    ...d.data(),
  }));
}

function cleanDisplayName(name) {
  return String(name || 'Vertex Student').trim().slice(0, 32) || 'Vertex Student';
}
