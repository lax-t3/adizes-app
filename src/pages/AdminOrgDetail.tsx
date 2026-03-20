// src/pages/AdminOrgDetail.tsx
import { useEffect, useState, useCallback, Fragment } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, ChevronDown, Plus, Trash2, Users, Download, HelpCircle } from 'lucide-react';
import {
  getOrganization, createNode, deleteNode, updateNode,
  listNodeEmployees, addEmployee, bulkUploadEmployees, removeEmployee,
  updateEmployee,
} from '@/api/organizations';
import { useOrgStore, findNode, buildBreadcrumb, flattenTree } from '@/store/orgStore';
import type { OrgNode, OrgEmployeeSummary } from '@/types/api';
import * as XLSX from 'xlsx';

// ── Tree node (recursive) ─────────────────────────────────────
function TreeNode({
  node, selectedId, onSelect, onAddChild, depth = 0,
}: {
  node: OrgNode;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddChild: (parentId: string) => void;
  depth?: number;
}) {
  const [open, setOpen] = useState(depth === 0);
  const isSelected = node.id === selectedId;
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className={`flex items-center gap-1 px-2 py-1.5 rounded-lg cursor-pointer group text-sm
          ${isSelected ? 'bg-[#C8102E] text-white' : 'hover:bg-gray-100 text-gray-700'}`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => { onSelect(node.id); if (hasChildren) setOpen((o) => !o); }}
      >
        {hasChildren ? (
          open
            ? <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" />
            : <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
        ) : (
          <span className="w-3.5 flex-shrink-0" />
        )}
        <span className="flex-1 truncate">{node.name}</span>
        <span className={`text-xs ml-1 flex-shrink-0 ${isSelected ? 'text-red-200' : 'text-gray-400'}`}>
          {node.employee_count > 0 ? node.employee_count : ''}
        </span>
        <button
          className={`ml-1 opacity-0 group-hover:opacity-100 flex-shrink-0
            ${isSelected ? 'text-red-200 hover:text-white' : 'text-gray-400 hover:text-[#C8102E]'}`}
          onClick={(e) => { e.stopPropagation(); onAddChild(node.id); }}
          title="Add sub-node"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      {open && node.children.map((child) => (
        <TreeNode key={child.id} node={child} selectedId={selectedId}
          onSelect={onSelect} onAddChild={onAddChild} depth={depth + 1} />
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export function AdminOrgDetail() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const { currentOrg, setCurrentOrg, selectedNodeId, setSelectedNodeId,
    employees, setEmployees, includeDescendants, setIncludeDescendants } = useOrgStore();

  const [loading, setLoading] = useState(true);
  const [empLoading, setEmpLoading] = useState(false);

  // Add employee modal state
  const [showAddEmp, setShowAddEmp] = useState(false);
  const [empName, setEmpName] = useState('');
  const [empEmail, setEmpEmail] = useState('');
  const [empTitle, setEmpTitle] = useState('');
  const [empExtId, setEmpExtId] = useState('');
  const [addingEmp, setAddingEmp] = useState(false);
  const [empError, setEmpError] = useState<string | null>(null);

  // Add sub-node modal state
  const [showAddNode, setShowAddNode] = useState(false);
  const [addNodeParentId, setAddNodeParentId] = useState<string | null>(null);
  const [nodeName, setNodeName] = useState('');
  const [nodeType, setNodeType] = useState('department');
  const [addingNode, setAddingNode] = useState(false);

  // Bulk upload state
  const [showBulk, setShowBulk] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkResult, setBulkResult] = useState<any>(null);
  const [uploading, setUploading] = useState(false);

  // Extended employee form state
  const [empTab, setEmpTab] = useState<'identity' | 'employment'>('identity');
  const [empLastName, setEmpLastName] = useState('');
  const [empMiddleName, setEmpMiddleName] = useState('');
  const [empGender, setEmpGender] = useState('');
  const [empDob, setEmpDob] = useState('');
  const [empLanguage, setEmpLanguage] = useState('English');
  const [empStatus, setEmpStatus] = useState('Active');
  const [empManagerEmail, setEmpManagerEmail] = useState('');
  const [empDate, setEmpDate] = useState('');
  const [empHeadOfDept, setEmpHeadOfDept] = useState(false);
  const [empEditMode, setEmpEditMode] = useState(false);
  const [empEditId, setEmpEditId] = useState<string | null>(null);
  const [dobError, setDobError] = useState('');
  const [empDateError, setEmpDateError] = useState('');

  // Expandable table row
  const [expandedEmpId, setExpandedEmpId] = useState<string | null>(null);

  // Help modal state
  const [showOrgHelp, setShowOrgHelp] = useState(false);
  const [showCsvHelp, setShowCsvHelp] = useState(false);

  const loadOrg = useCallback(() => {
    if (!orgId) return;
    setLoading(true);
    getOrganization(orgId)
      .then((org) => {
        setCurrentOrg(org);
        // Auto-select root node
        if (!selectedNodeId && org.tree.length > 0) {
          setSelectedNodeId(org.tree[0].id);
        }
      })
      .finally(() => setLoading(false));
  }, [orgId]);

  useEffect(() => { loadOrg(); }, [loadOrg]);

  const loadEmployees = useCallback(() => {
    if (!orgId || !selectedNodeId) return;
    setEmpLoading(true);
    listNodeEmployees(orgId, selectedNodeId, includeDescendants)
      .then(setEmployees)
      .finally(() => setEmpLoading(false));
  }, [orgId, selectedNodeId, includeDescendants]);

  useEffect(() => { loadEmployees(); }, [loadEmployees]);

  const handleAddEmployee = async () => {
    const dobErr = validateDmy(empDob);
    const empDateErr = validateDmy(empDate);
    setDobError(dobErr); setEmpDateError(empDateErr);
    if (dobErr || empDateErr) return;

    if (!orgId || !selectedNodeId || !empName.trim() || !empEmail.trim()) return;
    setAddingEmp(true); setEmpError(null);
    try {
      if (empEditMode && empEditId) {
        await updateEmployee(orgId, empEditId, {
          last_name: empLastName || undefined,
          middle_name: empMiddleName || undefined,
          title: empTitle || undefined,
          employee_id: empExtId || undefined,
          emp_status: empStatus,
          gender: empGender || undefined,
          default_language: empLanguage,
          manager_email: empManagerEmail || undefined,
          dob: empDob || undefined,
          emp_date: empDate || undefined,
          head_of_dept: empHeadOfDept,
        });
      } else {
        await addEmployee(orgId, selectedNodeId, {
          name: empName.trim(), email: empEmail.trim(),
          last_name: empLastName || undefined,
          middle_name: empMiddleName || undefined,
          title: empTitle || undefined,
          employee_id: empExtId || undefined,
          emp_status: empStatus,
          gender: empGender || undefined,
          default_language: empLanguage,
          manager_email: empManagerEmail || undefined,
          dob: empDob || undefined,
          emp_date: empDate || undefined,
          head_of_dept: empHeadOfDept,
        });
      }
      setShowAddEmp(false);
      resetEmpModal();
      loadOrg(); loadEmployees();
    } catch (e: any) {
      setEmpError(e?.response?.data?.detail ?? 'Failed to save employee');
    } finally {
      setAddingEmp(false);
    }
  };

  const handleAddNode = async () => {
    if (!orgId || !addNodeParentId || !nodeName.trim()) return;
    setAddingNode(true);
    try {
      await createNode(orgId, addNodeParentId, nodeName.trim(), nodeType);
      setShowAddNode(false); setNodeName(''); setNodeType('department');
      loadOrg();
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? 'Failed to create node');
    } finally {
      setAddingNode(false);
    }
  };

  const handleDeleteNode = async (nodeId: string) => {
    if (!orgId || !confirm('Delete this node?')) return;
    try {
      await deleteNode(orgId, nodeId);
      if (selectedNodeId === nodeId) setSelectedNodeId(null);
      loadOrg();
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? 'Delete failed');
    }
  };

  const handleRemoveEmployee = async (emp: OrgEmployeeSummary) => {
    if (!orgId || !confirm(`Remove ${emp.name} from this organisation?`)) return;
    try {
      await removeEmployee(orgId, emp.id);
      loadOrg(); loadEmployees();
    } catch {
      alert('Failed to remove employee');
    }
  };

  const handleBulkUpload = async () => {
    if (!orgId || !selectedNodeId || !bulkFile) return;
    setUploading(true);
    try {
      const result = await bulkUploadEmployees(orgId, selectedNodeId, bulkFile);
      setBulkResult(result);
      loadOrg(); loadEmployees();
    } catch {
      alert('Bulk upload failed');
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    const csv = 'name,email,title,employee_id,node_path\nJane Smith,jane@example.com,Manager,E001,\n';
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'employee_upload_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  /** Format YYYY-MM-DD (from API) to DD/MM/YYYY (for display). */
  const fmtDate = (iso: string | null): string => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  /** Validate DD/MM/YYYY format — returns error string or ''. */
  const validateDmy = (val: string): string => {
    if (!val) return '';
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(val)) return 'Use DD/MM/YYYY format';
    return '';
  };

  /** Reset all Add Employee modal state to defaults. */
  const resetEmpModal = () => {
    setEmpTab('identity');
    setEmpName(''); setEmpEmail(''); setEmpTitle(''); setEmpExtId('');
    setEmpLastName(''); setEmpMiddleName(''); setEmpGender('');
    setEmpDob(''); setEmpLanguage('English'); setEmpStatus('Active');
    setEmpManagerEmail(''); setEmpDate(''); setEmpHeadOfDept(false);
    setEmpEditMode(false); setEmpEditId(null);
    setEmpError(null); setDobError(''); setEmpDateError('');
  };

  /** Open the modal in edit mode pre-filled with an existing employee. */
  const openEditEmployee = (emp: OrgEmployeeSummary) => {
    setEmpTab('identity');
    setEmpName(emp.name);
    setEmpEmail(emp.email);
    setEmpTitle(emp.title ?? '');
    setEmpExtId(emp.employee_id ?? '');
    setEmpLastName(emp.last_name ?? '');
    setEmpMiddleName(emp.middle_name ?? '');
    setEmpGender(emp.gender ?? '');
    setEmpDob(fmtDate(emp.dob));
    setEmpLanguage(emp.default_language);
    setEmpStatus(emp.emp_status);
    setEmpManagerEmail(emp.manager_email ?? '');
    setEmpDate(fmtDate(emp.emp_date));
    setEmpHeadOfDept(emp.head_of_dept);
    setEmpEditMode(true);
    setEmpEditId(emp.id);
    setEmpError(null); setDobError(''); setEmpDateError('');
    setShowAddEmp(true);
  };

  const selectedNode = currentOrg && selectedNodeId
    ? findNode(currentOrg.tree, selectedNodeId)
    : null;
  const breadcrumb = currentOrg && selectedNodeId
    ? buildBreadcrumb(currentOrg.tree, selectedNodeId)
    : '';

  if (loading) return <div className="p-6 text-gray-500">Loading…</div>;
  if (!currentOrg) return <div className="p-6 text-red-600">Organisation not found.</div>;

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-3">
        <button onClick={() => navigate('/admin/organizations')} className="text-gray-400 hover:text-gray-700">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">{currentOrg.name}</h1>
        {currentOrg.description && (
          <span className="text-sm text-gray-400">— {currentOrg.description}</span>
        )}
        <div className="ml-auto flex gap-4 text-sm text-gray-500">
          <span>{currentOrg.linked_cohort_count} cohort{currentOrg.linked_cohort_count !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Split panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: tree (35%) */}
        <div className="w-[35%] border-r border-gray-200 overflow-y-auto p-3">
          {/* Heading row */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Organisation Structure
            </h3>
            <button
              onClick={() => setShowOrgHelp(true)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title="How to build your org structure"
              aria-label="How to build your org structure"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
          </div>
          {currentOrg.tree.map((root) => (
            <TreeNode
              key={root.id}
              node={root}
              selectedId={selectedNodeId}
              onSelect={setSelectedNodeId}
              onAddChild={(parentId) => { setAddNodeParentId(parentId); setShowAddNode(true); }}
            />
          ))}
        </div>

        {/* Right: detail (65%) */}
        <div className="flex-1 overflow-y-auto p-6">
          {!selectedNode ? (
            <p className="text-gray-400">Select a node on the left.</p>
          ) : (
            <>
              {/* Node header */}
              <div className="mb-4">
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-xl font-bold text-gray-900">{selectedNode.name}</h2>
                  {selectedNode.node_type && (
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full capitalize">
                      {selectedNode.node_type}
                    </span>
                  )}
                  {!selectedNode.is_root && (
                    <button
                      onClick={() => handleDeleteNode(selectedNode.id)}
                      className="ml-auto text-gray-400 hover:text-red-600"
                      title="Delete node"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {breadcrumb && (
                  <p className="text-xs text-gray-400">{breadcrumb}</p>
                )}
              </div>

              {/* Stats row */}
              <div className="flex gap-4 mb-6 text-sm">
                <div className="bg-gray-50 rounded-lg px-4 py-3 text-center">
                  <div className="font-bold text-lg text-gray-900">{selectedNode.employee_count}</div>
                  <div className="text-gray-500 text-xs">Direct employees</div>
                </div>
                <div className="bg-gray-50 rounded-lg px-4 py-3 text-center">
                  <div className="font-bold text-lg text-gray-900">{selectedNode.children.length}</div>
                  <div className="text-gray-500 text-xs">Sub-nodes</div>
                </div>
              </div>

              {/* Employee controls */}
              <div className="flex items-center gap-3 mb-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Users className="h-4 w-4" /> Employees
                </h3>
                <label className="flex items-center gap-1.5 text-sm text-gray-600 ml-auto cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeDescendants}
                    onChange={(e) => setIncludeDescendants(e.target.checked)}
                    className="rounded"
                  />
                  Include sub-nodes
                </label>
                <button
                  onClick={downloadTemplate}
                  className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50"
                >
                  <Download className="h-3.5 w-3.5" /> Template
                </button>
                <button
                  onClick={() => setShowBulk(true)}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50 text-gray-600"
                >
                  Bulk Upload
                </button>
                <button
                  onClick={() => setShowCsvHelp(true)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  title="How to format the CSV file"
                  aria-label="How to format the CSV file"
                >
                  <HelpCircle className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setShowAddEmp(true)}
                  className="flex items-center gap-1.5 text-sm bg-[#C8102E] text-white rounded-lg px-3 py-1.5 hover:bg-red-700"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Employee
                </button>
              </div>

              {/* Employee table */}
              {empLoading ? (
                <p className="text-sm text-gray-400">Loading…</p>
              ) : employees.length === 0 ? (
                <p className="text-sm text-gray-400">No employees in this node.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide text-left">
                      <th className="pb-2 pr-3">Name</th>
                      <th className="pb-2 pr-3">Email</th>
                      <th className="pb-2 pr-3">Title</th>
                      <th className="pb-2 pr-3">Status</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp) => (
                      <tr key={emp.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 pr-3 font-medium text-gray-900">{emp.name}</td>
                        <td className="py-2 pr-3 text-gray-500">{emp.email}</td>
                        <td className="py-2 pr-3 text-gray-500">{emp.title ?? '—'}</td>
                        <td className="py-2 pr-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium
                            ${emp.status === 'active'
                              ? 'bg-green-50 text-green-700'
                              : 'bg-amber-50 text-amber-700'}`}>
                            {emp.status === 'active' ? 'Active' : 'Pending'}
                          </span>
                        </td>
                        <td className="py-2">
                          <button
                            onClick={() => handleRemoveEmployee(emp)}
                            className="text-gray-400 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      </div>

      {/* Add / Edit Employee Modal — two tabs */}
      {showAddEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            {/* Header */}
            <div className="px-6 pt-5 pb-0">
              <h2 className="text-lg font-semibold text-gray-900">
                {empEditMode ? 'Edit Employee' : 'Add Employee'}
              </h2>
            </div>

            {/* Tabs */}
            <div className="flex gap-0 border-b border-gray-200 mt-4 px-6">
              <button
                className={`pb-2 px-1 mr-6 text-sm font-medium border-b-2 transition-colors ${
                  empTab === 'identity'
                    ? 'border-[#C8102E] text-[#C8102E]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setEmpTab('identity')}
              >
                Identity
              </button>
              <button
                className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
                  empTab === 'employment'
                    ? 'border-[#C8102E] text-[#C8102E]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setEmpTab('employment')}
              >
                Employment
              </button>
            </div>

            {empError && <p className="text-red-600 text-sm px-6 pt-3">{empError}</p>}

            {/* Tab 1: Identity */}
            {empTab === 'identity' && (
              <div className="px-6 pt-4 pb-2 flex flex-col gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name *{empEditMode && <span className="ml-2 text-xs text-gray-400">(read-only)</span>}
                  </label>
                  <input
                    className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8102E] ${empEditMode ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                    placeholder="First name"
                    value={empName}
                    onChange={(e) => !empEditMode && setEmpName(e.target.value)}
                    readOnly={empEditMode}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Middle Name</label>
                    <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
                      placeholder="Optional" value={empMiddleName} onChange={(e) => setEmpMiddleName(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                    <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
                      placeholder="Optional" value={empLastName} onChange={(e) => setEmpLastName(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email *{empEditMode && <span className="ml-2 text-xs text-gray-400">(read-only)</span>}
                  </label>
                  <input
                    className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8102E] ${empEditMode ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                    placeholder="work@company.com" value={empEmail}
                    onChange={(e) => !empEditMode && setEmpEmail(e.target.value)}
                    readOnly={empEditMode}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                  <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
                    value={empGender} onChange={(e) => setEmpGender(e.target.value)}>
                    <option value="">Not specified</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Non-Binary">Non-Binary</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth (DD/MM/YYYY)</label>
                  <input className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8102E] ${dobError ? 'border-red-400' : 'border-gray-300'}`}
                    placeholder="DD/MM/YYYY" value={empDob}
                    onChange={(e) => { setEmpDob(e.target.value); setDobError(''); }}
                    onBlur={() => setDobError(validateDmy(empDob))} />
                  {dobError && <p className="text-red-500 text-xs mt-1">{dobError}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Default Language</label>
                  <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
                    value={empLanguage} onChange={(e) => setEmpLanguage(e.target.value)}>
                    {['English','Hindi','Tamil','Telugu','Kannada','Malayalam','Bengali','Marathi','Other'].map(l => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Tab 2: Employment */}
            {empTab === 'employment' && (
              <div className="px-6 pt-4 pb-2 flex flex-col gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Employment Status *</label>
                  <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
                    value={empStatus} onChange={(e) => setEmpStatus(e.target.value)}>
                    {['Active','Inactive','On Leave','Probation','Resigned'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
                    <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
                      placeholder="Optional" value={empTitle} onChange={(e) => setEmpTitle(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
                    <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
                      placeholder="Optional HR ID" value={empExtId} onChange={(e) => setEmpExtId(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Manager Email</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
                    placeholder="manager@company.com" value={empManagerEmail} onChange={(e) => setEmpManagerEmail(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Employment Date (DD/MM/YYYY)</label>
                  <input className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8102E] ${empDateError ? 'border-red-400' : 'border-gray-300'}`}
                    placeholder="DD/MM/YYYY" value={empDate}
                    onChange={(e) => { setEmpDate(e.target.value); setEmpDateError(''); }}
                    onBlur={() => setEmpDateError(validateDmy(empDate))} />
                  {empDateError && <p className="text-red-500 text-xs mt-1">{empDateError}</p>}
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">Head of Department</label>
                  <div className="flex rounded-lg overflow-hidden border border-gray-300 text-sm">
                    <button
                      onClick={() => setEmpHeadOfDept(false)}
                      className={`px-4 py-1.5 transition-colors ${!empHeadOfDept ? 'bg-[#C8102E] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                    >No</button>
                    <button
                      onClick={() => setEmpHeadOfDept(true)}
                      className={`px-4 py-1.5 transition-colors ${empHeadOfDept ? 'bg-[#C8102E] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                    >Yes</button>
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-between items-center px-6 py-4 border-t border-gray-100 mt-2">
              {empTab === 'identity' ? (
                <>
                  <button onClick={() => { setShowAddEmp(false); resetEmpModal(); }}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
                  <button
                    onClick={() => setEmpTab('employment')}
                    disabled={!empName.trim() || !empEmail.trim()}
                    className="px-4 py-2 text-sm bg-[#C8102E] text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >Next →</button>
                </>
              ) : (
                <>
                  <button onClick={() => setEmpTab('identity')}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">← Back</button>
                  <button
                    onClick={handleAddEmployee}
                    disabled={addingEmp}
                    className="px-4 py-2 text-sm bg-[#C8102E] text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {addingEmp ? 'Saving…' : empEditMode ? 'Save Changes' : 'Add Employee'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Sub-node Modal */}
      {showAddNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold mb-4">Add Sub-node</h2>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#C8102E]"
              placeholder="e.g. North India Division"
              value={nodeName}
              onChange={(e) => setNodeName(e.target.value)}
              autoFocus
            />
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4"
              value={nodeType}
              onChange={(e) => setNodeType(e.target.value)}
            >
              {['company', 'division', 'department', 'team'].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <div className="flex justify-end gap-3">
              <button onClick={() => { setShowAddNode(false); setNodeName(''); }}
                className="px-4 py-2 text-sm text-gray-600">Cancel</button>
              <button
                onClick={handleAddNode}
                disabled={addingNode || !nodeName.trim()}
                className="px-4 py-2 text-sm bg-[#C8102E] text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {addingNode ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {showBulk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-2">Bulk Upload Employees</h2>
            <p className="text-sm text-gray-500 mb-4">
              Upload a CSV with columns: <code className="bg-gray-100 px-1 rounded">name, email, title, employee_id, node_path</code>
            </p>
            <input
              type="file" accept=".csv"
              onChange={(e) => { setBulkFile(e.target.files?.[0] ?? null); setBulkResult(null); }}
              className="block w-full text-sm text-gray-600 mb-4"
            />
            {bulkResult && (
              <div className="bg-gray-50 rounded-lg p-3 text-sm mb-4">
                <p className="text-green-700 font-medium">✓ {bulkResult.created} created, {bulkResult.skipped} skipped</p>
                {bulkResult.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="text-red-600 font-medium">{bulkResult.errors.length} error(s):</p>
                    {bulkResult.errors.map((e: any, i: number) => (
                      <p key={i} className="text-red-500 text-xs">Row {e.row}: {e.email} — {e.reason}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button onClick={() => { setShowBulk(false); setBulkFile(null); setBulkResult(null); }}
                className="px-4 py-2 text-sm text-gray-600">Close</button>
              <button
                onClick={handleBulkUpload}
                disabled={!bulkFile || uploading}
                className="px-4 py-2 text-sm bg-[#C8102E] text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {uploading ? 'Uploading…' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Org Structure Help Modal */}
      {showOrgHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            {/* Header */}
            <div className="px-6 pt-5 pb-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">How to build your org structure</h2>
              <p className="text-xs text-gray-500 mt-0.5">A step-by-step guide</p>
            </div>

            {/* Body */}
            <div className="px-6 py-5 overflow-y-auto max-h-[70vh] flex flex-col gap-4 text-sm text-gray-600">

              {/* Step 1 */}
              <div className="flex gap-3 items-start">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 bg-[#C8102E]">1</div>
                <div>
                  <p className="font-semibold text-gray-900">Create the organisation</p>
                  <p className="text-xs text-gray-500 mt-1">Give it a name (e.g. "Tata Motors") and an optional description. This is the top-level container — everything else lives inside it.</p>
                </div>
              </div>

              {/* Step 2 — tree example nested inside */}
              <div className="flex gap-3 items-start">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 bg-[#C8102E]">2</div>
                <div>
                  <p className="font-semibold text-gray-900">Add nodes to build the tree</p>
                  <p className="text-xs text-gray-500 mt-1">Nodes are departments, regions, or teams. Click <strong>+ Add Node</strong> under any existing node to create a child beneath it.</p>
                  <pre className="mt-2 bg-gray-50 rounded p-2 text-xs text-gray-600 font-mono leading-loose">{`🏢 Tata Motors\n  └── 📁 Sales\n        ├── 📁 North Region\n        └── 📁 South Region\n  └── 📁 Operations`}</pre>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-3 items-start">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 bg-[#C8102E]">3</div>
                <div>
                  <p className="font-semibold text-gray-900">Add employees to nodes</p>
                  <p className="text-xs text-gray-500 mt-1">Select any node in the tree, then use <strong>Add Employee</strong> (one at a time) or <strong>Bulk Upload</strong> (CSV) to add employees. Each employee receives a welcome email to activate their account.</p>
                </div>
              </div>

              {/* Step 4 — navy circle (off-page action) */}
              <div className="flex gap-3 items-start">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 bg-[#1D3557]">4</div>
                <div>
                  <p className="font-semibold text-gray-900">Link the org to a cohort</p>
                  <p className="text-xs text-gray-500 mt-1">Go to the cohort detail page → Linked Organisations → link this org. Then use <strong>Enrol from Org</strong> to enrol employees into the assessment cohort.</p>
                </div>
              </div>

              {/* Sub-node callout — amber */}
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-xs text-orange-900">
                <p className="font-bold mb-1">💡 What is a sub-node?</p>
                <p>A sub-node is any node nested inside another. They let you mirror your real org hierarchy — as deep as you need.</p>
                <p className="mt-1"><strong>Example:</strong> Tata Motors → Sales → North Region → Delhi Team</p>
                <p className="mt-1">When you enrol employees by scope you can pick an entire branch — choosing "Sales" automatically includes North Region, South Region, and all their employees.</p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setShowOrgHelp(false)}
                className="bg-[#C8102E] hover:bg-red-700 text-white text-xs font-semibold px-5 py-2 rounded-lg"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Help Modal */}
      {showCsvHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            {/* Header */}
            <div className="px-6 pt-5 pb-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">Bulk Upload — CSV Format</h2>
              <p className="text-xs text-gray-500 mt-0.5">How to fill the upload template</p>
            </div>

            {/* Body */}
            <div className="px-6 py-5 overflow-y-auto max-h-[70vh] flex flex-col gap-4 text-sm text-gray-600">

              {/* Column table */}
              <div>
                <p className="text-xs font-bold text-gray-900 mb-2">CSV columns</p>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left px-2 py-1.5 border border-gray-200 font-semibold text-gray-600">Column</th>
                      <th className="text-left px-2 py-1.5 border border-gray-200 font-semibold text-gray-600">Description</th>
                      <th className="text-left px-2 py-1.5 border border-gray-200 font-semibold text-gray-600 whitespace-nowrap">Required?</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-2 py-1.5 border border-gray-200 font-mono text-[#C8102E]">name</td>
                      <td className="px-2 py-1.5 border border-gray-200 text-gray-600">Employee's full name</td>
                      <td className="px-2 py-1.5 border border-gray-200 text-center">✅</td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="px-2 py-1.5 border border-gray-200 font-mono text-[#C8102E]">email</td>
                      <td className="px-2 py-1.5 border border-gray-200 text-gray-600">Work email address (must be unique)</td>
                      <td className="px-2 py-1.5 border border-gray-200 text-center">✅</td>
                    </tr>
                    <tr>
                      <td className="px-2 py-1.5 border border-gray-200 font-mono text-[#C8102E]">title</td>
                      <td className="px-2 py-1.5 border border-gray-200 text-gray-600">Job title (e.g. "Senior Manager")</td>
                      <td className="px-2 py-1.5 border border-gray-200 text-center text-gray-500">Optional</td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="px-2 py-1.5 border border-gray-200 font-mono text-[#C8102E]">employee_id</td>
                      <td className="px-2 py-1.5 border border-gray-200 text-gray-600">Your internal HR / payroll ID</td>
                      <td className="px-2 py-1.5 border border-gray-200 text-center text-gray-500">Optional</td>
                    </tr>
                    <tr>
                      <td className="px-2 py-1.5 border border-gray-200 font-mono text-[#C8102E]">node_path</td>
                      <td className="px-2 py-1.5 border border-gray-200 text-gray-600">Slash-separated path to the node. Leave blank to add to the currently selected node.</td>
                      <td className="px-2 py-1.5 border border-gray-200 text-center text-gray-500">Optional</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Example CSV — dark code block */}
              <div>
                <p className="text-xs font-bold text-gray-900 mb-2">Example CSV</p>
                <pre className="bg-[#1e1e2e] text-[#cdd6f4] rounded-lg p-3 text-xs font-mono leading-loose overflow-x-auto">{`name,email,title,employee_id,node_path\nPriya Sharma,priya@tata.com,Senior Manager,EMP001,Sales/North Region\nRahul Mehta,rahul@tata.com,Team Lead,EMP002,Sales/South Region\nAisha Khan,aisha@tata.com,Analyst,,Operations\nDev Patel,dev@tata.com,Director,EMP004,`}</pre>
              </div>

              {/* node_path tips — blue callout */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900">
                <p className="font-bold mb-1">💡 node_path tips</p>
                <ul className="space-y-1">
                  <li>• Use <code className="bg-blue-100 px-1 rounded">/</code> to separate levels: <code className="bg-blue-100 px-1 rounded">Sales/North Region/Delhi Team</code></li>
                  <li>• Names must match exactly (case-sensitive)</li>
                  <li>• Leave blank to add the employee to the node currently selected in the tree</li>
                  <li>• Employees with an unrecognised path will be skipped and listed in the error summary</li>
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between">
              <button
                onClick={downloadTemplate}
                className="text-xs text-[#C8102E] font-semibold hover:underline"
              >
                ⬇ Download blank template
              </button>
              <button
                onClick={() => setShowCsvHelp(false)}
                className="bg-[#C8102E] hover:bg-red-700 text-white text-xs font-semibold px-5 py-2 rounded-lg"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
