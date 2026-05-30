// ═══════════════════════════════════════
// STORE.JS — State, persistence, integrity
// ═══════════════════════════════════════
import {
  initFirebase as _initFirebase,
  onAuthReady as _onAuthReady,
  getCurrentUser,
  isFirebaseReady,
  syncUserStats,
  getUserProfile,
} from '../firebase.js';

// ── Integrity helpers ──
const SALT = 'v3x_s4lt_2026';

function computeChecksum(stats) {
  const sessionsStr = JSON.stringify((stats.sessions || []).map(s => ({ ...s, createdAt: 0 })));
  const subjStatsStr = JSON.stringify(stats.subjStats || {});
  const chapterStatsStr = JSON.stringify(stats.chapterStats || {});
  const bookmarksStr = JSON.stringify([...(stats.bookmarks || [])].sort());
  const wrongStr = JSON.stringify([...(stats.wrongQuestionIds || [])].sort());
  const achievementsStr = JSON.stringify([...(stats.achievements || [])].sort());
  const srStr = JSON.stringify(stats.spacedRepetition || {});
  
  const payload = [
    stats.answered || 0,
    stats.correct || 0,
    stats.bestStreak || 0,
    stats.dailyStreak || 0,
    stats.totalSolved || 0,
    !!stats.autoRemoveWrong,
    sessionsStr,
    subjStatsStr,
    chapterStatsStr,
    bookmarksStr,
    wrongStr,
    achievementsStr,
    srStr,
    SALT
  ].join('|');
  
  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    const char = payload.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; 
  }
  return hash.toString(36);
}

function validateIntegrity(stats) {
  const stored = localStorage.getItem('vx2_checksum');
  if (!stored) {
    saveChecksum(stats); // Generate for future runs
    return true;
  }
  return stored === computeChecksum(stats);
}

export function resetIntegrity() {
  integrityFailed = false;
}

function saveChecksum(stats) {
  localStorage.setItem('vx2_checksum', computeChecksum(stats));
}

// Flag set when tampering is detected — checked by the orchestrator
export let integrityFailed = false;

// ── Load state with integrity check ──
function loadState() {
  const raw = {
    streak:      +localStorage.getItem('vx2_streak')      || 0,
    dailyStreak: +localStorage.getItem('vx2_dailyStreak') || 0,
    lastStudyDate: localStorage.getItem('vx2_lastStudyDate') || '',
    bestStreak:  +localStorage.getItem('vx2_bestStreak')  || 0,
    answered:    +localStorage.getItem('vx2_answered')    || 0,
    correct:     +localStorage.getItem('vx2_correct')     || 0,
    totalSolved: +localStorage.getItem('vx2_totalSolved') || +localStorage.getItem('vx2_answered') || 0,
    leaderboardName: localStorage.getItem('vx2_leaderboardName') || '',
    sessions:    JSON.parse(localStorage.getItem('vx2_sessions') || '[]'),
    subjStats:   JSON.parse(localStorage.getItem('vx2_subjStats') || '{}'),
    chapterStats: JSON.parse(localStorage.getItem('vx2_chapterStats') || '{}'),
    bookmarks:   JSON.parse(localStorage.getItem('vx2_bookmarks') || '[]'),
    wrongQuestionIds: JSON.parse(localStorage.getItem('vx2_wrongQuestionIds') || '[]'),
    achievements: JSON.parse(localStorage.getItem('vx2_achievements') || '[]'),
    spacedRepetition: JSON.parse(localStorage.getItem('vx2_spacedRepetition') || '{}'),
    theme: localStorage.getItem('vx2_theme') || 'dark',
    autoRemoveWrong: localStorage.getItem('vx2_autoRemoveWrong') !== 'false',
    joinedAt: localStorage.getItem('vx2_joinedAt') || new Date().toISOString(),
  };

  if (!validateIntegrity(raw)) {
    integrityFailed = true;
    // Reset core numeric stats
    raw.streak = 0;
    raw.dailyStreak = 0;
    raw.lastStudyDate = '';
    raw.bestStreak = 0;
    raw.answered = 0;
    raw.correct = 0;
    raw.totalSolved = 0;
    raw.sessions = [];
    raw.subjStats = {};
    raw.chapterStats = {};
    raw.wrongQuestionIds = [];
    raw.achievements = [];
    raw.spacedRepetition = {};
    raw.autoRemoveWrong = true;
    raw.joinedAt = new Date().toISOString();
    // Persist the reset
    ['streak', 'dailyStreak', 'lastStudyDate', 'bestStreak', 'answered', 'correct', 'totalSolved'].forEach(k =>
      localStorage.setItem('vx2_' + k, raw[k]),
    );
    localStorage.setItem('vx2_sessions', '[]');
    localStorage.setItem('vx2_subjStats', '{}');
    localStorage.setItem('vx2_chapterStats', '{}');
    localStorage.setItem('vx2_wrongQuestionIds', '[]');
    localStorage.setItem('vx2_achievements', '[]');
    localStorage.setItem('vx2_spacedRepetition', '{}');
    localStorage.setItem('vx2_autoRemoveWrong', 'true');
    saveChecksum(raw);
  }

  return raw;
}

// ── Exported state object ──
export const S = loadState();

// ── Question bank ──
export let allQ = [];

export async function loadQ() {
  try {
    const r = await fetch('questions.json');
    if (!r.ok) throw 0;
    allQ = await r.json();
    if (!Array.isArray(allQ) || !allQ.length) throw 0;
  } catch {
    allQ = [];
    // toast is called by the orchestrator after checking loadQ result
  }
}

// ── Filtering & shuffle ──
export function filterQ({ subjects, chapters, diff, count }) {
  let pool = allQ;
  if (subjects && subjects.size) pool = pool.filter(q => subjects.has(q.subject));
  if (chapters && chapters.size) pool = pool.filter(q => chapters.has(q.chapter));
  if (diff && diff !== 'All') pool = pool.filter(q => q.difficulty === diff);
  pool = shuffle(pool);
  return count ? pool.slice(0, count) : pool;
}

export function questionsByIds(ids) {
  const wanted = new Set(ids || []);
  return allQ.filter(q => wanted.has(q.id));
}

export function shuffle(a) {
  const r = [...a];
  for (let i = r.length-1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i+1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

// ── Persistence ──
export function save() {
  S.totalSolved = S.answered;
  ['streak', 'dailyStreak', 'lastStudyDate', 'bestStreak', 'answered', 'correct', 'totalSolved'].forEach(k =>
    localStorage.setItem('vx2_' + k, S[k]),
  );
  localStorage.setItem('vx2_leaderboardName', S.leaderboardName || '');
  localStorage.setItem('vx2_sessions', JSON.stringify(S.sessions));
  localStorage.setItem('vx2_subjStats', JSON.stringify(S.subjStats));
  localStorage.setItem('vx2_chapterStats', JSON.stringify(S.chapterStats || {}));
  localStorage.setItem('vx2_bookmarks', JSON.stringify(S.bookmarks || []));
  localStorage.setItem('vx2_wrongQuestionIds', JSON.stringify(S.wrongQuestionIds || []));
  localStorage.setItem('vx2_achievements', JSON.stringify(S.achievements || []));
  localStorage.setItem('vx2_spacedRepetition', JSON.stringify(S.spacedRepetition || {}));
  localStorage.setItem('vx2_theme', S.theme || 'dark');
  localStorage.setItem('vx2_autoRemoveWrong', S.autoRemoveWrong ?? true);
  localStorage.setItem('vx2_joinedAt', S.joinedAt || new Date().toISOString());
  saveChecksum(S);
  syncCloud();
}

// ── Cloud sync ──
let syncTimeout = null;
export function syncCloud() {
  if (!isFirebaseReady() || !getCurrentUser()) return;
  
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(async () => {
    try {
      await syncUserStats(S);
    } catch {
      // Cloud sync failed silently — local data is safe
    }
  }, 2000); // Debounce for 2 seconds
}

export async function loadCloudProfile() {
  if (!isFirebaseReady() || !getCurrentUser()) return;
  try {
    const profile = await getUserProfile();
    if (!profile) return;
    if (profile.displayName) {
      S.leaderboardName = profile.displayName;
      localStorage.setItem('vx2_leaderboardName', S.leaderboardName);
    }
    if ((profile.answered || 0) > S.answered) {
      S.answered = profile.answered;
      S.correct = profile.correct;
      S.totalSolved = profile.totalSolved || profile.answered;
      S.bestStreak = profile.bestStreak || 0;
      // Also save the overwritten values back to localStorage
      ['answered', 'correct', 'totalSolved', 'bestStreak'].forEach(k =>
        localStorage.setItem('vx2_' + k, S[k]),
      );
    }
  } catch {
    // Local stats still work if the profile document is not readable yet.
  }
}

// ── Re-export Firebase helpers for convenience ──
export { _initFirebase as initFirebase, _onAuthReady as onAuthReady };
