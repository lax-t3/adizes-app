import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import {
  Plus, Users, ArrowRight, X, Loader2, Trash2, Search,
  CalendarDays, CheckCircle2, Clock, SortAsc, MoreVertical,
  Archive, RotateCcw, CheckSquare,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { listCohorts, createCohort, deleteCohort, updateCohortStatus } from "@/api/admin";
import type { CohortSummary } from "@/types/api";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7)  return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function timelineBucket(iso: string): "this-month" | "last-3-months" | "older" {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days <= 30)  return "this-month";
  if (days <= 90)  return "last-3-months";
  return "older";
}

function completionStatus(pct: number, memberCount: number) {
  if (memberCount === 0) return { label: "Empty",       color: "text-gray-500",  bg: "bg-gray-50 border-gray-200",   dot: "bg-gray-400" };
  if (pct === 100)       return { label: "Complete",    color: "text-green-700", bg: "bg-green-50 border-green-200", dot: "bg-green-500" };
  if (pct >= 50)         return { label: "Active",      color: "text-blue-700",  bg: "bg-blue-50 border-blue-200",   dot: "bg-blue-500" };
  return                        { label: "In Progress", color: "text-amber-700", bg: "bg-amber-50 border-amber-200", dot: "bg-amber-400" };
}

// ─── Sort ─────────────────────────────────────────────────────────────────────

type SortKey = "latest" | "oldest" | "members" | "completion";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "latest",     label: "Latest first" },
  { value: "oldest",     label: "Oldest first" },
  { value: "members",    label: "Most members" },
  { value: "completion", label: "Completion %" },
];

function sortCohorts(cohorts: CohortSummary[], key: SortKey): CohortSummary[] {
  return [...cohorts].sort((a, b) => {
    if (key === "latest")     return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (key === "oldest")     return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (key === "members")    return b.member_count - a.member_count;
    if (key === "completion") return b.completion_pct - a.completion_pct;
    return 0;
  });
}

// ─── Status filter tabs ───────────────────────────────────────────────────────

type StatusFilter = "active" | "completed" | "archived";

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "active",    label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "archived",  label: "Archived" },
];

// ─── Cohort action menu ───────────────────────────────────────────────────────

function CohortActionMenu({
  cohort,
  onStatusChange,
}: {
  cohort: CohortSummary;
  onStatusChange: (id: string, status: "active" | "completed" | "archived") => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const cs = cohort.cohort_status as StatusFilter;

  const actions: { label: string; icon: React.ReactNode; next: "active" | "completed" | "archived"; danger?: boolean }[] = [];

  if (cs === "active") {
    actions.push({ label: "Mark as Completed", icon: <CheckSquare className="h-3.5 w-3.5" />, next: "completed" });
    actions.push({ label: "Archive",            icon: <Archive className="h-3.5 w-3.5" />,    next: "archived",  danger: true });
  }
  if (cs === "completed") {
    actions.push({ label: "Restore to Active",  icon: <RotateCcw className="h-3.5 w-3.5" />,  next: "active" });
    actions.push({ label: "Archive",            icon: <Archive className="h-3.5 w-3.5" />,    next: "archived",  danger: true });
  }
  if (cs === "archived") {
    actions.push({ label: "Restore to Active",  icon: <RotateCcw className="h-3.5 w-3.5" />,  next: "active" });
  }

  if (actions.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        title="Actions"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.1 }}
            className="absolute right-0 top-9 z-20 min-w-[180px] rounded-xl border border-gray-100 bg-white shadow-lg py-1.5"
          >
            {actions.map((a) => (
              <button
                key={a.next}
                onClick={() => { onStatusChange(cohort.id, a.next); setOpen(false); }}
                className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-sm transition-colors hover:bg-gray-50
                  ${a.danger ? "text-red-600" : "text-gray-700"}`}
              >
                {a.icon}
                {a.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Create modal ─────────────────────────────────────────────────────────────

function CreateCohortModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (c: CohortSummary) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const cohort = await createCohort(name.trim(), description.trim() || undefined);
      onCreated(cohort);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Failed to create cohort.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">New Cohort</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cohort Name</label>
            <input
              required
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="e.g. Executive Leadership Team"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              placeholder="Brief description of this group…"
            />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Cohort"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Cohort card ──────────────────────────────────────────────────────────────

function CohortCard({
  cohort,
  onDelete,
  onStatusChange,
  query,
}: {
  cohort: CohortSummary;
  onDelete: (c: CohortSummary) => void;
  onStatusChange: (id: string, status: "active" | "completed" | "archived") => void;
  query: string;
}) {
  const progressStatus = completionStatus(cohort.completion_pct, cohort.member_count);
  const isInactive = cohort.cohort_status !== "active";

  function highlight(text: string) {
    if (!query) return <>{text}</>;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return <>{text}</>;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-yellow-100 text-yellow-900 rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
        {text.slice(idx + query.length)}
      </>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18 }}
    >
      <Card className={`transition-all duration-150 shadow-sm ${
        isInactive
          ? "opacity-70 bg-gray-50 hover:opacity-90"
          : "hover:border-primary/40 hover:shadow-md"
      }`}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4">
            {/* Left */}
            <div className="flex items-start gap-3 min-w-0">
              <div className={`mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${
                isInactive ? "bg-gray-200 text-gray-400" : "bg-gray-100 text-gray-500"
              }`}>
                {cohort.cohort_status === "archived"
                  ? <Archive className="h-5 w-5" />
                  : cohort.cohort_status === "completed"
                    ? <CheckSquare className="h-5 w-5" />
                    : <Users className="h-5 w-5" />
                }
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-0.5">
                  <h3 className="text-base font-semibold text-gray-900 truncate">
                    {highlight(cohort.name)}
                  </h3>
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${progressStatus.bg} ${progressStatus.color}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${progressStatus.dot}`} />
                    {progressStatus.label}
                  </span>
                </div>
                {cohort.description && (
                  <p className="text-sm text-gray-400 truncate max-w-md">
                    {highlight(cohort.description)}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <CalendarDays className="h-3 w-3" />
                    {relativeDate(cohort.created_at)}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <Users className="h-3 w-3" />
                    {cohort.member_count} {cohort.member_count === 1 ? "member" : "members"}
                  </span>
                  {cohort.member_count > 0 && (
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <CheckCircle2 className="h-3 w-3" />
                      {cohort.completed_count} completed
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Right */}
            <div className="flex flex-shrink-0 flex-col items-end gap-3">
              {cohort.member_count > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-28 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${cohort.completion_pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-gray-600 w-8 text-right">
                    {cohort.completion_pct}%
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2">
                {cohort.member_count === 0 && cohort.cohort_status === "active" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600"
                    onClick={() => onDelete(cohort)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
                <CohortActionMenu cohort={cohort} onStatusChange={onStatusChange} />
                <Link to={`/admin/cohorts/${cohort.id}`}>
                  <Button variant="outline" size="sm">
                    View <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Timeline group header ─────────────────────────────────────────────────────

const BUCKET_LABELS: Record<string, string> = {
  "this-month":    "This Month",
  "last-3-months": "Last 3 Months",
  "older":         "Older",
};

function GroupHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-3 mt-6 mb-3 first:mt-0">
      <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</span>
      <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{count}</span>
      <div className="flex-1 h-px bg-gray-100" />
    </div>
  );
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatsBar({ cohorts }: { cohorts: CohortSummary[] }) {
  const active   = cohorts.filter(c => c.cohort_status === "active").length;
  const members  = cohorts.reduce((s, c) => s + c.member_count, 0);
  const done     = cohorts.reduce((s, c) => s + c.completed_count, 0);
  const archived = cohorts.filter(c => c.cohort_status === "archived").length;

  const stats = [
    { icon: <Users className="h-4 w-4" />,        value: active,   label: "Active Cohorts" },
    { icon: <Users className="h-4 w-4" />,        value: members,  label: "Total Members" },
    { icon: <CheckCircle2 className="h-4 w-4" />, value: done,     label: "Assessments Done" },
    { icon: <Archive className="h-4 w-4" />,      value: archived, label: "Archived" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {stats.map((s) => (
        <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3">
          <div className="text-gray-400">{s.icon}</div>
          <div>
            <div className="text-lg font-bold text-gray-900 leading-none">{s.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function AdminCohorts() {
  const [cohorts, setCohorts]       = useState<CohortSummary[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [query, setQuery]           = useState("");
  const [sort, setSort]             = useState<SortKey>("latest");
  const [statusTab, setStatusTab]   = useState<StatusFilter>("active");

  useEffect(() => {
    listCohorts()
      .then(setCohorts)
      .catch(() => setError("Failed to load cohorts."))
      .finally(() => setLoading(false));
  }, []);

  const handleCreated = (cohort: CohortSummary) => {
    setCohorts(prev => [cohort, ...prev]);
  };

  const handleDelete = async (cohort: CohortSummary) => {
    if (!confirm(`Delete cohort "${cohort.name}"? This cannot be undone.`)) return;
    try {
      await deleteCohort(cohort.id);
      setCohorts(prev => prev.filter(c => c.id !== cohort.id));
    } catch (err: any) {
      alert(err?.response?.data?.detail ?? "Failed to delete cohort.");
    }
  };

  const handleStatusChange = async (id: string, next: "active" | "completed" | "archived") => {
    try {
      const updated = await updateCohortStatus(id, next);
      setCohorts(prev => prev.map(c => c.id === id ? { ...c, cohort_status: updated.cohort_status } : c));
    } catch (err: any) {
      alert(err?.response?.data?.detail ?? "Failed to update cohort status.");
    }
  };

  // Filter by status tab + search + sort
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = cohorts.filter(c => c.cohort_status === statusTab);
    if (q) {
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.description ?? "").toLowerCase().includes(q)
      );
    }
    return sortCohorts(list, sort);
  }, [cohorts, query, sort, statusTab]);

  // Tab counts (unfiltered by search)
  const tabCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = { active: 0, completed: 0, archived: 0 };
    for (const c of cohorts) {
      if (c.cohort_status in counts) counts[c.cohort_status as StatusFilter]++;
    }
    return counts;
  }, [cohorts]);

  // Timeline groups (only when not searching)
  const groups = useMemo(() => {
    if (query.trim()) return null;
    const buckets: Record<string, CohortSummary[]> = {
      "this-month": [], "last-3-months": [], "older": [],
    };
    for (const c of filtered) {
      buckets[timelineBucket(c.created_at)].push(c);
    }
    return (["this-month", "last-3-months", "older"] as const)
      .filter(k => buckets[k].length > 0)
      .map(k => ({ key: k, label: BUCKET_LABELS[k], items: buckets[k] }));
  }, [filtered, query]);

  return (
    <div className="p-4 sm:p-8">
      {showCreate && (
        <CreateCohortModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      )}

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h1 className="text-3xl font-display font-bold text-gray-900">Cohorts</h1>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Cohort
          </Button>
        </div>

        {loading && (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{error}</p>
        )}

        {!loading && !error && cohorts.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">No cohorts yet</p>
            <p className="text-sm mt-1">Create your first cohort to get started.</p>
          </div>
        )}

        {!loading && !error && cohorts.length > 0 && (
          <>
            <StatsBar cohorts={cohorts} />

            {/* Status tabs */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-5">
              {STATUS_TABS.map(t => (
                <button
                  key={t.value}
                  onClick={() => { setStatusTab(t.value); setQuery(""); }}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    statusTab === t.value
                      ? "bg-white shadow-sm text-gray-900"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {t.label}
                  {tabCounts[t.value] > 0 && (
                    <span className={`text-xs rounded-full px-1.5 py-0.5 font-semibold ${
                      statusTab === t.value ? "bg-primary text-white" : "bg-gray-200 text-gray-500"
                    }`}>
                      {tabCounts[t.value]}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Search + sort */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search by name or description…"
                  className="w-full h-9 pl-9 pr-9 rounded-lg border border-gray-200 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                />
                {query && (
                  <button onClick={() => setQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 h-9 shadow-sm">
                <SortAsc className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                <select
                  value={sort}
                  onChange={e => setSort(e.target.value as SortKey)}
                  className="text-sm text-gray-700 bg-transparent focus:outline-none pr-1 cursor-pointer"
                >
                  {SORT_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {query.trim() && (
              <p className="text-sm text-gray-500 mb-3">
                {filtered.length === 0
                  ? `No ${statusTab} cohorts match "${query}"`
                  : `${filtered.length} cohort${filtered.length !== 1 ? "s" : ""} match "${query}"`}
              </p>
            )}

            {/* Empty state for tab */}
            {filtered.length === 0 && !query.trim() && (
              <div className="text-center py-14 text-gray-400">
                {statusTab === "active"    && <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />}
                {statusTab === "completed" && <CheckSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />}
                {statusTab === "archived"  && <Archive className="h-10 w-10 mx-auto mb-3 opacity-30" />}
                <p className="text-base font-medium">No {statusTab} cohorts</p>
                {statusTab === "active" && <p className="text-sm mt-1">Create a cohort to get started.</p>}
                {statusTab === "completed" && <p className="text-sm mt-1">Mark active cohorts as complete from the actions menu.</p>}
                {statusTab === "archived" && <p className="text-sm mt-1">Archive cohorts from the actions menu to keep them for records.</p>}
              </div>
            )}

            <AnimatePresence mode="popLayout">
              {filtered.length > 0 && (
                query.trim() ? (
                  <div className="flex flex-col gap-3">
                    {filtered.map(c => (
                      <CohortCard key={c.id} cohort={c} onDelete={handleDelete} onStatusChange={handleStatusChange} query={query} />
                    ))}
                  </div>
                ) : (
                  <div>
                    {groups?.map(group => (
                      <div key={group.key}>
                        <GroupHeader label={group.label} count={group.items.length} />
                        <div className="flex flex-col gap-3">
                          {group.items.map(c => (
                            <CohortCard key={c.id} cohort={c} onDelete={handleDelete} onStatusChange={handleStatusChange} query="" />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </AnimatePresence>
          </>
        )}
      </motion.div>
    </div>
  );
}
