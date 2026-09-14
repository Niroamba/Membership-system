// Renders the top header + nav bar into <div id="app-header"></div>.
// Call after requireAuth() succeeds so we know the role.

const ADMIN_NAV = [
  ["dashboard.html", "dashboard", "Dashboard"],
  ["members.html", "members", "Members"],
  ["payment-details.html", "payment-details", "Payment Details"],
  ["messaging.html", "messaging", "Messaging"],
  ["news.html", "news", "Announcements"],
  ["removed-members.html", "removed-members", "Removed"],
  ["settings.html", "settings", "Settings"],
];

async function renderHeader(activeKey, profile) {
  const el = document.getElementById("app-header");
  if (!el) return;

  const [societyName, logoUrl] = await Promise.all([getSocietyName(), getLogoUrl()]);
  document.title = document.title ? document.title : societyName;

  let navHtml = "";
  if (profile.role === "admin" || profile.role === "viewer") {
    navHtml = `<nav class="tabs">${ADMIN_NAV.map(
      ([href, key, label]) =>
        `<a href="${href}" class="${key === activeKey ? "active" : ""}">${label}</a>`
    ).join("")}</nav>`;
  }

  const staffTools =
    profile.role === "admin" || profile.role === "viewer"
      ? `<button class="btn small secondary" id="backup-now-btn" style="margin-right:6px;">Backup now</button>
         <button class="btn small secondary" id="font-smaller-btn" aria-label="Smaller text" style="padding:5px 9px;">A-</button>
         <button class="btn small secondary" id="font-larger-btn" aria-label="Larger text" style="padding:5px 9px;">A+</button>`
      : "";

  el.innerHTML = `
    <div class="eyebrow">Membership System</div>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;">
      <h1 style="margin:6px 0 10px;">${logoUrl ? `<img src="${logoUrl}" alt="">` : ""}${societyName}</h1>
      <div>${staffTools}</div>
    </div>
    ${navHtml}
    <div class="userline">Signed in as ${profile.username || profile.role} (${profile.role}) · <a href="#" id="sign-out-link">Sign out</a></div>
  `;
  document.getElementById("sign-out-link").addEventListener("click", (e) => {
    e.preventDefault();
    signOut();
  });

  if (document.getElementById("backup-now-btn")) {
    document.getElementById("backup-now-btn").addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.textContent = "Backing up…";
      try {
        await backupAllData();
      } catch (err) {
        flash("Backup failed: " + err.message, "error");
      }
      btn.disabled = false;
      btn.textContent = "Backup now";
    });
    applyFontScale();
    document.getElementById("font-smaller-btn").addEventListener("click", () => adjustFontScale(-0.1));
    document.getElementById("font-larger-btn").addEventListener("click", () => adjustFontScale(0.1));
  }
}

const FONT_SCALE_MIN = 0.85;
const FONT_SCALE_MAX = 1.4;

function applyFontScale() {
  const saved = parseFloat(localStorage.getItem("app_font_scale") || "1");
  document.documentElement.style.setProperty("--app-font-scale", saved);
}

function adjustFontScale(delta) {
  let current = parseFloat(localStorage.getItem("app_font_scale") || "1");
  current = Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, current + delta));
  localStorage.setItem("app_font_scale", current);
  document.documentElement.style.setProperty("--app-font-scale", current);
}

(function initFontScaleEarly() {
  const saved = parseFloat(localStorage.getItem("app_font_scale") || "1");
  document.documentElement.style.setProperty("--app-font-scale", saved);
})();

function flash(message, type = "success") {
  const holder = document.getElementById("flash-holder");
  if (!holder) {
    alert(message);
    return;
  }
  const div = document.createElement("div");
  div.className = `flash ${type}`;
  div.textContent = message;
  holder.innerHTML = "";
  holder.appendChild(div);
  holder.scrollIntoView({ behavior: "smooth", block: "start" });
}
