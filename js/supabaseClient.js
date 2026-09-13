// Loaded after config.js and the Supabase CDN script on every page.
window.supabaseClient = window.supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_ANON_KEY
);
