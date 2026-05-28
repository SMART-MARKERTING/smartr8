import { useEffect } from "react";
import { useLocation, useSearch } from "wouter";

// Backwards-compat redirect. The two-option chooser has been replaced by the
// single-card auto-redirect experience at /heloc/next-step-v2 (see PR-A).
// We keep this route alive so any stale browser bookmarks, ad URLs, or
// internal links still land users on the new flow with their query params
// intact. Rendered as null with a replace-history navigation so the back
// button doesn't loop.
export default function HelocInstantOptionsV2() {
  const [, setLocation] = useLocation();
  const search = useSearch();

  useEffect(() => {
    const qs = search ? `?${search}` : "";
    setLocation(`/heloc/next-step-v2${qs}`, { replace: true });
  }, [search, setLocation]);

  return null;
}
