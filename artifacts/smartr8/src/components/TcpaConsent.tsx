import { useEffect, useRef, useState } from "react";
import { CONSENT_TEXT, CONSENT_VERSION } from "@/lib/tcpa";

// Cloudflare Turnstile site key (public). Set in Cloudflare Pages env as
// VITE_TURNSTILE_SITE_KEY. If missing, the widget falls back to a
// permissive placeholder token (dev only) and renders an inline warning.
const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
const TURNSTILE_SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

declare global {
  interface Window {
    turnstile?: {
      render: (selector: string | HTMLElement, opts: Record<string, unknown>) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

interface TcpaConsentProps {
  /** Receives ({ consent, consent_version, consent_text, turnstile_token }).
   *  As of 2026-05-28.v2 the consent checkbox is OPTIONAL — `ready` reports
   *  Turnstile-token-only, so forms gating Submit on `ready` will allow
   *  unchecked submissions through. The `consent` boolean still reflects
   *  the checkbox state so the backend can decide whether to write a
   *  tcpa_consents row. */
  onChange: (state: {
    ready: boolean;
    consent: boolean;
    consent_version: string;
    consent_text: string;
    turnstile_token: string;
  }) => void;
}

let turnstileScriptLoaded: Promise<void> | null = null;
function loadTurnstileScript(): Promise<void> {
  if (turnstileScriptLoaded) return turnstileScriptLoaded;
  turnstileScriptLoaded = new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("no window"));
      return;
    }
    if (window.turnstile) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src*="turnstile/v0/api.js"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("turnstile script failed")), { once: true });
      return;
    }
    const s = document.createElement("script");
    s.src = TURNSTILE_SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("turnstile script failed"));
    document.head.appendChild(s);
  });
  return turnstileScriptLoaded;
}

export function TcpaConsent({ onChange }: TcpaConsentProps) {
  const [consent, setConsent] = useState(false);
  const [token, setToken] = useState("");
  const widgetEl = useRef<HTMLDivElement | null>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    // The checkbox is optional now. `ready` gates only on Turnstile token
    // presence so the form can be submitted with the checkbox unchecked.
    // Bot-check still required (otherwise spam would flood the funnel).
    onChange({
      ready: token.length > 0,
      consent,
      consent_version: CONSENT_VERSION,
      consent_text: CONSENT_TEXT,
      turnstile_token: token,
    });
  }, [consent, token, onChange]);

  useEffect(() => {
    if (!SITE_KEY) return;
    if (!widgetEl.current) return;
    let cancelled = false;
    loadTurnstileScript()
      .then(() => {
        if (cancelled || !widgetEl.current || !window.turnstile) return;
        widgetId.current = window.turnstile.render(widgetEl.current, {
          sitekey: SITE_KEY,
          callback: (t: string) => setToken(t),
          "error-callback": () => setToken(""),
          "expired-callback": () => setToken(""),
          theme: "light",
          size: "flexible",
        });
      })
      .catch(() => {
        // Script failed to load; keep the form usable but without token
        // the submit stays disabled (server will reject anyway).
      });
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) {
        try { window.turnstile.remove(widgetId.current); } catch {}
        widgetId.current = null;
      }
    };
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 p-4 rounded-xl border border-border" style={{ backgroundColor: "#F8F5F0" }}>
        <input
          id="tcpa-consent"
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 cursor-pointer"
        />
        <label htmlFor="tcpa-consent" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
          <span className="font-semibold text-foreground">Optional:</span>{" "}
          By checking this box, I consent to receive calls, SMS/MMS texts, and
          emails from Mykoal DeShazo (NMLS #1912347) and Adaxa Home
          (NMLS #2380533) at the phone number and email I provided regarding
          mortgage and home-equity loan options. Calls and texts may use an
          autodialer, automated technology, or artificial/prerecorded voice.
          Consent is not required to submit this form or purchase goods or
          services. Message and data rates may apply. Message frequency may
          vary. Reply STOP to opt out or HELP for help. I may also revoke
          consent by contacting Mykoal directly.
        </label>
      </div>
      <div ref={widgetEl} aria-label="Turnstile challenge" />
      {!SITE_KEY && (
        <p className="text-xs text-amber-700">
          VITE_TURNSTILE_SITE_KEY is not set. The bot-check widget is disabled and
          submission will be rejected by the server until the key is configured.
        </p>
      )}
    </div>
  );
}

/** Transactional notice rendered directly below the Submit button on every
 *  contact form. Conveys implied consent for THIS specific inquiry (required
 *  to submit) and acknowledges the Privacy Policy + Terms of Service. The
 *  separate OPTIONAL marketing consent lives in <TcpaConsent /> above. */
export function TcpaSubmitNotice() {
  return (
    <p className="text-xs text-muted-foreground leading-relaxed mt-3">
      By clicking Submit, I request that Mykoal DeShazo and Adaxa Home contact
      me about my inquiry using the contact information I provided. I
      acknowledge the{" "}
      <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline">
        Privacy Policy
      </a>{" "}
      and{" "}
      <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline">
        Terms of Service
      </a>.
    </p>
  );
}
