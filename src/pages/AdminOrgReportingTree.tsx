// src/pages/AdminOrgReportingTree.tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, GitBranch, AlertCircle, Users } from 'lucide-react';
import { getOrganization } from '@/api/organizations';
import { getReportingTree } from '@/api/organizations';
import type { ReportingNode } from '@/api/organizations';

// ── Status badge ───────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Active: 'bg-green-100 text-green-700',
    'On Leave': 'bg-yellow-100 text-yellow-700',
    Probation: 'bg-blue-100 text-blue-700',
    Inactive: 'bg-gray-100 text-gray-500',
  };
  const cls = colors[status] ?? 'bg-gray-100 text-gray-500';
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${cls}`}>
      {status}
    </span>
  );
}

// ── Single employee card ───────────────────────────────────────
function EmployeeCard({ node }: { node: ReportingNode }) {
  const initials = [node.name, node.last_name]
    .filter(Boolean)
    .map((s) => s[0].toUpperCase())
    .join('');

  return (
    <div className="inline-flex flex-col items-center gap-1.5 bg-white border border-gray-200 rounded-xl shadow-sm px-4 py-3 min-w-[160px] max-w-[200px]">
      <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold">
        {initials || '?'}
      </div>
      <div className="text-center space-y-0.5">
        <p className="text-sm font-semibold text-gray-900 leading-tight">
          {[node.name, node.last_name].filter(Boolean).join(' ')}
        </p>
        {node.title && (
          <p className="text-xs text-gray-500 leading-tight">{node.title}</p>
        )}
        <StatusBadge status={node.emp_status} />
      </div>
    </div>
  );
}

// ── Recursive tree node ────────────────────────────────────────
function TreeLevel({ nodes }: { nodes: ReportingNode[] }) {
  if (!nodes.length) return null;
  return (
    <div className="flex flex-wrap justify-center gap-6">
      {nodes.map((node) => (
        <NodeWithChildren key={node.id} node={node} />
      ))}
    </div>
  );
}

function NodeWithChildren({ node }: { node: ReportingNode }) {
  const hasReports = node.reports.length > 0;
  return (
    <div className="flex flex-col items-center gap-0">
      {/* Card */}
      <EmployeeCard node={node} />

      {/* Connector line down */}
      {hasReports && (
        <div className="w-px h-6 bg-gray-300" />
      )}

      {/* Horizontal bar across children */}
      {hasReports && node.reports.length > 1 && (
        <div className="relative flex justify-center">
          {/* horizontal line spanning children */}
          <div
            className="absolute top-0 h-px bg-gray-300"
            style={{
              // span between first and last child cards (approx)
              left: '16px',
              right: '16px',
            }}
          />
        </div>
      )}

      {/* Children level */}
      {hasReports && (
        <div className="pt-0 flex flex-wrap justify-center gap-6 relative">
          {/* top border line above each child */}
          {node.reports.map((child) => (
            <div key={child.id} className="flex flex-col items-center gap-0">
              <div className="w-px h-6 bg-gray-300" />
              <NodeWithChildren node={child} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────
export function AdminOrgReportingTree() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();

  const [orgName, setOrgName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tree, setTree] = useState<{ has_structure: boolean; reason: string | null; roots: ReportingNode[] } | null>(null);

  useEffect(() => {
    if (!orgId) return;
    Promise.all([
      getOrganization(orgId).catch(() => null),
      getReportingTree(orgId),
    ])
      .then(([org, treeData]) => {
        if (org) setOrgName(org.name);
        setTree(treeData);
      })
      .catch(() => setError('Failed to load reporting tree.'))
      .finally(() => setLoading(false));
  }, [orgId]);

  return (
    <div className="p-4 sm:p-8 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => navigate(`/admin/organizations/${orgId}`)}
          className="text-gray-400 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900 flex items-center gap-2">
            <GitBranch className="h-6 w-6 text-primary" />
            Reporting Structure
          </h1>
          {orgName && (
            <p className="text-sm text-gray-500 mt-0.5">{orgName}</p>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* No employees */}
      {!loading && !error && tree && !tree.has_structure && tree.reason === 'no_employees' && (
        <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3">
          <Users className="h-12 w-12 opacity-30" />
          <p className="text-lg font-medium text-gray-500">No employees in this organisation</p>
          <p className="text-sm">Add employees to nodes first, then set manager emails to build the reporting tree.</p>
        </div>
      )}

      {/* No manager emails */}
      {!loading && !error && tree && !tree.has_structure && tree.reason === 'no_manager_emails' && (
        <div className="flex flex-col items-center justify-center h-64 gap-4 max-w-md mx-auto text-center">
          <div className="h-14 w-14 rounded-full bg-amber-50 flex items-center justify-center">
            <GitBranch className="h-7 w-7 text-amber-400" />
          </div>
          <div>
            <p className="text-lg font-semibold text-gray-800">No reporting structure set up</p>
            <p className="text-sm text-gray-500 mt-1">
              None of the employees in this organisation have a Manager Email populated.
              Edit employee records and set the <strong>Manager Email</strong> field to build the hierarchy.
            </p>
          </div>
        </div>
      )}

      {/* Tree */}
      {!loading && !error && tree?.has_structure && (
        <div className="overflow-auto pb-8">
          <div className="inline-flex min-w-full justify-center pt-2">
            <TreeLevel nodes={tree.roots} />
          </div>
        </div>
      )}
    </div>
  );
}
