import { useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/Home";
import ThankYou from "@/pages/ThankYou";
import Heloc from "@/pages/Heloc";
import HelocNextSteps from "@/pages/HelocNextSteps";
import HelocWhatsnext from "@/pages/HelocWhatsnext";
import HelocInstantOptions from "@/pages/HelocInstantOptions";
import CashOut from "@/pages/CashOut";
import CashOutWhatsnext from "@/pages/CashOutWhatsnext";
import RateReduction from "@/pages/RateReduction";
import RateReductionWhatsnext from "@/pages/RateReductionWhatsnext";
import Purchase from "@/pages/Purchase";
import PurchaseWhatsnext from "@/pages/PurchaseWhatsnext";
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
        fbq("track", "PageView");
      }
    } catch {
      // Never let analytics break navigation
    }
  }, [location]);

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
      <Route path="/apply/cash-out" component={CashOut} />
      <Route path="/apply/cash-out/whats-next" component={CashOutWhatsnext} />
      <Route path="/apply/rate-reduction" component={RateReduction} />
      <Route path="/apply/rate-reduction/whats-next" component={RateReductionWhatsnext} />
      <Route path="/apply/purchase" component={Purchase} />
      <Route path="/apply/purchase/whats-next" component={PurchaseWhatsnext} />
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
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
