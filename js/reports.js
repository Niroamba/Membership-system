// Generates the same Word reports the old desktop/Flask app produced,
// entirely in the browser (no server) using the docx.js library loaded
// via CDN in each page's <head>. See docx.js.org for the API.

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function headingRow(cells) {
  const { TableRow, TableCell, Paragraph, TextRun } = docx;
  return new TableRow({
    children: cells.map(
      (text) =>
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })],
        })
    ),
  });
}

function dataRow(cells) {
  const { TableRow, TableCell, Paragraph } = docx;
  return new TableRow({
    children: cells.map((text) => new TableCell({ children: [new Paragraph(String(text ?? ""))] })),
  });
}

async function saveDoc(doc, filename) {
  const blob = await docx.Packer.toBlob(doc);
  downloadBlob(blob, filename);
}

async function exportAllMembersReport(societyName, members) {
  const { Document, Paragraph, HeadingLevel, Table, TextRun } = docx;
  const rows = [headingRow(["Member ID", "Name", "Joined date", "Phone", "Address", "Remarks", "Membership duration"])];
  members.forEach((m) => {
    rows.push(
      dataRow([
        m.member_code,
        m.name,
        m.joined_date || "",
        m.phone_number || "",
        m.address || "",
        m.remarks || "-",
        computeMembershipDuration(m.joined_date),
      ])
    );
  });
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: societyName, heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ text: "All Members", heading: HeadingLevel.HEADING_2 }),
          new Paragraph({ children: [new TextRun({ text: `Generated on ${new Date().toISOString().slice(0, 10)}`, italics: true })] }),
          new Paragraph(""),
          new Table({ rows }),
        ],
      },
    ],
  });
  await saveDoc(doc, "All_Members_Report.docx");
}

async function exportMemberStatement(societyName, member, charges) {
  const { Document, Paragraph, HeadingLevel, Table, TextRun } = docx;
  const children = [
    new Paragraph({ text: societyName, heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ text: "Payment Statement", heading: HeadingLevel.HEADING_2 }),
    new Paragraph({
      children: [
        new TextRun({
          text: `${member.name} (${member.member_code}) — Generated ${new Date().toISOString().slice(0, 10)}`,
          italics: true,
        }),
      ],
    }),
    new Paragraph(""),
  ];

  if (charges.length === 0) {
    children.push(new Paragraph("No payments recorded yet."));
  }

  charges.forEach((c) => {
    children.push(new Paragraph({ text: `${c.description} (${c.year || ""})`, heading: HeadingLevel.HEADING_3 }));
    children.push(
      new Paragraph(
        `Total: ${money(c.total_amount)}   Paid: ${money(c.paid)}   Balance: ${money(c.balance)}`
      )
    );
    if (c.payments && c.payments.length) {
      const rows = [headingRow(["Installment", "Amount", "Paid Date"])];
      c.payments.forEach((p) => rows.push(dataRow([p.installment_no, money(p.amount), p.paid_date])));
      children.push(new Table({ rows }));
    } else {
      children.push(new Paragraph("No payments recorded yet."));
    }
    children.push(new Paragraph(""));
  });

  const doc = new Document({ sections: [{ children }] });
  await saveDoc(doc, `${member.member_code}_Statement.docx`);
}

async function exportCategoryReport(societyName, category, year, rows, statusLabel) {
  const { Document, Paragraph, HeadingLevel, Table } = docx;
  const totalCharged = rows.reduce((s, r) => s + Number(r.total_amount || 0), 0);
  const totalPaid = rows.reduce((s, r) => s + Number(r.paid || 0), 0);
  const suffix = statusLabel && statusLabel !== "Total" ? ` (${statusLabel})` : "";

  const tableRows = [headingRow(["Member ID", "Name", "Total", "Paid", "Balance", "Status", "Last Payment"])];
  rows.forEach((r) => {
    tableRows.push(
      dataRow([
        r.member_code,
        r.member_name,
        money(r.total_amount),
        money(r.paid),
        money(r.balance),
        r.balance <= 0 ? "Fully Paid" : "Outstanding",
        r.last_payment_date || "",
      ])
    );
  });

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: societyName, heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ text: `${category}${year ? " " + year : ""} — Payment Report${suffix}`, heading: HeadingLevel.HEADING_2 }),
          new Paragraph(`Generated on ${new Date().toISOString().slice(0, 10)}`),
          new Paragraph(
            `Members: ${rows.length}   Total Charged: ${money(totalCharged)}   Total Collected: ${money(totalPaid)}   Outstanding: ${money(totalCharged - totalPaid)}`
          ),
          new Paragraph(""),
          new Table({ rows: tableRows }),
        ],
      },
    ],
  });
  const statusFile = statusLabel && statusLabel !== "Total" ? `_${statusLabel.replace(/\s+/g, "")}` : "";
  await saveDoc(doc, `${category.replace(/\s+/g, "_")}${year ? "_" + year : ""}${statusFile}_Report.docx`);
}

async function exportRemovedMembersReport(societyName, rows) {
  const { Document, Paragraph, HeadingLevel, Table } = docx;
  const tableRows = [headingRow(["Member ID", "Name", "Phone", "Reason", "Removed On", "Removed By"])];
  rows.forEach((r) => {
    tableRows.push(
      dataRow([r.member_code, r.name, r.phone_number || "", r.reason || "", (r.removed_on || "").slice(0, 10), r.removed_by || ""])
    );
  });
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: societyName, heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ text: "Records of Removed Members", heading: HeadingLevel.HEADING_2 }),
          new Paragraph(`Generated on ${new Date().toISOString().slice(0, 10)}`),
          new Paragraph(""),
          new Table({ rows: tableRows }),
        ],
      },
    ],
  });
  await saveDoc(doc, "Removed_Members_Report.docx");
}
