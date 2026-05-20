/**
 * Runtime warning for legacy logo paths.
 *
 * After the perf-fix batch, /eho-logo.png and /adaxa-logo.jpg are no longer
 * referenced by the app code. Optimized variants (/eho-logo-optimized.png and
 * /adaxa-logo-optimized.jpg) replaced them everywhere. The original files
 * remain in /public until we're sure nothing external (email signatures, CRM
 * templates) still hot-links them.
 *
 * This module scans the rendered DOM for any <img> still using a legacy path
 * and warns once per unique src + route. If the deploy preview runs clean for
 * 24 hours with no warnings in the console (or no Sentry alerts on this
 * warning prefix, if you wire it up), the cleanup commit can safely delete
 * the originals from /public.
 *
 * Delete this file and the LegacyAssetWarn component import in App.tsx once
 * the cleanup commit ships.
 */
import { useEffect } from "react";
import { useLocation } from "wouter";

const LEGACY_PATHS = [
  { legacy: "/eho-logo.png", replacement: "/eho-logo-optimized.png" },
  { legacy: "/adaxa-logo.jpg", replacement: "/adaxa-logo-optimized.jpg" },
] as const;

const warned = new Set<string>();

function scan(location: string): void {
  const imgs = document.querySelectorAll<HTMLImageElement>("img");
  imgs.forEach((img) => {
    const src = img.getAttribute("src") ?? "";
    for (const { legacy, replacement } of LEGACY_PATHS) {
      if (src === legacy || src.endsWith(legacy)) {
        const key = `${src}::${location}`;
        if (warned.has(key)) return;
        warned.add(key);
        console.warn(
          `[smartr8 perf] Legacy logo path referenced on ${location}: ${src}. ` +
            `Switch this <img> to ${replacement} so the legacy file can be deleted.`,
          img,
        );
        return;
      }
    }
  });
}

export function LegacyAssetWarn(): null {
  const [location] = useLocation();
  useEffect(() => {
    // Wait a tick so React has finished rendering the new route before scanning.
    const id = window.setTimeout(() => scan(location), 500);
    return () => window.clearTimeout(id);
  }, [location]);
  return null;
}
