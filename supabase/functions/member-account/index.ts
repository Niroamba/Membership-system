// supabase/functions/member-account/index.ts
//
// Deploy with: supabase functions deploy member-account
// Called from member-detail.html to create/reset a member's portal login.
// Runs server-side so it's safe to use the SERVICE_ROLE key here (never in
// the static frontend). Verifies the caller is an admin before doing anything.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function randomPassword(length = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization") || "";
  const callerClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user } } = await callerClient.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Not signed in." }), { status: 401 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: callerProfile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!callerProfile || callerProfile.role !== "admin") {
    return new Response(JSON.stringify({ error: "Admins only." }), { status: 403 });
  }

  const { member_id, member_code } = await req.json();
  if (!member_id || !member_code) {
    return new Response(JSON.stringify({ error: "member_id and member_code are required." }), { status: 400 });
  }

  const email = `${String(member_code).trim().toLowerCase().replace(/\s+/g, "-")}@portal.local`;
  const password = randomPassword();

  const { data: existingProfile } = await admin.from("profiles").select("id").eq("member_id", member_id).eq("role", "member").maybeSingle();

  if (existingProfile) {
    const { error } = await admin.auth.admin.updateUserById(existingProfile.id, { password });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    return new Response(JSON.stringify({ email, password, reset: true }));
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr) return new Response(JSON.stringify({ error: createErr.message }), { status: 500 });

  const { error: profileErr } = await admin
    .from("profiles")
    .update({ role: "member", member_id, username: member_code })
    .eq("id", created.user.id);
  if (profileErr) return new Response(JSON.stringify({ error: profileErr.message }), { status: 500 });

  return new Response(JSON.stringify({ email, password, reset: false }));
});
