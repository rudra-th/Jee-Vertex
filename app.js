import {
  initFirebase,
  onAuthReady,
  getCurrentUser,
  isFirebaseReady,
  signInWithGoogle,
  signOutUser,
  syncUserStats,
  getUserProfile,
  updateLeaderboardName,
  fetchLeaderboard,
} from './firebase.js';

// ═══════════════════════════════════════
// STATE
// ═══════════════════════════════════════
let allQ = [];
let leaderboardCache = { streak: [], solved: [], accuracy: [] };
let lbTab = 'streak';

const S = {
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

let Q = { qs:[], cur:0, ans:[], mode:'practice', timerMode:'none',
          totalTimer:null, totalLeft:0, totalSecs:0,
          pqTimer:null, pqLeft:0, pqSecs:150 };

let RF = { qs:[], cur:0, score:0, correct:0, total:0, streak:0, bestStreak:0,
           timer:null, left:120, difficulty:'Foundation' };

let pracSetup = { subject:'Physics', chapters:new Set(), diff:'Foundation' };
let custSetup = { count:20, subjects:new Set(['Physics','Chemistry','Mathematics']),
                  diff:'All', timerMode:'perq', perQSecs:150, totalMins:60 };

// ═══════════════════════════════════════
// INIT
// ═══════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  initFirebase();
  onAuthReady(async () => {
    await loadCloudProfile();
    updateProfilePage();
    syncCloud();
  });
  await loadQ();
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

async function loadQ() {
  try {
    const r = await fetch('questions.json');
    if (!r.ok) throw 0;
    allQ = await r.json();
    if (!Array.isArray(allQ) || !allQ.length) throw 0;
    updateCustomPreview();
  } catch {
    allQ = [];
    toast('❌ questions.json not found — place it in the same folder.');
    updateCustomPreview();
  }
}

// ═══════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════
function navTo(id) {
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
  if (id === 'profile') updateProfilePage();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  reMath();
}

const MATH_OPTS = {
  delimiters: [
    { left: '$$', right: '$$', display: true },
    { left: '$', right: '$', display: false },
  ],
  throwOnError: false,
};

function reMath(root) {
  const target =
    root ||
    document.querySelector('.page.active #quizQArea') ||
    document.querySelector('.page.active #rfQArea') ||
    document.querySelector('.page.active #reviewItems') ||
    document.querySelector('.page.active .page-inner') ||
    document.querySelector('.page.active');
  if (!target) return;
  setTimeout(() => {
    if (window.renderMathInElement) renderMathInElement(target, MATH_OPTS);
  }, 80);
}

// ═══════════════════════════════════════
// PERSIST & DISPLAY
// ═══════════════════════════════════════
function save() {
  S.totalSolved = Math.max(S.totalSolved, S.answered);
  ['streak', 'bestStreak', 'level', 'xp', 'answered', 'correct', 'totalSolved'].forEach((k) =>
    localStorage.setItem('vx2_' + k, S[k]),
  );
  localStorage.setItem('vx2_leaderboardName', S.leaderboardName || '');
  localStorage.setItem('vx2_sessions', JSON.stringify(S.sessions));
  localStorage.setItem('vx2_subjStats', JSON.stringify(S.subjStats));
  syncCloud();
}

function syncCloud() {
  if (!isFirebaseReady() || !getCurrentUser()) return;
  syncUserStats(S).catch(() => {});
}

async function loadCloudProfile() {
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

function updateNav() {
  document.getElementById('streakN').textContent = S.streak;
  document.getElementById('levelN').textContent  = S.level;
  const xpPct = S.xp % 100;
  const arc   = document.getElementById('xpArc');
  if (arc) arc.style.strokeDashoffset = 69.1 * (1 - xpPct / 100);
}

function updateHome() {
  document.getElementById('sbAnswered').textContent = S.answered;
  document.getElementById('sbCorrect').textContent  = S.correct;
  const acc = S.answered ? Math.round((S.correct / S.answered) * 100) : 0;
  document.getElementById('sbAcc').textContent  = acc + '%';
  document.getElementById('sbBest').textContent = S.bestStreak;
  const xpPct = S.xp % 100;
  document.getElementById('xpPct').textContent = xpPct + ' / 100 XP';
  document.getElementById('xpBar').style.width  = xpPct + '%';
}

function gainXP(n) {
  S.xp += n;
  const lvl = Math.floor(S.xp / 100) + 1;
  if (lvl > S.level) {
    S.level = lvl;
    document.getElementById('newLvlTxt').textContent = 'Level ' + lvl;
    document.getElementById('lvlModal').style.display = 'flex';
    starBurst();
  }
  updateNav(); save();
}
function closeLvl() { document.getElementById('lvlModal').style.display = 'none'; }

function updateSubjStat(subject, isCorrect) {
  if (!S.subjStats[subject]) S.subjStats[subject] = { ans:0, cor:0 };
  S.subjStats[subject].ans++;
  if (isCorrect) S.subjStats[subject].cor++;
  save();
}

function updateStatsPage() {
  setText('stAnswered', S.answered);
  setText('stCorrect', S.correct);
  setText('profileStatAnswered', S.answered);
  setText('profileStatCorrect', S.correct);
  const overallAcc = S.answered ? Math.round((S.correct / S.answered) * 100) : 0;
  setText('stAcc', overallAcc + '%');
  setText('stBest', S.bestStreak);
  setText('profileStatAcc', overallAcc + '%');
  setText('profileStatBest', S.bestStreak);

  // NEW: Performance extras
  setText('stXP',      S.xp      ?? 0);
  setText('stLevel',   S.level   ?? 1);
  setText('stSessions', (S.sessions || []).length);
  setText('stWrong',   (S.answered || 0) - (S.correct || 0));

  // Subject breakdown
  const subAccMap = {};
  ['Physics','Chemistry','Mathematics'].forEach(sub => {
    const d = S.subjStats[sub];
    const id = sub === 'Physics' ? 'phy' : sub === 'Chemistry' ? 'chem' : 'math';
    const profileId = sub === 'Physics' ? 'profilePhy' : sub === 'Chemistry' ? 'profileChem' : 'profileMath';
    const subAcc = d && d.ans ? Math.round((d.cor / d.ans) * 100) : 0;
    if (d && d.ans) subAccMap[sub] = subAcc;
    setText(id + 'Acc', d && d.ans ? subAcc + '%' : '-');
    setText(profileId + 'Acc', d && d.ans ? subAcc + '%' : '-');
    const bar = document.getElementById(id + 'Bar');
    if (bar) bar.style.width = (d ? subAcc : 0) + '%';
    const profileBar = document.getElementById(profileId + 'Bar');
    if (profileBar) profileBar.style.width = (d ? subAcc : 0) + '%';
    setText(id + 'Meta', d ? `${d.cor}/${d.ans} correct` : 'No data yet');
    setText(profileId + 'Meta', d ? `${d.cor}/${d.ans} correct` : 'No data yet');
  });

  // NEW: Strengths & weaknesses
  const subEntries = Object.entries(subAccMap);
  if (subEntries.length) {
    const sorted = subEntries.sort((a, b) => b[1] - a[1]);
    setText('stStrongest', sorted[0][0] + ' (' + sorted[0][1] + '%)');
    setText('stWeakest',   sorted[sorted.length - 1][0] + ' (' + sorted[sorted.length - 1][1] + '%)');
  } else {
    setText('stStrongest', 'Not enough data');
    setText('stWeakest',   'Not enough data');
  }

  // NEW: Milestones
  const milestones = [
    { id: 'ms10',      earned: S.answered >= 10 },
    { id: 'ms50',      earned: S.answered >= 50 },
    { id: 'ms100',     earned: S.answered >= 100 },
    { id: 'ms250',     earned: S.answered >= 250 },
    { id: 'ms500',     earned: S.answered >= 500 },
    { id: 'msStreak5', earned: S.bestStreak >= 5 },
    { id: 'msStreak10',earned: S.bestStreak >= 10 },
    { id: 'msAcc80',   earned: overallAcc >= 80 && S.answered >= 10 },
    { id: 'msAcc90',   earned: overallAcc >= 90 && S.answered >= 10 },
  ];
  milestones.forEach(({ id, earned }) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('earned', earned);
  });

  const rows = document.getElementById('statsHistRows');
  const profileRows = document.getElementById('profileHistRows');
  if (!S.sessions.length) {
    const empty = '<div style="padding:2rem;text-align:center;color:var(--txt3);font-size:.85rem;font-style:italic">No sessions yet</div>';
    if (rows) rows.innerHTML = empty;
    if (profileRows) profileRows.innerHTML = empty;
    return;
  }
  const html = S.sessions.slice(0,20).map(s => buildHistRow(s)).join('');
  if (rows) rows.innerHTML = html;
  if (profileRows) profileRows.innerHTML = html;
}
// ═══════════════════════════════════════
// FEEDBACK
// ═══════════════════════════════════════
function flash(ok) {
  const el = document.createElement('div');
  el.className = 'flash ' + (ok ? 'ok' : 'bad');
  el.setAttribute('role', 'status');
  el.textContent = ok ? '✓ Correct! +10 XP' : '✗ Wrong';
  document.getElementById('flashArea').appendChild(el);
  setTimeout(() => el.remove(), 1900);
}

function starBurst() {
  for (let i = 0; i < 18; i++) {
    const s = document.createElement('div');
    s.className = 'star';
    const a = (i / 18) * 360, d = 80 + Math.random() * 80;
    s.style.cssText = `width:${4+Math.random()*5}px;height:${4+Math.random()*5}px;left:50%;top:40%;background:hsl(${a},100%,65%);--dx:${Math.cos(a*Math.PI/180)*d}px;--dy:${Math.sin(a*Math.PI/180)*d}px`;
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 900);
  }
}

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.setAttribute('role', 'status');
  t.textContent = msg;
  document.getElementById('toastArea').appendChild(t);
  setTimeout(() => t.remove(), 2700);
}

// ═══════════════════════════════════════
// CHAPTER HELPERS
// ═══════════════════════════════════════
function scCls(sub) { return sub === 'Physics' ? 'sp' : sub === 'Chemistry' ? 'sc' : 'sm'; }
function diffCls(d)  { return d==='Foundation'?'df':d==='JEE Main'?'dm':d==='JEE Advanced'?'da':'dall'; }

function updateChCount() {
  const el = document.getElementById('chCount');
  if (el) el.textContent = pracSetup.chapters.size + ' selected';
}

function populateChapters() {
  const sub  = pracSetup.subject;
  const chs  = [...new Set(allQ.filter(q => q.subject === sub).map(q => q.chapter))].sort();
  const grid = document.getElementById('pracChGrid');
  if (!grid) return;
  grid.innerHTML = '';
  pracSetup.chapters.clear();
  const cls = scCls(sub);
  chs.forEach(ch => {
    const chip = document.createElement('div');
    chip.className = 'ch-chip ' + cls;
    chip.dataset.chapter = ch; chip.dataset.cls = cls;
    pracSetup.chapters.add(ch);
    chip.innerHTML = `<div class="ch-dot"></div>${ch}`;
    chip.onclick = () => togChip(chip, ch);
    grid.appendChild(chip);
  });
  updateChCount();
}

function togChip(chip, ch) {
  const cls = chip.dataset.cls;
  if (pracSetup.chapters.has(ch)) { pracSetup.chapters.delete(ch); chip.classList.remove(cls); }
  else { pracSetup.chapters.add(ch); chip.classList.add(cls); }
  updateChCount();
}
function selAllCh() {
  document.querySelectorAll('#pracChGrid .ch-chip').forEach(c => { c.classList.add(c.dataset.cls); pracSetup.chapters.add(c.dataset.chapter); });
  updateChCount();
}
function clrAllCh() {
  document.querySelectorAll('#pracChGrid .ch-chip').forEach(c => c.classList.remove(c.dataset.cls));
  pracSetup.chapters.clear(); updateChCount();
}
function switchPracSub(btn) {
  document.querySelectorAll('#pracSubTabs .sub-tab').forEach(b => b.className = 'sub-tab');
  const sub = btn.dataset.subject;
  btn.classList.add(sub==='Physics'?'ap':sub==='Chemistry'?'ac':'am');
  pracSetup.subject = sub; populateChapters();
}

// ═══════════════════════════════════════
// CONTROLS
// ═══════════════════════════════════════
function selDiff(rowId, btn, cb) {
  document.querySelectorAll('#'+rowId+' .diff-btn').forEach(b => b.className = 'diff-btn');
  btn.classList.add(diffCls(btn.dataset.diff));
  cb(btn.dataset.diff);
  if (rowId === 'custDiffRow') updateCustomPreview();
}
function togSub(btn) {
  const sub = btn.dataset.sub, cls = sub==='Physics'?'sp':sub==='Chemistry'?'sc':'sm';
  if (custSetup.subjects.has(sub)) { custSetup.subjects.delete(sub); btn.className = 'subj-btn'; }
  else { custSetup.subjects.add(sub); btn.classList.add(cls); }
  updateCustomPreview();
}
function allSubs() {
  ['Physics','Chemistry','Mathematics'].forEach(sub => {
    custSetup.subjects.add(sub);
    const cls = sub==='Physics'?'sp':sub==='Chemistry'?'sc':'sm';
    const btn = document.querySelector(`.subj-btn[data-sub="${sub}"]`);
    if (btn) { btn.className = 'subj-btn'; btn.classList.add(cls); }
  });
  updateCustomPreview();
}
function noneSubs() {
  custSetup.subjects.clear();
  document.querySelectorAll('.subj-btn').forEach(b => b.className = 'subj-btn');
  updateCustomPreview();
}
function adjQ(d) {
  custSetup.count = Math.max(5, Math.min(60, custSetup.count + d));
  document.getElementById('custQCount').textContent = custSetup.count;
  updateCustomPreview();
}
function setQN(n, btn) {
  custSetup.count = n;
  document.getElementById('custQCount').textContent = n;
  document.querySelectorAll('.preset').forEach(b => b.classList.remove('on'));
  if (btn) btn.classList.add('on');
  updateCustomPreview();
}

function countCustomPool() {
  if (!custSetup.subjects.size) return 0;
  return filterQ({ subjects: custSetup.subjects, diff: custSetup.diff }).length;
}

function updateCustomPreview() {
  const hint = document.getElementById('custMatchHint');
  const btn = document.getElementById('btnStartCustom');
  if (!hint || !btn) return;
  if (!allQ.length) {
    hint.textContent = 'Question bank not loaded.';
    hint.className = 'cust-hint err';
    btn.disabled = true;
    return;
  }
  if (!custSetup.subjects.size) {
    hint.textContent = 'Select at least one subject to see how many questions match.';
    hint.className = 'cust-hint err';
    btn.disabled = true;
    return;
  }
  const available = countCustomPool();
  if (available === 0) {
    hint.textContent = 'No questions match — broaden difficulty or add subjects before starting.';
    hint.className = 'cust-hint err';
    btn.disabled = true;
  } else if (available < custSetup.count) {
    hint.textContent = `${available} question${available === 1 ? '' : 's'} available (test will use all ${available}).`;
    hint.className = 'cust-hint warn';
    btn.disabled = false;
  } else {
    hint.textContent = `${available} questions match your settings.`;
    hint.className = 'cust-hint ok';
    btn.disabled = false;
  }
}
function selTMode(btn) {
  document.querySelectorAll('#tmRow .tm-opt').forEach(b => b.classList.remove('on'));
  btn.classList.add('on'); custSetup.timerMode = btn.dataset.tmode;
  document.getElementById('perQArea').style.display  = custSetup.timerMode === 'perq'  ? 'block' : 'none';
  document.getElementById('totalArea').style.display = custSetup.timerMode === 'total' ? 'block' : 'none';
}
function selPQP(btn) {
  document.querySelectorAll('#perQArea .tpc').forEach(b => b.classList.remove('on'));
  btn.classList.add('on'); custSetup.perQSecs = +btn.dataset.tpq;
  document.getElementById('perQInput').value = custSetup.perQSecs;
}
function onPQI(inp) {
  const v = +inp.value;
  if (!isNaN(v) && v >= 10) {
    custSetup.perQSecs = v;
    document.querySelectorAll('#perQArea .tpc').forEach((b) => b.classList.remove('on'));
    updateCustomPreview();
  }
}
function selTP(btn) {
  document.querySelectorAll('#totalArea .tpc').forEach(b => b.classList.remove('on'));
  btn.classList.add('on'); custSetup.totalMins = +btn.dataset.ttot;
  document.getElementById('totalInput').value = custSetup.totalMins;
}
function onTI(inp) {
  const v = +inp.value;
  if (!isNaN(v) && v >= 5) {
    custSetup.totalMins = v;
    document.querySelectorAll('#totalArea .tpc').forEach((b) => b.classList.remove('on'));
    updateCustomPreview();
  }
}

// ═══════════════════════════════════════
// FILTERING
// ═══════════════════════════════════════
function filterQ({ subjects, chapters, diff, count }) {
  let pool = allQ;
  if (subjects && subjects.size) pool = pool.filter(q => subjects.has(q.subject));
  if (chapters && chapters.size) pool = pool.filter(q => chapters.has(q.chapter));
  if (diff && diff !== 'All') pool = pool.filter(q => q.difficulty === diff);
  pool = shuffle(pool);
  return count ? pool.slice(0, count) : pool;
}
function shuffle(a) {
  const r = [...a];
  for (let i = r.length-1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i+1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

// ═══════════════════════════════════════
// PRACTICE
// ═══════════════════════════════════════
function startPractice() {
  if (!pracSetup.chapters.size) { toast('Select at least one chapter!'); return; }
  const qs = filterQ({ subjects: new Set([pracSetup.subject]), chapters: pracSetup.chapters, diff: pracSetup.diff === 'All' ? null : pracSetup.diff });
  if (!qs.length) { toast('No questions match — try different settings.'); return; }
  Q = { qs, cur:0, ans:new Array(qs.length).fill(null), mode:'practice', timerMode:'none', totalTimer:null, totalLeft:0, totalSecs:0, pqTimer:null, pqLeft:0, pqSecs:0 };
  document.getElementById('modeBadge').textContent = '📚 Practice';
  document.getElementById('pqTimerWrap').style.display = 'none';
  document.getElementById('totalTimerWrap').style.display = 'none';
  navTo('quiz'); renderQ();
}

// ═══════════════════════════════════════
// CUSTOM TEST
// ═══════════════════════════════════════
function startCustom() {
  if (!custSetup.subjects.size) { toast('Select at least one subject!'); return; }
  const available = countCustomPool();
  if (!available) { updateCustomPreview(); toast('No questions match — try different settings.'); return; }
  const qs = filterQ({
    subjects: custSetup.subjects,
    diff: custSetup.diff,
    count: Math.min(custSetup.count, available),
  });
  if (!qs.length) { updateCustomPreview(); toast('No questions match — try different settings.'); return; }
  Q = { qs, cur:0, ans:new Array(qs.length).fill(null), mode:'custom', timerMode:custSetup.timerMode,
        totalTimer:null, totalLeft:custSetup.totalMins*60, totalSecs:custSetup.totalMins*60,
        pqTimer:null, pqLeft:custSetup.perQSecs, pqSecs:custSetup.perQSecs };
  document.getElementById('modeBadge').textContent = '🎯 Custom';
  document.getElementById('pqTimerWrap').style.display  = custSetup.timerMode === 'perq'  ? 'flex'  : 'none';
  document.getElementById('totalTimerWrap').style.display = custSetup.timerMode === 'total' ? 'block' : 'none';
  if (Q.timerMode === 'total') startTotalTimer();
  navTo('quiz');
  renderQ();
}

// ═══════════════════════════════════════
// TIMERS
// ═══════════════════════════════════════
function startTotalTimer() {
  clearInterval(Q.totalTimer); updRing();
  Q.totalTimer = setInterval(() => {
    Q.totalLeft--; updRing();
    if (Q.totalLeft <= 0) { clearInterval(Q.totalTimer); toast("⏰ Time's up!"); endQuiz(); }
  }, 1000);
}
function updRing() {
  const left = Q.totalLeft, total = Q.totalSecs;
  const m = Math.floor(left/60), s = left%60;
  const el = document.getElementById('rtTxt');
  if (el) el.textContent = m + ':' + String(s).padStart(2,'0');
  const fg = document.getElementById('rtFg');
  if (!fg) return;
  fg.style.strokeDashoffset = 125.7 * (1 - left / Math.max(total, 1));
  const r = left / Math.max(total, 1);
  fg.style.stroke = r > .4 ? 'var(--sky)' : r > .2 ? 'var(--gold)' : 'var(--rose)';
}
function startPQTimer() {
  clearInterval(Q.pqTimer); Q.pqLeft = Q.pqSecs; updPQ();
  Q.pqTimer = setInterval(() => {
    Q.pqLeft--; updPQ();
    if (Q.pqLeft <= 0) { clearInterval(Q.pqTimer); toast("⏰ Time's up!"); skipQ(); }
  }, 1000);
}
function stopPQTimer() { clearInterval(Q.pqTimer); Q.pqTimer = null; }
function updPQ() {
  const left = Q.pqLeft, total = Q.pqSecs, pct = (left / Math.max(total,1)) * 100;
  const fill = document.getElementById('pqFill'), txt = document.getElementById('pqTxt');
  if (!fill || !txt) return;
  fill.style.width = pct + '%';
  fill.style.background = pct > 50 ? 'var(--sky)' : pct > 25 ? 'var(--gold)' : 'var(--rose)';
  txt.style.color = pct <= 25 ? 'var(--rose)' : 'var(--txt2)';
  const m = Math.floor(left/60), s = left%60;
  txt.textContent = m > 0 ? `${m}:${String(s).padStart(2,'0')}` : s + 's';
}

// ═══════════════════════════════════════
// QUIZ RENDER
// ═══════════════════════════════════════
function renderQ() {
  const q = Q.qs[Q.cur], total = Q.qs.length, cur = Q.cur;
  document.getElementById('qCur').textContent = cur + 1;
  document.getElementById('qTot').textContent = total;
  const pct = (cur / total) * 100;
  document.getElementById('qProgFill').style.width = pct + '%';
  document.getElementById('qProgL').textContent = 'Question ' + (cur + 1);
  document.getElementById('qProgR').textContent = Math.round(pct) + '% done';
  document.getElementById('btnNext').style.display = 'none';
  document.getElementById('btnSkip').style.display = 'inline-flex';
  document.getElementById('quizQArea').innerHTML = buildQHTML(q, false);
  reMath(document.getElementById('quizQArea'));
  if (Q.timerMode === 'perq') { Q.pqLeft = Q.pqSecs; startPQTimer(); }
}

function buildQHTML(q, reveal, chosen = null) {
  const ls = ['A','B','C','D'];
  const sc = q.subject === 'Physics' ? 'phy' : q.subject === 'Chemistry' ? 'chem' : 'math';
  const dc = q.difficulty === 'Foundation' ? 'fnd' : q.difficulty === 'JEE Main' ? 'main' : 'adv';
  const opts = q.options.map((opt, i) => {
    let cls = 'opt';
    if (reveal) { if (opt === q.correctAnswer) cls += ' correct'; else if (opt === chosen && opt !== q.correctAnswer) cls += ' wrong'; }
    return `<button type="button" class="${cls}" ${reveal ? 'disabled' : ''} onclick="pickOpt(this,${i})" aria-keyshortcuts="${ls[i]}">`
      + `<span class="opt-key">${ls[i]}</span><span class="opt-body">${opt}</span></button>`;
  }).join('');
  const expl = reveal ? `<div class="expl"><div class="expl-tag">💡 Explanation</div><div class="expl-body">${q.explanation}</div></div>` : '';
  return `<div class="q-card"><div class="q-tags"><span class="q-tag qt-${sc}">${q.subject}</span><span class="q-tag qt-${dc}">${q.difficulty}</span></div><div class="q-text">${q.questionText}</div></div><div class="opts">${opts}</div>${expl}`;
}

function esc(s) { return s.replace(/\\/g,'\\\\').replace(/'/g,'&#39;').replace(/"/g,'&quot;'); }

function pickOpt(btn, idx) {
  const q = Q.qs[Q.cur];
  const chosen = q.options[idx];
  const ok = chosen === q.correctAnswer;
  Q.ans[Q.cur] = chosen;
  stopPQTimer();
  S.answered++;
  if (ok) { S.correct++; S.streak++; if (S.streak > S.bestStreak) S.bestStreak = S.streak; gainXP(10); flash(true); }
  else { S.streak = 0; flash(false); }
  updateSubjStat(q.subject, ok);
  updateNav(); updateHome(); save();
  const pct = ((Q.cur+1) / Q.qs.length) * 100;
  document.getElementById('qProgFill').style.width = pct + '%';
  document.getElementById('qProgR').textContent = Math.round(pct) + '% done';
  document.getElementById('quizQArea').innerHTML = buildQHTML(q, true, chosen);
  reMath(document.getElementById('quizQArea'));
  document.getElementById('btnNext').style.display = 'inline-flex';
  document.getElementById('btnSkip').style.display = 'none';
}

function nextQ() { stopPQTimer(); if (Q.cur < Q.qs.length-1) { Q.cur++; renderQ(); window.scrollTo({top:0,behavior:'smooth'}); } else endQuiz(); }
function skipQ()  { stopPQTimer(); Q.ans[Q.cur] = null; if (Q.cur < Q.qs.length-1) { Q.cur++; renderQ(); window.scrollTo({top:0,behavior:'smooth'}); } else endQuiz(); }

function endQuiz() {
  stopPQTimer(); clearInterval(Q.totalTimer);
  let correct=0, wrong=0, skipped=0;
  Q.ans.forEach((a, i) => { if (a === null) skipped++; else if (a === Q.qs[i].correctAnswer) correct++; else wrong++; });
  const total = Q.qs.length, pct = Math.round((correct/total)*100);
  document.getElementById('resCorrect').textContent = correct;
  document.getElementById('resWrong').textContent   = wrong;
  document.getElementById('resSkipped').textContent = skipped;
  document.getElementById('resPct').textContent     = pct + '%';
  let emoji, title, pill;
  if      (pct >= 95) { emoji='🏆'; title='Absolutely Cooked!'; pill='No cap, you ate that fr fr 🔥'; }
  else if (pct >= 85) { emoji='🔥'; title='Bussin\'!'; pill='Bro is actually built different ⚡'; }
  else if (pct >= 75) { emoji='⚡'; title='That\'s Fire!'; pill='Main character energy detected 🎯'; }
  else if (pct >= 60) { emoji='📚'; title='Decent Vibes!'; pill='Lowkey impressed ngl 💅'; }
  else if (pct >= 40) { emoji='😤'; title='Keep Grinding!'; pill='Touch grass and retry, bestie 🌿'; }
  else                { emoji='💀'; title='L + Ratio...'; pill='Glow-up arc loading 📈'; }
  document.getElementById('resEmoji').textContent = emoji;
  document.getElementById('resTitle').textContent = title;
  document.getElementById('resPill').textContent  = pill;
  document.getElementById('resSub').textContent   = `${correct}/${total} correct · ${pct}% accuracy`;
  document.getElementById('reviewPanel').style.display = 'none';
  addSession({ mode:Q.mode, score:pct, correct, wrong, skipped, total, date:new Date().toLocaleDateString() });
  navTo('results');
  setTimeout(() => {
    const fg = document.getElementById('srFg');
    if (fg) {
      fg.style.strokeDashoffset = 471.2 * (1 - pct/100);
      fg.style.stroke = pct >= 75 ? 'var(--emerald)' : pct >= 50 ? 'var(--gold)' : 'var(--rose)';
    }
  }, 100);
  updateHome(); updateStatsPage();
}

function reviewAnswers() {
  const panel = document.getElementById('reviewPanel');
  panel.style.display = 'block';
  const container = document.getElementById('reviewItems');
  container.innerHTML = '';
  Q.qs.forEach((q, i) => {
    const a = Q.ans[i], ok = a === q.correctAnswer, skip = a === null;
    const d = document.createElement('div');
    d.className = 'rev-item ' + (skip ? 'rs' : ok ? 'rc' : 'rw');
    d.innerHTML = `
      <span class="rev-badge ${skip?'rev-s':ok?'rev-c':'rev-w'}">${skip?'⏭ Skipped':ok?'✓ Correct':'✗ Wrong'}</span>
      <div class="rev-q">Q${i+1}: ${q.questionText}</div>
      ${(!skip && !ok) ? `<div class="rev-ans" style="color:var(--rose)">Your answer: ${a}</div>` : ''}
      <div class="rev-ans" style="color:var(--emerald)">Correct: ${q.correctAnswer}</div>
      <div class="expl" style="margin-top:.6rem"><div class="expl-tag">💡 Explanation</div><div class="expl-body">${q.explanation}</div></div>
    `;
    container.appendChild(d);
  });
  reMath(document.getElementById('reviewItems'));
  panel.scrollIntoView({ behavior: 'smooth' });
}

// ═══════════════════════════════════════
// RAPID FIRE
// ═══════════════════════════════════════
function stopRFTimer() {
  if (RF?.timer) {
    clearInterval(RF.timer);
    RF.timer = null;
  }
}

function startRF() {
  stopRFTimer();
  const pool = filterQ({ diff: RF.difficulty });
  if (pool.length < 5) { toast('Not enough questions!'); return; }
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
  renderRFQ();
  RF.timer = setInterval(() => {
    RF.left--;
    const m = Math.floor(RF.left/60), s = RF.left%60;
    const d = document.getElementById('rfTimerDisp');
    if (d) {
      d.textContent = m + ':' + String(s).padStart(2,'0');
      d.className = 'rf-time ' + (RF.left <= 20 ? 'hot' : RF.left <= 45 ? 'warn' : 'ok');
    }
    const bar = document.getElementById('rfBar');
    if (bar) bar.style.width = ((RF.left/120)*100) + '%';
    if (RF.left <= 0) { clearInterval(RF.timer); endRF(); }
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
        `<span class="opt-key">${ls[i]}</span><span class="opt-body">${opt}</span></button>`,
    )
    .join('');
  const area = document.getElementById('rfQArea');
  if (!area) return;
  area.innerHTML = `<div class="q-card"><div class="q-tags"><span class="q-tag qt-${sc}">${q.subject}</span><span class="q-tag qt-${dc}">${q.difficulty}</span></div><div class="q-text">${q.questionText}</div></div><div class="opts">${opts}</div>`;
  reMath(area);
}

function rfPick(btn, idx) {
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
  const sc2 = document.getElementById('rfScoreDisp'), st = document.getElementById('rfStreakDisp');
  if (sc2) sc2.textContent = RF.score;
  if (st)  st.textContent  = RF.streak + '🔥';
  updateNav(); save();
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
  updateHome(); updateStatsPage(); navTo('rapid-results');
}

// ═══════════════════════════════════════
// HISTORY
// ═══════════════════════════════════════
function addSession(s) {
  S.sessions.unshift(s);
  if (S.sessions.length > 30) S.sessions.pop();
  save(); renderHistory(); updateStatsPage();
}
function clearHistory() {
  if (!confirm('Clear all session history?')) return;
  S.sessions = []; save(); renderHistory(); toast('History cleared.');
}
function buildHistRow(s) {
  const b    = s.mode === 'rapid' ? 'hm-rapid' : s.mode === 'custom' ? 'hm-custom' : 'hm-practice';
  const ml   = s.mode === 'rapid' ? '⚡ Rapid'  : s.mode === 'custom' ? '🎯 Custom' : '📚 Practice';
  const st   = s.mode === 'rapid' ? s.score + ' pts' : s.score + '%';
  const det  = s.mode === 'rapid'
    ? `${s.correct}/${s.total} correct · streak ${s.streak || 0}`
    : `${s.correct}/${s.total} correct · ${s.wrong} wrong`;
  return `<div class="hist-row">
    <span class="h-mode-tag ${b}">${ml}</span>
    <div><div class="h-detail">${det}</div></div>
    <div class="h-score">${st}</div>
    <div class="h-date">${s.date}</div>
  </div>`;
}
function renderHistory() {
  const rows = document.getElementById('histRows');
  if (!rows) return;
  if (!S.sessions.length) {
    rows.innerHTML = '<div style="padding:2.5rem;text-align:center;color:var(--txt3);font-size:.85rem;font-style:italic">No sessions yet — pick a mode and start practicing!</div>';
    return;
  }
  rows.innerHTML = S.sessions.slice(0, 15).map(buildHistRow).join('');
}

// ═══════════════════════════════════════
// LEADERBOARD
// ═══════════════════════════════════════
async function loadLeaderboard() {
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
    if (el) el.innerHTML = `<div class="lb-empty">${msg}</div>`;
  });
  const hero = document.getElementById('lbHeroStats');
  if (hero) hero.innerHTML = '';
}

function switchLbTab(tab, btn) {
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

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ═══════════════════════════════════════
// PROFILE & AUTH
// ═══════════════════════════════════════
function updateProfilePage() {
  const guest = document.getElementById('profileGuest');
  const authed = document.getElementById('profileAuthed');
  const user = getCurrentUser();
  if (!guest || !authed) return;
  if (!user) {
    guest.style.display = 'block';
    authed.style.display = 'none';
    const navAv = document.getElementById('navAvatar');
    if (navAv) navAv.style.display = 'none';
    updateStatsPage();
    return;
  }
  guest.style.display = 'none';
  authed.style.display = 'block';
  const displayName = cleanLeaderboardName(S.leaderboardName || user.displayName) || 'Vertex Student';
  const img = document.getElementById('profileAvatar');
  const name = document.getElementById('profileName');
  const nameInput = document.getElementById('profileNameInput');
  const email = document.getElementById('profileEmail');
  if (img) img.src = user.photoURL || avatarUrl({ displayName });
  if (name) name.textContent = displayName;
  if (nameInput) nameInput.value = displayName;
  if (email) email.textContent = user.email || '';
  const navAv = document.getElementById('navAvatar');
  if (navAv) {
    if (user.photoURL) {
      navAv.src = user.photoURL;
      navAv.style.display = 'block';
    } else {
      navAv.style.display = 'none';
    }
  }
  const acc = S.answered ? Math.round((S.correct / S.answered) * 100) : 0;
  setText('profileLevel', S.level);
  setText('profileXP', S.xp);
  setText('profileSolved', S.totalSolved);
  setText('profileStreak', S.bestStreak);
  setText('profileAcc', acc + '%');
  updateStatsPage();
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

async function loginGoogle() {
  try {
    await signInWithGoogle();
    await loadCloudProfile();
    toast('Signed in - your progress will sync to the cloud.');
    syncCloud();
    updateProfilePage();
  } catch (e) {
    if (e?.code !== 'auth/popup-closed-by-user') toast('Sign-in failed. Check Firebase Auth setup.');
  }
}

async function logoutGoogle() {
  try {
    await signOutUser();
    toast('Signed out.');
    updateProfilePage();
  } catch {
    toast('Could not sign out.');
  }
}

async function saveLeaderboardName() {
  const input = document.getElementById('profileNameInput');
  const nextName = cleanLeaderboardName(input?.value);
  if (!nextName) {
    toast('Enter a leaderboard name first.');
    return;
  }
  S.leaderboardName = nextName;
  save();
  try {
    await updateLeaderboardName(nextName);
    toast('Leaderboard name updated.');
    updateProfilePage();
    if (document.getElementById('pg-leaderboard')?.classList.contains('active')) loadLeaderboard();
  } catch {
    toast('Could not update name. Check Firebase rules.');
  }
}

function cleanLeaderboardName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').slice(0, 32);
}
function onQuizKeydown(e) {
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

function toggleMobileNav() {
  const drawer = document.getElementById('mobileNav');
  const btn = document.getElementById('navMenuBtn');
  if (!drawer) return;
  const open = drawer.classList.toggle('open');
  if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  document.body.classList.toggle('nav-open', open);
}

function closeMobileNav() {
  const drawer = document.getElementById('mobileNav');
  const btn = document.getElementById('navMenuBtn');
  if (!drawer?.classList.contains('open')) return;
  drawer.classList.remove('open');
  if (btn) btn.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('nav-open');
}

function bindGlobals() {
  const fns = {
    navTo,
    toggleMobileNav,
    closeMobileNav,
    save,
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
  };
  Object.assign(window, fns);
}
