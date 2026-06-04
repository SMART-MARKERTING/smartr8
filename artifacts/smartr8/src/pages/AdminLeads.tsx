import { useEffect, useState } from "react";
import { Lock, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageMeta } from "@/components/PageMeta";
import { useToast } from "@/hooks/use-toast";

// Per-tab storage for the admin token (the shared admin password). Sent as the
// X-Admin-Token header to the /api/admin/* endpoints, which compare it to
// WORKSHEET_ADMIN_PASS. Cleared automatically when the tab closes.
const TOKEN_KEY = "smartr8_admin_token";

interface LeadRow {
  lead_id: string;
  created_at: number;
  funnel: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone_e164: string | null;
  property_state: string | null;
  ghl_contact_id: string | null;
  ghl_status: string | null;
  ghl_upsert_status: string | null;
  leadmailbox_status: string | null;
}

function fmtDate(ms: number): string {
  try {
    return new Date(ms).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return String(ms);
  }
}

function fullName(l: LeadRow): string {
  return [l.first_name, l.last_name].filter(Boolean).join(" ") || "—";
}

export default function AdminLeads() {
  const { toast } = useToast();
  const [token, setToken] = useState<string>(() => sessionStorage.getItem(TOKEN_KEY) ?? "");
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function loadLeads(t: string) {
    setLoading(true);
    setLoginError(null);
    try {
      const res = await fetch("/api/admin/leads", { headers: { "X-Admin-Token": t } });
      if (res.status === 401) {
        sessionStorage.removeItem(TOKEN_KEY);
        setAuthed(false);
        setToken("");
        setLoginError("Invalid password.");
        return;
      }
      const data = (await res.json()) as { ok: boolean; leads?: LeadRow[]; error?: string };
      if (!res.ok || !data.ok) {
        setLoginError(data.error ?? "Could not load leads.");
        return;
      }
      sessionStorage.setItem(TOKEN_KEY, t);
      setToken(t);
      setAuthed(true);
      setLeads(data.leads ?? []);
    } catch {
      setLoginError("Could not reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }

  // Auto-load if a token is already stored for this tab.
  useEffect(() => {
    if (token) void loadLeads(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    await loadLeads(password);
  }

  function handleLogout() {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken("");
    setAuthed(false);
    setLeads([]);
    setPassword("");
  }

  async function removeFromPipeline(lead: LeadRow) {
    const name = fullName(lead);
    if (
      !confirm(
        `Remove ${name}'s opportunity from the pipeline?\n\nThis deletes the card from your GHL pipeline board. The contact stays in GHL and the lead record is kept.`,
      )
    ) {
      return;
    }
    setRemovingId(lead.lead_id);
    try {
      const res = await fetch("/api/admin/remove-opportunity", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Token": token },
        body: JSON.stringify({ lead_id: lead.lead_id }),
      });
      const data = (await res.json()) as { ok: boolean; removed?: number; message?: string; error?: string };
      if (res.status === 401) {
        handleLogout();
        return;
      }
      if (data.ok && (data.removed ?? 0) > 0) {
        toast({ title: "Removed from pipeline", description: `${name}: ${data.removed} opportunity removed.` });
        setLeads((prev) =>
          prev.map((l) => (l.lead_id === lead.lead_id ? { ...l, ghl_status: "removed" } : l)),
        );
      } else if (data.ok) {
        toast({ title: "Nothing to remove", description: data.message ?? "No pipeline opportunity found for this lead." });
        setLeads((prev) =>
          prev.map((l) => (l.lead_id === lead.lead_id ? { ...l, ghl_status: "removed" } : l)),
        );
      } else {
        toast({ title: "Couldn't remove", description: data.error ?? "Unknown error.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", description: "Could not reach the server.", variant: "destructive" });
    } finally {
      setRemovingId(null);
    }
  }

  if (!authed) {
    return (
      <>
        <PageMeta title="Admin · Leads" description="Internal lead management." canonical="https://smartr8.com/admin/leads" noIndex />
        <div className="min-h-screen bg-background flex items-center justify-center px-4">
          <div className="bg-card border rounded-xl shadow-lg p-8 w-full max-w-sm">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4 mx-auto">
              <Lock className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-primary text-center mb-1">Lead Admin</h1>
            <p className="text-sm text-muted-foreground text-center mb-6">Adaxa Home team only</p>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
              {loginError && <p className="text-destructive text-sm">{loginError}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Sign In
              </Button>
            </form>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageMeta title="Admin · Leads" description="Internal lead management." canonical="https://smartr8.com/admin/leads" noIndex />
      <div className="min-h-screen bg-background px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-primary">Leads</h1>
              <p className="text-sm text-muted-foreground">
                {leads.length} most recent · &ldquo;Remove&rdquo; deletes the GHL pipeline card only.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => loadLeads(token)} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                Sign out
              </Button>
            </div>
          </div>

          <div className="border rounded-lg overflow-x-auto bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                  <th className="px-3 py-2 font-medium whitespace-nowrap">Date</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium whitespace-nowrap">Phone</th>
                  <th className="px-3 py-2 font-medium">Funnel</th>
                  <th className="px-3 py-2 font-medium">State</th>
                  <th className="px-3 py-2 font-medium">Pipeline</th>
                  <th className="px-3 py-2 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {leads.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                      {loading ? "Loading…" : "No leads yet."}
                    </td>
                  </tr>
                )}
                {leads.map((l) => {
                  const removed = l.ghl_status === "removed";
                  return (
                    <tr key={l.lead_id} className="border-b last:border-0 hover:bg-muted/20 align-top">
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{fmtDate(l.created_at)}</td>
                      <td className="px-3 py-2 font-medium text-primary">{fullName(l)}</td>
                      <td className="px-3 py-2">
                        {l.email ? <a className="text-accent hover:underline" href={`mailto:${l.email}`}>{l.email}</a> : "—"}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{l.phone_e164 || "—"}</td>
                      <td className="px-3 py-2">{l.funnel}</td>
                      <td className="px-3 py-2">{l.property_state || "—"}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-block rounded px-1.5 py-0.5 text-xs ${
                            removed
                              ? "bg-muted text-muted-foreground"
                              : l.ghl_contact_id
                                ? "bg-green-100 text-green-800"
                                : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {removed ? "removed" : l.ghl_contact_id ? "on pipeline" : "no contact"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10"
                          disabled={removed || !l.ghl_contact_id || removingId === l.lead_id}
                          onClick={() => removeFromPipeline(l)}
                        >
                          {removingId === l.lead_id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                          <span className="ml-1 hidden sm:inline">Remove</span>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
