// ═══════════════════════════════════════
// ROUTER.JS — Navigation & keyboard
// ═══════════════════════════════════════
import { reMath, updateStatsPage } from './ui.js';
import { loadLeaderboard } from './leaderboard.js';
import { updateProfilePage } from './profile.js';

export function navTo(id) {
  document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
  const el = document.getElementById('pg-' + id);
  if (el) {
    void el.offsetWidth;
    el.classList.add('active');
  }
  closeMobileNav();
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

export function toggleMobileNav() {
  const drawer = document.getElementById('mobileNav');
  const btn = document.getElementById('navMenuBtn');
  if (!drawer) return;
  const open = drawer.classList.toggle('open');
  if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  document.body.classList.toggle('nav-open', open);
}

export function closeMobileNav() {
  const drawer = document.getElementById('mobileNav');
  const btn = document.getElementById('navMenuBtn');
  if (!drawer?.classList.contains('open')) return;
  drawer.classList.remove('open');
  if (btn) btn.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('nav-open');
}

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
