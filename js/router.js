// ═══════════════════════════════════════
// ROUTER.JS — Navigation & keyboard
// ═══════════════════════════════════════
import { reMath, updateStatsPage } from './ui.js';
import { loadLeaderboard } from './leaderboard.js';
import { updateProfilePage } from './profile.js';

const pageTitles = {
  home: 'Home — Vertex JEE',
  'rapid-setup': 'Rapid Fire — Vertex JEE',
  'practice-setup': 'Practice — Vertex JEE',
  'custom-setup': 'Custom Test — Vertex JEE',
  'mock-setup': 'Mock Test — Vertex JEE',
  stats: 'Stats — Vertex JEE',
  leaderboard: 'Leaderboard — Vertex JEE',
  profile: 'Profile — Vertex JEE',
  quiz: 'Quiz — Vertex JEE',
  'rapid-quiz': 'Rapid Fire — Vertex JEE',
  results: 'Results — Vertex JEE',
  'rapid-results': 'Results — Vertex JEE',
};

export function navTo(id) {
  document.title = pageTitles[id] || 'Vertex — JEE Practice Platform';
  document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
  const el = document.getElementById('pg-' + id);
  if (el) {
    void el.offsetWidth;
    el.classList.add('active');
  }
  closeSidebar();
  // update active nav link
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const map = {
    home: 'home',
    'rapid-setup': 'rapid',
    'rapid-quiz': 'rapid',
    'rapid-results': 'rapid',
    'practice-setup': 'practice',
    'custom-setup': 'custom',
    'mock-setup': 'custom',
    quiz: 'quiz',
    results: 'results',
    stats: 'stats',
    leaderboard: 'leaderboard',
    profile: 'profile',
  };
  const navKey = map[id];
  if (navKey) {
    const nl = document.querySelector(`.nav-link[data-nav="${navKey}"]`);
    if (nl) nl.classList.add('active');
    document.querySelectorAll('.bottom-nav-item').forEach((b) => b.classList.remove('active'));
    const bn = document.querySelector(`.bottom-nav-item[data-bnav="${navKey}"]`);
    if (bn) bn.classList.add('active');
  }
  if (id === 'leaderboard') loadLeaderboard();
  if (id === 'stats') updateStatsPage();
  if (id === 'profile') updateProfilePage();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  reMath();
}

export function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const btn = document.getElementById('navMenuBtn');
  if (!sidebar) return;
  const open = sidebar.classList.toggle('open');
  if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  document.body.classList.toggle('sidebar-open', open);
}

export function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const btn = document.getElementById('navMenuBtn');
  if (!sidebar?.classList.contains('open')) return;
  sidebar.classList.remove('open');
  if (btn) btn.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('sidebar-open');
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSidebar();
});

export function onQuizKeydown(e) {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  const quizOn = document.getElementById('pg-quiz')?.classList.contains('active');
  const rfOn = document.getElementById('pg-rapid-quiz')?.classList.contains('active');
  if (!quizOn && !rfOn) return;
  const key = e.key.toLowerCase();
  const map = { '1': 0, '2': 1, '3': 2, '4': 3, a: 0, b: 1, c: 2, d: 3 };
  if (!(key in map)) return;
  const area = quizOn ? document.getElementById('quizQArea') : document.getElementById('rfQArea');
  const opts = area?.querySelectorAll('.opt:not(:disabled)');
  const btn = opts?.[map[key]];
  if (!btn) return;
  e.preventDefault();
  btn.click();
}
