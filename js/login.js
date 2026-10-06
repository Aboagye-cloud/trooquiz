// Admin sign-in.
// The session is kept only in this browser tab (sessionStorage), and this page never signs
// anyone in automatically: the email and password must be typed in every time.
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storage: window.sessionStorage }
});

const form = document.getElementById('login-form');
const msg = document.getElementById('msg');
const loginBtn = document.getElementById('login-btn');

function showMsg(text) {
  msg.textContent = text;
  msg.hidden = false;
}

// Arriving on this page always starts signed out (this tab only, other devices are not affected)
const cleared = sb.auth.signOut({ scope: 'local' });

if (new URLSearchParams(window.location.search).get('denied')) {
  showMsg('That account is not an admin.');
}

// Coming back with the browser's Back button should not leave old typing in the form
window.addEventListener('pageshow', function (e) {
  if (e.persisted) form.reset();
});

form.addEventListener('submit', async function (e) {
  e.preventDefault();
  msg.hidden = true;
  loginBtn.disabled = true;

  await cleared;

  const { error } = await sb.auth.signInWithPassword({
    email: document.getElementById('email').value.trim(),
    password: document.getElementById('password').value
  });

  if (error) {
    showMsg('Wrong email or password.');
    loginBtn.disabled = false;
    return;
  }

  const { data: isAdmin } = await sb.rpc('is_admin');
  if (!isAdmin) {
    await sb.auth.signOut({ scope: 'local' });
    showMsg('That account is not an admin.');
    loginBtn.disabled = false;
    return;
  }

  window.location.replace('dashboard.html');
});