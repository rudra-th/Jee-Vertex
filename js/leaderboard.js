// ═══════════════════════════════════════
// LEADERBOARD.JS — Fetch & render
// ═══════════════════════════════════════
import { S } from './store.js';
import { escHtml, avatarUrl } from './ui.js';
import {
  getCurrentUser,
  isFirebaseReady,
  fetchLeaderboard,
} from '../firebase.js';

let leaderboardCache = { streak: [], solved: [], accuracy: [] };
let lbTab = 'streak';
let lbExpanded = false;

export async function loadLeaderboard() {
  const hero = document.getElementById('lbHeroStats');
  if (hero) hero.innerHTML = '<span class="lb-loading">Loading rank data...</span>';
  if (!isFirebaseReady()) {
    renderLeaderboardEmpty('Leaderboard is optional. Configure Firebase when you want public rankings; practice and local stats work now.');
    return;
  }
  try {
    const [streak, solved, accuracy] = await Promise.all([
      fetchLeaderboard('bestStreak', 100),
      fetchLeaderboard('totalSolved', 100),
      fetchLeaderboard('accuracy', 100),
    ]);
    leaderboardCache = {
      streak: streak
        .filter((u) => (u.bestStreak || 0) > 0)
        .map((u, i) => ({ ...u, rank: i + 1 })),
      solved: solved
        .filter((u) => (u.totalSolved || 0) > 0)
        .map((u, i) => ({ ...u, rank: i + 1 })),
      accuracy: accuracy
        .filter((u) => (u.answered || 0) >= 5)
        .sort((a, b) => b.accuracy - a.accuracy || b.answered - a.answered)
        .map((u, i) => ({ ...u, rank: i + 1 })),
    };
    renderLbHero();
    renderLbTab(lbTab);
  } catch {
    renderLeaderboardEmpty('Leaderboard could not load right now. Your local practice data is still safe.');
  }
}

function renderLbHero() {
  const el = document.getElementById('lbHeroStats');
  if (!el) return;
  const me = getCurrentUser();
  const pool = leaderboardCache[lbTab] || [];
  const idx = me ? pool.findIndex((u) => u.id === me.uid) : -1;
  const myRank = idx >= 0 ? idx + 1 : null;
  
  let metricLabel = 'Questions Solved';
  let metricValue = S.totalSolved;
  
  if (lbTab === 'streak') {
    metricLabel = 'Best Streak';
    metricValue = S.bestStreak + '🔥';
  } else if (lbTab === 'accuracy') {
    metricLabel = 'Overall Accuracy';
    const acc = S.answered ? Math.round((S.correct / S.answered) * 100) : 0;
    metricValue = acc + '%';
  }

  el.innerHTML = `
    <div class="lb-hero-stat"><span class="lb-hero-val">${pool.length}</span><span class="lb-hero-lbl">Ranked Players</span></div>
    <div class="lb-hero-stat"><span class="lb-hero-val">${myRank || '—'}</span><span class="lb-hero-lbl">Your Rank</span></div>
    <div class="lb-hero-stat"><span class="lb-hero-val">${S.answered}</span><span class="lb-hero-lbl">Questions Solved</span></div>
    <div class="lb-hero-stat"><span class="lb-hero-val">${metricValue}</span><span class="lb-hero-lbl">${metricLabel}</span></div>`;
}

function renderLeaderboardEmpty(msg) {
  ['lbPodium', 'lbList'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<div class="lb-empty">${escHtml(msg)}</div>`;
  });
  const hero = document.getElementById('lbHeroStats');
  if (hero) hero.innerHTML = '';
  const actions = document.getElementById('lbActions');
  if (actions) actions.style.display = 'none';
}

export function switchLbTab(tab, btn) {
  lbTab = tab;
  lbExpanded = false; // Reset expansion on tab switch
  document.querySelectorAll('.lb-tab').forEach((b) => b.classList.remove('on'));
  if (btn) btn.classList.add('on');
  renderLbHero();
  renderLbTab(tab);
}

export function toggleLbExpand() {
  lbExpanded = !lbExpanded;
  renderLbTab(lbTab);
  const btn = document.getElementById('btnLbToggle');
  if (btn) btn.textContent = lbExpanded ? 'Show Less' : 'View All Top 100';
  if (!lbExpanded) {
    document.getElementById('lbList').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function renderLbTab(tab) {
  const list = leaderboardCache[tab] || [];
  const podium = document.getElementById('lbPodium');
  const rows = document.getElementById('lbList');
  const actions = document.getElementById('lbActions');
  if (!podium || !rows) return;

  if (!list.length) {
    podium.innerHTML = '';
    rows.innerHTML = '<div class="lb-empty">No rankings yet. Sign in after a few sessions to publish your score.</div>';
    if (actions) actions.style.display = 'none';
    return;
  }

  // Podium (Top 3)
  const top3 = list.slice(0, 3);
  const medals = ['🥇', '🥈', '🥉'];
  const colors = ['var(--gold)', 'var(--txt2)', '#cd7f32'];
  podium.innerHTML = top3
    .map((u, i) => {
      const val = lbMetricValue(u, tab);
      const displayName = u.displayName || 'Student';
      return `<div class="lb-podium-card lb-podium-${i + 1}">
        <div class="lb-podium-rank" style="color:${colors[i]}">${medals[i]}</div>
        <img class="lb-avatar lb-avatar-lg" src="${avatarUrl(u)}" alt="" loading="lazy" data-name="${escHtml(displayName)}" onerror="handleAvatarError(this)"/>
        <div class="lb-podium-name">${escHtml(displayName)}</div>
        <div class="lb-podium-val">${val}</div>
        <div class="lb-podium-meta">${u.totalSolved || 0} solved</div>
      </div>`;
    })
    .join('');

  // Rankings: show all users when list is small (≤10), otherwise show 4+ only
  const rest = list.length <= 10 ? list : list.slice(3);
  const displayList = lbExpanded ? rest : rest.slice(0, 7); // Default view logic

  rows.innerHTML = displayList
    .map((u) => {
      const val = lbMetricValue(u, tab);
      const isMe = getCurrentUser() && u.id === getCurrentUser().uid;
      const displayName = u.displayName || 'Student';
      return `<div class="lb-row${isMe ? ' lb-row-me' : ''}">
      <span class="lb-rank">${u.rank}</span>
      <img class="lb-avatar" src="${avatarUrl(u)}" alt="" loading="lazy" data-name="${escHtml(displayName)}" onerror="handleAvatarError(this)"/>
      <div class="lb-row-info">
        <div class="lb-row-name">${escHtml(displayName)}${isMe ? ' <span class="lb-you">YOU</span>' : ''}</div>
        <div class="lb-row-meta">${u.totalSolved || 0} solved</div>
      </div>
      <div class="lb-row-val">${val}</div>
    </div>`;
    })
    .join('');

  if (actions) {
    // Show toggle button if there are more users than what's currently displayed
    actions.style.display = rest.length > 7 ? 'flex' : 'none';
    const btn = document.getElementById('btnLbToggle');
    if (btn) btn.textContent = lbExpanded ? 'Show Less' : `View All Top ${list.length}`;
  }
}

function lbMetricValue(u, tab) {
  if (tab === 'streak') return `${u.bestStreak || 0}🔥`;
  if (tab === 'solved') return `${u.totalSolved || 0}`;
  return `${u.accuracy || 0}%`;
}
