import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Download, ArrowLeft, Users, FileText, UserPlus, X, Loader2, Trash2, Upload, CheckCircle2, AlertCircle, MinusCircle, MailCheck } from "lucide-react";
import { motion } from "motion/react";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import * as XLSX from "xlsx";
import { getCohort, enrollUser, removeMember, exportCohortCsv, bulkEnroll, resendEnrollmentInvite } from "@/api/admin";
import type { BulkEnrollEntry, BulkEnrollResult } from "@/api/admin";
import type { CohortDetailResponse } from "@/types/api";

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
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
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
                <table className="w-full text-sm text-left">
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

  useEffect(() => { fetchCohort(); }, [id]);

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
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh]">
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
    <div className="p-8">
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-display font-bold text-gray-900">{cohort.name}</h1>
              {cohort.description && <p className="text-gray-500 mt-1">{cohort.description}</p>}
              <p className="text-sm text-gray-400 mt-1">
                {cohort.respondents.length} members · {completedCount} completed
              </p>
            </div>
            <div className="flex gap-3">
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
                <table className="w-full text-sm text-left text-gray-500">
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
                              <Link to={`/admin/respondents/${r.user_id}`} className="font-medium text-primary hover:text-primary-dark text-sm">
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
      </motion.div>
    </div>
  );
}
