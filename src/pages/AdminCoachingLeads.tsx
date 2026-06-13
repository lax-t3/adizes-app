import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Search, Download, Loader2, X, Mail, Phone, Building2, MessageSquare, Clock, Briefcase, Globe } from "lucide-react";
import {
  listCoachingLeads, updateLeadActioned, downloadCoachingLeadsExport,
  type CoachingLead,
} from "@/api/coaching";
import { useCoachingLeadsStore } from "@/store/coachingLeadsStore";

function fmt(ts?: string | null): string {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString("en-GB", {
      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return ts;
  }
}

function LeadDetailModal({ lead, onClose }: { lead: CoachingLead; onClose: () => void }) {
  const Row = ({ icon, label, value, href }: { icon: React.ReactNode; label: string; value?: string | null; href?: string }) => (
    <div className="flex gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="text-gray-400 mt-0.5">{icon}</div>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</div>
        {href && value ? (
          <a href={href} className="text-sm text-primary hover:underline break-words">{value}</a>
        ) : (
          <div className="text-sm text-gray-800 break-words whitespace-pre-wrap">{value || "—"}</div>
        )}
      </div>
    </div>
  );
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} aria-label="Close" className="absolute top-4 right-4 text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-1">
            <h3 className="text-xl font-bold text-gray-900">{lead.name}</h3>
            <Badge className={lead.actioned ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}>
              {lead.actioned ? "Actioned" : "Yet to action"}
            </Badge>
          </div>
          <div className="mt-4">
            <Row icon={<Mail className="h-4 w-4" />} label="Email" value={lead.email} href={`mailto:${lead.email}`} />
            <Row icon={<Building2 className="h-4 w-4" />} label="Organization" value={lead.organization} />
            <Row icon={<Briefcase className="h-4 w-4" />} label="Designation" value={lead.designation} />
            <Row icon={<Globe className="h-4 w-4" />} label="Country" value={lead.country} />
            <Row icon={<Phone className="h-4 w-4" />} label="Phone" value={lead.phone} href={lead.phone ? `tel:${lead.phone}` : undefined} />
            <Row icon={<MessageSquare className="h-4 w-4" />} label="Message" value={lead.message} />
            <Row icon={<Clock className="h-4 w-4" />} label="Captured" value={fmt(lead.created_at)} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminCoachingLeads() {
  const [leads, setLeads] = useState<CoachingLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<CoachingLead | null>(null);
  const [exporting, setExporting] = useState(false);
  const setPendingBadge = useCoachingLeadsStore((s) => s.setPending);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const data = await listCoachingLeads(q);
      setLeads(data);
      // keep the sidebar badge in sync (only meaningful for the unfiltered list)
      if (!q) setPendingBadge(data.filter((l) => !l.actioned).length);
    } finally {
      setLoading(false);
    }
  }, [setPendingBadge]);

  useEffect(() => { load(""); }, [load]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => load(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query, load]);

  const toggleActioned = async (lead: CoachingLead, next: boolean) => {
    // optimistic update of the list + the sidebar badge
    const updated = leads.map((l) => (l.id === lead.id ? { ...l, actioned: next } : l));
    setLeads(updated);
    setPendingBadge(updated.filter((l) => !l.actioned).length);
    try {
      await updateLeadActioned(lead.id, next);
    } catch {
      const reverted = leads.map((l) => (l.id === lead.id ? { ...l, actioned: !next } : l));
      setLeads(reverted);
      setPendingBadge(reverted.filter((l) => !l.actioned).length);
    }
  };

  const onExport = async () => {
    setExporting(true);
    try { await downloadCoachingLeadsExport(); } finally { setExporting(false); }
  };

  const pending = leads.filter((l) => !l.actioned).length;

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Coaching Leads</h1>
          <p className="text-sm text-gray-500">Requests from the LEAP™ Coaching “Schedule a Conversation” form.</p>
        </div>
        <Button onClick={onExport} disabled={exporting || leads.length === 0} variant="outline">
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          <span className="ml-2">Excel</span>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>All Leads</CardTitle>
              <CardDescription>{leads.length} total · {pending} yet to action</CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, email, org, message…"
                className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-16 text-center text-gray-400"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : leads.length === 0 ? (
            <div className="py-16 text-center text-gray-400">{query ? "No leads match your search." : "No coaching leads yet."}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400 border-b border-gray-200">
                    <th className="px-3 py-3 w-28">Actioned</th>
                    <th className="px-3 py-3">Captured</th>
                    <th className="px-3 py-3">Name</th>
                    <th className="px-3 py-3">Email</th>
                    <th className="px-3 py-3">Organization</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => setSelected(lead)}>
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={lead.actioned}
                            onChange={(e) => toggleActioned(lead, e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/30"
                          />
                          <span className={`text-xs font-medium ${lead.actioned ? "text-green-600" : "text-amber-600"}`}>
                            {lead.actioned ? "Done" : "Pending"}
                          </span>
                        </label>
                      </td>
                      <td className="px-3 py-3 text-gray-500 whitespace-nowrap">{fmt(lead.created_at)}</td>
                      <td className="px-3 py-3 font-medium text-gray-900">{lead.name}</td>
                      <td className="px-3 py-3 text-gray-600">{lead.email}</td>
                      <td className="px-3 py-3 text-gray-600">{lead.organization || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {selected && <LeadDetailModal lead={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
