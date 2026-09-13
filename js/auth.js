// Shared auth helpers. Include after supabaseClient.js.

const PORTAL_EMAIL_DOMAIN = "portal.local";

function memberPortalEmail(memberCode) {
  return `${memberCode.trim().toLowerCase().replace(/\s+/g, "-")}@${PORTAL_EMAIL_DOMAIN}`;
}

async function getSession() {
  const { data } = await window.supabaseClient.auth.getSession();
  return data.session;
}

async function getMyProfile() {
  const session = await getSession();
  if (!session) return null;
  const { data, error } = await window.supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();
  if (error) {
    console.error("getMyProfile:", error);
    return null;
  }
  return data;
}

/**
 * Call at the top of every protected page.
 * requiredRole: "admin" | "member" | null (any signed-in user)
 * Returns the profile row, or redirects and returns null.
 */
async function requireAuth(requiredRole) {
  const session = await getSession();
  if (!session) {
    window.location.href = "login.html";
    return null;
  }
  const profile = await getMyProfile();
  if (!profile) {
    window.location.href = "login.html";
    return null;
  }
  if (requiredRole && profile.role !== requiredRole) {
    window.location.href = profile.role === "admin" ? "dashboard.html" : "my-payments.html";
    return null;
  }
  return profile;
}

async function signOut() {
  await window.supabaseClient.auth.signOut();
  window.location.href = "login.html";
}

async function getSocietyName() {
  const { data } = await window.supabaseClient
    .from("app_settings")
    .select("value")
    .eq("key", "society_name")
    .single();
  return data ? data.value : "Membership Manager";
}

async function getLogoUrl() {
  const { data } = await window.supabaseClient
    .from("app_settings")
    .select("value")
    .eq("key", "logo_url")
    .single();
  return data ? data.value : null;
}
