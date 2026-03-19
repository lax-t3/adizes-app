# Org Help Icons — Design Spec

**Date:** 2026-03-19
**Status:** Approved

## Problem

The AdminOrgDetail page gives admins no guidance on:

1. How to build an org tree (what order, what nodes are, what sub-nodes mean)
2. How to format the CSV for bulk employee upload (what columns, what `node_path` means, worked examples)

New admins have to guess or ask for help. Both pieces of information are contextual — they belong right at the point of action.

---

## Scope

Two additions to `src/pages/AdminOrgDetail.tsx`, both self-contained:

1. **Org Structure help** — add a "Organisation Structure" heading to the currently-unlabelled left tree panel, with a `?` icon that opens a modal guide.
2. **CSV Bulk Upload help** — add a `?` icon inline next to the existing "Bulk Upload" button that opens a modal explaining the CSV format.

No backend changes. No new files. No changes to other pages.

---

## Architecture

Both modals are **inline read-only modals** inside `AdminOrgDetail.tsx`. They follow the identical pattern as the existing Add Employee / Add Sub-node modals already in the file (fixed overlay + white `rounded-xl` card + `shadow-xl`). No shared component is needed — each is a simple conditional render block.

Two new state booleans: `showOrgHelp` and `showCsvHelp`.

`HelpCircle` is added to the existing `lucide-react` import.

---

## Piece 1: Org Structure Help

### Trigger placement

The left tree panel (line 224, `w-[35%]`) currently has no heading. Add a heading row above the tree:

```tsx
<div className="w-[35%] border-r border-gray-200 overflow-y-auto p-3">
  {/* New heading row */}
  <div className="flex items-center justify-between mb-3">
    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
      Organisation Structure
    </h3>
    <button
      onClick={() => setShowOrgHelp(true)}
      className="text-gray-400 hover:text-gray-600 transition-colors"
      title="How to build your org structure"
    >
      <HelpCircle className="h-4 w-4" />
    </button>
  </div>
  {/* existing tree render */}
  {currentOrg.tree.map((root) => ( ... ))}
</div>
```

### Modal content

**Header:** "How to build your org structure" / subtitle "A step-by-step guide"

**Body — 4 numbered steps:**

| # | Heading | Body |
|---|---------|------|
| 1 | Create the organisation | Give it a name (e.g. "Tata Motors") and an optional description. This is the top-level container — everything else lives inside it. |
| 2 | Add nodes to build the tree | Nodes are departments, regions, or teams. Click **+ Add Node** under any existing node to create a child beneath it. |
| 3 | Add employees to nodes | Select any node in the tree, then use **Add Employee** (one at a time) or **Bulk Upload** (CSV) to add employees. Each employee receives a welcome email to activate their account. |
| 4 | Link the org to a cohort | Go to the cohort detail page → Linked Organisations → link this org. Then use **Enrol from Org** to enrol employees into the assessment cohort. |

Step 4 circle uses `#1D3557` (navy) instead of `#C8102E` (red) to visually distinguish it as an off-page action.

**After step 2 — inline ASCII tree example** (monospace, `bg-gray-50` box):
```
🏢 Tata Motors
  └── 📁 Sales
        ├── 📁 North Region
        └── 📁 South Region
  └── 📁 Operations
```

**After the steps — amber callout box** (`bg-orange-50`, `border-orange-200`):

> **💡 What is a sub-node?**
>
> A sub-node is any node nested inside another. They let you mirror your real org hierarchy — as deep as you need.
>
> **Example:** Tata Motors → Sales → North Region → Delhi Team
>
> When you enrol employees by scope you can pick an entire branch — choosing "Sales" automatically includes North Region, South Region, and all their employees.

**Footer:** Single "Got it" button (`bg-[#C8102E]`, right-aligned) closes the modal.

---

## Piece 2: CSV Bulk Upload Help

### Trigger placement

The "Bulk Upload" button is at lines 298–303. Add a `?` icon immediately after it in the same `flex` row:

```tsx
<button onClick={() => setShowBulk(true)} ...>
  Bulk Upload
</button>
<button
  onClick={() => setShowCsvHelp(true)}
  className="text-gray-400 hover:text-gray-600 transition-colors"
  title="How to format the CSV file"
>
  <HelpCircle className="h-4 w-4" />
</button>
```

The two buttons sit in an existing `flex items-center gap-2` row — no layout changes needed.

### Modal content

**Header:** "Bulk Upload — CSV Format" / subtitle "How to fill the upload template"

**Body — column reference table:**

| Column | Description | Required? |
|--------|-------------|-----------|
| `name` | Employee's full name | ✅ Required |
| `email` | Work email address (must be unique) | ✅ Required |
| `title` | Job title (e.g. "Senior Manager") | Optional |
| `employee_id` | Your internal HR / payroll ID | Optional |
| `node_path` | Slash-separated path to the node. Leave blank to add to the currently selected node. | Optional |

Column names in `font-mono text-[#C8102E]`. Table has `bg-gray-50` header row and `border border-gray-200` cells.

**Body — example CSV** (dark code block, `bg-[#1e1e2e]`, monospace):

```
name,email,title,employee_id,node_path
Priya Sharma,priya@tata.com,Senior Manager,EMP001,Sales/North Region
Rahul Mehta,rahul@tata.com,Team Lead,EMP002,Sales/South Region
Aisha Khan,aisha@tata.com,Analyst,,Operations
Dev Patel,dev@tata.com,Director,EMP004,
```

(Aisha has no `employee_id` — double comma. Dev has no `node_path` — trailing comma. Both are valid.)

**Body — blue `node_path` tips callout** (`bg-blue-50`, `border-blue-200`):

> **💡 node_path tips**
>
> - Use `/` to separate levels: `Sales/North Region/Delhi Team`
> - Names must match exactly (case-sensitive)
> - Leave blank to add the employee to the node currently selected in the tree
> - Employees with an unrecognised path will be skipped and listed in the error summary

**Footer:** left side — "⬇ Download blank template" link (calls the existing download handler already wired to the `Download` icon button in the employee panel). Right side — "Got it" button (`bg-[#C8102E]`) closes the modal.

---

## State

Add to existing component state:

```tsx
const [showOrgHelp, setShowOrgHelp] = useState(false);
const [showCsvHelp, setShowCsvHelp] = useState(false);
```

Both modals close on "Got it" button click. No other close triggers needed (consistent with existing modals in the file which also only close via explicit button).

---

## Files Changed

| File | Change |
|------|--------|
| `src/pages/AdminOrgDetail.tsx` | Add `HelpCircle` to lucide import; add 2 state booleans; add heading + `?` button to left tree panel; add `?` button next to Bulk Upload; add 2 modal JSX blocks |

---

## What Is Not Changed

- No changes to `AdminOrganizations.tsx`
- No new component files
- No backend changes
- The existing "Bulk Upload" modal (CSV file picker + upload flow) is unchanged
- The existing download template button/handler is reused by the CSV help modal footer link
