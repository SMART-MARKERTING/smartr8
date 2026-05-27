// One-time setup helper.
//
// Fetches GoHighLevel custom-field IDs and pipeline/stage IDs for the
// smartr8 lead-capture integration and prints them to stdout in the exact
// env-var format you paste into Cloudflare Pages (Production + Preview).
//
// Inputs (process.env first, falling back to a .dev.vars file at either
// the repo root or artifacts/smartr8/):
//   SMARTR8_LEAD_CAPTURE_PROD   GoHighLevel Private Integration Token
//                               (labeled "smartr8-lead-capture-prod" in GHL)
//   GHL_LOCATION_ID
//
// Outputs (stdout):
//   GHL_CF_LOAN_REQUEST=...
//   GHL_CF_NOTES=...
//   GHL_PIPELINE_ID=...
//   GHL_PIPELINE_STAGE_NEW=...
//
// Status + errors go to stderr so stdout is paste-ready.
//
// Run:
//   npx tsx scripts/fetch-ghl-ids.ts
//
// Requires Node 20+ (global fetch). No npm dependencies.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const GHL_BASE = "https://services.leadconnectorhq.com";
const API_VERSION = "2021-07-28";

const DEV_VARS_PATHS = [
  resolve(process.cwd(), ".dev.vars"),
  resolve(process.cwd(), "artifacts/smartr8/.dev.vars"),
];

const CUSTOM_FIELDS_WANTED: Array<{ envVar: string; label: string }> = [
  { envVar: "GHL_CF_LOAN_TYPE", label: "Loan Type" },
  { envVar: "GHL_CF_PROPERTY_STATE", label: "Property State" },
  { envVar: "GHL_CF_TCPA_CONSENT", label: "TCPA Consent" },
  { envVar: "GHL_CF_CONVERSATION_SUMMARY", label: "Conversation Summary" },
];

const PIPELINE_NAME = "Web Leads";
const STAGE_NAME = "New Lead";

function logStatus(msg: string): void {
  process.stderr.write(`${msg}\n`);
}

function fail(msg: string): never {
  process.stderr.write(`\nERROR: ${msg}\n`);
  process.exit(1);
}

function loadDevVars(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const path of DEV_VARS_PATHS) {
    if (!existsSync(path)) continue;
    const content = readFileSync(path, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in out)) out[key] = value;
    }
  }
  return out;
}

function readSecret(name: string, devVars: Record<string, string>): string {
  const fromEnv = process.env[name];
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();
  const fromVars = devVars[name];
  if (fromVars && fromVars.trim()) return fromVars.trim();
  return "";
}

async function ghlGet<T>(path: string, token: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${GHL_BASE}${path}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Version: API_VERSION,
        Accept: "application/json",
      },
    });
  } catch (e) {
    fail(`Network error calling GHL ${path}: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    fail(
      `GHL request failed (${res.status} ${res.statusText}) for ${path}\n` +
        `Response body: ${body.slice(0, 500)}`,
    );
  }
  return (await res.json()) as T;
}

interface CustomField {
  id: string;
  name: string;
}
interface CustomFieldsResponse {
  customFields?: CustomField[];
}
interface PipelineStage {
  id: string;
  name: string;
}
interface Pipeline {
  id: string;
  name: string;
  stages?: PipelineStage[];
}
interface PipelinesResponse {
  pipelines?: Pipeline[];
}

function findByName<T extends { name: string }>(items: T[], name: string): T | undefined {
  const want = name.trim().toLowerCase();
  return items.find((x) => (x.name ?? "").trim().toLowerCase() === want);
}

async function main(): Promise<void> {
  const devVars = loadDevVars();
  const token = readSecret("SMARTR8_LEAD_CAPTURE_PROD", devVars);
  const locationId = readSecret("GHL_LOCATION_ID", devVars);

  if (!token) {
    fail(
      "SMARTR8_LEAD_CAPTURE_PROD is not set. Provide it via env (export it before running) " +
        "or add it to .dev.vars at the repo root or artifacts/smartr8/.dev.vars.",
    );
  }
  if (!locationId) {
    fail(
      "GHL_LOCATION_ID is not set. Provide it via env or .dev.vars (same locations as above).",
    );
  }

  logStatus(`Using location ${locationId}.`);

  logStatus("Fetching custom fields...");
  const cfResp = await ghlGet<CustomFieldsResponse>(
    `/locations/${encodeURIComponent(locationId)}/customFields`,
    token,
  );
  const fields = cfResp.customFields ?? [];
  if (fields.length === 0) {
    fail("GHL returned no custom fields for this location. Verify the location ID and PIT scopes.");
  }

  const cfLines: string[] = [];
  const missing: string[] = [];
  for (const want of CUSTOM_FIELDS_WANTED) {
    const found = findByName(fields, want.label);
    if (!found) {
      missing.push(`Custom field "${want.label}"`);
    } else {
      cfLines.push(`${want.envVar}=${found.id}`);
    }
  }

  logStatus("Fetching pipelines...");
  const pipResp = await ghlGet<PipelinesResponse>(
    `/opportunities/pipelines?locationId=${encodeURIComponent(locationId)}`,
    token,
  );
  const pipelines = pipResp.pipelines ?? [];
  if (pipelines.length === 0) {
    fail("GHL returned no pipelines for this location.");
  }

  const pipeline = findByName(pipelines, PIPELINE_NAME);
  let pipelineLine: string | null = null;
  let stageLine: string | null = null;
  if (!pipeline) {
    missing.push(`Pipeline "${PIPELINE_NAME}"`);
  } else {
    pipelineLine = `GHL_PIPELINE_ID=${pipeline.id}`;
    const stage = findByName(pipeline.stages ?? [], STAGE_NAME);
    if (!stage) {
      missing.push(`Stage "${STAGE_NAME}" inside pipeline "${PIPELINE_NAME}"`);
    } else {
      stageLine = `GHL_PIPELINE_STAGE_NEW=${stage.id}`;
    }
  }

  if (missing.length > 0) {
    fail(
      `Could not find the following in GoHighLevel for location ${locationId}:\n` +
        missing.map((m) => `  - ${m}`).join("\n") +
        `\n\nFix: create or rename the items above in GHL to the exact names ` +
        `expected by this script, then re-run.`,
    );
  }

  logStatus("Done. Paste the following into Cloudflare Pages env vars:\n");
  for (const line of cfLines) process.stdout.write(`${line}\n`);
  if (pipelineLine) process.stdout.write(`${pipelineLine}\n`);
  if (stageLine) process.stdout.write(`${stageLine}\n`);
}

main().catch((e) => {
  fail(`Unexpected error: ${e instanceof Error ? e.message : String(e)}`);
});
