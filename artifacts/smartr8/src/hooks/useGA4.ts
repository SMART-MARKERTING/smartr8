import type { FunnelId } from "@/lib/submitLead";

type WhatsnextOption =
  | "see_heloc_options"
  | "schedule_call"
  | "continue_application"
  | "compare_heloc"
  | "get_preapproved";

function gtag(event: string, eventName: string, params: Record<string, unknown>) {
  const w = window as unknown as { gtag?: (...a: unknown[]) => void };
  if (typeof w.gtag !== "undefined") {
    w.gtag(event, eventName, params);
  } else {
    console.log("GA event:", eventName, params);
  }
}

export function useGA4(funnel: FunnelId) {
  return {
    trackFunnelStart: () =>
      gtag("event", "funnel_start", { funnel }),
    trackStepCompleted: (step_number: number, step_name: string) =>
      gtag("event", "funnel_step_completed", { funnel, step_number, step_name }),
    trackLead: () =>
      gtag("event", "generate_lead", { funnel, currency: "USD", value: 0 }),
    trackWhatsnextClick: (option: WhatsnextOption) =>
      gtag("event", "whats_next_clicked", { funnel, option }),
  };
}
