-- Lead capture audit + TCPA consent tables for D1 (smartr8-leads).
-- Apply via: wrangler d1 migrations apply smartr8-leads --remote

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS leads (
  lead_id                  TEXT PRIMARY KEY,
  created_at               INTEGER NOT NULL,
  funnel                   TEXT NOT NULL,
  first_name               TEXT,
  last_name                TEXT,
  email                    TEXT,
  phone_e164               TEXT,
  address1                 TEXT,
  loan_request             TEXT,
  notes                    TEXT,
  source                   TEXT,
  referrer                 TEXT,
  landing_page             TEXT,
  utm_source               TEXT,
  utm_medium               TEXT,
  utm_campaign             TEXT,
  utm_content              TEXT,
  utm_term                 TEXT,
  ip                       TEXT,
  user_agent               TEXT,
  leadmailbox_status       TEXT DEFAULT 'pending',
  leadmailbox_attempts     INTEGER DEFAULT 0,
  leadmailbox_last_error   TEXT,
  ghl_status               TEXT DEFAULT 'pending',
  ghl_contact_id           TEXT,
  ghl_attempts             INTEGER DEFAULT 0,
  ghl_last_error           TEXT,
  resend_status            TEXT DEFAULT 'pending',
  resend_attempts          INTEGER DEFAULT 0,
  resend_last_error        TEXT,
  sendblue_status          TEXT DEFAULT 'pending',
  sendblue_message_handle  TEXT,
  sendblue_service         TEXT,
  sendblue_attempts        INTEGER DEFAULT 0,
  sendblue_last_error      TEXT
);

CREATE INDEX IF NOT EXISTS idx_leads_created_at         ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_email              ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_phone_e164         ON leads(phone_e164);
CREATE INDEX IF NOT EXISTS idx_leads_leadmailbox_status ON leads(leadmailbox_status);
CREATE INDEX IF NOT EXISTS idx_leads_ghl_status         ON leads(ghl_status);
CREATE INDEX IF NOT EXISTS idx_leads_resend_status      ON leads(resend_status);
CREATE INDEX IF NOT EXISTS idx_leads_sendblue_status    ON leads(sendblue_status);

CREATE TABLE IF NOT EXISTS tcpa_consents (
  consent_id        TEXT PRIMARY KEY,
  lead_id           TEXT NOT NULL REFERENCES leads(lead_id),
  consent_version   TEXT NOT NULL,
  consent_text      TEXT NOT NULL,
  ip                TEXT NOT NULL,
  user_agent        TEXT NOT NULL,
  page_url          TEXT NOT NULL,
  created_at        INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tcpa_consents_lead_id    ON tcpa_consents(lead_id);
CREATE INDEX IF NOT EXISTS idx_tcpa_consents_created_at ON tcpa_consents(created_at);
