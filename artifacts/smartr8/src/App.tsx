import { useEffect, useRef, Suspense, lazy } from "react";
import { Switch, Route, Router as WouterRouter, useLocation, useSearch } from "wouter";
import { Toaster } from "@/components/ui/toaster";
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
const HelocV3 = lazy(() => import("@/pages/HelocV3"));
const HelocNextStepV2 = lazy(() => import("@/pages/HelocNextStepV2"));
// DSCR remains a standalone single-page lander (tags its lead with a loanType
// for the matching CRM drip). The former Cash-Out / Rate-Term / Purchase
// landers were folded into the unified funnel and now 301 to their canonical
// product routes below.
const Dscr = lazy(() => import("@/pages/Dscr"));
// Indexable product landers carrying the FAQ + FAQPage schema (search / AI
// visibility). VA is a new lane; HelocOptions is the indexable companion to
// the noIndex /heloc-v3 application funnel.
const Va = lazy(() => import("@/pages/Va"));
const HelocOptions = lazy(() => import("@/pages/HelocOptions"));
const Worksheet = lazy(() => import("@/pages/Worksheet"));
const WorksheetNextStep = lazy(() => import("@/pages/WorksheetNextStep"));
const WorksheetInternal = lazy(() => import("@/pages/WorksheetInternal"));
const AdminLeads = lazy(() => import("@/pages/AdminLeads"));
const WhatsNext = lazy(() => import("@/pages/WhatsNext"));
const Privacy = lazy(() => import("@/pages/Privacy"));
const Terms = lazy(() => import("@/pages/Terms"));
const NotFound = lazy(() => import("@/pages/not-found"));

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
 * Client-side redirect used both for the legacy /apply/* routes that fan
 * into the unified /worksheet funnel and for the v1 HELOC routes that now
 * point at the v2 funnel. Pass `preserveSearch` when inbound query params
 * (utm_*, name, credit, etc.) need to ride through to the destination —
 * the legacy /apply/* redirects hardcode their own `?product=` so they
 * leave it off.
 */
function RedirectTo({ to, preserveSearch = false }: { to: string; preserveSearch?: boolean }) {
  const [, navigate] = useLocation();
  const search = useSearch();
  useEffect(() => {
    const target =
      preserveSearch && search
        ? `${to}${to.includes("?") ? "&" : "?"}${search}`
        : to;
    navigate(target, { replace: true });
  }, [navigate, to, search, preserveSearch]);
  return null;
}

/**
 * Legacy /worksheet?product=… → canonical per-product route. Maps the old
 * query-param entry to its clean URL (home-equity/heloc fold into /heloc-v3),
 * preserving every other inbound param (utm_*, name, etc.). A bare /worksheet
 * with no product lands on the generic /see-my-options picker.
 */
function WorksheetProductRedirect() {
  const [, navigate] = useLocation();
  const search = useSearch();
  useEffect(() => {
    const params = new URLSearchParams(search);
    const raw = params.get("product")?.toLowerCase().trim();
    const map: Record<string, string> = {
      "cash-out": "/cash-out", cashout: "/cash-out", cash_out: "/cash-out",
      "rate-reduction": "/rate-reduction", rate: "/rate-reduction", rate_reduction: "/rate-reduction",
      "home-equity": "/heloc-v3", home_equity: "/heloc-v3", "2nd-mortgage": "/heloc-v3", heloc: "/heloc-v3",
      purchase: "/purchase", buy: "/purchase",
    };
    const dest = (raw && map[raw]) || "/see-my-options";
    params.delete("product");
    const qs = params.toString();
    navigate(qs ? `${dest}?${qs}` : dest, { replace: true });
  }, [navigate, search]);
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
        {/* All HELOC / home-equity traffic now lands on the v3 "elevated"
            funnel — the legacy v1/v2/quick routes redirect there, preserving
            query params (utm_*, name, credit, etc.). */}
        <Route path="/heloc-v3" component={HelocV3} />
        <Route path="/heloc">{() => <RedirectTo to="/heloc-v3" preserveSearch />}</Route>
        <Route path="/heloc-v2" component={HelocV2} />
        <Route path="/home-equity">{() => <RedirectTo to="/heloc-v3" preserveSearch />}</Route>
        <Route path="/heloc/next-steps">{() => <RedirectTo to="/heloc/next-step-v2" preserveSearch />}</Route>
        <Route path="/heloc/whats-next">{() => <RedirectTo to="/heloc/next-step-v2" preserveSearch />}</Route>
        <Route path="/heloc/instant-options">{() => <RedirectTo to="/heloc/next-step-v2" preserveSearch />}</Route>
        <Route path="/heloc/instant-options-v2" component={HelocInstantOptionsV2} />
        <Route path="/heloc/next-step-v2" component={HelocNextStepV2} />
        <Route path="/heloc/quick">{() => <RedirectTo to="/heloc/quick-v2" preserveSearch />}</Route>
        <Route path="/heloc/quick-v2" component={HelocQuickV2} />
        {/* Canonical product funnels (unified worksheet). Each runs the funnel
            pre-selected to its product; Cash-Out / Rate-Reduction / Purchase
            all hand off to the LendingPad guest application via
            /application-next. /see-my-options is the generic strategy picker. */}
        <Route path="/see-my-options">{() => <Worksheet />}</Route>
        <Route path="/cash-out">{() => <Worksheet entry="cash-out" />}</Route>
        <Route path="/rate-reduction">{() => <Worksheet entry="rate-reduction" />}</Route>
        <Route path="/purchase">{() => <Worksheet entry="purchase" />}</Route>
        <Route path="/application-next" component={WorksheetNextStep} />
        {/* DSCR remains its own standalone lander. */}
        <Route path="/dscr" component={Dscr} />
        {/* VA lander (new lane) + indexable HELOC lander with FAQ + schema. */}
        <Route path="/va" component={Va} />
        <Route path="/heloc-options" component={HelocOptions} />
        {/* Retired single-page landers → their canonical funnel routes. */}
        <Route path="/cash-out-refi">{() => <RedirectTo to="/cash-out" preserveSearch />}</Route>
        <Route path="/rate-and-term-refi">{() => <RedirectTo to="/rate-reduction" preserveSearch />}</Route>
        {/* Legacy /apply/* and /worksheet?product= → canonical product routes. */}
        <Route path="/apply/cash-out">{() => <RedirectTo to="/cash-out" preserveSearch />}</Route>
        <Route path="/apply/rate-reduction">{() => <RedirectTo to="/rate-reduction" preserveSearch />}</Route>
        <Route path="/apply/purchase">{() => <RedirectTo to="/purchase" preserveSearch />}</Route>
        <Route path="/apply/cash-out/whats-next">{() => <RedirectTo to="/whats-next" />}</Route>
        <Route path="/apply/rate-reduction/whats-next">{() => <RedirectTo to="/whats-next" />}</Route>
        <Route path="/apply/purchase/whats-next">{() => <RedirectTo to="/whats-next" />}</Route>
        <Route path="/worksheet/internal" component={WorksheetInternal} />
        <Route path="/admin/leads" component={AdminLeads} />
        <Route path="/worksheet">{() => <WorksheetProductRedirect />}</Route>
        <Route path="/whats-next" component={WhatsNext} />
        <Route path="/privacy" component={Privacy} />
        <Route path="/terms-of-use" component={Terms} />
        {/* Alias for the older /terms URL still referenced by older inbound links. */}
        <Route path="/terms" component={Terms} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <RouteChangeScrollReset />
      <PixelRouteTracker />
      <PixelLinkTracker />
      <LegacyAssetWarn />
      <Router />
      <Toaster />
    </WouterRouter>
  );
}

export default App;
