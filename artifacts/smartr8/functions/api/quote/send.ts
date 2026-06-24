// @ts-nocheck
// Cloudflare Pages Function — POST /api/quote/send
//
// Sends the Adaxa Quick Quote to a client: an HTML email with both options
// rendered inline PLUS the generated PDF attached. Called cross-origin by the
// standalone Quick Quote tool hosted at quote.smartr8.com, so CORS allows that
// origin (and *.pages.dev previews).
//
// Required env binding (Cloudflare Pages → Settings → Environment variables):
//   RESEND_API_KEY — Resend API key (also accepts RE_worksheet as a fallback)

const ALLOWED_ORIGINS = new Set([
  "https://quote.smartr8.com",
  "https://smartr8.com",
  "https://www.smartr8.com",
]);

function isAllowedOrigin(origin) {
  if (ALLOWED_ORIGINS.has(origin)) return true;
  if (/^https:\/\/[^.]+\.pages\.dev$/.test(origin)) return true;
  return false;
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin : "https://quote.smartr8.com",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function jsonResponse(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]),
  );
}

async function sendResendEmail({ apiKey, from, replyTo, to, bcc, subject, html, pdfBase64, fileName }) {
  const body = {
    from,
    reply_to: replyTo,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  };
  // Optional BCC — automated funnel quotes copy the loan officer so they see
  // exactly what the client received.
  if (bcc) {
    body.bcc = Array.isArray(bcc) ? bcc : [bcc];
  }
  if (pdfBase64 && fileName) {
    body.attachments = [{ filename: fileName, content: pdfBase64 }];
  }

  let res;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (networkErr) {
    console.error("[quote] Resend network error:", networkErr);
    return { ok: false, error: `Network error: ${networkErr}` };
  }

  if (!res.ok) {
    let resBody = "";
    try { resBody = await res.text(); } catch {}
    console.error(`[quote] Resend API error — status=${res.status} body=${resBody}`);
    return { ok: false, error: `Resend ${res.status}: ${resBody}` };
  }

  const j = await res.json().catch(() => ({}));
  console.log(`[quote] Resend email sent — id=${j.id}`);
  return { ok: true };
}

// Renders one option as an email-safe card (table layout + inline styles).
function optionCard({ accent, accentLight, tag, title, subtitle, rows, rate, apr, payment, paymentLabel }) {
  const rowsHtml = rows
    .map(
      ([label, value]) =>
        `<tr>` +
        `<td style="padding:6px 0;color:#666666;font-size:14px;">${esc(label)}</td>` +
        `<td style="padding:6px 0;text-align:right;font-weight:700;color:#111111;font-size:14px;">${esc(value)}</td>` +
        `</tr>`,
    )
    .join("");

  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${accent};border-radius:8px;overflow:hidden;border-collapse:separate;">` +
    `<tr><td style="background:${accent};padding:14px 18px;">` +
    `<div style="color:#ffffff;font-size:12px;font-weight:800;letter-spacing:.7px;line-height:1;text-transform:uppercase;">${esc(tag)}</div>` +
    `<div style="color:#ffffff;font-size:18px;font-weight:800;line-height:1.12;">${esc(title)}</div>` +
    (subtitle ? `<div style="color:${accentLight};font-size:13px;margin-top:4px;">${esc(subtitle)}</div>` : "") +
    `</td></tr>` +
    `<tr><td style="padding:18px;background:#ffffff;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowsHtml}</table>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;background:${accent};border-radius:6px;border-collapse:separate;">` +
    `<tr>` +
    `<td style="padding:13px 16px;vertical-align:top;">` +
    `<div style="color:${accentLight};font-size:11px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;">INTEREST RATE</div>` +
    `<div style="color:#ffffff;font-size:26px;font-weight:800;line-height:1.05;">${esc(rate || "--")}</div>` +
    (apr ? `<div style="color:${accentLight};font-size:11px;">APR ${esc(apr)}</div>` : "") +
    `</td>` +
    `<td style="padding:13px 16px;text-align:right;vertical-align:top;">` +
    `<div style="color:${accentLight};font-size:11px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;">${esc(paymentLabel)}</div>` +
    `<div style="color:#ffffff;font-size:26px;font-weight:800;line-height:1.05;">${esc(payment || "--")}</div>` +
    `</td>` +
    `</tr></table>` +
    `</td></tr></table>`
  );
}

function buildQuoteEmailHtml(d) {
  const a = d.options.a || {};
  const b = d.options.b || {};
  const adv = d.advisor || {};
  const GREEN = "#2f8250", GREEN_L = "#c8e8d4", BLUE = "#225da6", BLUE_L = "#c9daf7";

  const advName = esc(adv.name || "Your Loan Officer");
  const advLine = [adv.title || "Loan Officer", adv.company || "Adaxa Home", adv.nmls ? `NMLS #${adv.nmls}` : ""]
    .filter(Boolean)
    .map(esc)
    .join(" &middot; ");

  const cardA = optionCard({
    accent: GREEN, accentLight: GREEN_L,
    tag: "OPTION A", title: "Cash-Out Refinance · 1st Lien",
    subtitle: [d.options.loanType || "Estimate", a.termLabel].filter(Boolean).join(" · "),
    rows: [["New Loan Amount", a.loanAmount], ["Existing Loan Payoff", a.payoff], ["Cash-Out Amount", a.cashOut]],
    rate: a.rate, apr: a.apr, payment: a.payment, paymentLabel: "EST. MONTHLY PAYMENT",
  });

  const cardB = optionCard({
    accent: BLUE, accentLight: BLUE_L,
    tag: "OPTION B", title: "HELOC",
    subtitle: [b.termLabel, "Interest Only"].filter(Boolean).join(" · "),
    rows: [["Line Amount", b.lineAmount], ["Initial Draw at Closing", b.draw]],
    rate: b.rate, apr: b.apr, payment: b.payment, paymentLabel: "EST. MONTHLY PAYMENT (INT. ONLY)",
  });

  return (
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>` +
    `<body style="margin:0;background:#f2f2f4;font-family:Arial,Helvetica,sans-serif;color:#222222;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f4;padding:30px 0;"><tr><td align="center">` +
    `<table role="presentation" width="680" cellpadding="0" cellspacing="0" style="max-width:680px;width:100%;background:#ffffff;">` +
    `<tr><td style="background:#111111;border-radius:8px 8px 0 0;padding:18px 24px;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>` +
    `<td style="color:#ffffff;font-size:22px;font-weight:800;line-height:1;">Adaxa Home</td>` +
    `<td style="text-align:right;color:#e3be3f;font-size:14px;font-weight:800;">Quick Quote</td>` +
    `</tr></table></td></tr>` +
    `<tr><td style="background:#ffffff;padding:28px 24px 26px;border:1px solid #e5e5e5;border-top:none;border-radius:0 0 8px 8px;">` +
    `<p style="margin:0 0 4px;font-size:17px;line-height:1.45;">Hi ${esc(d.clientName || "there")},</p>` +
    `<p style="margin:0 0 24px;font-size:16px;color:#444444;line-height:1.5;">Here is your personalized quick quote${d.options.date ? ` &middot; ${esc(d.options.date)}` : ""}. Two options are shown below, and a detailed PDF is attached.</p>` +
    cardA +
    `<div style="text-align:center;color:#888888;font-size:14px;font-weight:800;margin:16px 0;">&mdash; OR &mdash;</div>` +
    cardB +
    (Array.isArray(d.benefits) && d.benefits.length
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;background:#f7f9fc;border:1px solid #e5e5e5;border-radius:8px;"><tr><td style="padding:14px 16px;">` +
        `<div style="font-size:13px;font-weight:700;color:#111;margin-bottom:8px;">Why homeowners move forward</div>` +
        d.benefits.map((x) => `<div style="font-size:13px;color:#444;line-height:1.6;">&bull; ${esc(x)}</div>`).join("") +
        `</td></tr></table>`
      : "") +
    `<p style="margin:20px 0 0;font-size:14px;color:#666666;">A full PDF breakdown of both options is attached to this email.</p>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;border-top:1px solid #eeeeee;"><tr><td style="padding-top:16px;">` +
    `<div style="font-size:17px;font-weight:800;color:#111111;">${advName}</div>` +
    `<div style="font-size:14px;color:#777777;margin:2px 0 7px;">${advLine}</div>` +
    (adv.phone ? `<div style="font-size:14px;color:#444444;">P: ${esc(adv.phone)}</div>` : "") +
    (adv.email ? `<div style="font-size:14px;color:#444444;">E: <a href="mailto:${esc(adv.email)}" style="color:#1a56a0;text-decoration:none;">${esc(adv.email)}</a></div>` : "") +
    (adv.web ? `<div style="font-size:14px;color:#777777;">${esc(adv.web)}</div>` : "") +
    `</td></tr></table>` +
    `<p style="margin:26px 0 0;font-size:11px;color:#999999;line-height:1.45;">${esc(d.disclaimer || "")}</p>` +
    `</td></tr></table></td></tr></table></body></html>`
  );
}

export async function onRequest(context) {
  const { request, env, waitUntil } = context;
  const origin = request.headers.get("Origin") ?? "";
  const cors = corsHeaders(origin);

  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return jsonResponse({ success: false, error: "Method not allowed" }, 405, cors);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: "Invalid JSON body" }, 400, cors);
  }

  if (!body.clientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.clientEmail)) {
    return jsonResponse({ success: false, error: "A valid clientEmail is required." }, 400, cors);
  }
  if (!body.options || !body.options.a || !body.options.b) {
    return jsonResponse({ success: false, error: "Missing quote options." }, 400, cors);
  }

  const resendKey = env.RESEND_API_KEY || env.RE_worksheet;
  if (!resendKey) {
    console.error("[quote] CRITICAL: no Resend key (checked RESEND_API_KEY, RE_worksheet).");
    return jsonResponse({ success: false, error: "Email is not configured on the server." }, 500, cors);
  }

  const adv = body.advisor || {};
  const cleanName = String(adv.name || "Adaxa Home").replace(/["\r\n<>]/g, "").trim() || "Adaxa Home";
  const replyTo = (adv.email && String(adv.email).trim()) || "mykoal@adaxahome.com";
  const subject = `Your Quick Quote${body.clientName ? ` — ${body.clientName}` : ""}`;

  // BCC must be a valid address if supplied (e.g. the auto-quote copies Mykoal).
  const bcc =
    body.bcc && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(body.bcc)) ? String(body.bcc) : undefined;

  const result = await sendResendEmail({
    apiKey: resendKey,
    from: `"${cleanName}" <mykoal@mykoal.com>`,
    replyTo,
    to: body.clientEmail,
    bcc,
    subject,
    html: buildQuoteEmailHtml(body),
    pdfBase64: body.pdfBase64,
    fileName: body.fileName || "adaxa-quickquote.pdf",
  });

  // Capture the quote recipient as a CRM lead (best-effort, non-blocking) so every
  // Quick Quote also lands in crm.smartr8.com. Server-to-server; the CRM dedups by
  // email/phone, so re-quoting an existing lead updates rather than duplicates.
  // The CRM webhook URL (which carries its own ?key=) comes from env so no secret
  // lives in source. If it is unset, capture is skipped with a warning. Dedups by email/phone.
  const crmUrl = env.CRM_LEAD_WEBHOOK;
  if (crmUrl) {
    const nameParts = String(body.clientName || "").trim().split(/\s+/).filter(Boolean);
    const crmLead = {
      first_name: nameParts[0] || "",
      last_name: nameParts.slice(1).join(" "),
      email: body.clientEmail,
      phone: body.clientPhone || body.phone || "",
      source: "quote.smartr8.com",
      loanType: (body.options && body.options.loanType) || "CASHOUT_REFI",
      notes: `Quick Quote sent${body.source ? ` (${body.source})` : ""}`,
    };
    const crmJob = fetch(crmUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(crmLead),
    })
      .then(async (r) => {
        if (!r.ok)
          console.error(`[quote] CRM capture failed ${r.status}: ${(await r.text().catch(() => "")).slice(0, 200)}`);
        else console.log(`[quote] CRM capture ok — ${body.clientEmail}`);
      })
      .catch((e) => console.error("[quote] CRM capture error:", e));
    if (typeof waitUntil === "function") waitUntil(crmJob);
    else await crmJob;
  } else {
    console.warn("[quote] CRM_LEAD_WEBHOOK not set — quote recipient not captured to CRM");
  }

  console.log(
    `[quote] send — to=${body.clientEmail} advisor="${cleanName}" source=${body.source || "tool"} bcc=${bcc ? "yes" : "no"} emailOk=${result.ok}`,
  );
  return jsonResponse(
    { success: true, emailOk: result.ok, emailError: result.ok ? undefined : result.error },
    200,
    cors,
  );
}
