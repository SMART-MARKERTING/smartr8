import { useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { trackFbEvent, generateEventId } from "@/lib/fbq";
import { LegacyAssetWarn } from "@/lib/legacyAssetWarn";
import Home from "@/pages/Home";
import ThankYou from "@/pages/ThankYou";
import Heloc from "@/pages/Heloc";
import HelocNextSteps from "@/pages/HelocNextSteps";
import HelocWhatsnext from "@/pages/HelocWhatsnext";
import HelocInstantOptions from "@/pages/HelocInstantOptions";
import HelocQuick from "@/pages/HelocQuick";
import HelocQuickV2 from "@/pages/HelocQuickV2";
import HelocInstantOptionsV2 from "@/pages/HelocInstantOptionsV2";
import Worksheet from "@/pages/Worksheet";
import WorksheetInternal from "@/pages/WorksheetInternal";
import WhatsNext from "@/pages/WhatsNext";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

/**
 * Refresh Meta Pixel's URL context on every wouter SPA route change.
 *
 * Meta Pixel reads `document.location` once when fbq() runs, but its internal
 * page context for attribution stays anchored to whichever PageView was last
 * fired. Without this hook, custom events (Lead, ViewContent, etc.) that fire
 * after a client-side navigation get reported against the initial page-load
 * URL (the homepage) instead of the actual current route.
 *
 * Firing fbq('track', 'PageView') on every route change re-anchors Meta's
 * page context to the current URL so subsequent events report correctly.
 *
 * The very first route is skipped because index.html already fires the
 * initial PageView on hard load — we only fire on subsequent SPA navigations.
 */
function PixelRouteTracker() {
  const [location] = useLocation();
  const isFirst = useRef(true);

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    try {
      const fbq = (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq;
      if (typeof fbq === "function") {
        fbq("track", "PageView", {}, { eventID: generateEventId() });
      }
    } catch {
      // Never let analytics break navigation
    }
  }, [location]);

  return null;
}

/**
 * Global click tracker that fires Meta Pixel standard events for high-intent
 * outbound link clicks. Implemented as a single document-level capture-phase
 * listener so we don't have to wire onClick on every link across 12+ files.
 *
 * Mappings:
 *   tel:*                  → Contact      (method: 'phone')
 *   mailto:*               → Contact      (method: 'email')
 *   *cal.com*              → Schedule     (content_name: 'Consultation Call')
 *   *lendingpad.com*       → SubmitApplication (content_name: 'Full Application')
 *
 * Notes:
 * - We use capture phase so we fire before any nested onClick stops propagation.
 * - We do NOT pass any PII (phone numbers, emails, names) to fbq. Only static
 *   string params, matching the rest of the pixel implementation.
 * - All event firing is wrapped in try/catch via trackFbEvent so analytics
 *   failures can never break user navigation.
 */
function PixelLinkTracker() {
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest("a") as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href) return;

      if (href.startsWith("tel:")) {
        trackFbEvent("Contact", { method: "phone" });
        return;
      }
      if (href.startsWith("sms:")) {
        trackFbEvent("Contact", { method: "sms" });
        return;
      }
      if (href.startsWith("mailto:")) {
        trackFbEvent("Contact", { method: "email" });
        return;
      }
      if (href.includes("cal.com")) {
        trackFbEvent("Schedule", { content_name: "Consultation Call", content_category: "Mortgage" });
        return;
      }
      if (href.includes("lendingpad.com")) {
        trackFbEvent("SubmitApplication", { content_name: "Full Application", content_category: "Mortgage" });
        return;
      }
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  return null;
}

/**
 * Redirects legacy /apply/* funnel routes into the unified /worksheet funnel.
 * The per-product funnels were superseded by the shared funnel; these
 * redirects keep old links and ad destinations working.
 */
function RedirectTo({ to }: { to: string }) {
  const [, navigate] = useLocation();
  useEffect(() => {
    navigate(to, { replace: true });
  }, [navigate, to]);
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/thank-you" component={ThankYou} />
      <Route path="/heloc" component={Heloc} />
      <Route path="/heloc/next-steps" component={HelocNextSteps} />
      <Route path="/heloc/whats-next" component={HelocWhatsnext} />
      <Route path="/heloc/instant-options" component={HelocInstantOptions} />
      <Route path="/heloc/instant-options-v2" component={HelocInstantOptionsV2} />
      <Route path="/heloc/quick" component={HelocQuick} />
      <Route path="/heloc/quick-v2" component={HelocQuickV2} />
      {/* Legacy /apply/* funnels — superseded by the unified /worksheet funnel */}
      <Route path="/apply/cash-out">{() => <RedirectTo to="/worksheet?product=cash-out" />}</Route>
      <Route path="/apply/rate-reduction">{() => <RedirectTo to="/worksheet?product=rate-reduction" />}</Route>
      <Route path="/apply/purchase">{() => <RedirectTo to="/worksheet?product=purchase" />}</Route>
      <Route path="/apply/cash-out/whats-next">{() => <RedirectTo to="/whats-next" />}</Route>
      <Route path="/apply/rate-reduction/whats-next">{() => <RedirectTo to="/whats-next" />}</Route>
      <Route path="/apply/purchase/whats-next">{() => <RedirectTo to="/whats-next" />}</Route>
      <Route path="/worksheet/internal" component={WorksheetInternal} />
      <Route path="/worksheet" component={Worksheet} />
      <Route path="/whats-next" component={WhatsNext} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <PixelRouteTracker />
          <PixelLinkTracker />
          <LegacyAssetWarn />
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
