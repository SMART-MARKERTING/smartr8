import { ShieldCheck, Handshake, Lock } from "lucide-react";
import { LO_NAME, NMLS_ID, EQUAL_HOUSING_TEXT } from "@/lib/compliance";

const BRAND_TEAL = "#13485A";
const GREEN = "#1F8A5F";

interface TrustItem {
  icon: typeof ShieldCheck;
  title: string;
  body: string;
}

const ITEMS: TrustItem[] = [
  {
    icon: ShieldCheck,
    title: "Licensed mortgage guidance",
    body: `Work directly with ${LO_NAME}, a licensed mortgage professional (NMLS ${NMLS_ID}). Recommendations are tailored to your scenario and subject to underwriting and a full application review.`,
  },
  {
    icon: Handshake,
    title: "No-obligation consultation",
    body: "See your options with no obligation and no commitment to move forward. There's no credit pull just to review what may fit your goals.",
  },
  {
    icon: Lock,
    title: "Secure, private form",
    body: "Your information is submitted over a secure connection and used only to follow up about your inquiry. It is never sold to third parties for marketing.",
  },
];

/**
 * Reusable trust block for the conversion funnels: licensed-guidance,
 * no-obligation, and secure-data messaging (all conditional, no guarantees),
 * plus the NMLS and Equal Housing Opportunity markers.
 */
export function TrustBlock() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="grid gap-5 sm:grid-cols-3">
        {ITEMS.map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-2xl border border-border p-5 bg-white text-center sm:text-left">
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center mb-3 mx-auto sm:mx-0"
              style={{ backgroundColor: "rgba(31,138,95,0.12)" }}
            >
              <Icon className="h-5 w-5" style={{ color: GREEN }} />
            </div>
            <h3 className="text-sm font-bold mb-1" style={{ color: BRAND_TEAL }}>
              {title}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-col items-center gap-2 text-center">
        <div className="flex items-center gap-2 text-sm font-medium" style={{ color: BRAND_TEAL }}>
          <ShieldCheck className="h-4 w-4" style={{ color: GREEN }} />
          {LO_NAME} · NMLS {NMLS_ID}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <img
            src="/eho-logo-optimized.png"
            alt={EQUAL_HOUSING_TEXT}
            width={14}
            height={15}
            loading="lazy"
            decoding="async"
            className="h-3.5 w-auto object-contain"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
          {EQUAL_HOUSING_TEXT}
        </div>
      </div>
    </div>
  );
}
