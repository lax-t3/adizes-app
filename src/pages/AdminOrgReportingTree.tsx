// src/pages/AdminOrgReportingTree.tsx
import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, GitBranch, AlertCircle, Users, Maximize2 } from 'lucide-react';
import { getOrganization, getReportingTree } from '@/api/organizations';
import type { ReportingNode } from '@/api/organizations';

// ── Layout constants ────────────────────────────────────────────
const CARD_W = 180;
const CARD_H = 130;
const H_GAP = 60;   // horizontal gap between sibling subtrees
const V_GAP = 80;   // vertical gap between levels
const PAD = 60;     // canvas padding

// ── Layout types ───────────────────────────────────────────────
interface LayoutPos {
  node: ReportingNode;
  cx: number;  // center-x of card
  cy: number;  // top-y of card
  children: LayoutPos[];
}

interface Edge { x1: number; y1: number; x2: number; y2: number }

// ── Layout helpers ─────────────────────────────────────────────
function subtreeWidth(node: ReportingNode): number {
  if (!node.reports.length) return CARD_W;
  const childTotal = node.reports.reduce((s, c) => s + subtreeWidth(c), 0)
    + (node.reports.length - 1) * H_GAP;
  return Math.max(CARD_W, childTotal);
}

function buildLayout(node: ReportingNode, level: number, leftEdge: number): LayoutPos {
  const sw = subtreeWidth(node);
  const cx = leftEdge + sw / 2;
  const cy = PAD + level * (CARD_H + V_GAP);
  const children: LayoutPos[] = [];
  if (node.reports.length) {
    const totalChildW = node.reports.reduce((s, c) => s + subtreeWidth(c), 0)
      + (node.reports.length - 1) * H_GAP;
    let cl = leftEdge + (sw - totalChildW) / 2;
    for (const child of node.reports) {
      children.push(buildLayout(child, level + 1, cl));
      cl += subtreeWidth(child) + H_GAP;
    }
  }
  return { node, cx, cy, children };
}

function buildRootsLayout(roots: ReportingNode[]): LayoutPos[] {
  const result: LayoutPos[] = [];
  let left = PAD;
  for (const root of roots) {
    result.push(buildLayout(root, 0, left));
    left += subtreeWidth(root) + H_GAP;
  }
  return result;
}

function flattenCards(pos: LayoutPos, out: LayoutPos[] = []): LayoutPos[] {
  out.push(pos);
  pos.children.forEach(c => flattenCards(c, out));
  return out;
}

function collectEdges(pos: LayoutPos, out: Edge[] = []): Edge[] {
  if (!pos.children.length) return out;
  const parentBottom = pos.cy + CARD_H;
  const midY = parentBottom + V_GAP / 2;

  // vertical: parent bottom → mid
  out.push({ x1: pos.cx, y1: parentBottom, x2: pos.cx, y2: midY });

  if (pos.children.length > 1) {
    // horizontal bar spanning all children
    out.push({
      x1: pos.children[0].cx, y1: midY,
      x2: pos.children[pos.children.length - 1].cx, y2: midY,
    });
  }

  // vertical: mid → each child top
  for (const child of pos.children) {
    out.push({ x1: child.cx, y1: midY, x2: child.cx, y2: child.cy });
    collectEdges(child, out);
  }
  return out;
}

function canvasSize(roots: LayoutPos[]): { w: number; h: number } {
  const all = roots.flatMap(r => flattenCards(r));
  if (!all.length) return { w: 0, h: 0 };
  return {
    w: Math.max(...all.map(p => p.cx + CARD_W / 2)) + PAD,
    h: Math.max(...all.map(p => p.cy + CARD_H)) + PAD,
  };
}

// ── Status badge ───────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  Active: 'bg-green-100 text-green-700',
  'On Leave': 'bg-yellow-100 text-yellow-700',
  Probation: 'bg-blue-100 text-blue-700',
  Inactive: 'bg-gray-100 text-gray-500',
  Resigned: 'bg-red-100 text-red-500',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-500'}`}>
      {status}
    </span>
  );
}

// ── Employee card (absolutely positioned on canvas) ─────────────
function EmpCard({ pos }: { pos: LayoutPos }) {
  const { node, cx, cy } = pos;
  const initials = [node.name, node.last_name].filter(Boolean).map(s => s[0].toUpperCase()).join('');
  const fullName = [node.name, node.last_name].filter(Boolean).join(' ');
  return (
    <div
      style={{ position: 'absolute', left: cx - CARD_W / 2, top: cy, width: CARD_W, height: CARD_H }}
      className="bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col items-center justify-center gap-1.5 px-3 py-3"
    >
      <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold flex-shrink-0">
        {initials || '?'}
      </div>
      <p className="text-xs font-semibold text-gray-900 text-center leading-tight line-clamp-2 w-full">{fullName}</p>
      {node.title && (
        <p className="text-[10px] text-gray-400 text-center leading-tight line-clamp-2 w-full">{node.title}</p>
      )}
      <StatusBadge status={node.emp_status} />
    </div>
  );
}

// ── Pan + zoom canvas ──────────────────────────────────────────
type Transform = { x: number; y: number; scale: number };

function PanZoomCanvas({ canvasW, canvasH, children }: {
  canvasW: number; canvasH: number; children: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [t, setT] = useState<Transform>({ x: 0, y: 0, scale: 1 });
  const dragging = useRef(false);
  const lastTouchDist = useRef<number | null>(null);
  const lastTouchMid = useRef({ x: 0, y: 0 });

  // Center tree on first load
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !canvasW || !canvasH) return;
    setT({ x: Math.max(0, (el.clientWidth - canvasW) / 2), y: 20, scale: 1 });
  }, [canvasW, canvasH]);

  const applyZoom = useCallback((factor: number, ox: number, oy: number) => {
    setT(prev => {
      const newScale = Math.min(Math.max(prev.scale * factor, 0.15), 3);
      const r = newScale / prev.scale;
      return { x: ox - (ox - prev.x) * r, y: oy - (oy - prev.y) * r, scale: newScale };
    });
  }, []);

  const reset = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    setT({ x: Math.max(0, (el.clientWidth - canvasW) / 2), y: 20, scale: 1 });
  }, [canvasW]);

  // Non-passive wheel listener (required to preventDefault)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      applyZoom(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - rect.left, e.clientY - rect.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [applyZoom]);

  // Non-passive touch move (prevent page scroll during pinch)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 1 && dragging.current) {
        // pan
        setT(prev => ({
          ...prev,
          x: prev.x + e.touches[0].clientX - (lastTouchMid.current.x || e.touches[0].clientX),
          y: prev.y + e.touches[0].clientY - (lastTouchMid.current.y || e.touches[0].clientY),
        }));
        lastTouchMid.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2 && lastTouchDist.current !== null) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const rect = el.getBoundingClientRect();
        applyZoom(dist / lastTouchDist.current, lastTouchMid.current.x - rect.left, lastTouchMid.current.y - rect.top);
        lastTouchDist.current = dist;
      }
    };
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', onTouchMove);
  }, [applyZoom]);

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragging.current = true;
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return;
    setT(prev => ({ ...prev, x: prev.x + e.movementX, y: prev.y + e.movementY }));
  };
  const stopDrag = () => { dragging.current = false; };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      dragging.current = true;
      lastTouchMid.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      dragging.current = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchDist.current = Math.hypot(dx, dy);
      lastTouchMid.current = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
    }
  };
  const onTouchEnd = () => { dragging.current = false; lastTouchDist.current = null; };

  const centerZoom = (factor: number) => {
    const el = containerRef.current;
    if (el) applyZoom(factor, el.clientWidth / 2, el.clientHeight / 2);
  };

  return (
    <div
      ref={containerRef}
      className="relative flex-1 overflow-hidden bg-gray-50 cursor-grab active:cursor-grabbing select-none"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={stopDrag}
      onMouseLeave={stopDrag}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Panned/zoomed canvas */}
      <div
        style={{
          position: 'absolute',
          transformOrigin: '0 0',
          transform: `translate(${t.x}px, ${t.y}px) scale(${t.scale})`,
          width: canvasW,
          height: canvasH,
        }}
      >
        {children}
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-5 right-5 flex flex-col gap-1.5 z-10">
        <button
          onClick={() => centerZoom(1.2)}
          className="h-9 w-9 flex items-center justify-center bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 text-gray-700 text-lg font-light"
        >+</button>
        <button
          onClick={() => centerZoom(1 / 1.2)}
          className="h-9 w-9 flex items-center justify-center bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 text-gray-700 text-lg font-light"
        >−</button>
        <button
          onClick={reset}
          title="Fit to screen"
          className="h-9 w-9 flex items-center justify-center bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 text-gray-600"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      {/* Zoom level */}
      <div className="absolute bottom-5 left-5 bg-white border border-gray-200 text-xs text-gray-400 px-2 py-1 rounded-md pointer-events-none">
        {Math.round(t.scale * 100)}%
      </div>

      {/* Hint */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-white/80 border border-gray-100 text-[11px] text-gray-400 px-3 py-1 rounded-full pointer-events-none whitespace-nowrap">
        Drag to pan · Scroll to zoom
      </div>
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
  const [treeData, setTreeData] = useState<{
    has_structure: boolean;
    reason: string | null;
    roots: ReportingNode[];
  } | null>(null);

  useEffect(() => {
    if (!orgId) return;
    Promise.all([
      getOrganization(orgId).catch(() => null),
      getReportingTree(orgId),
    ])
      .then(([org, tree]) => {
        if (org) setOrgName(org.name);
        setTreeData(tree);
      })
      .catch(() => setError('Failed to load reporting tree.'))
      .finally(() => setLoading(false));
  }, [orgId]);

  // Build layout
  const roots = treeData?.has_structure ? buildRootsLayout(treeData.roots) : [];
  const allCards = roots.flatMap(r => flattenCards(r));
  const allEdges = roots.flatMap(r => collectEdges(r));
  const { w: canvasW, h: canvasH } = canvasSize(roots);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
        <button
          onClick={() => navigate(`/admin/organizations/${orgId}`)}
          className="text-gray-400 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <GitBranch className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-lg font-bold text-gray-900 leading-none">Reporting Structure</h1>
          {orgName && <p className="text-xs text-gray-400 mt-0.5">{orgName}</p>}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* No employees */}
      {!loading && !error && treeData && !treeData.has_structure && treeData.reason === 'no_employees' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400">
          <Users className="h-12 w-12 opacity-30" />
          <p className="text-lg font-medium text-gray-500">No employees in this organisation</p>
          <p className="text-sm">Add employees to nodes and set manager emails to build the tree.</p>
        </div>
      )}

      {/* No manager emails */}
      {!loading && !error && treeData && !treeData.has_structure && treeData.reason === 'no_manager_emails' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 max-w-sm mx-auto text-center px-4">
          <div className="h-14 w-14 rounded-full bg-amber-50 flex items-center justify-center">
            <GitBranch className="h-7 w-7 text-amber-400" />
          </div>
          <p className="text-lg font-semibold text-gray-800">No reporting structure set up</p>
          <p className="text-sm text-gray-500">
            None of the employees have a <strong>Manager Email</strong> set.
            Edit employee records to define the hierarchy.
          </p>
        </div>
      )}

      {/* Tree */}
      {!loading && !error && treeData?.has_structure && canvasW > 0 && (
        <PanZoomCanvas canvasW={canvasW} canvasH={canvasH}>
          {/* SVG connector lines — rendered below cards */}
          <svg
            style={{ position: 'absolute', top: 0, left: 0, width: canvasW, height: canvasH, overflow: 'visible', pointerEvents: 'none' }}
          >
            {allEdges.map((e, i) => (
              <line
                key={i}
                x1={e.x1} y1={e.y1}
                x2={e.x2} y2={e.y2}
                stroke="#d1d5db"
                strokeWidth={1.5}
                strokeLinecap="round"
              />
            ))}
          </svg>
          {/* Employee cards */}
          {allCards.map((pos, i) => <EmpCard key={i} pos={pos} />)}
        </PanZoomCanvas>
      )}
    </div>
  );
}
