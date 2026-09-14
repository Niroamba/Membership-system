// supabase/functions/create-login/index.ts
//
// Deploy with: supabase functions deploy create-login
// Matches the old desktop app's "Add New Login" dialog: an admin picks a
// username, password, and access level (admin or viewer) on the spot.
// Runs server-side because creating another user's account needs the
// service-role Admin API, which must never reach the browser.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MAX_VIEWERS = 3;

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization") || "";
  const callerClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user } } = await callerClient.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "Not signed in." }), { status: 401 });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: callerProfile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!callerProfile || callerProfile.role !== "admin") {
    return new Response(JSON.stringify({ error: "Admins only." }), { status: 403 });
  }

  const { username, password, role } = await req.json();
  if (!username || !password || !["admin", "viewer"].includes(role)) {
    return new Response(JSON.stringify({ error: "username, password, and role ('admin' or 'viewer') are required." }), { status: 400 });
  }
  if (password.length < 6) {
    return new Response(JSON.stringify({ error: "Password must be at least 6 characters." }), { status: 400 });
  }

  if (role === "viewer") {
    const { count } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "viewer");
    if ((count || 0) >= MAX_VIEWERS) {
      return new Response(JSON.stringify({ error: `Maximum of ${MAX_VIEWERS} viewer accounts already exist. Delete one first.` }), { status: 400 });
    }
  }

  const email = `${String(username).trim().toLowerCase().replace(/\s+/g, "-")}@staff.local`;

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr) return new Response(JSON.stringify({ error: createErr.message }), { status: 500 });

  const { error: profileErr } = await admin
    .from("profiles")
    .update({ role, username })
    .eq("id", created.user.id);
  if (profileErr) return new Response(JSON.stringify({ error: profileErr.message }), { status: 500 });

  return new Response(JSON.stringify({ email, username, role }));
});
