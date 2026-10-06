// Supabase connection details.
// The anon / publishable key is designed to be public, so it is safe in GitHub.
// NEVER put the database password or the service_role (secret) key here.
const SUPABASE_URL = 'https://wozsquhnjsuoavionfzn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_-D6V9VuZ3BfDYzhsuaVgWw_wQPifWk7';

// Quiz rules (the database also enforces 15 questions and the 50% pass mark)
const QUESTION_SECONDS = 60;