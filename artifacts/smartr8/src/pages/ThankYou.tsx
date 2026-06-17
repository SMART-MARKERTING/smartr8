import { useEffect } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
export default function ThankYou() {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = "Thanks, talk soon";

    let robotsMeta = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    const createdRobots = !robotsMeta;
    if (!robotsMeta) {
      robotsMeta = document.createElement("meta");
      robotsMeta.setAttribute("name", "robots");
      document.head.appendChild(robotsMeta);
    }
    const prevRobots = robotsMeta.getAttribute("content");
    robotsMeta.setAttribute("content", "noindex, nofollow");

    // Inject Cal.com script
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.innerHTML = `
      (function (C, A, L) {
        let p = function (a, ar) { a.q.push(ar); };
        let d = C.document;
        C.Cal = C.Cal || function () {
          let cal = C.Cal;
          let ar = arguments;
          if (!cal.loaded) {
            cal.ns = {};
            cal.q = cal.q || [];
            d.head.appendChild(d.createElement("script")).src = A;
            cal.loaded = true;
          }
          if (ar[0] === L) {
            const api = function () { p(api, arguments); };
            const namespace = ar[1];
            api.q = api.q || [];
            if (typeof namespace === "string") {
              cal.ns[namespace] = cal.ns[namespace] || api;
              p(cal.ns[namespace], ar);
              return;
            }
            p(cal, ar);
            return;
          }
          p(cal, ar);
        };
      })(window, "https://app.cal.com/embed/embed.js", "init");
      Cal("init", "15-min-loan-consult-meeting", { origin: "https://app.cal.com" });
      Cal.ns["15-min-loan-consult-meeting"]("inline", {
        elementOrSelector: "#my-cal-inline",
        config: { layout: "month_view" },
        calLink: "mykoal/15-min-loan-consult-meeting",
      });
      Cal.ns["15-min-loan-consult-meeting"]("ui", { hideEventTypeDetails: false, layout: "month_view" });
    `;
    document.body.appendChild(script);

    return () => {
      document.title = prevTitle;
      if (robotsMeta) {
        if (createdRobots) {
          document.head.removeChild(robotsMeta);
        } else {
          robotsMeta.setAttribute("content", prevRobots ?? "");
        }
      }
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, []);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <Header />

      <main className="flex-1 flex flex-col items-center justify-start pt-20 pb-12 px-4 container mx-auto max-w-4xl text-center">
        <div className="animate-in fade-in zoom-in duration-500 max-w-2xl w-full">
          {/* Check mark circle — light teal bg, dark teal check */}
          <div
            className="h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-8"
            style={{ backgroundColor: "rgba(26,58,71,0.12)" }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={3}
              stroke="#1A3A47"
              className="w-8 h-8"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-6" style={{ color: "#1A3A47" }}>
            Got it. Let's talk.
          </h1>

          <p className="text-xl text-muted-foreground leading-relaxed mb-8">
            I'll review what you sent and reach out within a few hours. If you want to lock in a time now, grab a slot below. While you wait, save my number:{" "}
            <a href="tel:4802069290" className="font-semibold hover:underline" style={{ color: "#1A3A47" }}>
              (480) 206-9290
            </a>
            . Text me anytime.
          </p>

          {/* Cal.com booking section */}
          <div className="w-full mb-8">
            <h2 className="text-2xl font-bold mb-2" style={{ color: "#1A3A47" }}>Book a 15-minute call</h2>
            <p className="text-muted-foreground mb-6">Pick a time that works for you. I'll call you at the number you provided.</p>
            <div
              id="my-cal-inline"
              className="w-full border border-border rounded-xl bg-white shadow-sm overflow-hidden min-h-[500px] sm:min-h-[600px]"
              data-testid="calcom-embed"
            />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
