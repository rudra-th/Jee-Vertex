// ═══════════════════════════════════════
// PROFILE.JS — Auth UI & profile page
// ═══════════════════════════════════════
import { S, save, loadCloudProfile, syncCloud } from './store.js';
import { setText, toast, updateStatsPage } from './ui.js';
import {
  getCurrentUser,
  signInWithGoogle,
  signOutUser,
  updateLeaderboardName,
} from '../firebase.js';
import { loadLeaderboard } from './leaderboard.js';

function avatarUrl(u) {
  return (
    u.photoURL ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(u.displayName || 'V')}&background=5b6fff&color=fff&size=128`
  );
}

function cleanLeaderboardName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').slice(0, 32);
}

export function updateProfilePage() {
  const guest = document.getElementById('profileGuest');
  const authed = document.getElementById('profileAuthed');
  const user = getCurrentUser();
  if (!guest || !authed) return;
  if (!user) {
    guest.style.display = 'block';
    authed.style.display = 'none';
    const navAv = document.getElementById('navAvatar');
    if (navAv) navAv.style.display = 'none';
    updateStatsPage();
    return;
  }
  guest.style.display = 'none';
  authed.style.display = 'block';
  const displayName = cleanLeaderboardName(S.leaderboardName || user.displayName) || 'Vertex Student';
  const img = document.getElementById('profileAvatar');
  const name = document.getElementById('profileName');
  const nameInput = document.getElementById('profileNameInput');
  const email = document.getElementById('profileEmail');
  if (img) img.src = user.photoURL || avatarUrl({ displayName });
  if (name) name.textContent = displayName;
  if (nameInput) nameInput.value = displayName;
  if (email) email.textContent = user.email || '';
  const navAv = document.getElementById('navAvatar');
  if (navAv) {
    if (user.photoURL) {
      navAv.src = user.photoURL;
      navAv.style.display = 'block';
    } else {
      navAv.style.display = 'none';
    }
  }
  const acc = S.answered ? Math.round((S.correct / S.answered) * 100) : 0;
  setText('profileLevel', S.level);
  setText('profileXP', S.xp);
  setText('profileSolved', S.totalSolved);
  setText('profileStreak', S.bestStreak);
  setText('profileAcc', acc + '%');
  updateStatsPage();
}

export async function loginGoogle() {
  try {
    await signInWithGoogle();
    await loadCloudProfile();
    toast('Signed in - your progress will sync to the cloud.');
    syncCloud();
    updateProfilePage();
  } catch (e) {
    if (e?.code !== 'auth/popup-closed-by-user') toast('Sign-in failed. Check Firebase Auth setup.');
  }
}

export async function logoutGoogle() {
  try {
    await signOutUser();
    toast('Signed out.');
    updateProfilePage();
  } catch {
    toast('Could not sign out.');
  }
}

export async function saveLeaderboardName() {
  const input = document.getElementById('profileNameInput');
  const nextName = cleanLeaderboardName(input?.value);
  if (!nextName) {
    toast('Enter a leaderboard name first.');
    return;
  }
  S.leaderboardName = nextName;
  save();
  try {
    await updateLeaderboardName(nextName, S); // pass stats so Firestore rules pass
    toast('Leaderboard name updated.');
    updateProfilePage();
    if (document.getElementById('pg-leaderboard')?.classList.contains('active')) loadLeaderboard();
  } catch {
    toast('Could not update name. Check Firebase rules.');
  }
}
