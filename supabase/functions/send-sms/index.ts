// supabase/functions/send-sms/index.ts
//
// Deploy with: supabase functions deploy send-sms
// Then set secrets:
//   supabase secrets set TWILIO_ACCOUNT_SID=xxx TWILIO_AUTH_TOKEN=xxx TWILIO_FROM_NUMBER=+1XXXXXXXXXX DEFAULT_COUNTRY_CODE=+94
//
// Called from messaging.html. Verifies the caller is an admin, then relays
// the message to Twilio's REST API. The Twilio auth token never reaches
// the browser because this function runs on Supabase's servers.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;
const TWILIO_FROM_NUMBER = Deno.env.get("TWILIO_FROM_NUMBER")!;
const DEFAULT_COUNTRY_CODE = Deno.env.get("DEFAULT_COUNTRY_CODE") || "+1";

function normalizePhone(raw: string) {
  const trimmed = raw.trim();
  if (trimmed.startsWith("+")) return trimmed;
  return DEFAULT_COUNTRY_CODE + trimmed.replace(/^0+/, "");
}

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

  const { to, message } = await req.json();
  if (!to || !message) {
    return new Response(JSON.stringify({ error: "to and message are required." }), { status: 400 });
  }

  const body = new URLSearchParams({
    To: normalizePhone(to),
    From: TWILIO_FROM_NUMBER,
    Body: message,
  });

  const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const result = await resp.json();
  if (!resp.ok) {
    return new Response(JSON.stringify({ error: result.message || "Twilio request failed." }), { status: 502 });
  }
  return new Response(JSON.stringify({ sid: result.sid }));
});
