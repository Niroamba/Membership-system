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
 * requiredRole: "admin" | "viewer" | "member" | "admin_or_viewer" | null (any signed-in user)
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
  const staffPage = requiredRole === "admin_or_viewer";
  const roleOk = staffPage
    ? profile.role === "admin" || profile.role === "viewer"
    : !requiredRole || profile.role === requiredRole;
  if (!roleOk) {
    window.location.href = profile.role === "member" ? "my-payments.html" : "dashboard.html";
    return null;
  }
  return profile;
}

/**
 * Hides/disables every element carrying data-admin-only on a page, and
 * shows a "view only" banner, when the signed-in user is a viewer rather
 * than an admin. Call after requireAuth("admin_or_viewer") resolves.
 */
function applyViewerRestrictions(profile) {
  if (profile.role !== "viewer") return;
  document.querySelectorAll("[data-admin-only]").forEach((el) => {
    if (el.tagName === "INPUT" || el.tagName === "BUTTON" || el.tagName === "SELECT" || el.tagName === "TEXTAREA") {
      el.disabled = true;
    } else {
      el.style.display = "none";
    }
  });
  const banner = document.createElement("div");
  banner.className = "flash error";
  banner.textContent = "View-only account — changes are disabled.";
  const holder = document.getElementById("flash-holder");
  if (holder) holder.prepend(banner);
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
