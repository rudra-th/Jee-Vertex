// ═══════════════════════════════════════
// QUIZ.JS — Practice + Custom quiz logic
// ═══════════════════════════════════════
import { S, save, filterQ, allQ, questionsByIds, shuffle } from './store.js';
import {
  toast, flash, reMath, escHtml,
  updateNav, updateHome, updateStatsPage,
  gainXP, updateSubjStat, addSession,
  updateChapterStat, rememberAnswer,
} from './ui.js';
import { navTo } from './router.js';

// ── Quiz state ──
export let Q = {
  qs:[], cur:0, ans:[], mode:'practice', timerMode:'none',
  totalTimer:null, totalLeft:0, totalSecs:0,
  pqTimer:null, pqLeft:0, pqSecs:150,
  sections:[], sectionIndex:0, sectionTimer:null, sectionLeft:0, sectionSecs:0,
  mockScore:0, positive:4, negative:1,
};

// ── Setup state ──
export const pracSetup = { subject:'Physics', chapters:new Set(), diff:'Foundation' };
export const custSetup = {
  count:20, subjects:new Set(['Physics','Chemistry','Mathematics']),
  diff:'All', timerMode:'perq', perQSecs:150, totalMins:60,
};
export const mockSetup = { exam:'main' };

// ── DOM Cache ──
const DOM = {
  rtTxt: null, rtFg: null,
  pqFill: null, pqTxt: null,
  sectionWrap: null, sectionTxt: null, sectionFill: null,
  qCur: null, qTot: null,
  qProgFill: null, qProgL: null, qProgR: null,
  area: null, btnNext: null, btnSkip: null
};

function initDom() {
  DOM.rtTxt = document.getElementById('rtTxt');
  DOM.rtFg  = document.getElementById('rtFg');
  DOM.pqFill = document.getElementById('pqFill');
  DOM.pqTxt  = document.getElementById('pqTxt');
  DOM.sectionWrap = document.getElementById('sectionTimerWrap');
  DOM.sectionTxt = document.getElementById('sectionTxt');
  DOM.sectionFill = document.getElementById('sectionFill');
  DOM.qCur  = document.getElementById('qCur');
  DOM.qTot  = document.getElementById('qTot');
  DOM.qProgFill = document.getElementById('qProgFill');
  DOM.qProgL = document.getElementById('qProgL');
  DOM.qProgR = document.getElementById('qProgR');
  DOM.area = document.getElementById('quizQArea');
  DOM.btnNext = document.getElementById('btnNext');
  DOM.btnSkip = document.getElementById('btnSkip');
}

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
    const chip = document.createElement('button');
    chip.type = 'button';
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
    if (Q.totalLeft <= 0) { clearInterval(Q.totalTimer); toast("Time's up!"); endQuiz(); }
  }, 1000);
}

function updRing() {
  const left = Q.totalLeft, total = Q.totalSecs;
  const m = Math.floor(left/60), s = left%60;
  if (DOM.rtTxt) DOM.rtTxt.textContent = m + ':' + String(s).padStart(2,'0');
  if (!DOM.rtFg) return;
  DOM.rtFg.style.strokeDashoffset = 125.7 * (1 - left / Math.max(total, 1));
  const r = left / Math.max(total, 1);
  DOM.rtFg.style.stroke = r > .4 ? 'var(--sky)' : r > .2 ? 'var(--gold)' : 'var(--rose)';
}

function startPQTimer() {
  clearInterval(Q.pqTimer); Q.pqLeft = Q.pqSecs; updPQ();
  Q.pqTimer = setInterval(() => {
    Q.pqLeft--; updPQ();
    if (Q.pqLeft <= 0) { clearInterval(Q.pqTimer); toast("Time's up!"); skipQ(); }
  }, 1000);
}

function stopPQTimer() { clearInterval(Q.pqTimer); Q.pqTimer = null; }
function stopSectionTimer() { clearInterval(Q.sectionTimer); Q.sectionTimer = null; }

function updPQ() {
  const left = Q.pqLeft, total = Q.pqSecs, pct = (left / Math.max(total,1)) * 100;
  if (!DOM.pqFill || !DOM.pqTxt) return;
  DOM.pqFill.style.width = pct + '%';
  DOM.pqFill.style.background = pct > 50 ? 'var(--sky)' : pct > 25 ? 'var(--gold)' : 'var(--rose)';
  DOM.pqTxt.style.color = pct <= 25 ? 'var(--rose)' : 'var(--txt2)';
  const m = Math.floor(left/60), s = left%60;
  DOM.pqTxt.textContent = m > 0 ? `${m}:${String(s).padStart(2,'0')}` : s + 's';
}

function startSectionTimer() {
  stopSectionTimer();
  Q.sectionLeft = Q.sectionSecs;
  updateSectionHUD();
  Q.sectionTimer = setInterval(() => {
    Q.sectionLeft--;
    updateSectionHUD();
    if (Q.sectionLeft <= 0) advanceSection();
  }, 1000);
}

function updateSectionHUD() {
  if (!DOM.sectionTxt || !DOM.sectionFill) return;
  const sec = Q.sections[Q.sectionIndex];
  const m = Math.floor(Q.sectionLeft / 60);
  const s = Q.sectionLeft % 60;
  const pct = (Q.sectionLeft / Math.max(Q.sectionSecs, 1)) * 100;
  DOM.sectionTxt.textContent = `${sec?.subject || 'Section'} ${m}:${String(s).padStart(2, '0')}`;
  DOM.sectionFill.style.width = `${pct}%`;
  DOM.sectionFill.style.background = pct > 45 ? 'var(--sky)' : pct > 20 ? 'var(--gold)' : 'var(--rose)';
}

function advanceSection() {
  stopSectionTimer();
  const next = Q.sectionIndex + 1;
  if (!Q.sections[next]) {
    toast('Mock time is up.');
    endQuiz();
    return;
  }
  Q.sectionIndex = next;
  Q.cur = Q.sections[next].start;
  toast(`Next section: ${Q.sections[next].subject}`);
  startSectionTimer();
  renderQ();
}

// ═══ PRACTICE ═══
export function startPractice() {
  if (!pracSetup.chapters.size) { toast('Select at least one chapter!'); return; }
  const qs = filterQ({ subjects: new Set([pracSetup.subject]), chapters: pracSetup.chapters, diff: pracSetup.diff === 'All' ? null : pracSetup.diff });
  if (!qs.length) { toast('No questions match — try different settings.'); return; }
  initDom();
  Q = { qs, cur:0, ans:new Array(qs.length).fill(null), mode:'practice', timerMode:'none', totalTimer:null, totalLeft:0, totalSecs:0, pqTimer:null, pqLeft:0, pqSecs:0 };
  document.getElementById('modeBadge').textContent = '📚 Practice';
  document.getElementById('pqTimerWrap').style.display = 'none';
  document.getElementById('totalTimerWrap').style.display = 'none';
  document.getElementById('sectionTimerWrap').style.display = 'none';
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
  initDom();
  Q = { qs, cur:0, ans:new Array(qs.length).fill(null), mode:'custom', timerMode:custSetup.timerMode,
        totalTimer:null, totalLeft:custSetup.totalMins*60, totalSecs:custSetup.totalMins*60,
        pqTimer:null, pqLeft:custSetup.perQSecs, pqSecs:custSetup.perQSecs };
  document.getElementById('modeBadge').textContent = '🎯 Custom';
  document.getElementById('pqTimerWrap').style.display  = custSetup.timerMode === 'perq'  ? 'flex'  : 'none';
  document.getElementById('totalTimerWrap').style.display = custSetup.timerMode === 'total' ? 'block' : 'none';
  document.getElementById('sectionTimerWrap').style.display = 'none';
  if (Q.timerMode === 'total') startTotalTimer();
  navTo('quiz');
  renderQ();
}

// ═══ QUIZ RENDER ═══
export function setMockExam(exam, btn) {
  mockSetup.exam = exam === 'advanced' ? 'advanced' : 'main';
  document.querySelectorAll('#mockExamRow .diff-btn').forEach(b => b.classList.remove('dm', 'da'));
  if (btn) btn.classList.add(mockSetup.exam === 'advanced' ? 'da' : 'dm');
  updateMockPreview();
}

export function updateMockPreview() {
  const el = document.getElementById('mockPreview');
  if (!el) return;
  const diff = mockSetup.exam === 'advanced' ? 'JEE Advanced' : 'JEE Main';
  const perSubject = mockSetup.exam === 'advanced' ? 18 : 25;
  const counts = ['Physics','Chemistry','Mathematics'].map(subject =>
    Math.min(perSubject, filterQ({ subjects: new Set([subject]), diff }).length),
  );
  el.textContent = `${counts.reduce((a, b) => a + b, 0)} questions ready - 60 min per section - +4/-1 marking`;
  el.className = counts.every(n => n >= Math.min(10, perSubject)) ? 'cust-hint ok' : 'cust-hint warn';
}

export function startMock() {
  const diff = mockSetup.exam === 'advanced' ? 'JEE Advanced' : 'JEE Main';
  const perSubject = mockSetup.exam === 'advanced' ? 18 : 25;
  const sectionSecs = 60 * 60;
  const sections = [];
  const qs = [];
  ['Physics','Chemistry','Mathematics'].forEach(subject => {
    const pool = filterQ({ subjects: new Set([subject]), diff, count: perSubject });
    if (!pool.length) return;
    const start = qs.length;
    qs.push(...pool);
    sections.push({ subject, start, end: qs.length - 1 });
  });
  if (sections.length < 3 || qs.length < 15) {
    updateMockPreview();
    toast('Not enough questions for a full mock yet.');
    return;
  }
  initDom();
  Q = { qs, cur:0, ans:new Array(qs.length).fill(null), mode:'mock', timerMode:'section',
        totalTimer:null, totalLeft:sectionSecs*sections.length, totalSecs:sectionSecs*sections.length,
        pqTimer:null, pqLeft:0, pqSecs:0, sections, sectionIndex:0, sectionTimer:null,
        sectionLeft:sectionSecs, sectionSecs, mockScore:0, positive:4, negative:1 };
  document.getElementById('modeBadge').textContent = mockSetup.exam === 'advanced' ? 'JEE Advanced Mock' : 'JEE Main Mock';
  document.getElementById('pqTimerWrap').style.display = 'none';
  document.getElementById('totalTimerWrap').style.display = 'none';
  document.getElementById('sectionTimerWrap').style.display = 'block';
  navTo('quiz');
  startSectionTimer();
  renderQ();
}

export function startQuestionSet(idList) {
  const ids = String(idList || '').split(',').filter(Boolean);
  const qs = questionsByIds(ids);
  if (!qs.length) { toast('No saved questions found.'); return; }
  startQuizFromPool(shuffle(qs), 'practice', 'Saved Practice');
}

export function startBookmarkedPractice() {
  startQuestionSet((S.bookmarks || []).join(','));
}

export function startWrongPractice() {
  startQuestionSet((S.wrongQuestionIds || []).join(','));
}

export function practiceChapter(subject, chapter) {
  subject = decodeURIComponent(subject);
  chapter = decodeURIComponent(chapter);
  const qs = filterQ({ subjects: new Set([subject]), chapters: new Set([chapter]) });
  if (!qs.length) { toast('No questions found for this chapter.'); return; }
  startQuizFromPool(qs, 'practice', chapter);
}

function startQuizFromPool(qs, mode, label) {
  initDom();
  Q = { qs, cur:0, ans:new Array(qs.length).fill(null), mode, timerMode:'none',
        totalTimer:null, totalLeft:0, totalSecs:0, pqTimer:null, pqLeft:0, pqSecs:0 };
  document.getElementById('modeBadge').textContent = label || 'Practice';
  document.getElementById('pqTimerWrap').style.display = 'none';
  document.getElementById('totalTimerWrap').style.display = 'none';
  document.getElementById('sectionTimerWrap').style.display = 'none';
  navTo('quiz');
  renderQ();
}

function renderQ() {
  const q = Q.qs[Q.cur], total = Q.qs.length, cur = Q.cur;
  if (DOM.qCur) DOM.qCur.textContent = cur + 1;
  if (DOM.qTot) DOM.qTot.textContent = total;
  const pct = (cur / total) * 100;
  if (DOM.qProgFill) DOM.qProgFill.style.width = pct + '%';
  if (DOM.qProgL) {
    const sec = Q.mode === 'mock' ? Q.sections[Q.sectionIndex] : null;
    DOM.qProgL.textContent = sec ? `${sec.subject} - Question ${cur - sec.start + 1}` : 'Question ' + (cur + 1);
  }
  if (DOM.qProgR) DOM.qProgR.textContent = Math.round(pct) + '% done';
  if (DOM.btnNext) DOM.btnNext.style.display = 'none';
  if (DOM.btnSkip) DOM.btnSkip.style.display = 'inline-flex';
  if (DOM.area) {
    DOM.area.innerHTML = buildQHTML(q, false);
    reMath(DOM.area);
  }
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
  const marked = (S.bookmarks || []).includes(q.id);
  return `<div class="q-card"><button type="button" class="bookmark-btn ${marked ? 'on' : ''}" data-bookmark-id="${escHtml(q.id)}" aria-pressed="${marked ? 'true' : 'false'}" onclick="toggleBookmark('${escHtml(q.id)}')" title="${marked ? 'Remove bookmark' : 'Bookmark question'}">★</button><div class="q-tags"><span class="q-tag qt-${sc}">${escHtml(q.subject)}</span><span class="q-tag qt-${dc}">${escHtml(q.difficulty)}</span><span class="q-tag">${escHtml(q.chapter || '')}</span></div><div class="q-text">${escHtml(q.questionText)}</div></div><div class="opts">${opts}</div>${expl}`;
}

export function pickOpt(btn, idx) {
  const q = Q.qs[Q.cur];
  const chosen = q.options[idx];
  const ok = chosen === q.correctAnswer;
  Q.ans[Q.cur] = chosen;
  stopPQTimer();
  if (Q.mode === 'mock') {
    btn.closest('.opts')?.querySelectorAll('.opt').forEach(b => { b.disabled = true; });
    btn.classList.add('selected');
    setTimeout(nextQ, 220);
    return;
  }
  S.answered++;
  if (ok) { S.correct++; S.streak++; if (S.streak > S.bestStreak) S.bestStreak = S.streak; gainXP(10); flash(true); }
  else { S.streak = 0; flash(false); }
  updateSubjStat(q.subject, ok);
  updateChapterStat(q, ok);
  rememberAnswer(q, ok);
  updateNav(); updateHome(); // save() is batched for the end of the quiz
  const pct = ((Q.cur+1) / Q.qs.length) * 100;
  if (DOM.qProgFill) DOM.qProgFill.style.width = pct + '%';
  if (DOM.qProgR) DOM.qProgR.textContent = Math.round(pct) + '% done';
  if (DOM.area) {
    DOM.area.innerHTML = buildQHTML(q, true, chosen);
    reMath(DOM.area);
  }
  if (DOM.btnNext) DOM.btnNext.style.display = 'inline-flex';
  if (DOM.btnSkip) DOM.btnSkip.style.display = 'none';
}

export function nextQ() {
  stopPQTimer();
  const sec = Q.mode === 'mock' ? Q.sections[Q.sectionIndex] : null;
  if (sec && Q.cur >= sec.end) { advanceSection(); return; }
  if (Q.cur < Q.qs.length-1) { Q.cur++; renderQ(); window.scrollTo({top:0,behavior:'smooth'}); } else endQuiz();
}
export function skipQ()  {
  stopPQTimer();
  Q.ans[Q.cur] = null;
  const sec = Q.mode === 'mock' ? Q.sections[Q.sectionIndex] : null;
  if (sec && Q.cur >= sec.end) { advanceSection(); return; }
  if (Q.cur < Q.qs.length-1) { Q.cur++; renderQ(); window.scrollTo({top:0,behavior:'smooth'}); } else endQuiz();
}

export function endQuiz() {
  stopPQTimer(); stopSectionTimer(); clearInterval(Q.totalTimer);
  if (!Q.qs.length) { navTo('home'); return; }
  let correct=0, wrong=0, skipped=0;
  Q.ans.forEach((a, i) => { if (a === null) skipped++; else if (a === Q.qs[i].correctAnswer) correct++; else wrong++; });
  const total = Q.qs.length, pct = Math.round((correct/total)*100);
  const mockScore = Q.mode === 'mock' ? (correct * Q.positive) - (wrong * Q.negative) : null;
  if (Q.mode === 'mock') {
    Q.ans.forEach((a, i) => {
      if (a === null) return;
      const q = Q.qs[i];
      const ok = a === q.correctAnswer;
      S.answered++;
      if (ok) {
        S.correct++;
        S.streak++;
        if (S.streak > S.bestStreak) S.bestStreak = S.streak;
        gainXP(4, true);
      } else {
        S.streak = 0;
      }
      updateSubjStat(q.subject, ok, true);
      updateChapterStat(q, ok, true);
      rememberAnswer(q, ok, true);
    });
  }
  
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
  document.getElementById('resSub').textContent = Q.mode === 'mock'
    ? `${mockScore} marks - ${correct}/${total} correct - ${pct}% accuracy`
    : `${correct}/${total} correct - ${pct}% accuracy`;
  document.getElementById('reviewPanel').style.display = 'none';
  renderWrongSummary();
  
  addSession({ mode:Q.mode, score:pct, mockScore, correct, wrong, skipped, total, date:new Date().toLocaleDateString() });
  updateHome(); updateStatsPage();
  save(); // Final batch save
  navTo('results');
  
  setTimeout(() => {
    const fg = document.getElementById('srFg');
    if (fg) {
      fg.style.strokeDashoffset = 471.2 * (1 - pct/100);
      fg.style.stroke = pct >= 75 ? 'var(--emerald)' : pct >= 50 ? 'var(--gold)' : 'var(--rose)';
    }
  }, 100);
}

export function jumpReview(i) {
  reviewAnswers();
  setTimeout(() => document.getElementById('reviewItem' + i)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
}

function renderWrongSummary() {
  const box = document.getElementById('wrongSummary');
  if (!box) return;
  const wrongs = Q.qs
    .map((q, i) => ({ q, i, a: Q.ans[i] }))
    .filter(x => x.a !== null && x.a !== x.q.correctAnswer);
  if (!wrongs.length) {
    box.innerHTML = '<div class="empty-mini">No wrong answers in this quiz.</div>';
    return;
  }
  box.innerHTML = `<div class="mini-panel-title">Wrong answers to review</div>` + wrongs.slice(0, 8).map(x => `
    <button class="wrong-summary-row" onclick="jumpReview(${x.i})">
      <span>${escHtml(x.q.questionText)}</span>
      <strong>${escHtml(x.q.correctAnswer)}</strong>
    </button>`).join('') + `<button class="btn btn-ghost btn-sm" onclick="startWrongPractice()">Practice your ${S.wrongQuestionIds?.length || wrongs.length} wrong answers</button>`;
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
    d.id = 'reviewItem' + i;
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
