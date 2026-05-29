// ═══════════════════════════════════════
// UI.JS — Shared DOM helpers & display
// ═══════════════════════════════════════
import { S, save, resetIntegrity, questionsByIds } from './store.js';
import { getCurrentUser, wipeFirestoreData } from '../firebase.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// ── KaTeX config ──
export const MATH_OPTS = {
  delimiters: [
    { left: '$$', right: '$$', display: true },
    { left: '$', right: '$', display: false },
  ],
  throwOnError: false,
};

export function reMath(root) {
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
  }, 120);
}

// ── Tiny helpers ──
export function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

export function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Feedback ──
export function flash(ok) {
  const el = document.createElement('div');
  el.className = 'flash ' + (ok ? 'ok' : 'bad');
  el.setAttribute('role', 'status');
  el.textContent = ok ? 'Correct!' : 'Incorrect';
  const area = document.getElementById('flashArea');
  if (area) {
    area.appendChild(el);
    setTimeout(() => el.remove(), 1900);
  }
}

export function starBurst() {
  for (let i = 0; i < 12; i++) {
    const s = document.createElement('div');
    s.className = 'star';
    const a = (i / 12) * 360, d = 60 + Math.random() * 60;
    s.style.cssText = `left:50%;top:40%;width:4px;height:4px;background:hsl(${a},100%,65%);--dx:${Math.cos(a*Math.PI/180)*d}px;--dy:${Math.sin(a*Math.PI/180)*d}px`;
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 800);
  }
}

export function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.setAttribute('role', 'status');
  t.textContent = msg;
  const area = document.getElementById('toastArea');
  if (area) {
    area.appendChild(t);
    setTimeout(() => t.remove(), 2700);
  }
}

export function dateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysBetween(a, b) {
  const da = new Date(`${a}T00:00:00`);
  const db = new Date(`${b}T00:00:00`);
  return Math.round((db - da) / DAY_MS);
}

export function applyTheme() {
  const themes = ['dark', 'light', 'amber'];
  const theme = themes.includes(S.theme) ? S.theme : 'dark';
  document.documentElement.dataset.theme = theme;
  const icons = { dark: '🌙', light: '☀️', amber: '🌅' };
  const labels = { dark: 'Dark', light: 'Light', amber: 'Amber' };
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = icons[theme];
  const label = document.getElementById('themeLabel');
  if (label) label.textContent = labels[theme];
  const profileLabel = document.getElementById('profileThemeLabel');
  if (profileLabel) profileLabel.textContent = labels[theme];
}

export function toggleTheme() {
  const order = ['dark', 'light', 'amber'];
  const idx = order.indexOf(S.theme);
  S.theme = idx === -1 ? 'light' : order[(idx + 1) % order.length];
  applyTheme();
  save();
  const msgs = { dark: 'Dark mode on.', light: 'Light mode on.', amber: 'Amber mode — warm tones activated.' };
  toast(msgs[S.theme]);
}



// ── Subject stat tracking ──
export function updateSubjStat(subject, isCorrect, skipSave = false) {
  if (!S.subjStats[subject]) S.subjStats[subject] = { ans: 0, cor: 0 };
  S.subjStats[subject].ans++;
  if (isCorrect) S.subjStats[subject].cor++;
  if (!skipSave) save();
}

export function updateChapterStat(q, isCorrect, skipSave = false) {
  if (!q?.chapter) return;
  const key = `${q.subject}::${q.chapter}`;
  if (!S.chapterStats[key]) S.chapterStats[key] = { subject: q.subject, chapter: q.chapter, ans: 0, cor: 0 };
  const beforeAcc = S.chapterStats[key].ans ? Math.round((S.chapterStats[key].cor / S.chapterStats[key].ans) * 100) : null;
  S.chapterStats[key].ans++;
  if (isCorrect) S.chapterStats[key].cor++;
  const afterAcc = Math.round((S.chapterStats[key].cor / S.chapterStats[key].ans) * 100);
  updateSpacedRepetition(q, isCorrect);
  if (S.chapterStats[key].ans >= 10 && afterAcc >= 80) unlockAchievement(`chapter_master_${q.subject}_${q.chapter}`, 'Chapter Master');
  if (beforeAcc !== null && beforeAcc < 50 && afterAcc >= 75 && S.chapterStats[key].ans >= 8) {
    unlockAchievement(`comeback_${q.subject}_${q.chapter}`, 'Comeback Kid');
  }
  if (!skipSave) save();
}

function updateSpacedRepetition(q, isCorrect) {
  if (!q?.chapter) return;
  const key = `${q.subject}::${q.chapter}`;
  if (!S.spacedRepetition) S.spacedRepetition = {};
  const current = S.spacedRepetition[key] || {
    subject: q.subject,
    chapter: q.chapter,
    interval: 0,
    ease: 2.2,
    due: dateKey(),
    seen: 0,
  };
  current.subject = q.subject;
  current.chapter = q.chapter;
  current.seen = (current.seen || 0) + 1;
  current.last = dateKey();
  if (isCorrect) {
    current.interval = current.interval <= 0 ? 1 : Math.min(30, Math.ceil(current.interval * (current.ease || 2.2)));
    current.ease = Math.min(2.8, (current.ease || 2.2) + 0.12);
  } else {
    current.interval = 0; // Immediate review needed
    current.ease = Math.max(1.4, (current.ease || 2.2) - 0.25);
  }
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + current.interval);
  current.due = dateKey(nextDate);
  S.spacedRepetition[key] = current;
}

export function rememberAnswer(q, isCorrect, skipSave = false) {
  if (!q?.id) return;
  const wrong = new Set(S.wrongQuestionIds || []);
  if (isCorrect) {
    if (S.autoRemoveWrong !== false) wrong.delete(q.id);
  } else {
    wrong.add(q.id);
  }
  S.wrongQuestionIds = [...wrong];
  if (!skipSave) save();
}

export function toggleAutoRemoveWrong() {
  S.autoRemoveWrong = !S.autoRemoveWrong;
  save();
  toast(S.autoRemoveWrong ? 'Auto-remove enabled.' : 'Auto-remove disabled.');
  updateProfilePage();
}

export function removeBookmark(id) {
  const set = new Set(S.bookmarks || []);
  set.delete(id);
  S.bookmarks = [...set];
  save();
  updateBookmarkButtons(id);
  updateStatsPage();
}

export function removeWrong(id) {
  const set = new Set(S.wrongQuestionIds || []);
  set.delete(id);
  S.wrongQuestionIds = [...set];
  save();
  updateStatsPage();
}

export function clearBookmarks() {
  if (!confirm('Remove all bookmarked questions?')) return;
  S.bookmarks = [];
  save();
  updateStatsPage();
  toast('Bookmarks cleared.');
}

export function clearWrongQueue() {
  if (!confirm('Clear your entire wrong-answer queue?')) return;
  S.wrongQuestionIds = [];
  save();
  updateStatsPage();
  toast('Wrong-answer queue cleared.');
}


export function toggleBookmark(id) {
  if (!id) return;
  const set = new Set(S.bookmarks || []);
  if (set.has(id)) {
    set.delete(id);
    toast('Removed from bookmarks.');
  } else {
    set.add(id);
    toast('Question bookmarked.');
  }
  S.bookmarks = [...set];
  save();
  updateBookmarkButtons(id);
  updateStatsPage();
}

export function updateBookmarkButtons(id) {
  const isOn = new Set(S.bookmarks || []).has(id);
  document.querySelectorAll(`[data-bookmark-id="${CSS.escape(id)}"]`).forEach(btn => {
    btn.classList.toggle('on', isOn);
    btn.setAttribute('aria-pressed', isOn ? 'true' : 'false');
    btn.title = isOn ? 'Remove bookmark' : 'Bookmark question';
  });
}

export function unlockAchievement(id, title) {
  if (!id || (S.achievements || []).includes(id)) return false;
  S.achievements = [...(S.achievements || []), id];
  save();
  toast(`Achievement unlocked: ${title}`);
  starBurst();
  return true;
}

export function checkSessionAchievements(session) {
  const acc = session.total ? Math.round((session.correct / session.total) * 100) : 0;
  if (session.total >= 20 && acc === 100) unlockAchievement('perfect_session', 'Perfect Session');
  if (session.mode === 'rapid' && acc >= 80) unlockAchievement('speed_demon', 'Speed Demon');
  if ((S.sessions || []).length >= 7) unlockAchievement('consistent_7', 'Consistent');
  if ((S.dailyStreak || 0) >= 7) unlockAchievement('daily_7', '7-Day Streak');
  if ((S.wrongQuestionIds || []).length === 0 && S.answered >= 25) unlockAchievement('clean_slate', 'Clean Slate');
  Object.values(S.chapterStats || {}).forEach(ch => {
    const chAcc = ch.ans ? Math.round((ch.cor / ch.ans) * 100) : 0;
    if (ch.ans >= 10 && chAcc >= 80) unlockAchievement(`chapter_master_${ch.subject}_${ch.chapter}`, 'Chapter Master');
  });
}

// ── Nav bar ──
export function updateNav() {
  setText('streakN', S.dailyStreak || 0);
  setText('dailyStreakN', S.dailyStreak || 0);
}

// ── Home page ──
export function updateHome() {
  const acc = S.answered ? Math.round((S.correct / S.answered) * 100) : 0;
  setText('heroStreak', S.dailyStreak || 0);
  setText('heroAnswered', S.answered);
  setText('heroAcc', acc + '%');
}

// ── Stats page ──
export function updateStatsPage() {
  setText('stAnswered', S.answered);
  setText('stCorrect', S.correct);
  setText('profileStatAnswered', S.answered);
  setText('profileStatCorrect', S.correct);
  const overallAcc = S.answered ? Math.round((S.correct / S.answered) * 100) : 0;
  setText('stAcc', overallAcc + '%');
  setText('stBest', S.bestStreak);
  setText('profileStatAcc', overallAcc + '%');
  setText('profileStatBest', S.bestStreak);
  setText('stDaily', S.dailyStreak || 0);

  // Performance extras
  setText('stSessions', (S.sessions || []).length);
  setText('profileStreak', S.dailyStreak || 0);

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

  // Strengths & weaknesses
  const subEntries = Object.entries(subAccMap);
  if (subEntries.length) {
    const sorted = subEntries.sort((a, b) => b[1] - a[1]);
    setText('stStrongest', sorted[0][0] + ' (' + sorted[0][1] + '%)');
    setText('stWeakest',   sorted[sorted.length - 1][0] + ' (' + sorted[sorted.length - 1][1] + '%)');
  } else {
    setText('stStrongest', 'Not enough data');
    setText('stWeakest',   'Not enough data');
  }

  renderProgressChart();
  renderWeakChapters();
  renderDueChapters();
  renderSavedQuestions();
  renderAchievements();
  renderRankPredictor();

  // Milestones
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

// ── History ──
export function addSession(s) {
  s.createdAt = s.createdAt || Date.now();
  updateDailyStreak();
  S.sessions.unshift(s);
  if (S.sessions.length > 30) S.sessions.pop();
  checkSessionAchievements(s);
  save(); renderHistory(); updateStatsPage();
}

function updateDailyStreak() {
  const today = dateKey();
  if (S.lastStudyDate === today) return;
  const gap = S.lastStudyDate ? daysBetween(S.lastStudyDate, today) : 0;
  S.dailyStreak = gap === 1 ? (S.dailyStreak || 0) + 1 : 1;
  S.lastStudyDate = today;
}

export function clearHistory() {
  if (!confirm('Clear all session history?')) return;
  S.sessions = []; save(); renderHistory(); toast('History cleared.');
}

export function switchStatsTab(tab) {
  document.querySelectorAll('.stats-tab').forEach(btn => btn.classList.toggle('on', btn.dataset.statsTab === tab));
  document.querySelectorAll('.stats-panel').forEach(panel => panel.classList.toggle('on', panel.dataset.statsPanel === tab));
}

function renderWeakChapters() {
  const box = document.getElementById('weakChapterRows');
  if (!box) return;
  const rows = Object.values(S.chapterStats || {})
    .filter(ch => ch.ans >= 2)
    .map(ch => ({ ...ch, acc: Math.round((ch.cor / ch.ans) * 100) }))
    .sort((a, b) => a.acc - b.acc || b.ans - a.ans)
    .slice(0, 5);
  if (!rows.length) {
    box.innerHTML = '<div class="empty-mini">Answer a few questions to find weak chapters.</div>';
    return;
  }
  box.innerHTML = rows.map(ch => `<div class="weak-row">
    <div><div class="weak-title">${escHtml(ch.chapter)}</div><div class="weak-meta">${escHtml(ch.subject)} · ${ch.cor}/${ch.ans} correct</div></div>
    <div class="weak-acc">${ch.acc}%</div>
    <button class="btn btn-ghost btn-sm" onclick="practiceChapter('${encodeURIComponent(ch.subject)}','${encodeURIComponent(ch.chapter)}')">Practice</button>
  </div>`).join('');
}

function renderDueChapters() {
  const box = document.getElementById('dueChapterRows');
  if (!box) return;
  const today = dateKey();
  const due = Object.values(S.spacedRepetition || {})
    .filter(item => !item.due || item.due <= today)
    .sort((a, b) => String(a.due || '').localeCompare(String(b.due || '')))
    .slice(0, 5);
  if (!due.length) {
    box.innerHTML = '<div class="empty-mini">No chapters due today.</div>';
    return;
  }
  box.innerHTML = due.map(srsChapterRow).join('');
}

function renderSavedQuestions() {
  const savedBox = document.getElementById('bookmarkRows');
  const wrongBox = document.getElementById('wrongRows');
  const srsBox   = document.getElementById('srsRows');
  const srsCount = document.getElementById('srsCount');

  const saved = questionsByIds(S.bookmarks || []);
  const wrong = questionsByIds(S.wrongQuestionIds || []);
  
  const today = dateKey();
  const srsItems = Object.values(S.spacedRepetition || {}).sort((a,b) => a.due.localeCompare(b.due));
  const dueItems = srsItems.filter(item => item.due <= today);

  setText('bookmarkCount', saved.length);
  setText('wrongPracticeCount', wrong.length);
  if (srsCount) srsCount.textContent = dueItems.length;

  if (savedBox) savedBox.innerHTML = saved.length ? saved.slice(0, 20).map(q => savedQuestionRow(q, 'bookmark')).join('') : '<div class="empty-mini">No bookmarked questions yet.</div>';
  if (wrongBox) wrongBox.innerHTML = wrong.length ? wrong.slice(0, 20).map(q => savedQuestionRow(q, 'wrong')).join('') : '<div class="empty-mini">No wrong-answer queue yet. Nice work.</div>';
  if (srsBox)   srsBox.innerHTML   = srsItems.length ? srsItems.slice(0, 20).map(srsChapterRow).join('') : '<div class="empty-mini">Start practicing chapters to see review tasks here!</div>';

  // Also update the "Due for Review" list in Analytics tab
  const analyticsSRS = document.getElementById('dueChapterRows');
  if (analyticsSRS) {
    analyticsSRS.innerHTML = dueItems.length 
      ? dueItems.slice(0, 5).map(srsChapterRow).join('') 
      : '<div class="empty-mini">No reviews due today. Keep it up!</div>';
  }
}

function srsChapterRow(item) {
  const diff = daysBetween(dateKey(), item.due);
  const isDue = diff <= 0;
  const status = isDue ? '<span style="color:var(--rose);font-weight:700">DUE NOW</span>' : `<span style="color:var(--txt3)">in ${diff}d</span>`;
  const btnClass = isDue ? 'btn-primary' : 'btn-ghost';
  
  return `<div class="saved-q-row">
    <div>
      <div class="saved-q-text">${escHtml(item.chapter)}</div>
      <div class="weak-meta">${escHtml(item.subject)} · Seen ${item.seen}x · ${status}</div>
    </div>
    <button class="btn ${btnClass} btn-sm" onclick="practiceChapter('${encodeURIComponent(item.subject)}','${encodeURIComponent(item.chapter)}')">Review</button>
  </div>`;
}

function savedQuestionRow(q, type) {
  const removeFn = type === 'bookmark' ? `removeBookmark('${q.id}')` : `removeWrong('${q.id}')`;
  return `<div class="saved-q-row">
    <div><div class="saved-q-text">${escHtml(q.questionText)}</div><div class="weak-meta">${escHtml(q.subject)} · ${escHtml(q.chapter)}</div></div>
    <div style="display:flex;gap:.4rem">
      <button class="btn btn-ghost btn-sm" onclick="startQuestionSet('${q.id}')">Retry</button>
      <button class="btn btn-ghost btn-sm" onclick="${removeFn}" title="Remove">✕</button>
    </div>
  </div>`;
}

const achievementDefs = [
  ['perfect_session', 'Perfect Session', '100% accuracy in a 20+ question test'],
  ['speed_demon', 'Speed Demon', 'Rapid Fire with 80%+ accuracy'],
  ['consistent_7', 'Consistent', 'Complete 7 sessions'],
  ['daily_7', '7-Day Streak', 'Study on 7 calendar days in a row'],
  ['clean_slate', 'Clean Slate', 'Clear your wrong-answer queue after 25+ attempts'],
  ['bookmark_builder', 'Review Stack', 'Save 10 questions for later'],
  ['ms10', 'First Ten', 'Answer 10 questions'],
  ['ms100', 'Century', 'Answer 100 questions'],
  ['msAcc90', 'Sharp Shooter', '90%+ overall accuracy after 10 questions'],
];

function renderAchievements() {
  const box = document.getElementById('achievementRows');
  if (!box) return;
  const earned = new Set(S.achievements || []);
  if (S.answered >= 10) earned.add('ms10');
  if (S.answered >= 100) earned.add('ms100');
  if ((S.bookmarks || []).length >= 10) earned.add('bookmark_builder');
  if (S.answered >= 10 && Math.round((S.correct / S.answered) * 100) >= 90) earned.add('msAcc90');
  box.innerHTML = achievementDefs.map(([id, title, desc]) => `<div class="achievement-card ${earned.has(id) ? 'earned' : ''}">
    <div class="ach-icon">${earned.has(id) ? '★' : '☆'}</div>
    <div><div class="ach-title">${title}</div><div class="ach-desc">${desc}</div></div>
  </div>`).join('');
}

function renderProgressChart() {
  const canvas = document.getElementById('accuracyChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const sessions = (S.sessions || []).slice(0, 20).reverse();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--line2');
  ctx.lineWidth = 1;
  for (let i = 1; i <= 3; i++) {
    const y = (canvas.height / 4) * i;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }
  if (sessions.length < 2) {
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--txt3');
    ctx.font = '13px sans-serif';
    ctx.fillText('Complete two sessions to see your trend.', 20, 70);
    return;
  }
  const points = sessions.map((s, i) => ({
    x: 18 + i * ((canvas.width - 36) / Math.max(sessions.length - 1, 1)),
    y: canvas.height - 18 - ((s.total ? Math.round((s.correct / s.total) * 100) : s.score || 0) / 100) * (canvas.height - 36),
  }));
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent');
  ctx.lineWidth = 3;
  ctx.beginPath();
  points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
  ctx.stroke();
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--gold');
  points.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill(); });
}

function renderRankPredictor() {
  const acc = S.answered ? Math.round((S.correct / S.answered) * 100) : 0;
  const attempted = Math.max(1, Math.min(75, S.answered || 25));
  const mainScore = Math.round((acc / 100) * attempted * 4);
  const advScore = Math.round((acc / 100) * attempted * 4.8);
  const mainInput = document.getElementById('rankMainInput');
  const advInput = document.getElementById('rankAdvInput');
  if (mainInput?.value || advInput?.value) {
    updateRankFromMarks();
    return;
  }
  setText('rankMainScore', `${Math.min(300, mainScore)} / 300`);
  setText('rankAdvScore', `${Math.min(360, advScore)} / 360`);
  setText('rankMainRank', estimateMainRank(mainScore));
  setText('rankAdvRank', estimateAdvRank(advScore));
}

export function updateRankFromMarks() {
  const mainInput = document.getElementById('rankMainInput');
  const advInput = document.getElementById('rankAdvInput');
  const mainRaw = mainInput?.value === '' ? null : Number(mainInput?.value);
  const advRaw = advInput?.value === '' ? null : Number(advInput?.value);

  if (mainRaw !== null && Number.isFinite(mainRaw)) {
    const mainScore = Math.max(0, Math.min(300, Math.round(mainRaw)));
    setText('rankMainScore', `${mainScore} / 300`);
    setText('rankMainRank', estimateMainRank(mainScore));
  } else {
    const acc = S.answered ? Math.round((S.correct / S.answered) * 100) : 0;
    const attempted = Math.max(1, Math.min(75, S.answered || 25));
    const score = Math.round((acc / 100) * attempted * 4);
    setText('rankMainScore', `${Math.min(300, score)} / 300`);
    setText('rankMainRank', estimateMainRank(score));
  }

  if (advRaw !== null && Number.isFinite(advRaw)) {
    const advScore = Math.max(0, Math.min(360, Math.round(advRaw)));
    setText('rankAdvScore', `${advScore} / 360`);
    setText('rankAdvRank', estimateAdvRank(advScore));
  } else {
    const acc = S.answered ? Math.round((S.correct / S.answered) * 100) : 0;
    const attempted = Math.max(1, Math.min(75, S.answered || 25));
    const score = Math.round((acc / 100) * attempted * 4.8);
    setText('rankAdvScore', `${Math.min(360, score)} / 360`);
    setText('rankAdvRank', estimateAdvRank(score));
  }
}

function estimateMainRank(score) {
  if (score >= 290) return 'Top 150';
  if (score >= 280) return '150 - 400';
  if (score >= 270) return '400 - 900';
  if (score >= 260) return '900 - 1,500';
  if (score >= 240) return '1,500 - 7,500';
  if (score >= 200) return '7,500 - 15,000';
  if (score >= 180) return '15,000 - 30,000';
  if (score >= 160) return '30,000 - 60,000';
  if (score >= 140) return '60,000 - 1,05,000';
  if (score >= 100) return '1.5L - 2.25L';
  return '2.25L+';
}

function estimateAdvRank(score) {
  if (score >= 278) return '1 - 101';
  if (score >= 262) return '101 - 500';
  if (score >= 234) return '201 - 1,000';
  if (score >= 208) return '501 - 1,500';
  if (score >= 181) return '1,501 - 2,000';
  if (score >= 165) return '2,501 - 3,000';
  if (score >= 149) return '4,001 - 5,000';
  if (score >= 120) return '6,801 - 9,901';
  if (score >= 100) return '15,001 - 17,001';
  if (score >= 74) return 'Rank-list range';
  return 'Below CRL cutoff trend';
}

export function handleAvatarError(img) {
  if (!img) return;
  img.onerror = null;
  const name = img.getAttribute('data-name') || 'V';
  img.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=5b6fff&color=fff&size=128`;
}

export function updateSyncReminders() {
  const user = getCurrentUser();
  const ids = ['syncReminder', 'statsSyncReminder', 'profileSyncReminder'];
  const msg = user
    ? 'Progress is syncing to the cloud.'
    : 'Local practice is active. Sign in only when you want cloud sync and leaderboard ranking.';

  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.className = user ? 'sync-banner-inline authed' : 'sync-banner-inline';
      if (id === 'syncReminder') el.className = user ? 'sync-banner authed' : 'sync-banner';
      el.innerHTML = msg;
    }
  });
}

// ── Profile Menu ──
export function toggleProfileMenu(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById('profileMenu');
  if (menu) {
    menu.classList.toggle('open');
    if (menu.classList.contains('open')) {
      document.addEventListener('click', closeProfileMenu, { once: true });
    }
  }
}

export function closeProfileMenu() {
  const menu = document.getElementById('profileMenu');
  if (menu) menu.classList.remove('open');
}

// ── Shared UI logic ──
export function avatarUrl(user) {
  if (!user) return 'https://ui-avatars.com/api/?name=V&background=5b6fff&color=fff&size=128';
  return (
    user.photoURL ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'V')}&background=5b6fff&color=fff&size=128`
  );
}

export async function resetAllProgress() {
  if (!confirm('⚠️ This will reset ALL your stats, streaks, and session history. This cannot be undone.\n\nAre you sure?')) return;
  
  const user = getCurrentUser();
  if (user) {
    const ok = await wipeFirestoreData();
    if (!ok) {
      toast('⚠️ Could not wipe cloud data. Check your connection.');
      // We continue with local reset anyway, but warn the user.
    }
  }

  S.streak = 0; S.dailyStreak = 0; S.lastStudyDate = ''; S.bestStreak = 0;
  S.answered = 0; S.correct = 0; S.totalSolved = 0;
  S.leaderboardName = '';
  S.sessions = []; S.subjStats = {};
  S.chapterStats = {}; S.bookmarks = []; S.wrongQuestionIds = []; S.achievements = []; S.spacedRepetition = {};
  resetIntegrity();
  save(); updateNav(); updateHome(); updateStatsPage(); renderHistory();
  updateSyncReminders();
  toast('All progress has been reset.');
}

export function buildHistRow(s) {
  const b    = s.mode === 'rapid' ? 'hm-rapid' : s.mode === 'mock' ? 'hm-mock' : s.mode === 'custom' ? 'hm-custom' : 'hm-practice';
  const ml   = s.mode === 'rapid' ? 'Rapid' : s.mode === 'mock' ? 'Mock' : s.mode === 'custom' ? 'Custom' : 'Practice';
  const st   = s.mode === 'rapid' ? escHtml(s.score + ' pts') : s.mode === 'mock' ? escHtml((s.mockScore || 0) + ' marks') : escHtml(s.score + '%');
  const det  = s.mode === 'rapid'
    ? `${escHtml(s.correct)}/${escHtml(s.total)} correct - streak ${escHtml(s.streak || 0)}`
    : s.mode === 'mock'
      ? `${escHtml(s.correct)}/${escHtml(s.total)} correct - ${escHtml(s.wrong)} wrong - ${escHtml(s.skipped)} skipped`
      : `${escHtml(s.correct)}/${escHtml(s.total)} correct - ${escHtml(s.wrong)} wrong`;
  return `<div class="hist-row">
    <span class="h-mode-tag ${b}">${ml}</span>
    <div><div class="h-detail">${det}</div></div>
    <div class="h-score">${st}</div>
    <div class="h-date">${escHtml(s.date)}</div>
  </div>`;
}

export function renderHistory() {
  const rows = document.getElementById('histRows');
  if (!rows) return;
  if (!S.sessions.length) {
    rows.innerHTML = '<div style="padding:2.5rem;text-align:center;color:var(--txt3);font-size:.85rem;font-style:italic">No sessions yet — pick a mode and start practicing!</div>';
    return;
  }
  rows.innerHTML = S.sessions.slice(0, 15).map(s => {
    const b    = s.mode === 'rapid' ? 'hm-rapid' : s.mode === 'mock' ? 'hm-mock' : s.mode === 'custom' ? 'hm-custom' : 'hm-practice';
    const ml   = s.mode === 'rapid' ? 'Rapid' : s.mode === 'mock' ? 'Mock' : s.mode === 'custom' ? 'Custom' : 'Practice';
    const st   = s.mode === 'rapid' ? escHtml(s.score + ' pts') : s.mode === 'mock' ? escHtml((s.mockScore || 0) + ' marks') : escHtml(s.score + '%');
    const det  = s.mode === 'rapid'
      ? `${escHtml(s.correct)}/${escHtml(s.total)} correct - streak ${escHtml(s.streak || 0)}`
      : s.mode === 'mock'
        ? `${escHtml(s.correct)}/${escHtml(s.total)} correct - ${escHtml(s.wrong)} wrong - ${escHtml(s.skipped)} skipped`
        : `${escHtml(s.correct)}/${escHtml(s.total)} correct - ${escHtml(s.wrong)} wrong`;
    return `<div class="hist-row">
      <span class="h-mode-tag ${b}">${ml}</span>
      <div><div class="h-detail">${det}</div></div>
      <div class="h-score">${st}</div>
    </div>`;
  }).join('');
}
