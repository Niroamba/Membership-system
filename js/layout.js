// Renders the left sidebar + slim topbar. Restructures the page's existing
// <header id="app-header"> and <div class="wrap"> into a sidebar shell via
// DOM manipulation, so individual pages don't need their HTML rewritten.
// Call after requireAuth() succeeds so we know the role.

const ADMIN_NAV = [
  ["dashboard.html", "dashboard", "Dashboard"],
  ["members.html", "members", "Members"],
  ["record-payment.html", "record-payment", "Record Payment"],
  ["payment-details.html", "payment-details", "Payment Details"],
  ["messaging.html", "messaging", "Messaging"],
  ["news.html", "news", "Announcements"],
  ["removed-members.html", "removed-members", "Removed"],
  ["settings.html", "settings", "Settings"],
];

async function renderHeader(activeKey, profile) {
  const sidebarEl = document.getElementById("app-header");
  const contentEl = document.querySelector(".wrap");
  if (!sidebarEl || !contentEl) return;

  const [societyName, logoUrl] = await Promise.all([getSocietyName(), getLogoUrl()]);
  document.title = document.title ? document.title : societyName;

  let shell = document.querySelector(".app-shell");
  if (!shell) {
    shell = document.createElement("div");
    shell.className = "app-shell";
    sidebarEl.parentNode.insertBefore(shell, sidebarEl);
    shell.appendChild(sidebarEl);
    shell.appendChild(contentEl);
  }
  sidebarEl.className = "app-sidebar";

  const isStaff = profile.role === "admin" || profile.role === "viewer";
  const navHtml = isStaff
    ? ADMIN_NAV.map(([href, key, label]) => `<a href="${href}" class="${key === activeKey ? "active" : ""}">${label}</a>`).join("")
    : `<a href="my-payments.html" class="active">My Payments</a>`;

  sidebarEl.innerHTML = `
    <div class="sidebar-brand">${logoUrl ? `<img src="${logoUrl}" alt="">` : "🌿"} <span>${societyName}</span></div>
    <nav class="sidebar-nav">${navHtml}</nav>
    <div class="sidebar-foot">
      Signed in as ${profile.username || profile.role} (${profile.role})<br>
      <a href="#" id="sign-out-link">Sign out</a>
    </div>
  `;

  let topbar = document.getElementById("app-topbar");
  if (!topbar) {
    topbar = document.createElement("div");
    topbar.id = "app-topbar";
    contentEl.insertBefore(topbar, contentEl.firstChild);
  }
  const staffTools = isStaff
    ? `<button class="btn small secondary" id="backup-now-btn">Backup now</button>
       <button class="btn small secondary" id="font-smaller-btn" aria-label="Smaller text">A-</button>
       <button class="btn small secondary" id="font-larger-btn" aria-label="Larger text">A+</button>`
    : "";
  topbar.innerHTML = `
    <button class="hamburger-btn" id="hamburger-btn" aria-label="Menu">☰</button>
    <div class="topbar-title">${document.title}</div>
    <div class="topbar-tools">${staffTools}</div>
  `;

  document.getElementById("sign-out-link").addEventListener("click", (e) => {
    e.preventDefault();
    signOut();
  });

  document.getElementById("hamburger-btn").addEventListener("click", () => {
    shell.classList.toggle("sidebar-open");
  });

  if (!document.querySelector(".sidebar-overlay")) {
    const overlay = document.createElement("div");
    overlay.className = "sidebar-overlay";
    overlay.addEventListener("click", () => shell.classList.remove("sidebar-open"));
    shell.appendChild(overlay);
  }

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
  document.body.style.zoom = saved;
}

function adjustFontScale(delta) {
  let current = parseFloat(localStorage.getItem("app_font_scale") || "1");
  current = Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, current + delta));
  localStorage.setItem("app_font_scale", current);
  document.body.style.zoom = current;
}

(function initFontScaleEarly() {
  document.addEventListener("DOMContentLoaded", () => {
    const saved = parseFloat(localStorage.getItem("app_font_scale") || "1");
    document.body.style.zoom = saved;
  });
})();

function flash(message, type = "success") {
  let stack = document.querySelector(".toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "toast-stack";
    document.body.appendChild(stack);
  }
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  stack.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("show"));

  const duration = type === "error" ? 6000 : 3500;
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 250);
  }, duration);
}
