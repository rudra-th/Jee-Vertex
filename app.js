// ═══════════════════════════════════════
// APP.JS — Orchestrator
// ═══════════════════════════════════════
// Entry point: imports all modules, initialises the app,
// and sets up data-action event delegation.

import { S, allQ, loadQ, initFirebase, onAuthReady, integrityFailed, loadCloudProfile, syncCloud, togglePremiumDataset } from './js/store.js';
import {
  reMath, toast,
  updateNav, updateHome, updateStatsPage, renderHistory, clearHistory, resetAllProgress,
  handleAvatarError, updateSyncReminders, toggleProfileMenu,
  toggleTheme, applyTheme, toggleBookmark, switchStatsTab,
  removeBookmark, removeWrong, clearBookmarks, clearWrongQueue, toggleAutoRemoveWrong,
} from './js/ui.js';
import { navTo, toggleSidebar, onQuizKeydown } from './js/router.js';
import {
  populateChapters, updateCustomPreview, updateMockPreview,
  setPracticeDifficulty, setCustomDifficulty,
  startPractice, startCustom, startMock, setMockExam,
  togSub, allSubs, noneSubs,
  adjQ, setQN, selTMode, selPQP, onPQI, selTP, onTI,
  pickOpt, nextQ, skipQ, endQuiz, reviewAnswers,
  switchPracSub, selAllCh, clrAllCh,
  startBookmarkedPractice, startWrongPractice, startSRSReview, practiceChapter, startQuestionSet, jumpReview, jumpToQuestion,
} from './js/quiz.js';
import { startRF, rfPick, setRFDifficulty } from './js/rapid.js';
import { switchLbTab, toggleLbExpand } from './js/leaderboard.js';
import { updateProfilePage, loginGoogle, logoutGoogle, saveLeaderboardName, deleteAccount, copyUID } from './js/profile.js';

const diffCls = (d) => d === 'JEE Main' ? 'dm' : d === 'JEE Advanced' ? 'da' : 'dall';

// Single window binding for inline onerror handlers on <img> elements
// (error events don't bubble, so delegation doesn't work for them).
window.handleAvatarError = handleAvatarError;

const actions = {
  navTo:          (el) => navTo(el.dataset.route),
  toggleSidebar:  () => toggleSidebar(),

  toggleTheme:    () => toggleTheme(),

  // Rapid Fire
  startRF:        () => startRF(),
  setRFDifficulty: (el) => {
    document.querySelectorAll('#rfDiffRow .diff-btn').forEach(b => b.className = 'diff-btn');
    el.classList.add(diffCls(el.dataset.diff));
    setRFDifficulty(el.dataset.diff);
  },

  // Practice
  startPractice:    () => startPractice(),
  switchPracSub:    (el) => switchPracSub(el),
  selAllCh:         () => selAllCh(),
  clrAllCh:         () => clrAllCh(),
  setPracticeDifficulty: (el) => {
    document.querySelectorAll('#pracDiffRow .diff-btn').forEach(b => b.className = 'diff-btn');
    el.classList.add(diffCls(el.dataset.diff));
    setPracticeDifficulty(el.dataset.diff);
  },

  // Custom
  startCustom:       () => startCustom(),
  togSub:            (el) => togSub(el),
  allSubs:           () => allSubs(),
  noneSubs:          () => noneSubs(),
  adjQ:              (el) => adjQ(parseInt(el.dataset.delta)),
  setQN:             (el) => setQN(parseInt(el.dataset.count), el),
  selTMode:          (el) => selTMode(el),
  selPQP:            (el) => selPQP(el),
  selTP:             (el) => selTP(el),
  onPQI:             (el) => onPQI(el),
  onTI:              (el) => onTI(el),
  setCustomDifficulty: (el) => {
    document.querySelectorAll('#custDiffRow .diff-btn').forEach(b => b.className = 'diff-btn');
    el.classList.add(diffCls(el.dataset.diff));
    setCustomDifficulty(el.dataset.diff);
    updateCustomPreview();
  },

  // Mock
  startMock:        () => startMock(),
  setMockExam:      (el) => setMockExam(el.dataset.exam, el),

  // Quiz
  pickOpt:          (el) => pickOpt(el, parseInt(el.dataset.idx)),
  rfPick:           (el) => rfPick(el, parseInt(el.dataset.idx)),
  nextQ:            () => nextQ(),
  skipQ:            () => skipQ(),
  endQuiz:          () => endQuiz(),
  reviewAnswers:    () => reviewAnswers(),
  jumpToQuestion:   (el) => jumpToQuestion(parseInt(el.dataset.idx)),
  jumpReview:       (el) => jumpReview(parseInt(el.dataset.idx)),
  toggleBookmark:   (el) => toggleBookmark(el.dataset.id),

  // Stats
  switchStatsTab:   (el) => switchStatsTab(el.dataset.tab),

  // Leaderboard
  switchLbTab:      (el) => switchLbTab(el.dataset.tab, el),
  toggleLbExpand:   () => toggleLbExpand(),

  // Profile
  loginGoogle:            () => loginGoogle(),
  logoutGoogle:           () => logoutGoogle(),
  saveLeaderboardName:    () => saveLeaderboardName(),
  deleteAccount:          () => deleteAccount(),
  copyUID:                () => copyUID(),
  toggleAutoRemoveWrong:  () => toggleAutoRemoveWrong(),
  togglePremiumDataset:   async () => {
    const on = togglePremiumDataset();
    document.getElementById('togglePremiumDataset')?.classList.toggle('on', on);
    await loadQ(on);
    if (!allQ.length) {
      toast('❌ Premium dataset not found. Toggling off.');
      togglePremiumDataset();
      document.getElementById('togglePremiumDataset')?.classList.remove('on');
      await loadQ(false);
    } else {
      populateChapters();
      toast(on ? '💎 Premium dataset activated' : '📚 Standard dataset activated');
    }
  },
  easterEggClick: () => {
    const el = document.getElementById('easterEgg');
    if (!el) return;
    const c = parseInt(el.dataset.clicks || '0') + 1;
    el.dataset.clicks = c;
    if (c >= 7) {
      const wrap = document.getElementById('premiumToggleWrap');
      if (wrap) {
        wrap.style.display = 'block';
        const toggle = document.getElementById('togglePremiumDataset');
        if (toggle) toggle.classList.toggle('on', S.premiumDataset);
      }
      el.classList.add('active');
      el.style.cursor = 'default';
      el.title = 'Secret unlocked!';
    }
  },

  // Data
  clearHistory:       () => clearHistory(),
  resetAllProgress:   () => resetAllProgress(),
  toggleProfileMenu:  (el) => toggleProfileMenu(el),

  // Saved questions
  startBookmarkedPractice: () => startBookmarkedPractice(),
  startWrongPractice:      () => startWrongPractice(),
  startSRSReview:          () => startSRSReview(),
  clearBookmarks:          () => clearBookmarks(),
  clearWrongQueue:         () => clearWrongQueue(),
  removeBookmark:          (el) => removeBookmark(el.dataset.id),
  removeWrong:             (el) => removeWrong(el.dataset.id),
  startQuestionSet:        (el) => startQuestionSet(el.dataset.id),
  practiceChapter:         (el) => practiceChapter(el.dataset.subject, el.dataset.chapter),
};

// ═══ EVENT DELEGATION ═══
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const fn = actions[el.dataset.action];
  if (fn) { fn(el); }
});

document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  if (el.dataset.action === 'onPQI' || el.dataset.action === 'onTI') {
    actions[el.dataset.action](el);
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const el = e.target.closest('[data-action]');
  if (!el || el.tagName === 'BUTTON' || el.tagName === 'A') return;
  e.preventDefault();
  const fn = actions[el.dataset.action];
  if (fn) fn(el);
});

// ═══ INIT ═══
document.addEventListener('DOMContentLoaded', async () => {
  initFirebase();
  onAuthReady(async () => {
    await loadCloudProfile();
    updateProfilePage();
    updateSyncReminders();
    syncCloud();
  });
  await loadQ();
  if (integrityFailed) {
    toast('⚠️ Stats were tampered with and have been reset.');
  }
  if (!allQ.length) {
    toast('❌ Question bank not found. Ensure questions.json or filtered_dataset.json exists.');
  }
  updateNav();
  applyTheme();
  updateHome();
  renderHistory();
  populateChapters();
  updateStatsPage();
  updateSyncReminders();
  reMath();
  updateCustomPreview();
  updateMockPreview();
  document.addEventListener('keydown', onQuizKeydown);
});
