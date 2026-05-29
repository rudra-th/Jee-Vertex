// ═══════════════════════════════════════
// APP.JS — Orchestrator
// ═══════════════════════════════════════
// Thin entry point: imports all modules, initialises the app,
// and exposes handler functions to `window` for inline onclick attrs.

import { S, allQ, loadQ, initFirebase, onAuthReady, integrityFailed, loadCloudProfile, syncCloud } from './js/store.js';
import {
  reMath, toast,
  updateNav, updateHome, updateStatsPage, renderHistory, clearHistory, resetAllProgress,
  handleAvatarError, updateSyncReminders, toggleProfileMenu,
  toggleTheme, applyTheme, toggleBookmark, switchStatsTab, updateRankFromMarks,
  removeBookmark, removeWrong, clearBookmarks, clearWrongQueue, toggleAutoRemoveWrong,
} from './js/ui.js';
import { navTo, toggleSidebar, closeSidebar, onQuizKeydown } from './js/router.js';
import {
  populateChapters, updateCustomPreview, updateMockPreview,
  pracSetup, custSetup,
  setPracticeDifficulty, setCustomDifficulty,
  startPractice, startCustom, startMock, setMockExam,
  selDiff, togSub, allSubs, noneSubs,
  adjQ, setQN, selTMode, selPQP, onPQI, selTP, onTI,
  pickOpt, nextQ, skipQ, endQuiz, reviewAnswers,
  switchPracSub, selAllCh, clrAllCh,
  startBookmarkedPractice, startWrongPractice, startSRSReview, practiceChapter, startQuestionSet, jumpReview, jumpToQuestion,
} from './js/quiz.js';
import { startRF, rfPick, setRFDifficulty } from './js/rapid.js';
import { switchLbTab, toggleLbExpand } from './js/leaderboard.js';
import { updateProfilePage, loginGoogle, logoutGoogle, saveLeaderboardName, deleteAccount, copyUID } from './js/profile.js';

// ═══ INIT ═══
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Vertex] DOMContentLoaded - Initializing...');
  bindGlobals();
  initFirebase();
  onAuthReady(async () => {
    await loadCloudProfile();
    updateProfilePage();
    updateSyncReminders();
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
  console.log('[Vertex] Initialization complete.');
});

// ═══ GLOBAL BINDINGS ═══
// Exposes functions to `window` so inline onclick= handlers in index.html work.
function bindGlobals() {
  const globals = {
    navTo,
    toggleSidebar,
    closeSidebar,
    pracSetup,
    custSetup,
    setPracticeDifficulty,
    setCustomDifficulty,
    clearHistory,
    resetAllProgress,
    startRF,
    setRFDifficulty,
    startPractice,
    startCustom,
    startMock,
    setMockExam,
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
    jumpToQuestion,
    endQuiz,
    reviewAnswers,
    rfPick,
    switchPracSub,
    selAllCh,
    clrAllCh,
    switchLbTab,
    toggleLbExpand,
    toggleProfileMenu,
    loginGoogle,
    logoutGoogle,
    saveLeaderboardName,
    deleteAccount,
    copyUID,
    handleAvatarError,
    toggleBookmark,
    switchStatsTab,
    updateRankFromMarks,
    toggleTheme,
    applyTheme,
    removeBookmark,
    removeWrong,
    clearBookmarks,
    clearWrongQueue,
    toggleAutoRemoveWrong,
    startBookmarkedPractice,
    startWrongPractice,
    startSRSReview,
    practiceChapter,
    startQuestionSet,
    jumpReview
  };
  Object.keys(globals).forEach(key => {
    if (globals[key] === undefined) console.error(`[Vertex] Global ${key} is undefined!`);
  });
  Object.assign(window, globals);
}
