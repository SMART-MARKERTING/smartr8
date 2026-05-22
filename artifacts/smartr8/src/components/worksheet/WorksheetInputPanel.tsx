import { useRef, useState } from "react";
import {
  WorksheetInputs,
  Debt,
  DEFAULT_ADVISOR,
  PRODUCT_LABELS,
  STRUCTURE_LABELS,
  ProductType,
  LoanStructure,
  solveApr,
  money,
  pct,
} from "@/lib/worksheetCalc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Download, Printer, Plus, Trash2, ChevronDown, Upload, X, ImageIcon } from "lucide-react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface WorksheetInputPanelProps {
  inputs: WorksheetInputs;
  onChange: (next: WorksheetInputs) => void;
  onPrint: () => void;
  onDownloadPdf: () => void;
  onEmailClient?: () => void;
  onEmailSelf?: () => void;
  isInternal?: boolean;
  pdfLoading?: boolean;
}

function NumInput({
  label, value, onChange, step = 100, min = 0, prefix, suffix, placeholder, optional,
}: {
  label: string; value: number; onChange: (v: number) => void; step?: number; min?: number;
  prefix?: string; suffix?: string; placeholder?: string; optional?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium text-muted-foreground">
        {label}{optional && <span className="ml-1 text-[10px]">(opt)</span>}
      </Label>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{prefix}</span>}
        <Input
          type="number"
          value={value || ""}
          step={step}
          min={min}
          placeholder={placeholder}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className={prefix ? "pl-7" : suffix ? "pr-8" : ""}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{suffix}</span>}
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
  onEmailSelf,
  isInternal = false,
  pdfLoading = false,
}: WorksheetInputPanelProps) {
  const [advisorOpen, setAdvisorOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    set("debts", [...inputs.debts, { name: "New Debt", balance: 0, payment: 0 }]);
  }
  function removeDebt(i: number) {
    set("debts", inputs.debts.filter((_, idx) => idx !== i));
  }

  function handleHeadshotUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please choose an image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert("Image must be smaller than 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      set("headshotDataUrl", reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  // Auto APR (used when no manual override is entered)
  const autoApr = solveApr(
    inputs.loanAmount,
    inputs.loanRate,
    inputs.termYears * 12,
    inputs.closingCosts,
  );
  const usingCustomApr = inputs.customApr > 0;
  const effectiveApr = usingCustomApr ? inputs.customApr : autoApr;

  return (
    <div className="space-y-6 text-sm">
      {/* Lead identity */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs font-medium text-muted-foreground">Client First Name</Label>
          <Input
            placeholder="Jane"
            value={inputs.clientFirstName}
            onChange={(e) => set("clientFirstName", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-muted-foreground">Client Last Name</Label>
          <Input
            placeholder="Smith"
            value={inputs.clientLastName}
            onChange={(e) => set("clientLastName", e.target.value)}
          />
        </div>
      </div>

      {/* Product Type & Loan Structure */}
      <div>
        <SectionHeader>Product</SectionHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">Product Type</Label>
            <Select
              value={inputs.productType}
              onValueChange={(v) => set("productType", v as ProductType)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.entries(PRODUCT_LABELS) as [ProductType, string][]).map(([v, label]) => (
                  <SelectItem key={v} value={v}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">Loan Structure</Label>
            <Select
              value={inputs.loanStructure}
              onValueChange={(v) => set("loanStructure", v as LoanStructure)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.entries(STRUCTURE_LABELS) as [LoanStructure, string][]).map(([v, label]) => (
                  <SelectItem key={v} value={v}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {inputs.loanStructure !== "FIXED" && (
              <p className="text-[10px] text-amber-700 mt-1">
                ARM/IO disclaimer is auto-added to the PDF compliance footer.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Current Mortgage */}
      <div>
        <SectionHeader>Current Mortgage</SectionHeader>
        {inputs.productType !== "RATE_REDUCTION" && (
          <div className="mb-3">
            <Label className="text-xs font-medium text-muted-foreground mb-1 block">
              Has existing mortgage?
            </Label>
            <RadioGroup
              value={inputs.hasExistingMortgage ? "yes" : "no"}
              onValueChange={(v) => set("hasExistingMortgage", v === "yes")}
              className="flex gap-4"
            >
              <div className="flex items-center gap-1.5">
                <RadioGroupItem id="ip-hm-yes" value="yes" />
                <Label htmlFor="ip-hm-yes" className="text-xs font-normal cursor-pointer">Yes</Label>
              </div>
              <div className="flex items-center gap-1.5">
                <RadioGroupItem id="ip-hm-no" value="no" />
                <Label htmlFor="ip-hm-no" className="text-xs font-normal cursor-pointer">No</Label>
              </div>
            </RadioGroup>
          </div>
        )}
        {inputs.hasExistingMortgage && (
          <div className="grid grid-cols-2 gap-3">
            <NumInput label="Balance" prefix="$" value={inputs.existBalance} onChange={(v) => set("existBalance", v)} step={1000} />
            <NumInput label="Total Pmt (PITI)" prefix="$" value={inputs.existTotalPayment} onChange={(v) => set("existTotalPayment", v)} step={50} />
            <NumInput label="Interest Rate" suffix="%" value={inputs.existRate} onChange={(v) => set("existRate", v)} step={0.001} optional />
            <NumInput label="Monthly Escrow" prefix="$" value={inputs.existEscrow} onChange={(v) => set("existEscrow", v)} step={25} optional />
            <NumInput label="Years Remaining" value={inputs.existYearsRemaining} onChange={(v) => set("existYearsRemaining", v)} step={1} optional />
          </div>
        )}
      </div>

      {/* New Loan */}
      <div>
        <SectionHeader>New Loan</SectionHeader>
        <div className="grid grid-cols-2 gap-3">
          <NumInput label="Loan Amount" prefix="$" value={inputs.loanAmount} onChange={(v) => set("loanAmount", v)} step={1000} />
          <NumInput label="Interest Rate" suffix="%" value={inputs.loanRate} onChange={(v) => set("loanRate", v)} step={0.001} />
          <NumInput label="Closing Costs" prefix="$" value={inputs.closingCosts} onChange={(v) => set("closingCosts", v)} step={100} />
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">Term</Label>
            <Select value={String(inputs.termYears)} onValueChange={(v) => set("termYears", parseInt(v, 10))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[10, 15, 20, 25, 30].map((y) => (
                  <SelectItem key={y} value={String(y)}>{y} years</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <NumInput label="Cash Back at Closing" prefix="$" value={inputs.cashBack} onChange={(v) => set("cashBack", v)} step={500} optional />
          <NumInput label="APR (override)" suffix="%" value={inputs.customApr} onChange={(v) => set("customApr", v)} step={0.001} optional placeholder={autoApr > 0 ? autoApr.toFixed(3) : undefined} />
        </div>
        <div className="mt-3 p-2 rounded bg-muted/40 text-[11px] text-muted-foreground space-y-0.5">
          <div>
            APR in use: <strong className="text-primary">{effectiveApr > 0 ? pct(effectiveApr) : "—"}</strong>{" "}
            <span className="text-muted-foreground">({usingCustomApr ? "manual override" : "auto from closing costs"})</span>
          </div>
          {usingCustomApr && (
            <button
              type="button"
              className="text-[11px] underline text-muted-foreground hover:text-primary"
              onClick={() => set("customApr", 0)}
            >
              Clear override and use auto APR ({autoApr > 0 ? pct(autoApr) : "—"})
            </button>
          )}
          <div className="pt-0.5">
            Leave APR blank to auto-calculate. Enter your Loan Estimate APR to override.
          </div>
          <div>
            Extra principal: <strong className="text-primary">auto = monthly savings</strong> (locked)
          </div>
        </div>
      </div>

      {/* Debts (no rate column) */}
      <div>
        <SectionHeader>Debts to Consolidate</SectionHeader>
        <div className="space-y-2">
          {inputs.debts.map((d, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-1.5 items-center p-2 rounded bg-secondary/30">
              <Input
                placeholder="Debt name"
                value={d.name}
                onChange={(e) => updateDebt(i, "name", e.target.value)}
                className="text-xs h-8"
              />
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                <Input
                  type="number" placeholder="Balance"
                  value={d.balance || ""} step={100}
                  onChange={(e) => updateDebt(i, "balance", e.target.value)}
                  className="pl-5 w-24 text-xs h-8"
                />
              </div>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                <Input
                  type="number" placeholder="Min pmt"
                  value={d.payment || ""} step={5}
                  onChange={(e) => updateDebt(i, "payment", e.target.value)}
                  className="pl-5 w-24 text-xs h-8"
                />
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => removeDebt(i)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="mt-2" onClick={addDebt}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Debt
        </Button>
      </div>

      {/* Headshot upload */}
      <div>
        <SectionHeader>Headshot (this session)</SectionHeader>
        <div className="flex items-center gap-3">
          {inputs.headshotDataUrl ? (
            <img src={inputs.headshotDataUrl} alt="headshot preview" className="h-12 w-12 rounded-full object-cover border-2 border-accent" />
          ) : (
            <div className="h-12 w-12 rounded-full border-2 border-dashed border-muted-foreground/40 flex items-center justify-center text-muted-foreground">
              <ImageIcon className="h-5 w-5" />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleHeadshotUpload}
            />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-3.5 w-3.5 mr-1.5" /> {inputs.headshotDataUrl ? "Replace" : "Upload"}
            </Button>
            {inputs.headshotDataUrl && (
              <Button variant="ghost" size="sm" onClick={() => set("headshotDataUrl", undefined)}>
                <X className="h-3.5 w-3.5 mr-1.5" /> Remove
              </Button>
            )}
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">PNG/JPG, max 2MB. Stays in your browser session only.</p>
      </div>

      {/* Advisor info (collapsible) — license states removed (hardcoded) */}
      <Collapsible open={advisorOpen} onOpenChange={setAdvisorOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${advisorOpen ? "rotate-180" : ""}`} />
            {advisorOpen ? "Hide" : "Customize"} advisor info
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <SectionHeader>Advisor Information</SectionHeader>
          <div className="grid grid-cols-2 gap-3">
            {([
              ["Prepared By", "preparedBy", DEFAULT_ADVISOR.preparedBy],
              ["Title", "preparedByTitle", DEFAULT_ADVISOR.preparedByTitle],
              ["Company", "companyName", DEFAULT_ADVISOR.companyName],
              ["Phone", "contactPhone", DEFAULT_ADVISOR.contactPhone],
              ["Email", "contactEmail", DEFAULT_ADVISOR.contactEmail],
              ["Personal NMLS", "contactNMLS", DEFAULT_ADVISOR.contactNMLS],
              ["Company NMLS", "companyNMLS", DEFAULT_ADVISOR.companyNMLS],
            ] as const).map(([label, key, placeholder]) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
                <Input
                  placeholder={placeholder}
                  value={(inputs[key] as string) ?? ""}
                  onChange={(e) => set(key, e.target.value)}
                  className="text-sm"
                />
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            Licensed states are hardcoded in the compliance footer (AZ, CO, CT, FL, MI, MN, OR, PA, TX, VA, WA).
          </p>
        </CollapsibleContent>
      </Collapsible>

      {/* Action buttons */}
      <div className="space-y-2 pt-2 border-t">
        <Button variant="outline" className="w-full" onClick={onPrint}>
          <Printer className="mr-2 h-4 w-4" /> Print / Save as PDF
        </Button>
        <Button
          className="w-full bg-primary hover:bg-primary/90 text-white"
          onClick={onDownloadPdf}
          disabled={pdfLoading}
        >
          <Download className="mr-2 h-4 w-4" />
          {pdfLoading ? "Generating PDF…" : "Download PDF"}
        </Button>
        {!isInternal && onEmailSelf && (
          <Button className="w-full bg-accent hover:bg-accent/90 text-white" onClick={onEmailSelf}>
            <Mail className="mr-2 h-4 w-4" /> Email Worksheet to Myself
          </Button>
        )}
        {isInternal && onEmailClient && (
          <Button className="w-full bg-accent hover:bg-accent/90 text-white" onClick={onEmailClient}>
            <Mail className="mr-2 h-4 w-4" /> Send to Client
          </Button>
        )}
      </div>
    </div>
  );
}
