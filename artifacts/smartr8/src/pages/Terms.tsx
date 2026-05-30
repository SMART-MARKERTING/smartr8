import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { PageMeta } from "@/components/PageMeta";

const EFFECTIVE_DATE = "May 30, 2026";
const CONTACT_PHONE_DISPLAY = "(480) 206-9290";
const CONTACT_PHONE_TEL = "tel:+14802069290";

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

export default function Terms() {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <PageMeta
        title="Terms of Use | Mykoal DeShazo at Adaxa Home"
        description="Terms of Use for smartr8.com, including SMS communication policy and A2P opt-in/opt-out disclosures. Mykoal DeShazo, NMLS #1912347."
        canonical="/terms-of-use"
      />
      <Header />

      <main className="flex-1 px-4 py-10 sm:py-16">
        <article className="container mx-auto max-w-3xl">
          <h1 className="text-3xl sm:text-4xl font-bold text-primary mb-2">Terms of Use</h1>
          <p className="text-sm text-muted-foreground mb-8">
            Effective {EFFECTIVE_DATE}
          </p>

          <P>
            Welcome to smartr8.com (the &ldquo;website&rdquo;), operated by
            Mykoal DeShazo (NMLS #1912347), Vice President and Senior Loan
            Officer at Adaxa Home, LLC (NMLS #2380533). By accessing the
            website you agree to these Terms of Use. If you do not agree,
            please do not use the website.
          </P>

          <H2>Website use and your responsibility</H2>
          <P>
            You are responsible for the hardware, software, internet service,
            and any other equipment needed to access this website. We try to
            keep the website available at all times, but it may occasionally be
            unavailable due to maintenance, upstream failures, traffic spikes,
            or other circumstances. We are not liable for any losses or damages
            resulting from such interruptions.
          </P>

          <H2>Access restrictions</H2>
          <P>
            We reserve the right to limit, suspend, or terminate your access to
            the website at any time, without prior notice and without liability.
          </P>
          <P>
            This website is intended for users in jurisdictions where Adaxa
            Home, LLC is licensed to offer mortgage-related services (currently
            AZ, CO, CT, FL, MI, MN, OR, PA, TX, VA, WA). You are responsible
            for complying with the laws of your jurisdiction.
          </P>

          <H2>Security and unauthorized use</H2>
          <P>
            We may ask you to verify your identity before processing certain
            requests. If you believe your information has been used without
            your authorization, contact us immediately at{" "}
            <a href={CONTACT_PHONE_TEL} className="underline font-medium">
              {CONTACT_PHONE_DISPLAY}
            </a>
            . Delays in reporting unauthorized activity may affect remedies
            available to you.
          </P>

          <H2>SMS consent and communication policy (A2P 10DLC)</H2>

          <H3>Express consent</H3>
          <P>
            When you submit your phone number through any form on this website,
            you provide express written consent to receive SMS and MMS messages
            from Mykoal DeShazo and Adaxa Home, LLC related to:
          </P>
          <UL>
            <li>Account updates</li>
            <li>Application status</li>
            <li>Loan processing updates</li>
            <li>Document requests</li>
            <li>Appointment reminders</li>
            <li>Other service-related notifications</li>
          </UL>
          <P><strong>Consent is not a condition of any purchase.</strong></P>

          <H3>Message frequency</H3>
          <P>Message frequency may vary based on your interaction, account status, and service activity.</P>

          <H3>Message and data rates</H3>
          <P>Message and data rates may apply per your mobile carrier plan.</P>

          <H3>Opt-out</H3>
          <P>
            You may opt out of SMS communications at any time by replying{" "}
            <strong>STOP</strong>, <strong>END</strong>, <strong>CANCEL</strong>,{" "}
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

          <H3>Carrier disclaimer</H3>
          <P>Carriers are not liable for delayed or undelivered messages.</P>

          <H3>Technical requirements</H3>
          <P>To receive SMS messages you need a text-enabled mobile device, active mobile service, and sufficient storage on your device.</P>

          <H2>Privacy and data usage</H2>
          <P>
            We respect your privacy. Information you provide is used to deliver
            the services you request and as described in our{" "}
            <a href="/privacy" className="underline font-medium">Privacy Policy</a>
            . We do not sell your personal information. We may share data with
            trusted service providers strictly to fulfill service-related
            functions.
          </P>

          <H2>Consent to communication and verification</H2>
          <P>
            By submitting your information you authorize Mykoal DeShazo and
            Adaxa Home, LLC to contact you and to verify the details you
            provided with third-party services where necessary to deliver
            services.
          </P>

          <H2>Updates to these terms</H2>
          <P>
            We may update these Terms of Use at any time. Updates take effect
            when posted on this page. Continued use of the website after an
            update constitutes acceptance of the revised terms.
          </P>

          <H2>Acknowledgment</H2>
          <P>
            By using this website you confirm that you have read, understood,
            and agree to these Terms of Use and the SMS Consent and
            Communication Policy described above.
          </P>

          <div className="mt-10 p-5 rounded-xl border border-border bg-secondary/40">
            <p className="text-sm text-foreground/85 leading-relaxed">
              For more information about Adaxa Home, LLC&rsquo;s broader
              corporate Terms of Use, please see{" "}
              <a
                href="https://adaxahome.com/terms-of-use/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-medium"
              >
                adaxahome.com/terms-of-use
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
