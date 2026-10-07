// The admin session lives only in this tab, matching the login page
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storage: window.sessionStorage }
});
const $ = function (id) { return document.getElementById(id); };

let levels = [];
let courses = [];
let editingId = null;

/* ---------- small helpers ---------- */

// Build a DOM element safely (text is never parsed as HTML)
function h(tag, attrs) {
  const e = document.createElement(tag);
  Object.entries(attrs || {}).forEach(function (pair) {
    const k = pair[0], v = pair[1];
    if (k === 'text') e.textContent = v;
    else if (k === 'on') Object.entries(v).forEach(function (ev) { e.addEventListener(ev[0], ev[1]); });
    else e.setAttribute(k, v);
  });
  for (let i = 2; i < arguments.length; i++) e.append(arguments[i]);
  return e;
}

function btn(label, fn, cls) {
  return h('button', { type: 'button', class: 'small ' + (cls || ''), text: label, on: { click: fn } });
}

function emptyRow(cols, text) {
  return h('tr', {}, h('td', { colspan: String(cols), class: 'muted', text: text }));
}

let toastTimer;
function toast(msg, isError) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast show' + (isError ? ' error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { t.className = 'toast'; }, 3500);
}

// Show an error or success message for a Supabase response; returns true if OK
function report(result, okMsg) {
  if (result.error) {
    toast(result.error.message, true);
    return false;
  }
  if (okMsg) toast(okMsg);
  return true;
}

function fillSelect(sel, rows, placeholder) {
  const keep = sel.value;
  sel.innerHTML = '';
  sel.append(h('option', { value: '', text: placeholder }));
  rows.forEach(function (r) {
    sel.append(h('option', { value: String(r.id), text: r.name }));
  });
  if (rows.some(function (r) { return String(r.id) === keep; })) sel.value = keep;
}

function levelName(id) {
  const l = levels.find(function (x) { return x.id === id; });
  return l ? l.name : '';
}

/* ---------- start-up: must be a signed-in admin ---------- */

async function init() {
  const { data } = await sb.auth.getSession();
  if (!data.session) {
    window.location.replace('login.html');
    return;
  }
  const { data: isAdmin } = await sb.rpc('is_admin');
  if (!isAdmin) {
    await sb.auth.signOut();
    window.location.replace('login.html?denied=1');
    return;
  }
  Nav.setAccount(data.session.user.email, function () { sb.auth.signOut(); });
  await loadBase();
}

sb.auth.onAuthStateChange(function (event) {
  if (event === 'SIGNED_OUT') window.location.replace('login.html');
});


/* ---------- tabs ---------- */

document.querySelectorAll('.tab').forEach(function (b) {
  b.addEventListener('click', function () {
    document.querySelectorAll('.tab').forEach(function (x) { x.classList.toggle('active', x === b); });
    document.querySelectorAll('.tabpanel').forEach(function (p) { p.hidden = p.id !== 'tab-' + b.dataset.tab; });
  });
});

/* ---------- levels and courses ---------- */

async function loadBase() {
  const lv = await sb.from('levels').select('id,name').order('name');
  const co = await sb.from('courses').select('id,level_id,name').order('name');
  if (lv.error || co.error) {
    toast((lv.error || co.error).message, true);
    return;
  }
  levels = lv.data;
  courses = co.data;

  renderLevels();
  renderCourses();
  fillSelect($('course-level'), levels, 'Select level');
  fillSelect($('q-level'), levels, 'Select level');
  updateQuestionCourses();
}

function renderLevels() {
  const body = $('levels-body');
  body.innerHTML = '';
  levels.forEach(function (l) {
    const n = courses.filter(function (c) { return c.level_id === l.id; }).length;
    body.append(h('tr', {},
      h('td', { text: l.name }),
      h('td', { text: String(n) }),
      h('td', { class: 'actions' },
        btn('Rename', function () { renameLevel(l); }),
        btn('Delete', function () { deleteLevel(l); }, 'danger'))));
  });
  if (!levels.length) body.append(emptyRow(3, 'No levels yet.'));
}

function renderCourses() {
  const body = $('courses-body');
  body.innerHTML = '';
  courses.forEach(function (c) {
    body.append(h('tr', {},
      h('td', { text: levelName(c.level_id) }),
      h('td', { text: c.name }),
      h('td', { class: 'actions' },
        btn('Rename', function () { renameCourse(c); }),
        btn('Delete', function () { deleteCourse(c); }, 'danger'))));
  });
  if (!courses.length) body.append(emptyRow(3, 'No subjects yet.'));
}

$('level-form').addEventListener('submit', async function (e) {
  e.preventDefault();
  const name = $('level-name').value.trim();
  if (!name) return;
  if (report(await sb.from('levels').insert({ name: name }), 'Level added')) {
    $('level-name').value = '';
    await loadBase();
  }
});

async function renameLevel(l) {
  const name = prompt('Rename level', l.name);
  if (!name || !name.trim() || name.trim() === l.name) return;
  if (report(await sb.from('levels').update({ name: name.trim() }).eq('id', l.id), 'Level renamed')) await loadBase();
}

async function deleteLevel(l) {
  if (!confirm('Delete "' + l.name + '" together with ALL its subjects and questions? This cannot be undone.')) return;
  if (report(await sb.from('levels').delete().eq('id', l.id), 'Level deleted')) await loadBase();
}

$('course-form').addEventListener('submit', async function (e) {
  e.preventDefault();
  const levelId = Number($('course-level').value);
  const name = $('course-name').value.trim();
  if (!levelId || !name) return;
  if (report(await sb.from('courses').insert({ level_id: levelId, name: name }), 'Subject added')) {
    $('course-name').value = '';
    await loadBase();
  }
});

async function renameCourse(c) {
  const name = prompt('Rename subject', c.name);
  if (!name || !name.trim() || name.trim() === c.name) return;
  if (report(await sb.from('courses').update({ name: name.trim() }).eq('id', c.id), 'Subject renamed')) await loadBase();
}

async function deleteCourse(c) {
  if (!confirm('Delete "' + c.name + '" together with ALL its questions? This cannot be undone.')) return;
  if (report(await sb.from('courses').delete().eq('id', c.id), 'Subject deleted')) await loadBase();
}

/* ---------- questions ---------- */

function updateQuestionCourses() {
  const lid = $('q-level').value;
  const rows = courses.filter(function (c) { return String(c.level_id) === lid; });
  fillSelect($('q-course'), rows, lid ? 'Select subject' : 'Select a level first');
  loadQuestions();
}

$('q-level').addEventListener('change', function () {
  resetForm();
  updateQuestionCourses();
});
$('q-course').addEventListener('change', function () {
  resetForm();
  loadQuestions();
});

async function loadQuestions() {
  const body = $('q-body');
  const cid = $('q-course').value;
  updateImportTarget();
  body.innerHTML = '';

  if (!cid) {
    $('q-count').textContent = 'Choose a level and subject above.';
    body.append(emptyRow(4, 'No subject selected.'));
    return;
  }

  const res = await sb.from('questions').select('*').eq('course_id', cid).order('id');
  if (res.error) {
    toast(res.error.message, true);
    return;
  }

  const n = res.data.length;
  $('q-count').textContent = n + (n === 1 ? ' question' : ' questions') +
    (n < 15 ? ' (add at least 15 so every quiz session is full)' : '');

  res.data.forEach(function (q, i) {
    const short = q.question_text.length > 90 ? q.question_text.slice(0, 90) + '…' : q.question_text;
    body.append(h('tr', {},
      h('td', { text: String(i + 1) }),
      h('td', { text: short }),
      h('td', { text: q.correct_option }),
      h('td', { class: 'actions' },
        btn('Edit', function () { startEdit(q); }),
        btn('Delete', function () { deleteQuestion(q); }, 'danger'))));
  });
  if (!n) body.append(emptyRow(4, 'No questions in this subject yet.'));
}

function resetForm() {
  editingId = null;
  $('q-form').reset();
  $('q-form-title').textContent = 'Add a question';
  $('q-submit').textContent = 'Add question';
  $('q-cancel').hidden = true;
}

function startEdit(q) {
  editingId = q.id;
  $('q-text').value = q.question_text;
  $('q-a').value = q.option_a;
  $('q-b').value = q.option_b;
  $('q-c').value = q.option_c;
  $('q-d').value = q.option_d;
  $('q-correct').value = q.correct_option;
  $('q-form-title').textContent = 'Edit question';
  $('q-submit').textContent = 'Save changes';
  $('q-cancel').hidden = false;
  $('q-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

$('q-cancel').addEventListener('click', resetForm);

$('q-form').addEventListener('submit', async function (e) {
  e.preventDefault();
  const cid = Number($('q-course').value);
  if (!cid) {
    toast('Choose a level and subject first.', true);
    return;
  }

  const payload = {
    course_id: cid,
    question_text: $('q-text').value.trim(),
    option_a: $('q-a').value.trim(),
    option_b: $('q-b').value.trim(),
    option_c: $('q-c').value.trim(),
    option_d: $('q-d').value.trim(),
    correct_option: $('q-correct').value
  };

  const result = editingId
    ? await sb.from('questions').update(payload).eq('id', editingId)
    : await sb.from('questions').insert(payload);

  if (report(result, editingId ? 'Question updated' : 'Question added')) {
    resetForm();
    await loadQuestions();
  }
});

async function deleteQuestion(q) {
  if (!confirm('Delete this question?')) return;
  if (report(await sb.from('questions').delete().eq('id', q.id), 'Question deleted')) {
    if (editingId === q.id) resetForm();
    await loadQuestions();
  }
}

/* ---------- import questions from JSON ---------- */

const IMPORT_MAX = 500;
const LETTERS = ['A', 'B', 'C', 'D'];
const IMPORT_TEMPLATE = [
  {
    question: 'What does CPU stand for?',
    options: ['Central Processing Unit', 'Computer Personal Unit', 'Central Program Utility', 'Control Processing Unit'],
    answer: 'A'
  },
  {
    question: 'What is 7 x 8?',
    options: ['54', '56', '58', '64'],
    answer: '56'
  }
];

let pendingImport = null;   // { cid, rows } once a check has passed

function text(v) {
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  return '';
}

// Turns one item from the JSON into a database row, or explains what is wrong with it
function parseQuestion(raw, n) {
  const label = 'Question ' + n;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: label + ': this is not a question object.' };

  const q = text(raw.question !== undefined ? raw.question : raw.question_text);
  if (!q) return { error: label + ': the "question" text is missing.' };

  let opts;
  if (Array.isArray(raw.options)) {
    opts = raw.options.map(text);
  } else if (raw.options && typeof raw.options === 'object') {
    const byLetter = {};
    Object.keys(raw.options).forEach(function (k) { byLetter[k.trim().toUpperCase()] = raw.options[k]; });
    if (!LETTERS.every(function (l) { return byLetter[l] !== undefined; })) {
      return { error: label + ': "options" needs the keys A, B, C and D.' };
    }
    opts = LETTERS.map(function (l) { return text(byLetter[l]); });
  } else if (raw.option_a !== undefined) {
    opts = [raw.option_a, raw.option_b, raw.option_c, raw.option_d].map(text);
  } else {
    return { error: label + ': "options" is missing (a list of 4 answers, or an object with A, B, C and D).' };
  }

  if (opts.length !== 4 || opts.some(function (o) { return !o; })) {
    return { error: label + ': it needs exactly 4 options and none can be empty.' };
  }
  const lower = opts.map(function (o) { return o.toLowerCase(); });
  if (new Set(lower).size !== 4) return { error: label + ': two options are the same.' };

  const ans = raw.answer !== undefined ? raw.answer : (raw.correct_option !== undefined ? raw.correct_option : raw.correct);
  const a = text(ans);
  let idx = -1;
  if (/^[A-Da-d]$/.test(a)) idx = a.toUpperCase().charCodeAt(0) - 65;
  else if (a) idx = lower.indexOf(a.toLowerCase());
  if (idx < 0) return { error: label + ': "answer" must be A, B, C or D, or exactly match one of the options.' };

  return {
    row: {
      question_text: q,
      option_a: opts[0],
      option_b: opts[1],
      option_c: opts[2],
      option_d: opts[3],
      correct_option: LETTERS[idx]
    }
  };
}

// Puts the four options in a random order and keeps track of which one is correct
function shuffleRow(row) {
  const correctText = row['option_' + row.correct_option.toLowerCase()];
  const opts = [row.option_a, row.option_b, row.option_c, row.option_d];
  for (let i = opts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = opts[i];
    opts[i] = opts[j];
    opts[j] = t;
  }
  row.option_a = opts[0];
  row.option_b = opts[1];
  row.option_c = opts[2];
  row.option_d = opts[3];
  row.correct_option = LETTERS[opts.indexOf(correctText)];
  return row;
}

// If the file says which level and subject it is for, warn when that differs from the chosen one
function fileTargetNote(data) {
  if (!data || Array.isArray(data)) return '';
  const fileLevel = text(data.level);
  const fileSubject = text(data.subject);
  if (!fileLevel && !fileSubject) return '';
  const lvl = $('q-level').selectedOptions[0].textContent.trim();
  const sub = $('q-course').selectedOptions[0].textContent.trim();
  function same(a, b) { return !a || a.toLowerCase() === b.toLowerCase(); }
  if (same(fileLevel, lvl) && same(fileSubject, sub)) return '';
  return 'Check: this file is labelled "' + [fileLevel, fileSubject].filter(Boolean).join(' \u00B7 ') +
    '" but you are importing into "' + lvl + ' \u00B7 ' + sub + '".';
}

function showImportSummary(kind, lines) {
  const box = $('imp-summary');
  box.className = 'imp-summary ' + kind;
  box.innerHTML = '';
  box.append(h('div', { text: lines[0] }));
  if (lines.length > 1) {
    const ul = h('ul', {});
    lines.slice(1).forEach(function (l) { ul.append(h('li', { text: l })); });
    box.append(ul);
  }
  box.hidden = false;
}

function clearImportCheck() {
  pendingImport = null;
  $('imp-run').disabled = true;
  $('imp-run').textContent = 'Import';
  $('imp-summary').hidden = true;
}

function updateImportTarget() {
  const cid = $('q-course').value;
  if (cid) {
    const lvl = $('q-level').selectedOptions[0];
    const sub = $('q-course').selectedOptions[0];
    $('imp-target').textContent = 'Importing into: ' + lvl.textContent + ' \u00B7 ' + sub.textContent;
  } else {
    $('imp-target').textContent = 'Choose a level and subject above first.';
  }
  $('imp-check').disabled = !cid;
  if (pendingImport && String(pendingImport.cid) !== cid) clearImportCheck();
}

async function checkImport() {
  clearImportCheck();
  const cid = Number($('q-course').value);
  if (!cid) { toast('Choose a level and subject first.', true); return; }

  const raw = $('imp-text').value.trim();
  if (!raw) { toast('Paste your JSON or choose a file first.', true); return; }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    showImportSummary('error', ['This is not valid JSON. Check for a missing comma, quote or bracket.', e.message]);
    return;
  }

  const list = Array.isArray(data) ? data : (data && Array.isArray(data.questions) ? data.questions : null);
  if (!list) { showImportSummary('error', ['The JSON must be a list of questions, for example [ { ... }, { ... } ].']); return; }
  if (!list.length) { showImportSummary('error', ['The list is empty.']); return; }
  if (list.length > IMPORT_MAX) { showImportSummary('error', ['Too many questions (' + list.length + '). Import up to ' + IMPORT_MAX + ' at a time.']); return; }

  const problems = [];
  const rows = [];
  const seen = {};
  list.forEach(function (item, i) {
    const r = parseQuestion(item, i + 1);
    if (r.error) { problems.push(r.error); return; }
    const key = r.row.question_text.toLowerCase();
    if (seen[key]) { problems.push('Question ' + (i + 1) + ': same question text as question ' + seen[key] + '.'); return; }
    seen[key] = i + 1;
    rows.push(r.row);
  });

  if (problems.length) {
    const shown = problems.slice(0, 15);
    if (problems.length > 15) shown.push('\u2026and ' + (problems.length - 15) + ' more.');
    showImportSummary('error', ['Found ' + problems.length + ' problem' + (problems.length === 1 ? '' : 's') + '. Fix them and check again:'].concat(shown));
    return;
  }

  // Leave out questions this subject already has
  const res = await sb.from('questions').select('question_text').eq('course_id', cid);
  if (res.error) { toast(res.error.message, true); return; }
  const existing = new Set(res.data.map(function (q) { return q.question_text.trim().toLowerCase(); }));
  const fresh = rows.filter(function (r) { return !existing.has(r.question_text.toLowerCase()); });
  const skipped = rows.length - fresh.length;

  if (!fresh.length) {
    showImportSummary('error', ['Nothing new to import. All ' + rows.length + ' questions are already in this subject.']);
    return;
  }

  if ($('imp-shuffle').checked) fresh.forEach(shuffleRow);

  pendingImport = { cid: cid, rows: fresh };
  $('imp-run').disabled = false;
  $('imp-run').textContent = 'Import ' + fresh.length + ' question' + (fresh.length === 1 ? '' : 's');
  const lines = [
    fresh.length + ' question' + (fresh.length === 1 ? ' is' : 's are') + ' ready to import.' +
      (skipped ? ' ' + skipped + ' already in this subject will be skipped.' : '') +
      ($('imp-shuffle').checked ? ' Answer positions have been shuffled.' : '')
  ];
  const note = fileTargetNote(data);
  if (note) lines.push(note);
  showImportSummary('ok', lines);
}

async function runImport() {
  if (!pendingImport) return;
  const cid = pendingImport.cid;
  const payload = pendingImport.rows.map(function (r) { return Object.assign({ course_id: cid }, r); });

  $('imp-run').disabled = true;
  $('imp-check').disabled = true;

  let done = 0;
  for (let i = 0; i < payload.length; i += 100) {
    const chunk = payload.slice(i, i + 100);
    const res = await sb.from('questions').insert(chunk);
    if (res.error) {
      pendingImport = null;
      showImportSummary('error', ['Stopped after ' + done + ' of ' + payload.length + ' questions.', res.error.message]);
      $('imp-check').disabled = false;
      await loadQuestions();
      return;
    }
    done += chunk.length;
  }

  clearImportCheck();
  $('imp-text').value = '';
  $('imp-file').value = '';
  $('imp-check').disabled = false;
  toast(done + ' questions imported');
  showImportSummary('ok', [done + ' question' + (done === 1 ? ' was' : 's were') + ' added to this subject.']);
  await loadQuestions();
}

$('imp-check').addEventListener('click', checkImport);
$('imp-run').addEventListener('click', runImport);
$('imp-text').addEventListener('input', clearImportCheck);
$('imp-shuffle').addEventListener('change', clearImportCheck);

$('imp-file').addEventListener('change', function (e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { toast('That file is too large (limit 2 MB).', true); e.target.value = ''; return; }
  const reader = new FileReader();
  reader.onload = function () {
    $('imp-text').value = String(reader.result || '');
    clearImportCheck();
  };
  reader.readAsText(file);
});

$('imp-template').addEventListener('click', function () {
  const blob = new Blob([JSON.stringify(IMPORT_TEMPLATE, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'questions-template.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
});

init();
