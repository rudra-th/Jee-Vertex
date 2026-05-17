// ═══════════════════════════════════════
// QUIZ.JS — Practice + Custom quiz logic
// ═══════════════════════════════════════
import { S, save, filterQ, allQ } from './store.js';
import {
  toast, flash, reMath, escHtml,
  updateNav, updateHome, updateStatsPage,
  gainXP, updateSubjStat, addSession,
} from './ui.js';
import { navTo } from './router.js';

// ── Quiz state ──
export let Q = {
  qs:[], cur:0, ans:[], mode:'practice', timerMode:'none',
  totalTimer:null, totalLeft:0, totalSecs:0,
  pqTimer:null, pqLeft:0, pqSecs:150,
};

// ── Setup state ──
export const pracSetup = { subject:'Physics', chapters:new Set(), diff:'Foundation' };
export const custSetup = {
  count:20, subjects:new Set(['Physics','Chemistry','Mathematics']),
  diff:'All', timerMode:'perq', perQSecs:150, totalMins:60,
};

// ═══ CHAPTER HELPERS ═══
function scCls(sub) { return sub === 'Physics' ? 'sp' : sub === 'Chemistry' ? 'sc' : 'sm'; }
function diffCls(d) { return d==='Foundation'?'df':d==='JEE Main'?'dm':d==='JEE Advanced'?'da':'dall'; }

export function updateChCount() {
  const el = document.getElementById('chCount');
  if (el) el.textContent = pracSetup.chapters.size + ' selected';
}

export function populateChapters() {
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
    chip.innerHTML = `<div class="ch-dot"></div>${escHtml(ch)}`;
    chip.onclick = () => togChip(chip, ch);
    grid.appendChild(chip);
  });
  updateChCount();
}

export function togChip(chip, ch) {
  const cls = chip.dataset.cls;
  if (pracSetup.chapters.has(ch)) { pracSetup.chapters.delete(ch); chip.classList.remove(cls); }
  else { pracSetup.chapters.add(ch); chip.classList.add(cls); }
  updateChCount();
}

export function selAllCh() {
  document.querySelectorAll('#pracChGrid .ch-chip').forEach(c => { c.classList.add(c.dataset.cls); pracSetup.chapters.add(c.dataset.chapter); });
  updateChCount();
}

export function clrAllCh() {
  document.querySelectorAll('#pracChGrid .ch-chip').forEach(c => c.classList.remove(c.dataset.cls));
  pracSetup.chapters.clear(); updateChCount();
}

export function switchPracSub(btn) {
  document.querySelectorAll('#pracSubTabs .sub-tab').forEach(b => b.className = 'sub-tab');
  const sub = btn.dataset.subject;
  btn.classList.add(sub==='Physics'?'ap':sub==='Chemistry'?'ac':'am');
  pracSetup.subject = sub; populateChapters();
}

// ═══ CUSTOM CONTROLS ═══
export function selDiff(rowId, btn, cb) {
  document.querySelectorAll('#'+rowId+' .diff-btn').forEach(b => b.className = 'diff-btn');
  btn.classList.add(diffCls(btn.dataset.diff));
  cb(btn.dataset.diff);
  if (rowId === 'custDiffRow') updateCustomPreview();
}

export function togSub(btn) {
  const sub = btn.dataset.sub, cls = sub==='Physics'?'sp':sub==='Chemistry'?'sc':'sm';
  if (custSetup.subjects.has(sub)) { custSetup.subjects.delete(sub); btn.className = 'subj-btn'; }
  else { custSetup.subjects.add(sub); btn.classList.add(cls); }
  updateCustomPreview();
}

export function allSubs() {
  ['Physics','Chemistry','Mathematics'].forEach(sub => {
    custSetup.subjects.add(sub);
    const cls = sub==='Physics'?'sp':sub==='Chemistry'?'sc':'sm';
    const btn = document.querySelector(`.subj-btn[data-sub="${sub}"]`);
    if (btn) { btn.className = 'subj-btn'; btn.classList.add(cls); }
  });
  updateCustomPreview();
}

export function noneSubs() {
  custSetup.subjects.clear();
  document.querySelectorAll('.subj-btn').forEach(b => b.className = 'subj-btn');
  updateCustomPreview();
}

export function adjQ(d) {
  custSetup.count = Math.max(5, Math.min(60, custSetup.count + d));
  document.getElementById('custQCount').textContent = custSetup.count;
  updateCustomPreview();
}

export function setQN(n, btn) {
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

export function updateCustomPreview() {
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

export function selTMode(btn) {
  document.querySelectorAll('#tmRow .tm-opt').forEach(b => b.classList.remove('on'));
  btn.classList.add('on'); custSetup.timerMode = btn.dataset.tmode;
  document.getElementById('perQArea').style.display  = custSetup.timerMode === 'perq'  ? 'block' : 'none';
  document.getElementById('totalArea').style.display = custSetup.timerMode === 'total' ? 'block' : 'none';
}

export function selPQP(btn) {
  document.querySelectorAll('#perQArea .tpc').forEach(b => b.classList.remove('on'));
  btn.classList.add('on'); custSetup.perQSecs = +btn.dataset.tpq;
  document.getElementById('perQInput').value = custSetup.perQSecs;
}

export function onPQI(inp) {
  const v = +inp.value;
  if (!isNaN(v) && v >= 10) {
    custSetup.perQSecs = v;
    document.querySelectorAll('#perQArea .tpc').forEach((b) => b.classList.remove('on'));
    updateCustomPreview();
  }
}

export function selTP(btn) {
  document.querySelectorAll('#totalArea .tpc').forEach(b => b.classList.remove('on'));
  btn.classList.add('on'); custSetup.totalMins = +btn.dataset.ttot;
  document.getElementById('totalInput').value = custSetup.totalMins;
}

export function onTI(inp) {
  const v = +inp.value;
  if (!isNaN(v) && v >= 5) {
    custSetup.totalMins = v;
    document.querySelectorAll('#totalArea .tpc').forEach((b) => b.classList.remove('on'));
    updateCustomPreview();
  }
}

// ═══ TIMERS ═══
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

// ═══ PRACTICE ═══
export function startPractice() {
  if (!pracSetup.chapters.size) { toast('Select at least one chapter!'); return; }
  const qs = filterQ({ subjects: new Set([pracSetup.subject]), chapters: pracSetup.chapters, diff: pracSetup.diff === 'All' ? null : pracSetup.diff });
  if (!qs.length) { toast('No questions match — try different settings.'); return; }
  Q = { qs, cur:0, ans:new Array(qs.length).fill(null), mode:'practice', timerMode:'none', totalTimer:null, totalLeft:0, totalSecs:0, pqTimer:null, pqLeft:0, pqSecs:0 };
  document.getElementById('modeBadge').textContent = '📚 Practice';
  document.getElementById('pqTimerWrap').style.display = 'none';
  document.getElementById('totalTimerWrap').style.display = 'none';
  navTo('quiz'); renderQ();
}

// ═══ CUSTOM TEST ═══
export function startCustom() {
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

// ═══ QUIZ RENDER ═══
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
      + `<span class="opt-key">${ls[i]}</span><span class="opt-body">${escHtml(opt)}</span></button>`;
  }).join('');
  const expl = reveal ? `<div class="expl"><div class="expl-tag">💡 Explanation</div><div class="expl-body">${escHtml(q.explanation)}</div></div>` : '';
  return `<div class="q-card"><div class="q-tags"><span class="q-tag qt-${sc}">${escHtml(q.subject)}</span><span class="q-tag qt-${dc}">${escHtml(q.difficulty)}</span></div><div class="q-text">${escHtml(q.questionText)}</div></div><div class="opts">${opts}</div>${expl}`;
}

export function pickOpt(btn, idx) {
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

export function nextQ() { stopPQTimer(); if (Q.cur < Q.qs.length-1) { Q.cur++; renderQ(); window.scrollTo({top:0,behavior:'smooth'}); } else endQuiz(); }
export function skipQ()  { stopPQTimer(); Q.ans[Q.cur] = null; if (Q.cur < Q.qs.length-1) { Q.cur++; renderQ(); window.scrollTo({top:0,behavior:'smooth'}); } else endQuiz(); }

export function endQuiz() {
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

export function reviewAnswers() {
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
      <div class="rev-q">Q${i+1}: ${escHtml(q.questionText)}</div>
      ${(!skip && !ok) ? `<div class="rev-ans" style="color:var(--rose)">Your answer: ${escHtml(a)}</div>` : ''}
      <div class="rev-ans" style="color:var(--emerald)">Correct: ${escHtml(q.correctAnswer)}</div>
      <div class="expl" style="margin-top:.6rem"><div class="expl-tag">💡 Explanation</div><div class="expl-body">${escHtml(q.explanation)}</div></div>
    `;
    container.appendChild(d);
  });
  reMath(document.getElementById('reviewItems'));
  panel.scrollIntoView({ behavior: 'smooth' });
}
