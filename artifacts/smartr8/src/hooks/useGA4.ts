import type { FunnelId } from "@/lib/submitLead";

type WhatsnextOption =
  | "see_heloc_options"
  | "schedule_call"
  | "continue_application"
  | "compare_heloc"
  | "get_preapproved"
  | "loan_benefits_worksheet";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...a: unknown[]) => void;
  }
}

function trackEvent(eventName: string, params: Record<string, unknown>) {
  if (typeof window === "undefined") return;

  if (Array.isArray(window.dataLayer)) {
    window.dataLayer.push({ event: eventName, ...params });
  } else if (typeof window.gtag === "function") {
    window.gtag("event", eventName, params);
  } else {
    console.log("GA event:", eventName, params);
  }
}

export function useGA4(funnel: FunnelId) {
  return {
    trackFunnelStart: () =>
      trackEvent("funnel_start", { funnel }),
    trackStepCompleted: (step_number: number, step_name: string) =>
      trackEvent("funnel_step_completed", { funnel, step_number, step_name }),
    trackLead: (extra: Record<string, unknown> = {}) =>
      trackEvent("generate_lead", { funnel, currency: "USD", value: 0, ...extra }),
    trackWhatsnextClick: (option: WhatsnextOption) =>
      trackEvent("whats_next_clicked", { funnel, option }),
    trackEvent: (eventName: string, params: Record<string, unknown> = {}) =>
      trackEvent(eventName, { funnel, ...params }),
  };
}
