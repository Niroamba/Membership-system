// Central place for every Supabase query. Pages call these instead of
// hitting supabaseClient directly, so the query logic only exists once.

const sb = () => window.supabaseClient;

function money(n) {
  return Number(n || 0).toFixed(2);
}

function withPaidBalance(charge) {
  const paid = (charge.payments || []).reduce((s, p) => s + Number(p.amount), 0);
  return { ...charge, paid, balance: Number(charge.total_amount) - paid };
}

// ---------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------

async function getAllMembers() {
  const { data, error } = await sb().from("members").select("*").order("name");
  if (error) throw error;
  return data;
}

async function searchMembers(q) {
  const { data, error } = await sb()
    .from("members")
    .select("*")
    .or(`name.ilike.%${q}%,member_code.ilike.%${q}%`)
    .order("name");
  if (error) throw error;
  return data;
}

async function getMember(id) {
  const { data, error } = await sb().from("members").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

async function addMember(fields) {
  const { data, error } = await sb().from("members").insert(fields).select().single();
  if (error) throw error;
  return data;
}

async function updateMember(id, fields) {
  const { error } = await sb().from("members").update(fields).eq("id", id);
  if (error) throw error;
}

async function deleteMemberAndArchive(member, reason, removedBy) {
  const { error: e1 } = await sb().from("removed_members").insert({
    member_code: member.member_code,
    name: member.name,
    phone_number: member.phone_number,
    reason,
    removed_by: removedBy,
  });
  if (e1) throw e1;
  const { error: e2 } = await sb().from("members").delete().eq("id", member.id);
  if (e2) throw e2;
}

async function getRemovedMembers() {
  const { data, error } = await sb().from("removed_members").select("*").order("removed_on", { ascending: false });
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------
// Charges & payments
// ---------------------------------------------------------------------

async function getChargesForMember(memberId) {
  const { data, error } = await sb()
    .from("charges")
    .select("*, payments(*)")
    .eq("member_id", memberId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((c) => {
    const withBalance = withPaidBalance(c);
    withBalance.payments = (c.payments || []).sort((a, b) => a.installment_no - b.installment_no);
    return withBalance;
  });
}

async function getChargeForMemberCategoryYear(memberId, description, year) {
  let query = sb().from("charges").select("*, payments(*)").eq("member_id", memberId).eq("description", description);
  query = year ? query.eq("year", year) : query.is("year", null);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(1);
  if (error) throw error;
  return data && data.length ? withPaidBalance(data[0]) : null;
}

async function addCharge(memberId, description, year, totalAmount) {
  const { data, error } = await sb()
    .from("charges")
    .insert({ member_id: memberId, description, year, total_amount: totalAmount })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteCharge(chargeId) {
  const { error } = await sb().from("charges").delete().eq("id", chargeId);
  if (error) throw error;
}

async function addPayment(chargeId, amount, paidDate, receiptBookNo, receiptNo) {
  const { count, error: countErr } = await sb()
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("charge_id", chargeId);
  if (countErr) throw countErr;
  const { error } = await sb().from("payments").insert({
    charge_id: chargeId,
    installment_no: (count || 0) + 1,
    amount,
    paid_date: paidDate,
    receipt_book_no: receiptBookNo || null,
    receipt_no: receiptNo || null,
  });
  if (error) throw error;
}

async function deletePayment(paymentId) {
  const { error } = await sb().from("payments").delete().eq("id", paymentId);
  if (error) throw error;
}

async function getChargesByCategory(category, year) {
  let query = sb().from("charges").select("*, members(*), payments(*)").eq("description", category);
  if (year) query = query.eq("year", year);
  const { data, error } = await query;
  if (error) throw error;
  return data.map((c) => {
    const paid = (c.payments || []).reduce((s, p) => s + Number(p.amount), 0);
    const lastPayment = (c.payments || []).sort((a, b) => (a.paid_date < b.paid_date ? 1 : -1))[0];
    return {
      member_id: c.members.id,
      member_code: c.members.member_code,
      member_name: c.members.name,
      total_amount: c.total_amount,
      paid,
      balance: Number(c.total_amount) - paid,
      last_payment_date: lastPayment ? lastPayment.paid_date : null,
    };
  });
}

async function listYearsForCategory(category) {
  const { data, error } = await sb().from("charges").select("year").eq("description", category);
  if (error) throw error;
  const years = [...new Set(data.map((r) => r.year).filter(Boolean))];
  return years.sort((a, b) => b - a);
}

// ---------------------------------------------------------------------
// Totals / dashboard aggregation
// ---------------------------------------------------------------------

async function getAllMembersWithTotals() {
  const [members, charges] = await Promise.all([
    getAllMembers(),
    sb().from("charges").select("member_id, total_amount, payments(amount)").then(({ data, error }) => {
      if (error) throw error;
      return data;
    }),
  ]);
  const byMember = {};
  charges.forEach((c) => {
    const paid = (c.payments || []).reduce((s, p) => s + Number(p.amount), 0);
    if (!byMember[c.member_id]) byMember[c.member_id] = { charged: 0, paid: 0 };
    byMember[c.member_id].charged += Number(c.total_amount);
    byMember[c.member_id].paid += paid;
  });
  return members.map((m) => {
    const t = byMember[m.id] || { charged: 0, paid: 0 };
    return { ...m, total_charged: t.charged, total_paid: t.paid, balance: t.charged - t.paid };
  });
}

function summarizeTotals(membersWithTotals) {
  return membersWithTotals.reduce(
    (acc, m) => ({
      total_members: acc.total_members + 1,
      total_expected: acc.total_expected + m.total_charged,
      total_collected: acc.total_collected + m.total_paid,
      total_outstanding: acc.total_outstanding + m.balance,
    }),
    { total_members: 0, total_expected: 0, total_collected: 0, total_outstanding: 0 }
  );
}

// ---------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------

async function listCategories() {
  const { data, error } = await sb().from("categories").select("*").order("name");
  if (error) throw error;
  return data;
}

async function addOrUpdateCategory(name, defaultAmount) {
  const { error } = await sb()
    .from("categories")
    .upsert({ name, default_amount: defaultAmount }, { onConflict: "name" });
  if (error) throw error;
}

async function deleteCategory(name) {
  const { error } = await sb().from("categories").delete().eq("name", name);
  if (error) throw error;
}

async function setCategoryYearAmount(name, year, amount) {
  const { error } = await sb()
    .from("category_year_amounts")
    .upsert({ name, year, amount }, { onConflict: "name,year" });
  if (error) throw error;
}

async function getEffectiveCategoryAmount(name, year) {
  const { data: yearRow } = await sb()
    .from("category_year_amounts")
    .select("amount")
    .eq("name", name)
    .eq("year", year)
    .maybeSingle();
  if (yearRow) return yearRow.amount;
  const { data: catRow } = await sb().from("categories").select("default_amount").eq("name", name).maybeSingle();
  return catRow ? catRow.default_amount : null;
}

// ---------------------------------------------------------------------
// News / announcements
// ---------------------------------------------------------------------

async function getAllNews() {
  const { data, error } = await sb().from("news").select("*").order("posted_on", { ascending: false });
  if (error) throw error;
  return data;
}

async function getNews(id) {
  const { data, error } = await sb().from("news").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

async function addNews(title, content, postedBy) {
  const { error } = await sb().from("news").insert({ title, content, posted_by: postedBy });
  if (error) throw error;
}

async function updateNews(id, title, content) {
  const { error } = await sb().from("news").update({ title, content }).eq("id", id);
  if (error) throw error;
}

async function deleteNews(id) {
  const { error } = await sb().from("news").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Membership duration (client-side port of the desktop app's calc)
// ---------------------------------------------------------------------

function computeMembershipDuration(joinedDateStr) {
  if (!joinedDateStr) return "—";
  const joined = new Date(joinedDateStr + "T00:00:00");
  if (isNaN(joined.getTime())) return "—";
  const today = new Date();
  if (joined > today) return "—";
  let monthsTotal = (today.getFullYear() - joined.getFullYear()) * 12 + (today.getMonth() - joined.getMonth());
  if (today.getDate() < joined.getDate()) monthsTotal -= 1;
  if (monthsTotal < 0) monthsTotal = 0;
  const years = Math.floor(monthsTotal / 12);
  const months = monthsTotal % 12;
  if (years === 0 && months === 0) return "< 1 mo";
  const parts = [];
  if (years) parts.push(`${years} yr${years !== 1 ? "s" : ""}`);
  if (months) parts.push(`${months} mo${months !== 1 ? "s" : ""}`);
  return parts.join(" ");
}

// ---------------------------------------------------------------------
// Backup — downloads every table as one JSON file (the web equivalent of
// the old desktop app's "Backup Now" button copying decors.db)
// ---------------------------------------------------------------------

async function backupAllData() {
  const tables = ["members", "categories", "category_year_amounts", "charges", "payments", "news", "removed_members", "app_settings"];
  const backup = { created_at: new Date().toISOString(), tables: {} };
  for (const t of tables) {
    const { data, error } = await sb().from(t).select("*");
    if (error) throw error;
    backup.tables[t] = data;
  }
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  a.href = url;
  a.download = `decors_backup_${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function setSetting(key, value) {
  const { error } = await sb().from("app_settings").upsert({ key, value }, { onConflict: "key" });
  if (error) throw error;
}

async function listAdminProfiles() {
  const { data, error } = await sb().from("profiles").select("id, username, role").eq("role", "admin");
  if (error) throw error;
  return data;
}
