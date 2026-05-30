// ═══════════════════════════════════════
// PROFILE.JS — Auth UI & profile page
// ═══════════════════════════════════════
import { S, save, loadCloudProfile, syncCloud } from './store.js';
import { setText, toast, updateStatsPage, avatarUrl, updateSyncReminders } from './ui.js';
import {
  getCurrentUser,
  signInWithGoogle,
  signOutUser,
  updateLeaderboardName,
  deleteUserAccount,
} from '../firebase.js';
import { loadLeaderboard } from './leaderboard.js';

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

  const finalAvatar = avatarUrl({ photoURL: user.photoURL, displayName });
  if (img) img.src = finalAvatar;
  if (name) name.textContent = displayName;
  if (nameInput) nameInput.value = displayName;
  if (email) email.textContent = user.email || '';
  
  const acc = S.answered ? Math.round((S.correct / S.answered) * 100) : 0;
  setText('profileStreak', S.dailyStreak || 0);
  setText('profileAcc', acc + '%');
  setText('profileAnswered', S.answered);

  // Joined Date
  let joined;
  try {
    joined = new Date(S.joinedAt || Date.now());
    if (isNaN(joined.getTime())) joined = new Date();
  } catch {
    joined = new Date();
  }
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  setText('profileJoinedDate', `Member since ${monthNames[joined.getMonth()]} ${joined.getFullYear()}`);

  const toggle = document.getElementById('toggleAutoRemove');
  if (toggle) toggle.classList.toggle('on', S.autoRemoveWrong !== false);

  const themeLabel = document.getElementById('profileThemeLabel');
  if (themeLabel) {
    themeLabel.textContent = S.theme === 'light' ? 'Light' : 'Dark';
  }

  updateStatsPage();
}

export async function loginGoogle() {
  try {
    await signInWithGoogle();
    await loadCloudProfile();
    toast('Signed in - your progress will sync to the cloud.');
    syncCloud();
    updateProfilePage();
    updateSyncReminders();
  } catch (e) {
    if (e?.code !== 'auth/popup-closed-by-user') toast('Sign-in failed. Check Firebase Auth setup.');
  }
}

export async function logoutGoogle() {
  try {
    await signOutUser();
    toast('Signed out.');
    updateProfilePage();
    updateSyncReminders();
  } catch {
    toast('Could not sign out.');
  }
}

export function copyUID() {
  const user = getCurrentUser();
  if (!user) { toast('Sign in to see your ID.'); return; }
  navigator.clipboard.writeText(user.uid);
  toast('Support ID copied to clipboard!');
}

export async function deleteAccount() {
  const user = getCurrentUser();
  if (!user) return;
  if (!confirm('🚨 CRITICAL: This will permanently delete your account and all cloud data. This cannot be undone.\n\nAre you sure?')) return;
  try {
    await deleteUserAccount();
    toast('Account deleted.');
    S.streak = 0; S.dailyStreak = 0; S.lastStudyDate = ''; S.bestStreak = 0;
    S.answered = 0; S.correct = 0; S.totalSolved = 0;
    S.leaderboardName = '';
    S.sessions = []; S.subjStats = {}; S.chapterStats = {}; S.bookmarks = []; S.wrongQuestionIds = []; S.achievements = []; S.spacedRepetition = {};
    save();
    updateProfilePage();
    updateSyncReminders();
  } catch (e) {
    if (e?.code === 'auth/requires-recent-login') {
      toast('Security: Please sign out and sign in again before deleting your account.');
    } else {
      toast('Failed to delete account.');
    }
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
