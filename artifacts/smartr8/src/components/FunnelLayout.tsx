import { Header } from "@/components/Header";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

interface FunnelLayoutProps {
  step: number;
  totalSteps: number;
  onBack?: () => void;
  children: React.ReactNode;
}

export function FunnelLayout({ step, totalSteps, onBack, children }: FunnelLayoutProps) {
  const progress = Math.round((step / totalSteps) * 100);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <Header />

      <div className="border-b border-border shrink-0">
        <div className="flex items-center px-4 py-2.5 max-w-2xl mx-auto w-full gap-3">
          <div className="w-16 flex items-start">
            {onBack && step > 1 && (
              <button
                type="button"
                onClick={onBack}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
                aria-label="Go back to previous step"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
            )}
          </div>
          <div
            className="flex-1"
            role="progressbar"
            aria-valuenow={step}
            aria-valuemin={1}
            aria-valuemax={totalSteps}
            aria-label={`Step ${step} of ${totalSteps}`}
          >
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
              <span>Step {step} of {totalSteps}</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-1.5 rounded-full" />
          </div>
          <div className="w-16" />
        </div>
      </div>

      <main className="flex-1 px-4 py-10 md:py-14">
        <div className="mx-auto max-w-xl">
          {children}
        </div>
      </main>

      <div className="shrink-0 border-t border-border px-4 py-3 flex items-center justify-center gap-2 bg-secondary/20">
        <img
          src="/eho-logo-optimized.png"
          alt="Equal Housing Opportunity"
          width={15}
          height={16}
          loading="lazy"
          decoding="async"
          className="h-4 w-auto object-contain opacity-60"
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
        <span className="text-[10px] text-muted-foreground text-center">
          Equal Housing Opportunity · NMLS #1912347 · Adaxa Home, LLC NMLS #2380533
        </span>
      </div>
    </div>
  );
}

interface ChoiceCardProps {
  label: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}

export function ChoiceCard({ label, selected, onClick, disabled }: ChoiceCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "w-full text-left px-4 py-4 rounded-xl border-2 transition-all duration-150 font-medium text-base",
        "flex items-center justify-between gap-3 min-h-[56px]",
        selected
          ? "border-primary bg-primary/5 text-primary"
          : "border-border bg-white hover:border-primary/40 hover:bg-secondary/30 text-foreground",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer active:scale-[0.99]",
      ].join(" ")}
    >
      <span>{label}</span>
      {selected && <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />}
    </button>
  );
}

interface MultiChoiceCardProps {
  label: string;
  selected: boolean;
  onClick: () => void;
}

export function MultiChoiceCard({ label, selected, onClick }: MultiChoiceCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full text-left px-4 py-4 rounded-xl border-2 transition-all duration-150 font-medium text-base",
        "flex items-center justify-between gap-3 min-h-[56px] cursor-pointer active:scale-[0.99]",
        selected
          ? "border-primary bg-primary/5 text-primary"
          : "border-border bg-white hover:border-primary/40 hover:bg-secondary/30 text-foreground",
      ].join(" ")}
    >
      <span>{label}</span>
      <div
        className={[
          "h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
          selected ? "border-primary bg-primary" : "border-muted-foreground/40",
        ].join(" ")}
      >
        {selected && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
      </div>
    </button>
  );
}
