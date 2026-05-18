// ═══════════════════════════════════════
// RAPID.JS — Rapid Fire mode
// ═══════════════════════════════════════
import { S, save, filterQ, shuffle } from './store.js';
import {
  toast, flash, reMath, escHtml,
  updateNav, updateHome, updateStatsPage,
  gainXP, updateSubjStat, addSession, starBurst, updateChapterStat, rememberAnswer,
} from './ui.js';
import { navTo } from './router.js';

// ── Rapid Fire state ──
export let RF = {
  qs:[], cur:0, score:0, correct:0, total:0, streak:0, bestStreak:0,
  timer:null, left:120, difficulty:'Foundation',
};

const DOM = {
  timer: null,
  bar: null,
  area: null,
  score: null,
  streak: null
};

function initDom() {
  DOM.timer = document.getElementById('rfTimerDisp');
  DOM.bar   = document.getElementById('rfBar');
  DOM.area  = document.getElementById('rfQArea');
  DOM.score = document.getElementById('rfScoreDisp');
  DOM.streak = document.getElementById('rfStreakDisp');
}

function stopRFTimer() {
  if (RF?.timer) {
    clearInterval(RF.timer);
    RF.timer = null;
  }
}

export function startRF() {
  stopRFTimer();
  const pool = filterQ({ diff: RF.difficulty });
  if (pool.length < 5) { toast('Not enough questions!'); return; }
  initDom();
  const bestAtStart = S.bestStreak;
  RF = {
    qs: shuffle(pool),
    cur: 0,
    score: 0,
    correct: 0,
    total: 0,
    streak: 0,
    bestStreak: 0,
    bestAtStart,
    timer: null,
    left: 120,
    difficulty: RF.difficulty,
  };
  navTo('rapid-quiz');
  if (DOM.timer) {
    DOM.timer.textContent = '2:00';
    DOM.timer.className = 'rf-time ok';
  }
  if (DOM.bar) DOM.bar.style.width = '100%';
  if (DOM.score) DOM.score.textContent = '0';
  if (DOM.streak) DOM.streak.textContent = '0';
  renderRFQ();
  RF.timer = setInterval(() => {
    RF.left--;
    const m = Math.floor(RF.left/60), s = RF.left%60;
    if (DOM.timer) {
      DOM.timer.textContent = m + ':' + String(s).padStart(2,'0');
      DOM.timer.className = 'rf-time ' + (RF.left <= 20 ? 'hot' : RF.left <= 45 ? 'warn' : 'ok');
    }
    if (DOM.bar) DOM.bar.style.width = ((RF.left/120)*100) + '%';
    if (RF.left <= 0) { stopRFTimer(); endRF(); }
  }, 1000);
}

function renderRFQ() {
  if (RF.cur >= RF.qs.length) { RF.qs = shuffle(RF.qs); RF.cur = 0; }
  const q = RF.qs[RF.cur];
  const ls = ['A','B','C','D'];
  const sc = q.subject === 'Physics' ? 'phy' : q.subject === 'Chemistry' ? 'chem' : 'math';
  const dc = q.difficulty === 'Foundation' ? 'fnd' : q.difficulty === 'JEE Main' ? 'main' : 'adv';
  const opts = q.options
    .map(
      (opt, i) =>
        `<button type="button" class="opt" onclick="rfPick(this,${i})" aria-keyshortcuts="${ls[i]}">` +
        `<span class="opt-key">${ls[i]}</span><span class="opt-body">${escHtml(opt)}</span></button>`,
    )
    .join('');
  if (!DOM.area) return;
  const marked = (S.bookmarks || []).includes(q.id);
  DOM.area.innerHTML = `<div class="q-card"><button type="button" class="bookmark-btn ${marked ? 'on' : ''}" data-bookmark-id="${escHtml(q.id)}" aria-pressed="${marked ? 'true' : 'false'}" onclick="toggleBookmark('${escHtml(q.id)}')" title="${marked ? 'Remove bookmark' : 'Bookmark question'}">★</button><div class="q-tags"><span class="q-tag qt-${sc}">${escHtml(q.subject)}</span><span class="q-tag qt-${dc}">${escHtml(q.difficulty)}</span><span class="q-tag">${escHtml(q.chapter || '')}</span></div><div class="q-text">${escHtml(q.questionText)}</div></div><div class="opts">${opts}</div>`;
  reMath(DOM.area);
}

export function rfPick(btn, idx) {
  const q = RF.qs[RF.cur];
  const chosen = q.options[idx];
  const ok = chosen === q.correctAnswer;
  RF.total++;
  btn.closest('.opts').querySelectorAll('.opt').forEach((b, i) => {
    b.disabled = true;
    if (q.options[i] === q.correctAnswer) b.classList.add('correct');
    else if (i === idx && !ok) b.classList.add('wrong');
  });
  if (ok) {
    RF.correct++;
    RF.streak++;
    if (RF.streak > RF.bestStreak) RF.bestStreak = RF.streak;
    RF.score += 10 + (RF.streak >= 3 ? 5 : 0);
    flash(true);
    S.correct++;
    S.answered++;
    S.streak++;
    if (S.streak > S.bestStreak) S.bestStreak = S.streak;
    gainXP(5);
  } else {
    RF.streak = 0;
    flash(false);
    S.answered++;
    S.streak = 0;
  }
  updateSubjStat(q.subject, ok);
  updateChapterStat(q, ok);
  rememberAnswer(q, ok);
  if (DOM.score)  DOM.score.textContent = RF.score;
  if (DOM.streak) DOM.streak.textContent = RF.streak + '🔥';
  updateNav(); // Batched save: we only call save() in endRF
  RF.cur++;
  setTimeout(renderRFQ, 500);
}

function endRF() {
  stopRFTimer();
  const newBest = RF.bestStreak > (RF.bestAtStart ?? 0);
  if (newBest) S.bestStreak = RF.bestStreak;
  const acc = RF.total ? Math.round((RF.correct/RF.total)*100) : 0;
  let emoji, pill;
  if      (acc >= 85) { emoji='🏆'; pill='Goated behavior fr, not taking any Ls 👑'; }
  else if (acc >= 70) { emoji='🔥'; pill='Slay! You cooked those qs deadass ⚡'; }
  else if (acc >= 55) { emoji='⚡'; pill='Lowkey not bad, kinda poggers ngl 🎯'; }
  else if (acc >= 40) { emoji='📚'; pill='Midrange arc... time to grind bestie 📖'; }
  else               { emoji='💀'; pill='Bro got ratio\'d by physics lmaoo 💀'; }
  
  document.getElementById('rfResEmoji').textContent   = emoji;
  document.getElementById('rfResPill').textContent    = pill;
  document.getElementById('rfResSub').textContent     = `${RF.correct}/${RF.total} correct · ${acc}% accuracy`;
  document.getElementById('rfResScore').textContent   = RF.score;
  document.getElementById('rfResCorrect').textContent = RF.correct;
  document.getElementById('rfResTotal').textContent   = RF.total;
  document.getElementById('rfNewBest').style.display  = newBest ? 'block' : 'none';
  
  addSession({ mode:'rapid', score:RF.score, correct:RF.correct, wrong:RF.total-RF.correct, skipped:0, total:RF.total, streak:RF.bestStreak, date:new Date().toLocaleDateString() });
  if (newBest) starBurst();
  updateHome(); updateStatsPage(); 
  save(); // Persist and sync everything once at the end
  navTo('rapid-results');
}
