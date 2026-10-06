const courseId = Number(sessionStorage.getItem('courseId'));
if (!courseId) {
  window.location.replace('start.html');
}

const GUARD_MESSAGE = 'Leave this quiz? Your answers so far will be lost.';

const el = {
  course: document.getElementById('course-name'),
  counter: document.getElementById('counter'),
  progress: document.getElementById('progress'),
  timerBar: document.getElementById('timer-bar'),
  timerText: document.getElementById('timer-text'),
  question: document.getElementById('question'),
  options: document.getElementById('options'),
  notice: document.getElementById('notice'),
  error: document.getElementById('error'),
  retry: document.getElementById('retry'),
  back: document.getElementById('back')
};

let questions = [];
let answers = [];
let index = 0;
let deadline = 0;
let timerId = null;
let locked = false;
let finished = false;

el.course.innerHTML = '';
const strong = document.createElement('strong');
strong.textContent = sessionStorage.getItem('courseName') || 'Quiz';
el.course.appendChild(strong);

function showError(text, canRetry) {
  el.error.textContent = text;
  el.error.hidden = false;
  el.back.hidden = false;
  el.retry.hidden = !canRetry;
}

async function start() {
  el.error.hidden = true;
  el.retry.hidden = true;
  el.back.hidden = true;

  try {
    questions = await API.rpc('get_quiz_questions', { p_course_id: courseId });
  } catch (err) {
    el.question.textContent = '';
    showError('Could not load the questions. Please check your connection.', false);
    return;
  }

  if (!questions.length) {
    el.question.textContent = '';
    showError('This subject has no questions yet. Please choose another subject.', false);
    return;
  }

  answers = [];
  window.Nav.guard = GUARD_MESSAGE;   // the menu now asks before leaving
  showQuestion(0);
}

function showQuestion(i) {
  index = i;
  locked = false;
  const q = questions[i];

  el.counter.textContent = 'Question ' + (i + 1) + ' of ' + questions.length;
  el.progress.style.width = (i / questions.length) * 100 + '%';
  el.question.textContent = q.question_text;
  el.notice.textContent = '';
  el.options.innerHTML = '';

  [['A', q.option_a], ['B', q.option_b], ['C', q.option_c], ['D', q.option_d]].forEach(function (pair) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'option';
    btn.dataset.letter = pair[0];

    const letter = document.createElement('span');
    letter.className = 'letter';
    letter.textContent = pair[0];

    const text = document.createElement('span');
    text.textContent = pair[1];

    btn.appendChild(letter);
    btn.appendChild(text);
    btn.addEventListener('click', function () { record(pair[0], btn); });
    el.options.appendChild(btn);
  });

  deadline = Date.now() + QUESTION_SECONDS * 1000;
  clearInterval(timerId);
  timerId = setInterval(tick, 100);
  tick();
}

function tick() {
  const remaining = Math.max(0, deadline - Date.now());
  const seconds = Math.ceil(remaining / 1000);
  const danger = seconds <= 10;

  el.timerText.textContent = seconds + 's';
  el.timerText.classList.toggle('danger', danger);
  el.timerBar.classList.toggle('danger', danger);
  el.timerBar.style.width = (remaining / (QUESTION_SECONDS * 1000)) * 100 + '%';

  if (remaining === 0) record(null, null);
}

function record(letter, button) {
  if (locked || finished) return;
  locked = true;
  clearInterval(timerId);

  answers.push({ question_id: questions[index].id, answer: letter });

  document.querySelectorAll('.option').forEach(function (b) { b.disabled = true; });
  if (button) button.classList.add('selected');
  if (!letter) el.notice.textContent = "Time's up. Moving on…";

  setTimeout(next, letter ? 350 : 900);
}

function next() {
  if (index + 1 < questions.length) {
    showQuestion(index + 1);
  } else {
    finish();
  }
}

function rememberResult(result) {
  try {
    sessionStorage.setItem('result', JSON.stringify(result));
  } catch (e) { /* storage unavailable */ }
}

async function finish() {
  finished = true;
  window.Nav.guard = null;

  el.progress.style.width = '100%';
  el.timerBar.style.width = '0%';
  el.timerText.textContent = '';
  el.counter.textContent = 'Done';
  el.question.textContent = 'Marking your answers…';
  el.options.innerHTML = '';
  el.notice.textContent = '';
  el.error.hidden = true;
  el.retry.hidden = true;

  try {
    const result = await API.rpc('submit_quiz', {
      p_course_id: courseId,
      p_answers: answers
    });
    rememberResult(result);
    window.location.replace('result.html');
  } catch (err) {
    // Answers stay in memory, so a retry does not lose them
    showError('Could not submit your answers. Check your connection and try again.', true);
  }
}

el.retry.addEventListener('click', finish);

/* keyboard: A-D or 1-4 pick an answer */
document.addEventListener('keydown', function (e) {
  if (locked || finished || !questions.length) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const map = { a: 'A', b: 'B', c: 'C', d: 'D', '1': 'A', '2': 'B', '3': 'C', '4': 'D' };
  const letter = map[e.key.toLowerCase()];
  if (!letter) return;
  const btn = el.options.querySelector('[data-letter="' + letter + '"]');
  if (btn) record(letter, btn);
});

/* closing the tab or pressing Back mid-quiz */
window.addEventListener('beforeunload', function (e) {
  if (window.Nav.guard) {
    e.preventDefault();
    e.returnValue = '';
  }
});

if (courseId) start();