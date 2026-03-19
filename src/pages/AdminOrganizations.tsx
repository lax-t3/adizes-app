import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus, Trash2, Loader2, X } from 'lucide-react';
import { listOrganizations, createOrganization, deleteOrganization } from '@/api/organizations';
import type { OrgSummary } from '@/types/api';

function NewOrgModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError('');
    setLoading(true);
    try {
      await createOrganization(name.trim(), description.trim() || undefined);
      setSuccess(true);
      onCreated();
      setTimeout(onClose, 2000);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Failed to create organisation.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">New Organisation</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        {success ? (
          <div className="p-6 text-center">
            <div className="text-4xl mb-3">✅</div>
            <p className="text-sm font-medium text-green-700">Organisation created successfully.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
                placeholder="e.g. Acme Corporation"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
                rows={2}
                placeholder="Optional"
              />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-10 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="flex-1 h-10 rounded-md bg-[#C8102E] text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {loading ? 'Creating…' : 'Create'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export function AdminOrganizations() {
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState<OrgSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState('');

  const fetchOrgs = () => {
    setLoading(true);
    listOrganizations()
      .then(setOrgs)
      .catch(() => setError('Failed to load organisations.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrgs();
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4000);
  };

  const handleDelete = async (org: OrgSummary) => {
    if (!window.confirm(`Delete "${org.name}"? This cannot be undone.`)) return;
    setDeletingId(org.id);
    try {
      await deleteOrganization(org.id);
      fetchOrgs();
      showToast('Organisation deleted.');
    } catch (err: any) {
      showToast(err?.response?.data?.detail ?? 'Failed to delete organisation.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-4 sm:p-8">
      {showModal && (
        <NewOrgModal onClose={() => setShowModal(false)} onCreated={fetchOrgs} />
      )}

      <div className="flex flex-wrap items-start justify-between gap-3 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-gray-900">Organisations</h1>
          <p className="text-gray-500 mt-1">Manage organizational structures and hierarchies.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 h-10 px-4 bg-[#C8102E] text-white rounded-md hover:bg-red-700 text-sm font-medium"
        >
          <Plus className="h-4 w-4" /> New Organisation
        </button>
      </div>

      {toastMsg && (
        <div className="mb-6 px-4 py-3 bg-green-50 border border-green-200 text-green-800 rounded-lg text-sm">
          {toastMsg}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : error ? (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-4 py-3">{error}</p>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Nodes</th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Employees</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orgs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center">
                      <Building2 className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p className="text-gray-500">No organisations yet. Create one to get started.</p>
                    </td>
                  </tr>
                ) : (
                  orgs.map((org) => (
                    <tr
                      key={org.id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/admin/organizations/${org.id}`)}
                    >
                      <td className="px-6 py-4 font-medium text-gray-900">{org.name}</td>
                      <td className="px-6 py-4 text-gray-500 max-w-xs truncate">{org.description ?? '—'}</td>
                      <td className="px-6 py-4 text-right text-gray-700">{org.node_count}</td>
                      <td className="px-6 py-4 text-right text-gray-700">{org.employee_count}</td>
                      <td className="px-6 py-4 text-gray-500 text-sm">
                        {new Date(org.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleDelete(org)}
                          disabled={deletingId === org.id}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                          title="Delete organisation"
                        >
                          {deletingId === org.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
