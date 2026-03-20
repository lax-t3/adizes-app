import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Download, ArrowLeft, Users, FileText, UserPlus, X, Loader2, Trash2, Upload, CheckCircle2, AlertCircle, MinusCircle, MailCheck, Plus } from "lucide-react";
import { motion } from "motion/react";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import * as XLSX from "xlsx";
import { getCohort, enrollUser, removeMember, exportCohortCsv, bulkEnroll, resendEnrollmentInvite } from "@/api/admin";
import type { BulkEnrollEntry, BulkEnrollResult } from "@/api/admin";
import type { CohortDetailResponse } from "@/types/api";
import { listCohortOrgs, linkOrgToCohort, unlinkOrgFromCohort,
         enrollFromOrg, listOrganizations, getOrganization,
         listNodeEmployees } from '@/api/organizations';
import type { LinkedOrgSummary, OrgSummary, OrgDetail, OrgEmployeeSummary } from '@/types/api';

const ROLE_COLORS: Record<string, string> = {
  P: "#C8102E",
  A: "#1D3557",
  E: "#E87722",
  I: "#2A9D8F",
};

function EnrollUserModal({
  cohortId,
  onClose,
  onEnrolled,
}: {
  cohortId: string;
  onClose: () => void;
  onEnrolled: () => void;
}) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await enrollUser(cohortId, email.trim());
      onEnrolled();
      if (result?.invited) {
        setSuccessMsg(result.message);
        setTimeout(onClose, 3500);
      } else {
        onClose();
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Failed to enroll user.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Enroll User</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        {successMsg ? (
          <div className="p-6 text-center">
            <div className="text-4xl mb-3">📧</div>
            <p className="text-sm text-green-700 font-medium">{successMsg}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <p className="text-sm text-gray-500">
              Enter any email address. Existing users are added immediately; new users receive an invite email to set up their account.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="user@company.com"
              />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enroll User"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Bulk Enroll Modal ───────────────────────────────────────────────────────

type ParsedRow = BulkEnrollEntry & { _row: number };

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    ["email", "name"],
    ["alice@example.com", "Alice Smith"],
    ["bob@example.com", "Bob Jones"],
  ]);
  ws["!cols"] = [{ wch: 32 }, { wch: 24 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Enroll");
  XLSX.writeFile(wb, "bulk_enroll_template.xlsx");
}

function BulkEnrollModal({
  cohortId,
  onClose,
  onEnrolled,
}: {
  cohortId: string;
  onClose: () => void;
  onEnrolled: () => void;
}) {
  const [step, setStep] = useState<"upload" | "preview" | "result">("upload");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BulkEnrollResult | null>(null);
  const [dragging, setDragging] = useState(false);

  const parseFile = (file: File) => {
    setParseError("");
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });

        if (!json.length) { setParseError("The sheet is empty."); return; }

        const emailKey = Object.keys(json[0]).find(k => k.toLowerCase() === "email");
        const nameKey = Object.keys(json[0]).find(k => k.toLowerCase() === "name");
        if (!emailKey) { setParseError('Could not find an "email" column. Please use the template.'); return; }

        const parsed: ParsedRow[] = [];
        const seen = new Set<string>();
        json.forEach((row, i) => {
          const email = (row[emailKey] ?? "").trim().toLowerCase();
          if (!email || seen.has(email)) return;
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
          seen.add(email);
          parsed.push({ email, name: nameKey ? (row[nameKey] ?? "").trim() : undefined, _row: i + 2 });
        });

        if (!parsed.length) { setParseError("No valid email addresses found in the file."); return; }
        setRows(parsed);
        setStep("preview");
      } catch {
        setParseError("Could not read the file. Please upload a valid .xlsx or .csv file.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      setParseError("Please drop an .xlsx or .csv file.");
      return;
    }
    parseFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = () => setDragging(false);

  const handleEnroll = async () => {
    setLoading(true);
    try {
      const res = await bulkEnroll(cohortId, rows.map(r => ({ email: r.email, name: r.name })));
      setResult(res);
      setStep("result");
      if (res.enrolled.length > 0) onEnrolled();
    } catch (err: any) {
      setParseError(err?.response?.data?.detail ?? "Bulk enrollment failed.");
    } finally {
      setLoading(false);
    }
  };

  const removeRow = (email: string) => {
    setRows(prev => prev.filter(r => r.email !== email));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 sm:mx-auto max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Bulk Enroll</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {step === "upload" && "Step 1 of 2 — Upload file"}
              {step === "preview" && `Step 2 of 2 — Review ${rows.length} user${rows.length !== 1 ? "s" : ""}`}
              {step === "result" && "Enrollment complete"}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ── Step 1: Upload ── */}
          {step === "upload" && (
            <div className="space-y-5">
              <p className="text-sm text-gray-500">
                Upload an Excel (.xlsx) or CSV file with an <strong>email</strong> column and an optional <strong>name</strong> column. New users will receive an invite email automatically.
              </p>
              <button
                onClick={downloadTemplate}
                className="text-sm text-primary hover:underline font-medium"
              >
                Download template ↓
              </button>
              <label
                className={`flex flex-col items-center justify-center w-full h-44 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                  dragging
                    ? "border-primary bg-primary-light scale-[1.01]"
                    : "border-gray-300 hover:border-primary hover:bg-gray-50"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <Upload className={`h-10 w-10 mb-3 transition-colors ${dragging ? "text-primary" : "text-gray-300"}`} />
                <span className="text-sm font-medium text-gray-600">
                  {dragging ? "Drop file here" : "Drag & drop or click to upload"}
                </span>
                <span className="text-xs text-gray-400 mt-1">.xlsx, .xls, or .csv</span>
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileInput} />
              </label>
              {parseError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{parseError}</p>
              )}
            </div>
          )}

          {/* ── Step 2: Preview ── */}
          {step === "preview" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Review the list below. Remove any rows you don't want to enroll, then click <strong>Enroll All</strong>.
              </p>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full min-w-[400px] text-sm text-left">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-2">Email</th>
                      <th className="px-4 py-2">Name</th>
                      <th className="px-4 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.email} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-800">{r.email}</td>
                        <td className="px-4 py-2 text-gray-500">{r.name || "—"}</td>
                        <td className="px-4 py-2">
                          <button
                            onClick={() => removeRow(r.email)}
                            className="text-gray-300 hover:text-red-500 transition-colors"
                            title="Remove row"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parseError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{parseError}</p>
              )}
            </div>
          )}

          {/* ── Step 3: Result ── */}
          {step === "result" && result && (
            <div className="space-y-4">
              {/* Summary pills */}
              <div className="flex flex-wrap gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {result.enrolled.length} enrolled
                </span>
                {result.already_member.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                    <MinusCircle className="h-3.5 w-3.5" /> {result.already_member.length} already member
                  </span>
                )}
                {result.failed.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
                    <AlertCircle className="h-3.5 w-3.5" /> {result.failed.length} failed
                  </span>
                )}
              </div>

              {/* Detail table */}
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-2">Email</th>
                      <th className="px-4 py-2">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.enrolled.map(r => (
                      <tr key={r.email} className="border-b border-gray-100 last:border-0">
                        <td className="px-4 py-2 text-gray-800">{r.email}</td>
                        <td className="px-4 py-2">
                          <span className="inline-flex items-center gap-1 text-green-700 text-xs font-medium">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {r.invited ? "Enrolled + invite sent" : "Enrolled"}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {result.already_member.map(r => (
                      <tr key={r.email} className="border-b border-gray-100 last:border-0 bg-gray-50/50">
                        <td className="px-4 py-2 text-gray-500">{r.email}</td>
                        <td className="px-4 py-2 text-xs text-gray-400">Already a member</td>
                      </tr>
                    ))}
                    {result.failed.map(r => (
                      <tr key={r.email} className="border-b border-gray-100 last:border-0">
                        <td className="px-4 py-2 text-gray-800">{r.email}</td>
                        <td className="px-4 py-2">
                          <span className="inline-flex items-center gap-1 text-red-600 text-xs">
                            <AlertCircle className="h-3.5 w-3.5" /> {r.reason}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t flex-shrink-0">
          {step === "upload" && (
            <Button variant="outline" className="ml-auto" onClick={onClose}>Cancel</Button>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("upload")}>Back</Button>
              <Button
                className="ml-auto"
                disabled={loading || rows.length === 0}
                onClick={handleEnroll}
              >
                {loading
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enrolling…</>
                  : <>Enroll {rows.length} user{rows.length !== 1 ? "s" : ""}</>
                }
              </Button>
            </>
          )}
          {step === "result" && (
            <Button className="ml-auto" onClick={onClose}>Done</Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export function AdminCohortDetail() {
  const { id } = useParams<{ id: string }>();
  const [cohort, setCohort] = useState<CohortDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showEnroll, setShowEnroll] = useState(false);
  const [showBulkEnroll, setShowBulkEnroll] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resendMsg, setResendMsg] = useState<{ userId: string; ok: boolean; text: string } | null>(null);

  const [linkedOrgs, setLinkedOrgs] = useState<LinkedOrgSummary[]>([]);
  const [allOrgs, setAllOrgs] = useState<OrgSummary[]>([]);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkOrgId, setLinkOrgId] = useState('');
  const [linking, setLinking] = useState(false);
  const [showEnrolModal, setShowEnrolModal] = useState(false);
  const [enrolOrg, setEnrolOrg] = useState<OrgDetail | null>(null);
  const [enrolScope, setEnrolScope] = useState<{ nodeId: string | null; includeDesc: boolean }>({
    nodeId: null, includeDesc: true,
  });
  const [enrolUserIds, setEnrolUserIds] = useState<string[]>([]);
  const [enrolTab, setEnrolTab] = useState<'scope' | 'individual'>('scope');
  const [enrolling, setEnrolling] = useState(false);
  const [enrolResult, setEnrolResult] = useState<{ enrolled: number; skipped: number } | null>(null);
  const [orgEmployees, setOrgEmployees] = useState<OrgEmployeeSummary[]>([]);
  const [empSearch, setEmpSearch] = useState('');
  const [empLoading, setEmpLoading] = useState(false);

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const fetchCohort = () => {
    if (!id) return;
    if (!UUID_RE.test(id)) {
      setError("Invalid cohort ID. Please select a cohort from the list.");
      setLoading(false);
      return;
    }
    setLoading(true);
    getCohort(id)
      .then(setCohort)
      .catch((err) => {
        const msg = err?.response?.data?.detail ?? "Failed to load cohort.";
        setError(msg);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCohort();
    if (id && UUID_RE.test(id)) {
      listCohortOrgs(id).then(setLinkedOrgs).catch(() => {});
    }
    listOrganizations().then(setAllOrgs).catch(() => {});
  }, [id]);

  const handleRemoveMember = async (userId: string) => {
    if (!id) return;
    setRemovingId(userId);
    try {
      await removeMember(id, userId);
      setCohort(prev => prev ? { ...prev, respondents: prev.respondents.filter(r => r.user_id !== userId) } : prev);
    } catch {
      // silently fail — user stays in list
    } finally {
      setRemovingId(null);
    }
  };

  const handleExport = async () => {
    if (!id || !cohort) return;
    setExporting(true);
    try {
      await exportCohortCsv(id, cohort.name);
    } finally {
      setExporting(false);
    }
  };

  const handleResendInvite = async (userId: string) => {
    if (!id) return;
    setResendingId(userId);
    setResendMsg(null);
    try {
      const res = await resendEnrollmentInvite(id, userId);
      setResendMsg({ userId, ok: true, text: res.message });
    } catch (err: any) {
      setResendMsg({ userId, ok: false, text: err?.response?.data?.detail ?? "Failed to resend invite." });
    } finally {
      setResendingId(null);
      setTimeout(() => setResendMsg(null), 4000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !cohort) {
    return (
      <div className="p-4 sm:p-8 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="max-w-md text-center">
          <div className="text-5xl mb-4">🔍</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Cohort not found</h2>
          <p className="text-sm text-gray-500 mb-6">{error || "This cohort does not exist or you don't have access."}</p>
          <Link to="/admin/cohorts">
            <Button>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Cohorts
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Build radar data from team_scores
  const radarData = cohort.team_scores
    ? [
        { subject: "Producer (P)", is: cohort.team_scores.average_scaled.is?.P ?? 0, should: cohort.team_scores.average_scaled.should?.P ?? 0, want: cohort.team_scores.average_scaled.want?.P ?? 0, fullMark: 50 },
        { subject: "Administrator (A)", is: cohort.team_scores.average_scaled.is?.A ?? 0, should: cohort.team_scores.average_scaled.should?.A ?? 0, want: cohort.team_scores.average_scaled.want?.A ?? 0, fullMark: 50 },
        { subject: "Entrepreneur (E)", is: cohort.team_scores.average_scaled.is?.E ?? 0, should: cohort.team_scores.average_scaled.should?.E ?? 0, want: cohort.team_scores.average_scaled.want?.E ?? 0, fullMark: 50 },
        { subject: "Integrator (I)", is: cohort.team_scores.average_scaled.is?.I ?? 0, should: cohort.team_scores.average_scaled.should?.I ?? 0, want: cohort.team_scores.average_scaled.want?.I ?? 0, fullMark: 50 },
      ]
    : [];

  const distData = cohort.team_scores
    ? [
        { name: "Producer", count: cohort.team_scores.style_distribution.P ?? 0, fill: ROLE_COLORS.P },
        { name: "Administrator", count: cohort.team_scores.style_distribution.A ?? 0, fill: ROLE_COLORS.A },
        { name: "Entrepreneur", count: cohort.team_scores.style_distribution.E ?? 0, fill: ROLE_COLORS.E },
        { name: "Integrator", count: cohort.team_scores.style_distribution.I ?? 0, fill: ROLE_COLORS.I },
      ]
    : [];

  const completedCount = cohort.respondents.filter(r => r.status === "completed").length;

  return (
    <div className="p-4 sm:p-8">
      {showEnroll && id && (
        <EnrollUserModal
          cohortId={id}
          onClose={() => setShowEnroll(false)}
          onEnrolled={fetchCohort}
        />
      )}
      {showBulkEnroll && id && (
        <BulkEnrollModal
          cohortId={id}
          onClose={() => setShowBulkEnroll(false)}
          onEnrolled={fetchCohort}
        />
      )}

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="mb-6">
          <Link to="/admin/cohorts" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 mb-4 transition-colors">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Cohorts
          </Link>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-display font-bold text-gray-900">{cohort.name}</h1>
              {cohort.description && <p className="text-gray-500 mt-1">{cohort.description}</p>}
              <p className="text-sm text-gray-400 mt-1">
                {cohort.respondents.length} members · {completedCount} completed
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setShowEnroll(true)}>
                <UserPlus className="mr-2 h-4 w-4" /> Enroll User
              </Button>
              <Button variant="outline" onClick={() => setShowBulkEnroll(true)}>
                <Upload className="mr-2 h-4 w-4" /> Bulk Enroll
              </Button>
              <Button variant="outline" onClick={handleExport} disabled={exporting}>
                {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Export CSV
              </Button>
            </div>
          </div>
        </div>

        {cohort.team_scores && radarData.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2 mb-8">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-gray-400" /> Team Aggregate Profile
                </CardTitle>
                <CardDescription>Average scores across all completed assessments</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="99%" height="100%" debounce={50}>
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                      <PolarGrid stroke="#e5e7eb" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: "#4b5563", fontSize: 12 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 50]} tick={{ fill: "#9ca3af" }} />
                      <Radar name="Is" dataKey="is" stroke="#C8102E" fill="#C8102E" fillOpacity={0.4} />
                      <Radar name="Should" dataKey="should" stroke="#1D3557" fill="#1D3557" fillOpacity={0.3} />
                      <Radar name="Want" dataKey="want" stroke="#2A9D8F" fill="#2A9D8F" fillOpacity={0.3} />
                      <Legend />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-gray-400" /> Style Distribution
                </CardTitle>
                <CardDescription>Dominant styles across the team</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="99%" height="100%" debounce={50}>
                    <BarChart data={distData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                      <XAxis dataKey="name" tick={{ fill: "#4b5563", fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fill: "#9ca3af" }} />
                      <Tooltip cursor={{ fill: "#f9fafb" }} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={40}>
                        {distData.map((entry, i) => (
                          <rect key={i} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {!cohort.team_scores && cohort.respondents.length > 0 && (
          <div className="mb-8 px-4 py-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-sm">
            Team charts will appear once at least one member completes the assessment.
          </div>
        )}

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Respondents</CardTitle>
              <CardDescription>Individual assessment status and results</CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={() => setShowEnroll(true)}>
              <UserPlus className="mr-2 h-4 w-4" /> Add
            </Button>
          </CardHeader>
          <CardContent>
            {cohort.respondents.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>No members yet. Click "Enroll User" to add someone.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-sm text-left text-gray-500">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 font-medium">Name</th>
                      <th className="px-6 py-3 font-medium">Email</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 font-medium">Dominant Style</th>
                      <th className="px-6 py-3 font-medium">Completed</th>
                      <th className="px-6 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cohort.respondents.map((r) => (
                      <tr key={r.user_id} className="bg-white border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-900">{r.name || "—"}</td>
                        <td className="px-6 py-4">{r.email}</td>
                        <td className="px-6 py-4">
                          {r.status === "completed" ? (
                            <Badge variant="secondary" className="bg-green-100 text-green-800">Completed</Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-amber-100 text-amber-800">Pending</Badge>
                          )}
                        </td>
                        <td className="px-6 py-4 font-mono font-medium">{r.dominant_style || "—"}</td>
                        <td className="px-6 py-4">
                          {r.completed_at ? new Date(r.completed_at).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {r.status === "completed" && (
                              <Link to={`/admin/respondents/${r.user_id}?cohort_id=${id}`} className="font-medium text-primary hover:text-primary-dark text-sm">
                                View Results
                              </Link>
                            )}
                            {r.status === "pending" && (
                              <div className="relative flex items-center">
                                <button
                                  onClick={() => handleResendInvite(r.user_id)}
                                  disabled={resendingId === r.user_id}
                                  title="Resend enrollment invite"
                                  className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded px-2.5 py-1 transition-colors disabled:opacity-50"
                                >
                                  {resendingId === r.user_id
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    : <MailCheck className="h-3.5 w-3.5" />
                                  }
                                  Resend Invite
                                </button>
                                {resendMsg?.userId === r.user_id && (
                                  <span className={`absolute right-full mr-2 whitespace-nowrap text-xs px-2 py-1 rounded shadow-sm ${
                                    resendMsg.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
                                  }`}>
                                    {resendMsg.text}
                                  </span>
                                )}
                              </div>
                            )}
                            <button
                              onClick={() => handleRemoveMember(r.user_id)}
                              disabled={removingId === r.user_id}
                              className="text-gray-300 hover:text-red-500 transition-colors"
                              title="Remove from cohort"
                            >
                              {removingId === r.user_id
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <Trash2 className="h-4 w-4" />
                              }
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Linked Organisations ────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Linked Organisations</h3>
            <button
              onClick={() => setShowLinkModal(true)}
              className="flex items-center gap-1.5 text-sm border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50 text-gray-600"
            >
              <Plus className="h-3.5 w-3.5" /> Link Organisation
            </button>
          </div>

          {linkedOrgs.length === 0 ? (
            <p className="text-sm text-gray-400">No organisations linked yet.</p>
          ) : (
            <div className="space-y-2">
              {linkedOrgs.map((lo) => (
                <div key={lo.org_id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <span className="font-medium text-sm text-gray-900">{lo.name}</span>
                    <span className="ml-2 text-xs text-gray-400">{lo.employee_count} employees</span>
                  </div>
                  <button
                    onClick={async () => {
                      if (!confirm(`Unlink ${lo.name}?`)) return;
                      try {
                        await unlinkOrgFromCohort(id!, lo.org_id);
                        setLinkedOrgs((prev) => prev.filter((o) => o.org_id !== lo.org_id));
                      } catch {
                        alert('Failed to unlink organisation. Please try again.');
                      }
                    }}
                    className="text-xs text-gray-400 hover:text-red-600"
                  >
                    Unlink
                  </button>
                </div>
              ))}
            </div>
          )}

          {linkedOrgs.length > 0 && (
            linkedOrgs.length === 1 ? (
              <button
                onClick={async () => {
                  const org = await getOrganization(linkedOrgs[0].org_id);
                  setEnrolOrg(org);
                  setEnrolResult(null);
                  setEnrolScope({ nodeId: null, includeDesc: true });
                  setEnrolUserIds([]);
                  setEmpSearch('');
                  // Pre-fetch all employees (root node + descendants) for the individual tab
                  if (org.tree[0]) {
                    setEmpLoading(true);
                    listNodeEmployees(org.id, org.tree[0].id, true)
                      .then(setOrgEmployees).catch(() => {}).finally(() => setEmpLoading(false));
                  }
                  setShowEnrolModal(true);
                }}
                className="mt-4 w-full text-sm bg-[#1D3557] text-white rounded-lg py-2 hover:bg-blue-900"
              >
                Enrol from Organisation
              </button>
            ) : (
              <div className="mt-4 space-y-2">
                <p className="text-xs text-gray-500">Enrol from a linked organisation:</p>
                {linkedOrgs.map((lo) => (
                  <button
                    key={lo.org_id}
                    onClick={async () => {
                      const org = await getOrganization(lo.org_id);
                      setEnrolOrg(org);
                      setEnrolResult(null);
                      setEnrolScope({ nodeId: null, includeDesc: true });
                      setEnrolUserIds([]);
                      setEmpSearch('');
                      if (org.tree[0]) {
                        listNodeEmployees(org.id, org.tree[0].id, true).then(setOrgEmployees).catch(() => {});
                      }
                      setShowEnrolModal(true);
                    }}
                    className="w-full text-left text-sm bg-[#1D3557] text-white rounded-lg px-3 py-2 hover:bg-blue-900"
                  >
                    {lo.name} ({lo.employee_count} employees)
                  </button>
                ))}
              </div>
            )
          )}
        </div>
      </motion.div>

      {/* ── Link Org Modal ───────────────────────────── */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold mb-4">Link Organisation</h2>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4"
              value={linkOrgId}
              onChange={(e) => setLinkOrgId(e.target.value)}
            >
              <option value="">Select an organisation…</option>
              {allOrgs
                .filter((o) => !linkedOrgs.some((lo) => lo.org_id === o.id))
                .map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
            </select>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowLinkModal(false)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
              <button
                disabled={!linkOrgId || linking}
                onClick={async () => {
                  setLinking(true);
                  try {
                    await linkOrgToCohort(id!, linkOrgId);
                    const updated = await listCohortOrgs(id!);
                    setLinkedOrgs(updated);
                    setShowLinkModal(false); setLinkOrgId('');
                  } finally { setLinking(false); }
                }}
                className="px-4 py-2 text-sm bg-[#C8102E] text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {linking ? 'Linking…' : 'Link'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Enrol from Org Modal ─────────────────────── */}
      {showEnrolModal && enrolOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-1">Enrol from {enrolOrg.name}</h2>
            <div className="flex gap-4 mb-4 border-b border-gray-200 text-sm">
              {(['scope', 'individual'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setEnrolTab(tab)}
                  className={`py-2 border-b-2 -mb-px font-medium capitalize
                    ${enrolTab === tab ? 'border-[#C8102E] text-[#C8102E]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  {tab === 'scope' ? 'By Scope' : 'By Individual'}
                </button>
              ))}
            </div>

            {enrolTab === 'scope' && (
              <div className="space-y-2 mb-4">
                <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input type="radio" checked={enrolScope.nodeId === null}
                    onChange={() => setEnrolScope({ nodeId: null, includeDesc: true })} />
                  <span className="text-sm">Entire organisation</span>
                </label>
                {enrolOrg.tree[0]?.children.map((node) => (
                  <label key={node.id} className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input type="radio" checked={enrolScope.nodeId === node.id}
                      onChange={() => setEnrolScope({ nodeId: node.id, includeDesc: true })} />
                    <span className="text-sm flex-1">{node.name}</span>
                    <span className="text-xs text-gray-400">{node.employee_count} employees</span>
                  </label>
                ))}
                {enrolScope.nodeId && (
                  <label className="flex items-center gap-2 text-sm text-gray-600 mt-2">
                    <input type="checkbox" checked={enrolScope.includeDesc}
                      onChange={(e) => setEnrolScope((s) => ({ ...s, includeDesc: e.target.checked }))} />
                    Include sub-nodes
                  </label>
                )}
              </div>
            )}

            {enrolTab === 'individual' && (
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Search by name or email…"
                  value={empSearch}
                  onChange={(e) => setEmpSearch(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2"
                />
                <div className="max-h-52 overflow-y-auto space-y-1">
                  {orgEmployees
                    .filter(
                      (e) => e.name.toLowerCase().includes(empSearch.toLowerCase()) ||
                             e.email.toLowerCase().includes(empSearch.toLowerCase())
                    )
                    .map((emp) => (
                      <label key={emp.user_id} className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={enrolUserIds.includes(emp.user_id)}
                          onChange={(e) => setEnrolUserIds((ids) =>
                            e.target.checked ? [...ids, emp.user_id] : ids.filter((uid) => uid !== emp.user_id)
                          )}
                        />
                        <span className="flex-1">{emp.name}</span>
                        <span className="text-xs text-gray-400">{emp.email}</span>
                      </label>
                    ))}
                  {orgEmployees.filter(
                    (e) => e.name.toLowerCase().includes(empSearch.toLowerCase()) ||
                           e.email.toLowerCase().includes(empSearch.toLowerCase())
                  ).length === 0 && (
                    <p className="text-xs text-gray-400 p-2">
                      {empLoading ? 'Loading employees…' : 'No employees found.'}
                    </p>
                  )}
                </div>
                {enrolUserIds.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">{enrolUserIds.length} selected</p>
                )}
              </div>
            )}

            {enrolResult && (
              <div className="bg-green-50 rounded-lg p-3 text-sm mb-4 text-green-700">
                ✓ {enrolResult.enrolled} enrolled, {enrolResult.skipped} skipped (already enrolled)
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button onClick={() => setShowEnrolModal(false)} className="px-4 py-2 text-sm text-gray-600">
                {enrolResult ? 'Done' : 'Close'}
              </button>
              <button
                disabled={enrolling || (enrolTab === 'individual' && enrolUserIds.length === 0)}
                onClick={async () => {
                  setEnrolling(true);
                  try {
                    const result = await enrollFromOrg(id!, {
                      org_id: enrolOrg.id,
                      node_id: enrolScope.nodeId ?? undefined,
                      include_descendants: enrolScope.includeDesc,
                      user_ids: enrolUserIds.length > 0 ? enrolUserIds : undefined,
                    });
                    setEnrolResult(result);
                    if (result.enrolled > 0) fetchCohort();
                  } catch {
                    alert('Enrolment failed. Please try again.');
                  } finally { setEnrolling(false); }
                }}
                className="px-4 py-2 text-sm bg-[#C8102E] text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {enrolling ? 'Enrolling…' : 'Enrol'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
