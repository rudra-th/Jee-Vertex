import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';

// ─── Config ───────────────────────────────────────────────────────────
const CHUNK_SIZE = 1500;
const OUT_DIR = new URL('data/', import.meta.url);
const MASTER = new URL('jee_master_dataset.json', import.meta.url);
const PW_JAN = new URL('data_src_pw_jan.jsonl', import.meta.url);
const PW_APR = new URL('data_src_pw_apr.jsonl', import.meta.url);
const CK0607 = new URL('data_src_ck0607.csv', import.meta.url);
const DATAVOROUS = new URL('data_src_datavorous.jsonl', import.meta.url);
const SAMKARYA_FILES = [
  'jeeMain_2025_22Jan_shift1.json',
  'jeeMain_2025_22Jan_shift2.json',
  'jeeMain_2026_02April_shift1.json',
  'jeeMain_2026_02April_shift2.json',
  'jeeMain_2026_04April_shift1.json',
];

// ─── Helpers ──────────────────────────────────────────────────────────

function sha1(s) {
  return parseInt(createHash('sha1').update(s).digest('hex').slice(0, 8), 16);
}

function mapType(qt) {
  if (!qt) return 'mcq';
  const s = String(qt).toLowerCase();
  if (s.includes('numerical') || s.includes('integer') || s === '2') return 'numerical';
  return 'mcq';
}

function mapAnswer(answer, options, qType) {
  if (qType === 'numerical') {
    const n = parseFloat(String(answer).replace(/[\s,]/g, ''));
    return isNaN(n) ? 0 : n;
  }
  if (answer === undefined || answer === null) return 0;
  const a = String(answer).trim();
  if (/^[A-D]$/i.test(a)) {
    const idx = a.toUpperCase().charCodeAt(0) - 65;
    return idx >= 0 && idx < options.length ? idx : 0;
  }
  const n = parseInt(a, 10);
  if (!isNaN(n) && n >= 0 && n < options.length) return n;
  return 0;
}

function generateId(questionText, source) {
  return sha1(source + ':' + questionText.replace(/\s+/g, ' ').trim());
}

// ─── Parse Sources ────────────────────────────────────────────────────

function parseMaster() {
  console.log('Reading master dataset...');
  const raw = JSON.parse(readFileSync(MASTER, 'utf-8'));
  const questions = raw.questions || raw;
  if (!Array.isArray(questions)) throw new Error('Master format unexpected');
  console.log(`  ${questions.length} raw entries`);
  return questions.map(q => {
    const qType = mapType(q.question_type);
    const opts = (q.options || []).map(o => o.text || o);
    const ans = qType === 'numerical' ? mapAnswer(q.answer, opts, qType)
      : mapAnswer(q.answer || q.correct_answer, opts, qType);
    return {
      id: Number(q.id),
      subject: q.subject || '',
      chapter: (q.chapter || q.topic || '').toLowerCase().replace(/\s+/g, '-'),
      exam: q.exam || '',
      year: String(q.year || ''),
      type: qType,
      answer: ans,
      question_text: q.question_text || q.question || '',
      options: opts,
    };
  });
}

function parsePW(jsonlPath, label) {
  console.log(`Reading ${label}...`);
  const text = readFileSync(jsonlPath, 'utf-8');
  const lines = text.trim().split('\n').filter(Boolean);
  console.log(`  ${lines.length} lines`);
  return lines.map((line, i) => {
    const q = JSON.parse(line);
    const qText = q.question || '';
    const opts = (q.options || []).map(o => String(o));
    const qType = Number(q.question_type) === 2 ? 'numerical' : 'mcq';
    const ans = Array.isArray(q.correct_options) && q.correct_options.length > 0
      ? q.correct_options[0] : 0;
    const id = generateId(qText, label + '_' + i);
    return {
      id,
      subject: 'Mathematics',
      chapter: 'jee-main-2025',
      exam: 'JEE Main',
      year: '2025',
      type: qType,
      answer: ans,
      question_text: qText,
      options: opts,
    };
  });
}

function parseCK0607() {
  console.log('Reading CK0607 CSV...');
  const text = readFileSync(CK0607, 'utf-8');

  // Proper multi-line CSV parse: split rows at newlines NOT inside quotes
  function splitCSVRows(csv) {
    const rows = [];
    let current = '';
    let inQ = false;
    for (let i = 0; i < csv.length; i++) {
      const ch = csv[i];
      if (ch === '"') inQ = !inQ;
      if (ch === '\n' && !inQ) {
        const trimmed = current.trim();
        if (trimmed) rows.push(trimmed);
        current = '';
      } else {
        current += ch;
      }
    }
    const trimmed = current.trim();
    if (trimmed) rows.push(trimmed);
    return rows;
  }

  function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ',' && !inQ) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  }

  const rows = splitCSVRows(text);
  const header = parseCSVLine(rows[0]);
  const dataRows = rows.slice(1).filter(Boolean);
  console.log(`  ${dataRows.length} rows`);

  // Find column indices
  const colId = header.indexOf('unique_id');
  const colShift = header.indexOf('Shift Name');
  const colSubject = header.indexOf('Subject');
  const colQText = header.indexOf('Question Text');
  const colCorrect = header.indexOf('Correct Option');

  const out = [];
  for (const line of dataRows) {
    const fields = parseCSVLine(line);
    const uuid = fields[colId] || '';
    const shift = fields[colShift] || '';
    const subject = fields[colSubject] || 'Mathematics';
    const qText = fields[colQText] || '';
    const correctOpt = parseInt(fields[colCorrect], 10) || 0;

    // Parse options from question text: lines like "(1) ...", "(2) ...", "(3) ...", "(4) ..."
    const lines2 = qText.split('\n');
    const mainLines = [];
    const opts = [];
    for (const l of lines2) {
      const trimmed = l.trim();
      const m = trimmed.match(/^\((\d+)\)\s*(.*)/);
      if (m) {
        opts[parseInt(m[1]) - 1] = m[2].trim();
      } else if (trimmed) {
        mainLines.push(trimmed);
      }
    }

    const questionBody = mainLines.join(' ');
    // Generate ID from UUID
    const id = sha1('ck0607:' + uuid);

    out.push({
      id,
      subject: subject,
      chapter: 'jee-main-2025',
      exam: 'JEE Main',
      year: '2025',
      type: 'mcq',
      answer: correctOpt - 1, // convert 1-based to 0-based
      question_text: questionBody,
      options: opts.filter(Boolean),
    });
  }
  return out;
}

function parseDatavorous() {
  console.log('Reading datavorous JSONL...');
  const text = readFileSync(DATAVOROUS, 'utf-8');
  const lines = text.trim().split('\n').filter(Boolean);
  console.log(`  ${lines.length} lines`);
  return lines.map((line, i) => {
    const q = JSON.parse(line);
    const qText = q.question || '';
    const opts = (q.options || []).map(o => String(o).replace(/^"|"$/g, ''));
    const qType = Number(q.question_type) === 2 ? 'numerical' : 'mcq';
    const ans = Array.isArray(q.correct_options) && q.correct_options.length > 0
      ? q.correct_options[0] : 0;
    const id = generateId(qText, 'datavorous_' + i);
    const year = q.module ? q.module.match(/20\d{2}/)?.[0] || '' : '';
    return {
      id,
      subject: q.subject || '',
      chapter: (q.chapter || '').toLowerCase().replace(/\s+/g, '-'),
      exam: q.exam || '',
      year,
      type: qType,
      answer: ans,
      question_text: qText,
      options: opts,
    };
  });
}

function parseSamkarya(filename) {
  console.log(`Reading Samkarya ${filename}...`);
  const path = new URL(filename, import.meta.url);
  const raw = JSON.parse(readFileSync(path, 'utf-8'));
  console.log(`  ${raw.length} questions`);
  const year = filename.match(/20\d{2}/)[0];
  return raw.map(q => {
    const opts = [];
    const optMap = q.options || {};
    const optKeys = Object.keys(optMap).sort();
    for (const k of optKeys) opts.push(String(optMap[k]));
    const ansMap = { a: 0, b: 1, c: 2, d: 3 };
    const ans = ansMap[String(q.correct_answer).toLowerCase()] ?? 0;
    const id = generateId(q.question_text, 'samkarya_' + filename + '_' + q.question_number);
    // Determine question type from options format
    const isNumerical = !q.correct_answer || /^[A-D]$/i.test(String(q.correct_answer)) === false;
    return {
      id,
      subject: q.subject || 'Mathematics',
      chapter: 'jee-main-' + year,
      exam: 'JEE Main',
      year,
      type: isNumerical ? 'numerical' : 'mcq',
      answer: ans,
      question_text: q.question_text || '',
      options: opts,
    };
  });
}

// ─── Dedup & Build ────────────────────────────────────────────────────

function build(all) {
  console.log(`\nTotal entries before dedup: ${all.length}`);

  // Dedup by id (keep first occurrence)
  const seen = new Set();
  const unique = [];
  let dups = 0;
  for (const q of all) {
    if (seen.has(q.id)) { dups++; continue; }
    seen.add(q.id);
    unique.push(q);
  }
  console.log(`Dups removed: ${dups}`);
  console.log(`Unique questions: ${unique.length}`);

  // Stats
  const byExam = {};
  const bySubject = {};
  for (const q of unique) {
    byExam[q.exam] = (byExam[q.exam] || 0) + 1;
    bySubject[q.subject] = (bySubject[q.subject] || 0) + 1;
  }
  console.log('By exam:', JSON.stringify(byExam));
  console.log('By subject:', JSON.stringify(bySubject));

  // Sort by id for deterministic ordering
  unique.sort((a, b) => a.id - b.id);

  // Write index
  const index = unique.map(q => [q.id, q.subject, q.chapter, q.exam, q.year, q.type, q.answer]);
  writeFileSync(new URL('index.json', OUT_DIR), JSON.stringify(index));
  console.log(`\nWrote index.json (${index.length} entries)`);

  // Write chunks
  const chunkCount = Math.ceil(unique.length / CHUNK_SIZE);
  let existing = 0;
  // Remove old chunk files first
  for (let i = 1; ; i++) {
    const path = new URL(`chunk_${i}.json`, OUT_DIR);
    if (existsSync(path)) {
      writeFileSync(path, '');
      existing++;
    } else break;
  }

  let written = 0;
  for (let c = 0; c < chunkCount; c++) {
    const start = c * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, unique.length);
    const chunk = unique.slice(start, end).map(q => ({
      i: q.id,
      t: q.type,
      a: q.answer,
      q: q.question_text,
      o: q.options,
    }));
    const filePath = new URL(`chunk_${c + 1}.json`, OUT_DIR);
    writeFileSync(filePath, JSON.stringify(chunk));
    written++;
    console.log(`  chunk_${c + 1}.json: ${chunk.length} questions`);
  }
  console.log(`\nWrote ${written} chunk files`);
  if (existing > written) {
    // Clean leftover old chunks
    for (let i = written + 1; i <= existing; i++) {
      const p = new URL(`chunk_${i}.json`, OUT_DIR);
      if (existsSync(p) && readFileSync(p, 'utf-8').length === 0) continue;
      try { writeFileSync(p, ''); } catch {}
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────

function main() {
  const all = [];

  // 1. Master dataset
  const master = parseMaster();
  all.push(...master);

  // 2. PhysicsWallahAI Jan
  const pwJan = parsePW(PW_JAN, 'pw_jan');
  all.push(...pwJan);

  // 3. PhysicsWallahAI Apr
  const pwApr = parsePW(PW_APR, 'pw_apr');
  all.push(...pwApr);

  // 4. CK0607
  const ck = parseCK0607();
  all.push(...ck);

  // 5. Datavorous
  const dv = parseDatavorous();
  all.push(...dv);

  // 6. Samkarya papers
  for (const f of SAMKARYA_FILES) {
    const s = parseSamkarya(f);
    all.push(...s);
  }

  build(all);
  console.log('\nDone!');
}

main();
