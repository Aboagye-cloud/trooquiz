(function () {
  var data = null;

  // The result from this visit
  try {
    var raw = sessionStorage.getItem('result');
    if (raw) {
      data = {
        result: JSON.parse(raw),
        courseId: sessionStorage.getItem('courseId'),
        course: sessionStorage.getItem('courseName') || '',
        level: sessionStorage.getItem('levelName') || ''
      };
    }
  } catch (e) { /* ignore */ }

  if (!data) {
    window.location.replace('start.html');
    return;
  }

  var r = data.result;
  var pct = Math.max(0, Math.min(100, Number(r.score)));
  var label = [data.level, data.course].filter(Boolean).join(' · ');

  document.getElementById('course').textContent = label;

  var badge = document.getElementById('badge');
  badge.textContent = r.passed ? 'PASS' : 'FAIL';
  badge.classList.add(r.passed ? 'pass' : 'fail');

  var ring = document.getElementById('ring');
  ring.classList.add(r.passed ? 'pass' : 'fail');
  ring.setAttribute('aria-label', 'Score ' + pct.toFixed(1) + ' percent');

  document.getElementById('detail').textContent =
    r.correct + ' out of ' + r.total + ' correct. Pass mark: 50%.';
  document.getElementById('message').textContent = r.passed
    ? 'Well done, you passed this quiz.'
    : 'You did not reach the 50% pass mark. Review the subject and try again.';

  /* ring and count-up */
  var CIRC = 326.73;
  var fg = document.getElementById('ring-fg');
  var scoreEl = document.getElementById('score');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function paint(value) {
    scoreEl.textContent = value.toFixed(1) + '%';
    fg.style.strokeDashoffset = String(CIRC * (1 - value / 100));
  }

  if (reduce || pct === 0) {
    paint(pct);
  } else {
    var start = null;
    var DURATION = 900;
    (function step(ts) {
      if (start === null) start = ts;
      var t = Math.min(1, (ts - start) / DURATION);
      var eased = 1 - Math.pow(1 - t, 3);
      paint(pct * eased);
      if (t < 1) requestAnimationFrame(step);
    })(performance.now());
  }

  /* retake: restore the subject if this result came from an earlier visit */
  var retake = document.getElementById('retake');
  if (!data.courseId) retake.href = 'start.html';
  retake.addEventListener('click', function () {
    if (!data.courseId) return;
    try {
      sessionStorage.setItem('courseId', data.courseId);
      sessionStorage.setItem('courseName', data.course);
      sessionStorage.setItem('levelName', data.level);
      sessionStorage.removeItem('result');
    } catch (e) { /* ignore */ }
  });

  /* share */
  var shareBtn = document.getElementById('share');
  var text = 'I scored ' + pct.toFixed(1) + '% in ' + (data.course || 'a quiz') + ' on Trooquiz (' +
    (r.passed ? 'pass' : 'fail') + ').';

  shareBtn.addEventListener('click', function () {
    if (navigator.share) {
      navigator.share({ title: 'Trooquiz result', text: text, url: window.location.origin + window.location.pathname.replace('result.html', 'index.html') })
        .catch(function () { /* cancelled */ });
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function () {
        shareBtn.textContent = 'Copied to clipboard';
        setTimeout(function () { shareBtn.textContent = 'Share result'; }, 2200);
      });
    } else {
      shareBtn.hidden = true;
    }
  });
})();