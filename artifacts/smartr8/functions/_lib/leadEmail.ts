// @ts-nocheck
// Shared transactional "thanks for starting" email for lead submissions.
// Sent server-side from the capture Workers (functions/api/submit-lead.ts and
// functions/api/worksheet/submit-lead.ts) via waitUntil, and from the
// POST /api/lead-email endpoint. Uses Resend. Never throws to the caller.
//
// env requirements: RESEND_API_KEY (required). CF_KV_NAMESPACE (optional;
// enables idempotency + IP rate limiting). Both are already bound in the
// capture Workers.

const FROM = "Mykoal at Adaxa Home <noreply@smartr8.com>";
const REPLY_TO = "mykoal@adaxahome.com";
// Absolute, production-hosted assets (emails cannot use bundle-relative paths).
const LOGO_URL = "https://smartr8.com/adaxa-logo-optimized.jpg";
const EHO_URL = "https://smartr8.com/eho-logo-optimized.png";
const RESEND_ENDPOINT = "https://api.resend.com/emails";

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]),
  );
}

function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Subject by funnel. Accepts the coarse Worker funnelType
// (heloc / cashout / rate-reduction / purchase) and the finer client values
// (heloc-v2, heloc-quick, cash-out, other, ...).
export function subjectFor(funnel, firstName) {
  const f = String(funnel || "").toLowerCase();
  if (f === "cash-out" || f === "cashout") return `Thanks ${firstName}, I'm reviewing your cash-out options`;
  if (f === "rate-reduction") return `Thanks ${firstName}, let's look at your rate options`;
  if (f === "purchase") return `Thanks ${firstName}, let's get your purchase started`;
  if (f.startsWith("heloc")) return `Thanks ${firstName}, I'm working on your HELOC options`;
  return `Thanks ${firstName}, I'm working on your options`;
}

export function renderText(firstName) {
  return `Hi ${firstName},

Thanks for reaching out through Adaxa Home. I just got your information and I'm already starting to dig through 99+ lender options to find the best fit for your situation.

Here's what happens next:

1. I'll review your file within 24 hours and pull together the strongest options for you.
2. I'll reach out by phone, text, or email (whichever you prefer) to walk through what I found.
3. If anything looks like a great fit, we'll talk through the next steps. No pressure, no obligation.

If you have any questions before then, you can reach me directly:

Phone: (949) 418-5486
Text: (949) 418-5486
Email: mykoal@adaxahome.com

Looking forward to helping you out.

Mykoal DeShazo
Vice President | Senior Loan Officer
Adaxa Home, LLC
NMLS #1912347 | Company NMLS #2380533
16767 N Perimeter Dr., Ste 150, Scottsdale, AZ 85260

Equal Housing Opportunity. Licensed in AZ, CO, CT, FL, MI, MN, OR, PA, TX, VA, WA.

This is not a commitment to lend. All loans subject to credit approval, income verification, and property appraisal. Rates and terms subject to change.

This email was sent because you submitted a request through smartr8.com. If you did not submit this request, please disregard this email.`;
}

export function renderHtml(firstNameRaw) {
  const firstName = escapeHtml(firstNameRaw);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light only">
<title>Thanks for reaching out</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e5e5;">
  <tr><td align="center" style="padding:28px 24px 8px;">
    <img src="${LOGO_URL}" alt="Adaxa Home" width="156" style="display:block;width:156px;max-width:60%;height:auto;border:0;">
  </td></tr>
  <tr><td style="padding:12px 32px 8px;color:#333333;font-size:16px;line-height:1.6;">
    <p style="margin:0 0 16px;">Hi ${firstName},</p>
    <p style="margin:0 0 16px;">Thanks for reaching out through Adaxa Home. I just got your information and I'm already starting to dig through 99+ lender options to find the best fit for your situation.</p>
    <p style="margin:0 0 10px;color:#13485A;font-size:17px;font-weight:bold;">Here's what happens next:</p>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr><td valign="top" style="padding:4px 10px 4px 0;color:#13485A;font-weight:bold;font-size:16px;">1.</td><td style="padding:4px 0;font-size:16px;line-height:1.6;color:#333333;">I'll review your file within 24 hours and pull together the strongest options for you.</td></tr>
      <tr><td valign="top" style="padding:4px 10px 4px 0;color:#13485A;font-weight:bold;font-size:16px;">2.</td><td style="padding:4px 0;font-size:16px;line-height:1.6;color:#333333;">I'll reach out by phone, text, or email (whichever you prefer) to walk through what I found.</td></tr>
      <tr><td valign="top" style="padding:4px 10px 4px 0;color:#13485A;font-weight:bold;font-size:16px;">3.</td><td style="padding:4px 0;font-size:16px;line-height:1.6;color:#333333;">If anything looks like a great fit, we'll talk through the next steps. No pressure, no obligation.</td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:14px 32px 4px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fdf2f2;border-left:4px solid #CC1818;border-radius:4px;">
      <tr><td style="padding:16px 20px;font-size:15px;line-height:1.8;color:#333333;">
        <strong style="color:#CC1818;">Have questions before then? Reach me directly:</strong><br>
        Phone: <a href="tel:+19494185486" style="color:#CC1818;text-decoration:none;">(949) 418-5486</a><br>
        Text: <a href="sms:+19494185486" style="color:#CC1818;text-decoration:none;">(949) 418-5486</a><br>
        Email: <a href="mailto:mykoal@adaxahome.com" style="color:#CC1818;text-decoration:none;">mykoal@adaxahome.com</a>
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:20px 32px 8px;color:#333333;font-size:15px;line-height:1.6;">
    <p style="margin:0 0 16px;">Looking forward to helping you out.</p>
    <p style="margin:0;color:#13485A;font-weight:bold;font-size:16px;">Mykoal DeShazo</p>
    <p style="margin:2px 0 0;color:#666666;font-size:14px;line-height:1.5;">
      Vice President | Senior Loan Officer<br>
      Adaxa Home, LLC<br>
      NMLS #1912347 | Company NMLS #2380533<br>
      16767 N Perimeter Dr., Ste 150, Scottsdale, AZ 85260
    </p>
  </td></tr>
  <tr><td style="padding:18px 32px 26px;border-top:1px solid #eeeeee;">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td valign="middle" style="padding-right:10px;"><img src="${EHO_URL}" alt="Equal Housing Opportunity" width="28" style="display:block;width:28px;height:auto;border:0;"></td>
      <td valign="middle" style="font-size:11px;color:#666666;line-height:1.5;">Equal Housing Opportunity.<br>Licensed in AZ, CO, CT, FL, MI, MN, OR, PA, TX, VA, WA.</td>
    </tr></table>
    <p style="margin:14px 0 0;font-size:11px;color:#666666;line-height:1.5;">This is not a commitment to lend. All loans subject to credit approval, income verification, and property appraisal. Rates and terms subject to change.</p>
    <p style="margin:10px 0 0;font-size:11px;color:#666666;line-height:1.5;">This email was sent because you submitted a request through smartr8.com. If you did not submit this request, please disregard this email.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

async function sendViaResend(apiKey, payload) {
  // Retry once on transient (5xx) or network errors. Never retry on 4xx.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        return { success: true, emailId: data && data.id };
      }
      if (res.status >= 400 && res.status < 500) {
        const errText = await res.text().catch(() => "");
        console.error(`[leadEmail] Resend ${res.status}: ${errText.slice(0, 300)}`);
        return { success: false, error: `Resend ${res.status}` };
      }
      console.error(`[leadEmail] Resend ${res.status} (attempt ${attempt + 1})`);
    } catch (e) {
      console.error(`[leadEmail] Resend fetch error (attempt ${attempt + 1}):`, e);
    }
  }
  return { success: false, error: "Resend send failed after retry" };
}

// Main entry. Validates, dedups (KV), optional IP rate limit, sends. Never throws.
// `ip` is passed only on the public HTTP endpoint path (enables IP rate limiting).
export async function handleLeadEmail(env, lead, ip) {
  const firstName = String((lead && lead.firstName) || "").trim();
  const email = String((lead && lead.email) || "").trim();
  if (!firstName) return { success: false, error: "firstName required" };
  if (!isValidEmail(email)) return { success: false, error: "valid email required" };
  if (!env || !env.RESEND_API_KEY) {
    console.error("[leadEmail] RESEND_API_KEY missing");
    return { success: false, error: "email not configured" };
  }

  const kv = env.CF_KV_NAMESPACE;
  const emailKey = `email_sent:addr:${email.toLowerCase()}`;
  const leadKey = lead && lead.leadId ? `email_sent:lead:${lead.leadId}` : null;

  if (kv) {
    // Idempotency + per-email throttle (24h covers the "1 per email per hour" rule).
    try {
      const [seenEmail, seenLead] = await Promise.all([
        kv.get(emailKey),
        leadKey ? kv.get(leadKey) : Promise.resolve(null),
      ]);
      if (seenEmail || seenLead) return { success: true, skipped: true };
    } catch (e) {
      console.error("[leadEmail] KV dedup read error (continuing):", e);
    }

    // IP rate limit (HTTP endpoint only): max 10 per IP per hour.
    if (ip && ip !== "unknown") {
      try {
        const ipKey = `rate_limit:ip:${ip}`;
        const count = parseInt((await kv.get(ipKey)) || "0", 10);
        if (count >= 10) return { success: false, error: "rate limited" };
        await kv.put(ipKey, String(count + 1), { expirationTtl: 3600 });
      } catch (e) {
        console.error("[leadEmail] KV rate-limit error (continuing):", e);
      }
    }
  }

  const result = await sendViaResend(env.RESEND_API_KEY, {
    from: FROM,
    to: [email],
    reply_to: REPLY_TO,
    subject: subjectFor(lead && lead.funnel, firstName),
    html: renderHtml(firstName),
    text: renderText(firstName),
  });

  if (kv && result.success) {
    try {
      await Promise.all([
        kv.put(emailKey, "1", { expirationTtl: 86400 }),
        leadKey ? kv.put(leadKey, "1", { expirationTtl: 86400 }) : Promise.resolve(),
      ]);
    } catch (e) {
      console.error("[leadEmail] KV mark-sent error:", e);
    }
  }

  return result;
}
