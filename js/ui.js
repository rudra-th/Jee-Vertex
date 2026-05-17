// ═══════════════════════════════════════
// UI.JS — Shared DOM helpers & display
// ═══════════════════════════════════════
import { S, save } from './store.js';

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
  }, 80);
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
  el.textContent = ok ? '✓ Correct! +10 XP' : '✗ Wrong';
  document.getElementById('flashArea').appendChild(el);
  setTimeout(() => el.remove(), 1900);
}

export function starBurst() {
  for (let i = 0; i < 18; i++) {
    const s = document.createElement('div');
    s.className = 'star';
    const a = (i / 18) * 360, d = 80 + Math.random() * 80;
    s.style.cssText = `width:${4+Math.random()*5}px;height:${4+Math.random()*5}px;left:50%;top:40%;background:hsl(${a},100%,65%);--dx:${Math.cos(a*Math.PI/180)*d}px;--dy:${Math.sin(a*Math.PI/180)*d}px`;
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 900);
  }
}

export function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.setAttribute('role', 'status');
  t.textContent = msg;
  document.getElementById('toastArea').appendChild(t);
  setTimeout(() => t.remove(), 2700);
}

// ── Level-up modal ──
export function closeLvl() {
  document.getElementById('lvlModal').style.display = 'none';
}

// ── XP / Level ──
export function gainXP(n) {
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

// ── Subject stat tracking ──
export function updateSubjStat(subject, isCorrect) {
  if (!S.subjStats[subject]) S.subjStats[subject] = { ans:0, cor:0 };
  S.subjStats[subject].ans++;
  if (isCorrect) S.subjStats[subject].cor++;
  save();
}

// ── Nav bar ──
export function updateNav() {
  document.getElementById('streakN').textContent = S.streak;
  document.getElementById('levelN').textContent  = S.level;
  const xpPct = S.xp % 100;
  const arc   = document.getElementById('xpArc');
  if (arc) arc.style.strokeDashoffset = 69.1 * (1 - xpPct / 100);
}

// ── Home page ──
export function updateHome() {
  document.getElementById('sbAnswered').textContent = S.answered;
  document.getElementById('sbCorrect').textContent  = S.correct;
  const acc = S.answered ? Math.round((S.correct / S.answered) * 100) : 0;
  document.getElementById('sbAcc').textContent  = acc + '%';
  document.getElementById('sbBest').textContent = S.bestStreak;
  const xpPct = S.xp % 100;
  document.getElementById('xpPct').textContent = xpPct + ' / 100 XP';
  document.getElementById('xpBar').style.width  = xpPct + '%';
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

  // Performance extras
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
  S.sessions.unshift(s);
  if (S.sessions.length > 30) S.sessions.pop();
  save(); renderHistory(); updateStatsPage();
}

export function clearHistory() {
  if (!confirm('Clear all session history?')) return;
  S.sessions = []; save(); renderHistory(); toast('History cleared.');
}

export function buildHistRow(s) {
  const b    = s.mode === 'rapid' ? 'hm-rapid' : s.mode === 'custom' ? 'hm-custom' : 'hm-practice';
  const ml   = s.mode === 'rapid' ? '⚡ Rapid'  : s.mode === 'custom' ? '🎯 Custom' : '📚 Practice';
  const st   = s.mode === 'rapid' ? escHtml(s.score + ' pts') : escHtml(s.score + '%');
  const det  = s.mode === 'rapid'
    ? `${escHtml(s.correct)}/${escHtml(s.total)} correct · streak ${escHtml(s.streak || 0)}`
    : `${escHtml(s.correct)}/${escHtml(s.total)} correct · ${escHtml(s.wrong)} wrong`;
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
  rows.innerHTML = S.sessions.slice(0, 15).map(buildHistRow).join('');
}
