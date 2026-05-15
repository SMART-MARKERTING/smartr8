import { Switch, Route, Router as WouterRouter } from "wouter";
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
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

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
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
