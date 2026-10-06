// Level, then subject, then the quiz. Both "I am a student" and "Take a quiz" open this page.

const steps = {
  level: document.getElementById('step-level'),
  subject: document.getElementById('step-subject')
};
const levelList = document.getElementById('level-list');
const subjectList = document.getElementById('subject-list');
const subjectTitle = document.getElementById('subject-title');
const startBtn = document.getElementById('start');
const assessment = document.getElementById('assessment');
const assessmentMsg = document.getElementById('assessment-msg');
const msg = document.getElementById('msg');

let selectedLevel = null;
let selectedSubject = null;

function show(name) {
  Object.keys(steps).forEach(function (key) {
    steps[key].hidden = key !== name;
  });
  msg.hidden = true;
}

function showError(text) {
  msg.textContent = text;
  msg.hidden = false;
}

function note(container, text) {
  container.innerHTML = '';
  const p = document.createElement('p');
  p.className = 'muted';
  p.textContent = text;
  container.appendChild(p);
}

function choiceButton(label, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'choice';
  b.textContent = label;
  b.addEventListener('click', function () { onClick(b); });
  return b;
}

/* ---------- Step 1: levels ---------- */

// Levels are shown three to a row: Basic 4-6, Basic 7-9, then SHS 1-3.
// Any level named differently goes in a last row.
const LEVEL_ROWS = [
  { prefix: 'basic', from: 4, to: 6 },
  { prefix: 'basic', from: 7, to: 9 },
  { prefix: 'shs', from: 1, to: 3 }
];

function groupLevels(levels) {
  const rows = LEVEL_ROWS.map(function () { return []; });
  const other = [];

  levels.forEach(function (lvl) {
    const m = /^\s*(basic|shs)\s*(\d+)\s*$/i.exec(lvl.name);
    let placed = false;
    if (m) {
      const prefix = m[1].toLowerCase();
      const num = Number(m[2]);
      LEVEL_ROWS.forEach(function (def, i) {
        if (!placed && def.prefix === prefix && num >= def.from && num <= def.to) {
          rows[i].push({ level: lvl, num: num });
          placed = true;
        }
      });
    }
    if (!placed) other.push(lvl);
  });

  const ordered = rows.map(function (row) {
    return row
      .sort(function (a, b) { return a.num - b.num; })
      .map(function (x) { return x.level; });
  });
  other.sort(function (a, b) { return a.name.localeCompare(b.name); });
  ordered.push(other);
  return ordered;
}

async function loadLevels() {
  note(levelList, 'Loading levels…');
  try {
    const levels = await API.get('levels?select=id,name&order=name');
    if (!levels.length) {
      note(levelList, 'No levels have been added yet.');
      return;
    }
    levelList.innerHTML = '';
    const groups = groupLevels(levels);
    groups.forEach(function (group, i) {
      if (!group.length) return;
      const row = document.createElement('div');
      row.className = 'level-row' + (i === groups.length - 1 ? ' other' : '');
      group.forEach(function (lvl) {
        row.appendChild(choiceButton(lvl.name, function () { pickLevel(lvl); }));
      });
      levelList.appendChild(row);
    });
  } catch (err) {
    note(levelList, '');
    showError('Could not load levels. Check js/config.js and your internet connection.');
  }
}

/* ---------- Step 2: subjects ---------- */

async function pickLevel(lvl) {
  selectedLevel = lvl;
  selectedSubject = null;
  assessment.hidden = true;
  subjectTitle.textContent = 'Choose a subject (' + lvl.name + ')';
  show('subject');
  note(subjectList, 'Loading subjects…');

  try {
    const subjects = await API.get(
      'courses?select=id,name&level_id=eq.' + encodeURIComponent(lvl.id) + '&order=name'
    );
    if (!subjects.length) {
      note(subjectList, 'There are no subjects for this level yet.');
      return;
    }
    subjectList.innerHTML = '';
    subjects.forEach(function (sub) {
      subjectList.appendChild(choiceButton(sub.name, function (btn) { pickSubject(sub, btn); }));
    });
  } catch (err) {
    note(subjectList, '');
    showError('Could not load subjects. Please try again.');
  }
}

function pickSubject(sub, btn) {
  selectedSubject = sub;
  subjectList.querySelectorAll('.choice').forEach(function (b) {
    b.classList.toggle('selected', b === btn);
  });
  assessmentMsg.textContent = 'You have chosen ' + sub.name + ' (' + selectedLevel.name +
    '). When you are ready, start your quiz.';
  assessment.hidden = false;
  assessment.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

document.getElementById('back-to-level').addEventListener('click', function () {
  assessment.hidden = true;
  show('level');
});

/* ---------- Start the quiz ---------- */

function confirmQuizStart(title) {
  const message = 'You are about to take a quiz for:\n"' + title + '"\n\n' +
    '\u2022 Questions: 15 random questions\n' +
    '\u2022 Time: ' + QUESTION_SECONDS + ' seconds per question\n' +
    '\u2022 Pass mark: 50%\n\n' +
    'Do you wish to start the quiz now?';
  return confirm(message);
}

startBtn.addEventListener('click', function () {
  if (!selectedLevel || !selectedSubject) return;
  if (!confirmQuizStart(selectedSubject.name)) return;

  // The database table is still called "courses", so these keys keep that name
  sessionStorage.setItem('courseId', selectedSubject.id);
  sessionStorage.setItem('courseName', selectedSubject.name);
  sessionStorage.setItem('levelName', selectedLevel.name);
  sessionStorage.removeItem('result');

  window.location.href = 'quiz.html';
});

loadLevels();