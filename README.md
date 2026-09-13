# Membership Management System — Supabase + GitHub Pages Edition

This is the version built the way the original development plan described:
**Supabase** for the database, authentication, and file storage; a plain
static **HTML/CSS/JS** front end (no build step); hosted for free on
**GitHub Pages**; installable to a phone home screen as a PWA.

There is no server to run and no Python involved — everything lives in
your Supabase project and in this folder of static files.

## What's here vs. the Flask version

Same facilities as before (members, categories, charges/installments,
member portal, announcements, removed-members archive, Word exports,
branding, multiple admins). Two things work differently because there's
no server process to keep secrets on:

- **Login** uses email + password (Supabase's built-in auth) instead of
  custom usernames. The very first person to sign up automatically
  becomes the admin. Members log in the same way — with an internal
  auto-generated email like `m0001@portal.local`, so they never need a
  real inbox.
- **SMS and creating a member's login** need a tiny bit of server-side
  code (a Supabase **Edge Function**) because they touch a secret (your
  Twilio token, or the admin API key) that must never sit in a public
  static file. Everything else works the moment you deploy the site —
  these two are an optional "Phase 2" you can add later.

---

## Phase 1 — Core system (30–45 minutes, no coding)

### 1. Create your Supabase project
Go to [supabase.com](https://supabase.com) → sign up (free) → "New project".
Pick a name, a database password (save it somewhere), and a region close
to your members. Wait a minute or two for it to finish provisioning.

### 2. Run the database schema
In your project, go to **SQL Editor → New query**. Open `supabase/schema.sql`
from this folder, copy all of it, paste it in, and click **Run**. This
creates every table, the admin/member permission rules, and a starter
"Membership Fee" category.

### 3. Create the logo storage bucket (optional but easy)
Go to **Storage → New bucket**. Name it exactly `branding`, toggle
**Public bucket** on, and create it. Then go back to **SQL Editor**, paste
in `supabase/storage_policies.sql`, and run it. (If you skip this, the
Settings page's "Save Branding" for the name still works — only the logo
upload needs the bucket.)

### 4. Get your API keys
**Project Settings → API**. Copy the **Project URL** and the
**anon public** key.

### 5. Fill in `config.js`
Open `config.js` in this folder and paste your Project URL and anon key
into the two placeholders. This file is meant to be public — the anon key
is safe to publish because the RLS rules from step 2 are what actually
protect your data, not secrecy of this key.

### 6. Put it on GitHub Pages
1. Create a new **public** GitHub repository (Pages' free tier needs
   public, unless you have GitHub Pro/Team for private Pages).
2. Upload every file in this folder to the repo (drag-and-drop on
   github.com works fine, or `git push` if you're comfortable with git).
3. Repo → **Settings → Pages** → Source: "Deploy from a branch" → Branch:
   `main`, folder `/ (root)` → Save.
4. GitHub gives you a URL like `https://yourname.github.io/repo-name/` —
   that's your live site, usually ready within a minute.

### 7. Create your first admin account
Open your new site's `login.html` page → "First time here? Create an
account" → sign up with your real email and a password. You're now the
admin (the schema's trigger makes the very first signup an admin
automatically). Sign in and you'll land on the Dashboard.

**That's the whole core system working** — members, charges, payments,
categories, announcements, removed-members archive, Word exports,
branding, and a member self-service portal (once you invite members —
see below) are all live at that URL right now.

---

## Adding members and their portal login (without Phase 2 yet)

You can add and manage members, charges and payments immediately. For a
member's *own* login before you set up Phase 2, have them sign up
themselves on `login.html` with their own email, then in Supabase go to
**Table Editor → profiles**, find their row, and set `member_id` to their
row's id in the `members` table. Phase 2 below automates this into one
click from the Member page.

---

## Phase 2 — Optional: one-click member logins + SMS

These need the **Supabase CLI** (a small command-line tool) because Edge
Functions are deployed from your computer, not pasted into a text box.

### 1. Install the CLI and log in
```bash
npm install -g supabase
supabase login
```

### 2. Link this folder to your project
```bash
cd supabase_web
supabase link --project-ref YOUR-PROJECT-REF
```
(Your project ref is the random string in your Project URL, e.g. `abcdxyz`
from `https://abcdxyz.supabase.co`.)

### 3. Deploy the member-account function
```bash
supabase functions deploy member-account
```
No extra secrets needed — it uses Supabase's own built-in service key.
Once deployed, "Create Portal Login" on any member's page works instantly.

### 4. Deploy SMS (only if you want it)
```bash
supabase functions deploy send-sms
supabase secrets set TWILIO_ACCOUNT_SID=your_sid TWILIO_AUTH_TOKEN=your_token TWILIO_FROM_NUMBER=+1XXXXXXXXXX DEFAULT_COUNTRY_CODE=+94
```
Get the Twilio values from [console.twilio.com](https://console.twilio.com)
after creating a free account. `DEFAULT_COUNTRY_CODE` is prepended to any
phone number that doesn't already start with `+` (e.g. `+94` for Sri
Lanka, `+1` for US/Canada, `+91` for India, `+44` for UK).

That's it — the Messaging page's "Send" and "Send to All" buttons will
start working.

---

## Adding a second admin

Have them sign up on `login.html` with their own email (they'll land as a
plain member account). Then in Supabase, **Table Editor → profiles**,
find their row by matching their user id (Authentication → Users shows
emails next to ids), and change their `role` from `member` to `admin`.
(Settings page has a placeholder for a one-click version of this, which a
small Edge Function can wire up later if you want it.)

## Costs

- Supabase free tier: generous enough for a single-society system
  (500MB database, 1GB file storage, 2 free Edge Function projects,
  50,000 monthly active users for auth).
- GitHub Pages: free for public repos.
- Twilio: pay-per-SMS, only if you turn on Phase 2 messaging.
- A custom domain is optional and has its own small annual cost.

## Files in this folder

| Path | What it is |
|---|---|
| `*.html` | One static page per screen — open in any browser, no build step |
| `js/data.js` | Every Supabase database query, in one place |
| `js/auth.js`, `js/layout.js` | Session/role checks and the shared header |
| `js/reports.js` | Generates the Word exports entirely in the browser |
| `config.js` | Your Supabase URL + anon key (fill in during setup) |
| `supabase/schema.sql` | The whole database structure + security rules |
| `supabase/storage_policies.sql` | Optional logo-bucket permissions |
| `supabase/functions/` | The two optional Phase 2 Edge Functions |
| `manifest.webmanifest`, `service-worker.js` | Makes it installable as an app |
