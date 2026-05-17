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
  const payload = `${stats.answered}|${stats.correct}|${stats.bestStreak}|${stats.xp}|${stats.level}|${stats.totalSolved}|${SALT}`;
  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    hash = ((hash << 5) - hash + payload.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}

function validateIntegrity(stats) {
  const stored = localStorage.getItem('vx2_checksum');
  if (!stored) return true; // first run, no checksum yet
  return stored === computeChecksum(stats);
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
    bestStreak:  +localStorage.getItem('vx2_bestStreak')  || 0,
    level:       +localStorage.getItem('vx2_level')       || 1,
    xp:          +localStorage.getItem('vx2_xp')          || 0,
    answered:    +localStorage.getItem('vx2_answered')    || 0,
    correct:     +localStorage.getItem('vx2_correct')     || 0,
    totalSolved: +localStorage.getItem('vx2_totalSolved') || +localStorage.getItem('vx2_answered') || 0,
    leaderboardName: localStorage.getItem('vx2_leaderboardName') || '',
    sessions:    JSON.parse(localStorage.getItem('vx2_sessions') || '[]'),
    subjStats:   JSON.parse(localStorage.getItem('vx2_subjStats') || '{}'),
  };

  if (!validateIntegrity(raw)) {
    console.warn('[Vertex] Stats integrity check failed — resetting stats.');
    integrityFailed = true;
    // Reset core numeric stats
    raw.streak = 0;
    raw.bestStreak = 0;
    raw.level = 1;
    raw.xp = 0;
    raw.answered = 0;
    raw.correct = 0;
    raw.totalSolved = 0;
    raw.sessions = [];
    raw.subjStats = {};
    // Persist the reset
    ['streak', 'bestStreak', 'level', 'xp', 'answered', 'correct', 'totalSolved'].forEach(k =>
      localStorage.setItem('vx2_' + k, raw[k]),
    );
    localStorage.setItem('vx2_sessions', '[]');
    localStorage.setItem('vx2_subjStats', '{}');
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
  S.totalSolved = Math.max(S.totalSolved, S.answered);
  ['streak', 'bestStreak', 'level', 'xp', 'answered', 'correct', 'totalSolved'].forEach(k =>
    localStorage.setItem('vx2_' + k, S[k]),
  );
  localStorage.setItem('vx2_leaderboardName', S.leaderboardName || '');
  localStorage.setItem('vx2_sessions', JSON.stringify(S.sessions));
  localStorage.setItem('vx2_subjStats', JSON.stringify(S.subjStats));
  saveChecksum(S);
  syncCloud();
}

// ── Cloud sync ──
export function syncCloud() {
  if (!isFirebaseReady() || !getCurrentUser()) return;
  syncUserStats(S).catch(() => {});
}

export async function loadCloudProfile() {
  if (!isFirebaseReady() || !getCurrentUser()) return;
  try {
    const profile = await getUserProfile();
    if (profile?.displayName) {
      S.leaderboardName = profile.displayName;
      localStorage.setItem('vx2_leaderboardName', S.leaderboardName);
    }
  } catch {
    // Local stats still work if the profile document is not readable yet.
  }
}

// ── Re-export Firebase helpers for convenience ──
export { _initFirebase as initFirebase, _onAuthReady as onAuthReady };
