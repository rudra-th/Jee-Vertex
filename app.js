// ═══════════════════════════════════════
// APP.JS — Orchestrator
// ═══════════════════════════════════════
// Thin entry point: imports all modules, initialises the app,
// and exposes handler functions to `window` for inline onclick attrs.

import { S, allQ, loadQ, initFirebase, onAuthReady, integrityFailed, loadCloudProfile, syncCloud } from './js/store.js';
import {
  reMath, closeLvl, toast,
  updateNav, updateHome, updateStatsPage, renderHistory, clearHistory,
} from './js/ui.js';
import { navTo, toggleMobileNav, closeMobileNav, onQuizKeydown } from './js/router.js';
import {
  populateChapters, updateCustomPreview,
  startPractice, startCustom,
  selDiff, togSub, allSubs, noneSubs,
  adjQ, setQN, selTMode, selPQP, onPQI, selTP, onTI,
  pickOpt, nextQ, skipQ, endQuiz, reviewAnswers,
  switchPracSub, selAllCh, clrAllCh,
} from './js/quiz.js';
import { startRF, rfPick } from './js/rapid.js';
import { switchLbTab } from './js/leaderboard.js';
import { updateProfilePage, loginGoogle, logoutGoogle, saveLeaderboardName } from './js/profile.js';

// ═══ INIT ═══
document.addEventListener('DOMContentLoaded', async () => {
  initFirebase();
  onAuthReady(async () => {
    await loadCloudProfile();
    updateProfilePage();
    syncCloud();
  });
  await loadQ();
  // Show toast messages deferred from store.js (no circular dep)
  if (integrityFailed) {
    toast('⚠️ Stats were tampered with and have been reset.');
  }
  if (!allQ.length) {
    toast('❌ questions.json not found — place it in the same folder.');
  }
  updateNav();
  updateHome();
  renderHistory();
  populateChapters();
  updateStatsPage();
  reMath();
  bindGlobals();
  updateCustomPreview();
  document.addEventListener('keydown', onQuizKeydown);
});

// ═══ GLOBAL BINDINGS ═══
// Exposes functions to `window` so inline onclick= handlers in index.html work.
function bindGlobals() {
  Object.assign(window, {
    navTo,
    toggleMobileNav,
    closeMobileNav,
    closeLvl,
    clearHistory,
    startRF,
    startPractice,
    startCustom,
    selDiff,
    togSub,
    allSubs,
    noneSubs,
    adjQ,
    setQN,
    selTMode,
    selPQP,
    onPQI,
    selTP,
    onTI,
    pickOpt,
    nextQ,
    skipQ,
    endQuiz,
    reviewAnswers,
    rfPick,
    switchPracSub,
    selAllCh,
    clrAllCh,
    switchLbTab,
    loginGoogle,
    logoutGoogle,
    saveLeaderboardName,
  });
}
