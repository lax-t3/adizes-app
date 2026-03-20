import { create } from 'zustand';
import type { OrgDetail, OrgNode, OrgEmployeeSummary } from '@/types/api';

interface OrgState {
  // Currently loaded org detail (tree + meta)
  currentOrg: OrgDetail | null;
  setCurrentOrg: (org: OrgDetail | null) => void;

  // Selected node in the tree panel
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;

  // Employees for the selected node (loaded on demand)
  employees: OrgEmployeeSummary[];
  setEmployees: (employees: OrgEmployeeSummary[]) => void;

  // Include descendants toggle on the employees tab
  includeDescendants: boolean;
  setIncludeDescendants: (v: boolean) => void;

  reset: () => void;
}

export const useOrgStore = create<OrgState>((set) => ({
  currentOrg: null,
  setCurrentOrg: (org) => set({ currentOrg: org }),

  selectedNodeId: null,
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  employees: [],
  setEmployees: (employees) => set({ employees }),

  includeDescendants: false,
  setIncludeDescendants: (v) => set({ includeDescendants: v }),

  reset: () => set({ currentOrg: null, selectedNodeId: null, employees: [], includeDescendants: false }),
}));

/** Find a node anywhere in the tree by id */
export function findNode(tree: OrgNode[], id: string): OrgNode | null {
  for (const node of tree) {
    if (node.id === id) return node;
    const found = findNode(node.children, id);
    if (found) return found;
  }
  return null;
}

/** Build breadcrumb string for a node using its path (resolves names from tree) */
export function buildBreadcrumb(tree: OrgNode[], nodeId: string): string {
  const parts: string[] = [];
  function walk(nodes: OrgNode[], target: string): boolean {
    for (const n of nodes) {
      if (n.id === target) { parts.push(n.name); return true; }
      if (walk(n.children, target)) { parts.unshift(n.name); return true; }
    }
    return false;
  }
  walk(tree, nodeId);
  return parts.join(' › ');
}

/** Flatten the org tree into a list of all nodes (for lookup maps). */
export function flattenTree(tree: OrgNode[]): OrgNode[] {
  const result: OrgNode[] = [];
  function walk(nodes: OrgNode[]) {
    for (const n of nodes) {
      result.push(n);
      if (n.children.length) walk(n.children);
    }
  }
  walk(tree);
  return result;
}
