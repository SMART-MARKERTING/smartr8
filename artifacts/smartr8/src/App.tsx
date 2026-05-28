import { useEffect, useRef, Suspense, lazy } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { trackFbEvent, generateEventId } from "@/lib/fbq";
import { LegacyAssetWarn } from "@/lib/legacyAssetWarn";

// Route-based code splitting. React.lazy + Suspense lets Rollup carve each
// page (or chunk group from vite.config.ts manualChunks) out of the main
// entry bundle. Ad-traffic visitors landing on a HELOC funnel never pay for
// the Worksheet bundle (including react-pdf) and Home stays out of the
// path as well. The ad-traffic pages share one chunk via manualChunks so
// A/B bounces between v1 and v2 don't trigger a second network round trip.
const Home = lazy(() => import("@/pages/Home"));
const ThankYou = lazy(() => import("@/pages/ThankYou"));
const Heloc = lazy(() => import("@/pages/Heloc"));
const HelocNextSteps = lazy(() => import("@/pages/HelocNextSteps"));
const HelocWhatsnext = lazy(() => import("@/pages/HelocWhatsnext"));
const HelocInstantOptions = lazy(() => import("@/pages/HelocInstantOptions"));
const HelocQuick = lazy(() => import("@/pages/HelocQuick"));
const HelocQuickV2 = lazy(() => import("@/pages/HelocQuickV2"));
const HelocInstantOptionsV2 = lazy(() => import("@/pages/HelocInstantOptionsV2"));
const HelocV2 = lazy(() => import("@/pages/HelocV2"));
const HelocNextStepV2 = lazy(() => import("@/pages/HelocNextStepV2"));
const Worksheet = lazy(() => import("@/pages/Worksheet"));
const WorksheetInternal = lazy(() => import("@/pages/WorksheetInternal"));
const WhatsNext = lazy(() => import("@/pages/WhatsNext"));
const NotFound = lazy(() => import("@/pages/not-found"));

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

/**
 * Scrolls the window to the top on every wouter route change so a new page
 * never loads scrolled to a position carried over from the previous route
 * (e.g. submitting /heloc-v2 step 9 and landing on /heloc/instant-options-v2).
 * In-page step changes within a single route (the funnel) are handled by the
 * page itself, since the location does not change between steps.
 */
function RouteChangeScrollReset() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);
  return null;
}

function Router() {
  // null fallback: lazy chunks resolve in microseconds on a warm cache and
  // typically under a few hundred ms on first visit. A loading spinner would
  // flash visibly only on slow connections, which we'd rather not draw
  // attention to mid-funnel.
  return (
    <Suspense fallback={null}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/thank-you" component={ThankYou} />
        <Route path="/heloc" component={Heloc} />
        <Route path="/heloc-v2" component={HelocV2} />
        <Route path="/heloc/next-steps" component={HelocNextSteps} />
        <Route path="/heloc/whats-next" component={HelocWhatsnext} />
        <Route path="/heloc/instant-options" component={HelocInstantOptions} />
        <Route path="/heloc/instant-options-v2" component={HelocInstantOptionsV2} />
        <Route path="/heloc/next-step-v2" component={HelocNextStepV2} />
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
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <RouteChangeScrollReset />
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
