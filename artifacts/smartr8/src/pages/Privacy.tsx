import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { PageMeta } from "@/components/PageMeta";

const EFFECTIVE_DATE = "May 30, 2026";
const CONTACT_PHONE_DISPLAY = "(480) 206-9290";
const CONTACT_PHONE_TEL = "tel:+14802069290";
const CONTACT_EMAIL = "mykoal@adaxahome.com";

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xl sm:text-2xl font-bold text-primary mt-10 mb-3">{children}</h2>;
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-lg font-semibold text-foreground mt-6 mb-2">{children}</h3>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-base text-foreground/85 leading-relaxed mb-3">{children}</p>;
}

function UL({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc pl-6 mb-3 text-foreground/85 leading-relaxed space-y-1">{children}</ul>;
}

export default function Privacy() {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <PageMeta
        title="Privacy Policy | Mykoal DeShazo at Adaxa Home"
        description="Privacy Policy for smartr8.com, including SMS communication policy and A2P opt-in/opt-out disclosures. Mykoal DeShazo, NMLS #1912347."
        canonical="/privacy"
      />
      <Header />

      <main className="flex-1 px-4 py-10 sm:py-16">
        <article className="container mx-auto max-w-3xl">
          <h1 className="text-3xl sm:text-4xl font-bold text-primary mb-2">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground mb-8">
            Effective {EFFECTIVE_DATE}
          </p>

          <H2>1. Agreement</H2>
          <P>
            Mykoal DeShazo (NMLS #1912347), operating under Adaxa Home, LLC
            (NMLS #2380533) (collectively &ldquo;we,&rdquo; &ldquo;us,&rdquo;
            or &ldquo;our&rdquo;), respects your privacy and is committed to
            protecting the personal information you share with us.
          </P>
          <P>
            By using smartr8.com you agree to the terms of this Privacy Policy
            and consent to the collection, use, and sharing of your information
            as described below. If you do not agree, please do not use the
            website. Providing personal information is voluntary; certain
            features may be unavailable if you choose not to provide it.
          </P>

          <H2>2. Information we collect</H2>

          <H3>Information you provide</H3>
          <UL>
            <li>Name</li>
            <li>Email address</li>
            <li>Phone number</li>
            <li>Mailing address</li>
            <li>Financial and loan-related details (e.g., income, assets, mortgage balance, credit range)</li>
            <li>Any other information you submit through forms on the website</li>
          </UL>

          <H3>Information collected automatically</H3>
          <UL>
            <li>IP address</li>
            <li>Browser type and version</li>
            <li>Device information</li>
            <li>Website usage data (pages viewed, time on page, referring URL)</li>
          </UL>

          <H3>Information from third parties</H3>
          <P>We may receive information from credit bureaus, identity-verification services, and social platforms when you choose to use them with our forms.</P>

          <H2>3. Cookies and tracking technologies</H2>
          <P>We use cookies, pixels, and similar technologies to:</P>
          <UL>
            <li>Improve your experience on the website</li>
            <li>Analyze website traffic and performance</li>
            <li>Run advertising campaigns (Meta, Google) and measure their results</li>
          </UL>
          <P>You can disable cookies in your browser settings, though some features may not function correctly without them.</P>

          <H2>4. How we use your information</H2>
          <UL>
            <li>Process loan applications and pre-qualification requests</li>
            <li>Respond to your inquiries</li>
            <li>Provide customer support</li>
            <li>Send service-related updates</li>
            <li>Improve our services and website</li>
            <li>Send marketing communications, only with your consent</li>
          </UL>

          <H2>5. SMS communication and A2P 10DLC compliance</H2>

          <H3>Consent to receive SMS</H3>
          <P>
            By providing your phone number through any form on this website,
            you give express written consent to receive SMS and MMS messages
            from Mykoal DeShazo and Adaxa Home, LLC. These messages may include:
          </P>
          <UL>
            <li>Application updates</li>
            <li>Loan status notifications</li>
            <li>Appointment reminders</li>
            <li>Document requests</li>
            <li>Other service-related alerts</li>
          </UL>
          <P><strong>Consent is not a condition of any purchase.</strong></P>

          <H3>Message frequency</H3>
          <P>Message frequency may vary based on your interaction and account activity.</P>

          <H3>Message and data rates</H3>
          <P>Message and data rates may apply per your mobile carrier plan.</P>

          <H3>Opt-out</H3>
          <P>
            You may opt out at any time by replying <strong>STOP</strong>,{" "}
            <strong>END</strong>, <strong>CANCEL</strong>,{" "}
            <strong>UNSUBSCRIBE</strong>, or <strong>QUIT</strong> to any
            message we send. After opting out you will no longer receive
            messages unless you re-subscribe.
          </P>

          <H3>Help</H3>
          <P>
            For help, reply <strong>HELP</strong> to any message or call{" "}
            <a href={CONTACT_PHONE_TEL} className="underline font-medium">
              {CONTACT_PHONE_DISPLAY}
            </a>
            .
          </P>

          <H3>SMS data sharing</H3>
          <P>SMS consent and mobile-opt-in data are not shared with third parties for marketing purposes. SMS is used only for service-related communications described above.</P>

          <H2>6. Sharing of information</H2>
          <P>We may share your information only in these cases:</P>
          <UL>
            <li>With service providers we rely on for verification, processing, CRM, and email/SMS delivery (each bound by confidentiality and use restrictions)</li>
            <li>To comply with legal obligations or respond to lawful requests</li>
            <li>To protect our rights or prevent fraud</li>
            <li>With your explicit consent</li>
          </UL>
          <P><strong>We do not sell your personal information.</strong></P>

          <H2>7. Data security</H2>
          <P>We use reasonable administrative and technical safeguards including TLS encryption in transit, secure cloud-hosted infrastructure (Cloudflare, GoHighLevel, Resend), and access controls on internal systems. No system is 100% secure; you provide information at your own risk.</P>

          <H2>8. Your rights</H2>
          <P>You have the right to:</P>
          <UL>
            <li>Opt out of marketing communications</li>
            <li>Request deletion of your personal data</li>
            <li>Update or correct information we hold about you</li>
            <li>Request a copy of the information we hold</li>
          </UL>
          <P>
            To make a request, contact us at{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="underline font-medium">
              {CONTACT_EMAIL}
            </a>{" "}
            or{" "}
            <a href={CONTACT_PHONE_TEL} className="underline font-medium">
              {CONTACT_PHONE_DISPLAY}
            </a>
            .
          </P>

          <H2>9. Children&rsquo;s privacy</H2>
          <P>This website is intended for individuals 18 and older. We do not knowingly collect information from anyone under 18.</P>

          <H2>10. Changes to this policy</H2>
          <P>We may update this Privacy Policy at any time. Updates take effect when posted on this page. Continued use of the website after an update constitutes acceptance of the revised policy.</P>

          <div className="mt-10 p-5 rounded-xl border border-border bg-secondary/40">
            <p className="text-sm text-foreground/85 leading-relaxed">
              For more information about Adaxa Home, LLC&rsquo;s broader
              corporate Privacy Policy, please see{" "}
              <a
                href="https://adaxahome.com/privacy/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-medium"
              >
                adaxahome.com/privacy
              </a>
              .
            </p>
          </div>
        </article>
      </main>

      <Footer />
    </div>
  );
}
