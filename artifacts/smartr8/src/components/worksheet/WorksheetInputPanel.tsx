import { useState } from "react";
import { WorksheetInputs, Debt, DEFAULT_ADVISOR } from "@/lib/worksheetCalc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Plus, Trash2 } from "lucide-react";

interface WorksheetInputPanelProps {
  inputs: WorksheetInputs;
  onChange: (next: WorksheetInputs) => void;
  onPrint: () => void;
  onDownloadPdf: () => void;
  onEmailClient?: () => void;
  isInternal?: boolean;
  pdfLoading?: boolean;
}

function NumInput({
  label,
  value,
  onChange,
  step = 100,
  min = 0,
  prefix,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
            {prefix}
          </span>
        )}
        <Input
          type="number"
          value={value || ""}
          step={step}
          min={min}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className={prefix ? "pl-7" : suffix ? "pr-8" : ""}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-bold uppercase tracking-widest text-primary/70 border-b border-primary/20 pb-1 mb-3">
      {children}
    </div>
  );
}

export default function WorksheetInputPanel({
  inputs,
  onChange,
  onPrint,
  onDownloadPdf,
  onEmailClient,
  isInternal = false,
  pdfLoading = false,
}: WorksheetInputPanelProps) {
  const [advisorOpen, setAdvisorOpen] = useState(false);

  function set<K extends keyof WorksheetInputs>(key: K, value: WorksheetInputs[K]) {
    onChange({ ...inputs, [key]: value });
  }

  function updateDebt(i: number, field: keyof Debt, value: string | number) {
    const next = inputs.debts.map((d, idx) =>
      idx === i ? { ...d, [field]: field === "name" ? value : parseFloat(value as string) || 0 } : d
    );
    set("debts", next);
  }

  function addDebt() {
    set("debts", [...inputs.debts, { name: "New Debt", balance: 0, rate: 0, payment: 0 }]);
  }

  function removeDebt(i: number) {
    set("debts", inputs.debts.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-6 text-sm">
      {/* Client Name */}
      <div className="space-y-1">
        <Label className="text-xs font-medium text-muted-foreground">Client Name</Label>
        <Input
          placeholder="Jane Smith"
          value={inputs.clientName}
          onChange={(e) => set("clientName", e.target.value)}
        />
      </div>

      {/* Current Mortgage */}
      <div>
        <SectionHeader>Current Mortgage</SectionHeader>
        <div className="grid grid-cols-2 gap-3">
          <NumInput
            label="Balance"
            prefix="$"
            value={inputs.existBalance}
            onChange={(v) => set("existBalance", v)}
            step={1000}
          />
          <NumInput
            label="Interest Rate"
            suffix="%"
            value={inputs.existRate}
            onChange={(v) => set("existRate", v)}
            step={0.125}
          />
          <NumInput
            label="P&I Payment"
            prefix="$"
            value={inputs.existPayment}
            onChange={(v) => set("existPayment", v)}
            step={50}
          />
          <NumInput
            label="Monthly Escrow"
            prefix="$"
            value={inputs.existEscrow}
            onChange={(v) => set("existEscrow", v)}
            step={25}
          />
        </div>
      </div>

      {/* New Loan */}
      <div>
        <SectionHeader>New Loan</SectionHeader>
        <div className="grid grid-cols-2 gap-3">
          <NumInput
            label="Loan Amount"
            prefix="$"
            value={inputs.loanAmount}
            onChange={(v) => set("loanAmount", v)}
            step={1000}
          />
          <NumInput
            label="Interest Rate"
            suffix="%"
            value={inputs.loanRate}
            onChange={(v) => set("loanRate", v)}
            step={0.125}
          />
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">Loan Term</Label>
            <Select
              value={String(inputs.termYears)}
              onValueChange={(v) => set("termYears", parseInt(v, 10))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 15, 20, 25, 30].map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y} years
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <NumInput
            label="Extra Monthly Principal"
            prefix="$"
            value={inputs.extraMonthly}
            onChange={(v) => set("extraMonthly", v)}
            step={50}
          />
          <NumInput
            label="Cash Back at Closing"
            prefix="$"
            value={inputs.cashBack}
            onChange={(v) => set("cashBack", v)}
            step={500}
          />
        </div>
      </div>

      {/* Debts */}
      <div>
        <SectionHeader>Debts to Consolidate</SectionHeader>
        <div className="space-y-2">
          {inputs.debts.map((d, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-1.5 items-center p-2 rounded bg-secondary/30"
            >
              <Input
                placeholder="Debt name"
                value={d.name}
                onChange={(e) => updateDebt(i, "name", e.target.value)}
                className="text-xs h-8"
              />
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                <Input
                  type="number"
                  placeholder="Balance"
                  value={d.balance || ""}
                  step={100}
                  onChange={(e) => updateDebt(i, "balance", e.target.value)}
                  className="pl-5 w-24 text-xs h-8"
                />
              </div>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="Rate"
                  value={d.rate || ""}
                  step={0.01}
                  onChange={(e) => updateDebt(i, "rate", e.target.value)}
                  className="pr-5 w-20 text-xs h-8"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">%</span>
              </div>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                <Input
                  type="number"
                  placeholder="Min pmt"
                  value={d.payment || ""}
                  step={5}
                  onChange={(e) => updateDebt(i, "payment", e.target.value)}
                  className="pl-5 w-24 text-xs h-8"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => removeDebt(i)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
        <div className="text-xs text-muted-foreground mt-1 mb-2 hidden sm:grid grid-cols-[1fr_auto_auto_auto_auto] gap-1.5 px-2">
          <span>Name</span>
          <span className="w-24 text-center">Balance</span>
          <span className="w-20 text-center">Rate</span>
          <span className="w-24 text-center">Min Pmt</span>
          <span className="w-8" />
        </div>
        <Button variant="outline" size="sm" className="mt-1" onClick={addDebt}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Debt
        </Button>
      </div>

      {/* Advisor info (collapsible) */}
      <Collapsible open={advisorOpen} onOpenChange={setAdvisorOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${advisorOpen ? "rotate-180" : ""}`}
            />
            {advisorOpen ? "Hide" : "Customize"} advisor info
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <SectionHeader>Advisor Information</SectionHeader>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Prepared By", key: "preparedBy" as const, placeholder: DEFAULT_ADVISOR.preparedBy },
              { label: "Title", key: "preparedByTitle" as const, placeholder: DEFAULT_ADVISOR.preparedByTitle },
              { label: "Company", key: "companyName" as const, placeholder: DEFAULT_ADVISOR.companyName },
              { label: "Phone", key: "contactPhone" as const, placeholder: DEFAULT_ADVISOR.contactPhone },
              { label: "Email", key: "contactEmail" as const, placeholder: DEFAULT_ADVISOR.contactEmail },
              { label: "Personal NMLS", key: "contactNMLS" as const, placeholder: DEFAULT_ADVISOR.contactNMLS },
              { label: "Company NMLS", key: "companyNMLS" as const, placeholder: DEFAULT_ADVISOR.companyNMLS },
              { label: "Licensed States", key: "licenseStates" as const, placeholder: DEFAULT_ADVISOR.licenseStates },
            ].map(({ label, key, placeholder }) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
                <Input
                  placeholder={placeholder}
                  value={inputs[key] as string}
                  onChange={(e) => set(key, e.target.value)}
                  className="text-sm"
                />
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Action buttons */}
      <div className="space-y-2 pt-2 border-t">
        <Button variant="outline" className="w-full" onClick={onPrint}>
          Print / Save as PDF
        </Button>
        <Button
          className="w-full bg-primary hover:bg-primary/90 text-white"
          onClick={onDownloadPdf}
          disabled={pdfLoading}
        >
          {pdfLoading ? "Generating PDF…" : "Download PDF"}
        </Button>
        {isInternal && onEmailClient && (
          <Button
            className="w-full bg-accent hover:bg-accent/90 text-white"
            onClick={onEmailClient}
          >
            Email to Client
          </Button>
        )}
      </div>
    </div>
  );
}
