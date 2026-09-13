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
  if (profile.role === "admin") {
    navHtml = `<nav class="tabs">${ADMIN_NAV.map(
      ([href, key, label]) =>
        `<a href="${href}" class="${key === activeKey ? "active" : ""}">${label}</a>`
    ).join("")}</nav>`;
  }

  el.innerHTML = `
    <div class="eyebrow">Membership System</div>
    <h1>${logoUrl ? `<img src="${logoUrl}" alt="">` : ""}${societyName}</h1>
    ${navHtml}
    <div class="userline">Signed in as ${profile.username || profile.role} · <a href="#" id="sign-out-link">Sign out</a></div>
  `;
  document.getElementById("sign-out-link").addEventListener("click", (e) => {
    e.preventDefault();
    signOut();
  });
}

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
