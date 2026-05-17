// ═══════════════════════════════════════
// LEADERBOARD.JS — Fetch & render
// ═══════════════════════════════════════
import { S } from './store.js';
import { escHtml } from './ui.js';
import {
  getCurrentUser,
  isFirebaseReady,
  fetchLeaderboard,
} from '../firebase.js';

let leaderboardCache = { streak: [], solved: [], accuracy: [] };
let lbTab = 'streak';

export async function loadLeaderboard() {
  const hero = document.getElementById('lbHeroStats');
  if (hero) hero.innerHTML = '<span class="lb-loading">Syncing global ranks…</span>';
  if (!isFirebaseReady()) {
    renderLeaderboardEmpty('Configure firebase-config.js to enable the global leaderboard.');
    return;
  }
  try {
    const [streak, solved, accuracy] = await Promise.all([
      fetchLeaderboard('bestStreak', 50),
      fetchLeaderboard('totalSolved', 50),
      fetchLeaderboard('accuracy', 50),
    ]);
    leaderboardCache = {
      streak: streak
        .filter((u) => u.provider === 'google.com' && (u.bestStreak || 0) > 0)
        .map((u, i) => ({ ...u, rank: i + 1 })),
      solved: solved
        .filter((u) => u.provider === 'google.com' && (u.totalSolved || 0) > 0)
        .map((u, i) => ({ ...u, rank: i + 1 })),
      accuracy: accuracy
        .filter((u) => u.provider === 'google.com' && (u.answered || 0) >= 10)
        .sort((a, b) => b.accuracy - a.accuracy || b.answered - a.answered)
        .map((u, i) => ({ ...u, rank: i + 1 })),
    };
    renderLbHero();
    renderLbTab(lbTab);
  } catch {
    renderLeaderboardEmpty('Could not load leaderboard. Check Firestore rules and indexes.');
  }
}

function renderLbHero() {
  const el = document.getElementById('lbHeroStats');
  if (!el) return;
  const me = getCurrentUser();
  const pool = leaderboardCache[lbTab] || [];
  const myRank = me ? pool.findIndex((u) => u.id === me.uid) + 1 : 0;
  el.innerHTML = `
    <div class="lb-hero-stat"><span class="lb-hero-val">${pool.length}</span><span class="lb-hero-lbl">Ranked Players</span></div>
    <div class="lb-hero-stat"><span class="lb-hero-val">${myRank || '—'}</span><span class="lb-hero-lbl">Your Rank</span></div>
    <div class="lb-hero-stat"><span class="lb-hero-val">${S.bestStreak}🔥</span><span class="lb-hero-lbl">Your Best Streak</span></div>
    <div class="lb-hero-stat"><span class="lb-hero-val">${S.totalSolved}</span><span class="lb-hero-lbl">Questions Solved</span></div>`;
}

function renderLeaderboardEmpty(msg) {
  ['lbPodium', 'lbList'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<div class="lb-empty">${escHtml(msg)}</div>`;
  });
  const hero = document.getElementById('lbHeroStats');
  if (hero) hero.innerHTML = '';
}

export function switchLbTab(tab, btn) {
  lbTab = tab;
  document.querySelectorAll('.lb-tab').forEach((b) => b.classList.remove('on'));
  if (btn) btn.classList.add('on');
  renderLbHero();
  renderLbTab(tab);
}

function renderLbTab(tab) {
  const list = leaderboardCache[tab] || [];
  const podium = document.getElementById('lbPodium');
  const rows = document.getElementById('lbList');
  if (!podium || !rows) return;
  if (!list.length) {
    podium.innerHTML = '';
    rows.innerHTML = '<div class="lb-empty">No rankings yet — be the first to climb the board!</div>';
    return;
  }
  const top3 = list.slice(0, 3);
  const medals = ['🥇', '🥈', '🥉'];
  const colors = ['var(--gold)', 'var(--txt2)', '#cd7f32'];
  podium.innerHTML = top3
    .map((u, i) => {
      const val = lbMetricValue(u, tab);
      return `<div class="lb-podium-card lb-podium-${i + 1}">
        <div class="lb-podium-rank" style="color:${colors[i]}">${medals[i]}</div>
        <img class="lb-avatar lb-avatar-lg" src="${avatarUrl(u)}" alt="" loading="lazy"/>
        <div class="lb-podium-name">${escHtml(u.displayName || 'Student')}</div>
        <div class="lb-podium-val">${val}</div>
        <div class="lb-podium-meta">LVL ${u.level || 1}</div>
      </div>`;
    })
    .join('');
  const rest = list.slice(3);
  rows.innerHTML =
    rest
      .map((u) => {
        const val = lbMetricValue(u, tab);
        const isMe = getCurrentUser() && u.id === getCurrentUser().uid;
        return `<div class="lb-row${isMe ? ' lb-row-me' : ''}">
        <span class="lb-rank">${u.rank}</span>
        <img class="lb-avatar" src="${avatarUrl(u)}" alt="" loading="lazy"/>
        <div class="lb-row-info">
          <div class="lb-row-name">${escHtml(u.displayName || 'Student')}${isMe ? ' <span class="lb-you">YOU</span>' : ''}</div>
          <div class="lb-row-meta">Level ${u.level || 1} · ${u.totalSolved || 0} solved</div>
        </div>
        <div class="lb-row-val">${val}</div>
      </div>`;
      })
      .join('') ||
    '<div class="lb-empty">Only top 3 so far — keep grinding to fill the board!</div>';
}

function lbMetricValue(u, tab) {
  if (tab === 'streak') return `${u.bestStreak || 0}🔥`;
  if (tab === 'solved') return `${u.totalSolved || 0}`;
  return `${u.accuracy || 0}%`;
}

function avatarUrl(u) {
  return (
    u.photoURL ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(u.displayName || 'V')}&background=5b6fff&color=fff&size=128`
  );
}
