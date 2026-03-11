import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Plus, Users, ArrowRight, X, Loader2 } from "lucide-react";
import { motion } from "motion/react";
import { listCohorts, createCohort } from "@/api/admin";
import type { CohortSummary } from "@/types/api";

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

export function AdminCohorts() {
  const [cohorts, setCohorts] = useState<CohortSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    listCohorts()
      .then(setCohorts)
      .catch(() => setError("Failed to load cohorts."))
      .finally(() => setLoading(false));
  }, []);

  const handleCreated = (cohort: CohortSummary) => {
    setCohorts(prev => [cohort, ...prev]);
  };

  return (
    <div className="p-8">
      {showCreate && (
        <CreateCohortModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      )}

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="flex items-center justify-between mb-8">
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

        <div className="grid gap-6">
          {cohorts.map((cohort) => (
            <Card key={cohort.id} className="hover:border-primary-light transition-colors shadow-sm">
              <CardContent className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
                    <Users className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{cohort.name}</h3>
                    {cohort.description && (
                      <p className="text-sm text-gray-400">{cohort.description}</p>
                    )}
                    <p className="text-sm text-gray-500">
                      Created {new Date(cohort.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-8">
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {cohort.completed_count} / {cohort.member_count}
                    </p>
                    <p className="text-xs text-gray-500">Completed</p>
                  </div>
                  <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${cohort.completion_pct}%` }}
                    />
                  </div>
                  <Link to={`/admin/cohorts/${cohort.id}`}>
                    <Button variant="outline" size="sm">
                      View <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
