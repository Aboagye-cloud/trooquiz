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

init();