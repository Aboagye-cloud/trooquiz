// The student flow is unchanged: level, then subject, then the quiz.
// Only the way it is shown changed: it now opens in a dialog on top of the landing page.

const dialog = document.getElementById('quiz-dialog');
const steps = {
  level: document.getElementById('step-level'),
  subject: document.getElementById('step-subject')
};
const levelList = document.getElementById('level-list');
const subjectList = document.getElementById('subject-list');
const subjectTitle = document.getElementById('subject-title');
const startBtn = document.getElementById('start');
const msg = document.getElementById('msg');

let selectedLevel = null;
let selectedSubject = null;
let levelsLoaded = false;

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

/* ---------- dialog open / close ---------- */

function openDialog() {
  show('level');
  if (!dialog.open) {
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }
  if (!levelsLoaded) loadLevels();
}

function closeDialog() {
  if (!dialog.open) return;
  if (typeof dialog.close === 'function') dialog.close();
  else dialog.removeAttribute('open');
}

document.querySelectorAll('[data-open-quiz]').forEach(function (b) {
  b.addEventListener('click', openDialog);
});
document.getElementById('dlg-close').addEventListener('click', closeDialog);

// Click on the dark area outside the box closes it
dialog.addEventListener('click', function (e) {
  if (e.target === dialog) closeDialog();
});

// Clear #start so the "Take a quiz" menu link can open the dialog again
dialog.addEventListener('close', function () {
  if (window.location.hash === '#start') {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
});

/* ---------- Step 1: levels ---------- */

async function loadLevels() {
  note(levelList, 'Loading levels…');
  try {
    const levels = await API.get('levels?select=id,name&order=name');
    if (!levels.length) {
      note(levelList, 'No levels have been added yet.');
      return;
    }
    levelList.innerHTML = '';
    levels.forEach(function (lvl) {
      levelList.appendChild(choiceButton(lvl.name, function () { pickLevel(lvl); }));
    });
    levelsLoaded = true;
  } catch (err) {
    note(levelList, '');
    showError('Could not load levels. Check js/config.js and your internet connection.');
  }
}

/* ---------- Step 2: subjects ---------- */

async function pickLevel(lvl) {
  selectedLevel = lvl;
  selectedSubject = null;
  startBtn.disabled = true;
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
  startBtn.disabled = false;
}

document.getElementById('back-to-level').addEventListener('click', function () {
  show('level');
});

/* ---------- Start the quiz ---------- */

startBtn.addEventListener('click', function () {
  if (!selectedLevel || !selectedSubject) return;

  // The database table is still called "courses", so these keys keep that name
  sessionStorage.setItem('courseId', selectedSubject.id);
  sessionStorage.setItem('courseName', selectedSubject.name);
  sessionStorage.setItem('levelName', selectedLevel.name);
  sessionStorage.removeItem('result');

  window.location.href = 'quiz.html';
});

/* ---------- "Take a quiz" in the menu links to index.html#start ---------- */

function route() {
  if (window.location.hash === '#start') openDialog();
}
window.addEventListener('hashchange', route);
route();