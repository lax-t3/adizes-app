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

Both modals are **inline read-only modals** inside `AdminOrgDetail.tsx`. They follow the identical pattern as the existing Add Employee / Add Sub-node modals already in the file (fixed overlay + white `rounded-xl` card + `shadow-xl` + `max-w-lg w-full`). No shared component is needed — each is a simple conditional render block.

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

Each step number is rendered as a circle badge: `w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0`. Steps 1–3 use `bg-[#C8102E]`; step 4 uses `bg-[#1D3557]` (navy) to visually distinguish it as an off-page action.

**Nested inside step 2's content block — inline ASCII tree example** (monospace, `bg-gray-50 rounded p-2` box, rendered immediately after step 2's description text and before step 3):
```
🏢 Tata Motors
  └── 📁 Sales
        ├── 📁 North Region
        └── 📁 South Region
  └── 📁 Operations
```

**After the steps — amber callout box** (`bg-orange-50`, `border-orange-200`). All emoji (🏢, 📁, 💡, ⬇) are plain Unicode characters rendered inline in JSX strings — not Lucide icons:

> **💡 What is a sub-node?**
>
> A sub-node is any node nested inside another. They let you mirror your real org hierarchy — as deep as you need.
>
> **Example:** Tata Motors → Sales → North Region → Delhi Team
>
> When you enrol employees by scope you can pick an entire branch — choosing "Sales" automatically includes North Region, South Region, and all their employees.

**Footer:** Single "Got it" button (`bg-[#C8102E]`, right-aligned) closes the modal.

### Modal JSX skeleton

```tsx
{showOrgHelp && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-gray-100">
        <p className="text-base font-bold text-gray-900">How to build your org structure</p>
        <p className="text-xs text-gray-500 mt-0.5">A step-by-step guide</p>
      </div>

      {/* Body — scrollable */}
      <div className="px-6 py-5 overflow-y-auto max-h-[70vh] flex flex-col gap-4 text-sm text-gray-600">

        {/* Steps 1–4 */}
        {/* Each step: flex gap-3 items-start */}
        <div className="flex gap-3 items-start">
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 bg-[#C8102E]">1</div>
          <div>
            <p className="font-semibold text-gray-900">Create the organisation</p>
            <p className="text-xs text-gray-500 mt-1">Give it a name (e.g. "Tata Motors") and an optional description. This is the top-level container — everything else lives inside it.</p>
          </div>
        </div>

        <div className="flex gap-3 items-start">
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 bg-[#C8102E]">2</div>
          <div>
            <p className="font-semibold text-gray-900">Add nodes to build the tree</p>
            <p className="text-xs text-gray-500 mt-1">Nodes are departments, regions, or teams. Click <strong>+ Add Node</strong> under any existing node to create a child beneath it.</p>
            {/* Tree example — nested inside step 2's content div, directly after the description text */}
            <pre className="mt-2 bg-gray-50 rounded p-2 text-xs text-gray-600 font-mono leading-loose">{`🏢 Tata Motors\n  └── 📁 Sales\n        ├── 📁 North Region\n        └── 📁 South Region\n  └── 📁 Operations`}</pre>
          </div>
        </div>

        <div className="flex gap-3 items-start">
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 bg-[#C8102E]">3</div>
          <div>
            <p className="font-semibold text-gray-900">Add employees to nodes</p>
            <p className="text-xs text-gray-500 mt-1">Select any node in the tree, then use <strong>Add Employee</strong> (one at a time) or <strong>Bulk Upload</strong> (CSV) to add employees. Each employee receives a welcome email to activate their account.</p>
          </div>
        </div>

        <div className="flex gap-3 items-start">
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 bg-[#1D3557]">4</div>
          <div>
            <p className="font-semibold text-gray-900">Link the org to a cohort</p>
            <p className="text-xs text-gray-500 mt-1">Go to the cohort detail page → Linked Organisations → link this org. Then use <strong>Enrol from Org</strong> to enrol employees into the assessment cohort.</p>
          </div>
        </div>

        {/* Sub-node callout — amber, after all 4 steps */}
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-xs text-orange-900">
          <p className="font-bold mb-1">💡 What is a sub-node?</p>
          <p>A sub-node is any node nested inside another. They let you mirror your real org hierarchy — as deep as you need.</p>
          <p className="mt-1"><strong>Example:</strong> Tata Motors → Sales → North Region → Delhi Team</p>
          <p className="mt-1">When you enrol employees by scope you can pick an entire branch — choosing "Sales" automatically includes North Region, South Region, and all their employees.</p>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-gray-100 flex justify-end">
        <button onClick={() => setShowOrgHelp(false)} className="bg-[#C8102E] text-white text-xs font-semibold px-5 py-2 rounded-lg">Got it</button>
      </div>
    </div>
  </div>
)}
```

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

The `?` button is inserted **immediately after** the "Bulk Upload" button and **before** the "Add Employee" button in the existing `flex items-center gap-3` row — no layout changes needed. The row order becomes: [Download icon] [Bulk Upload] [? icon] [Add Employee].

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

**Body — blue `node_path` tips callout** (`bg-blue-50`, `border-blue-200`; 💡 is a plain Unicode character, not a Lucide icon):

> **💡 node_path tips**
>
> - Use `/` to separate levels: `Sales/North Region/Delhi Team`
> - Names must match exactly (case-sensitive)
> - Leave blank to add the employee to the node currently selected in the tree
> - Employees with an unrecognised path will be skipped and listed in the error summary

**Footer:** left side — "⬇ Download blank template" link (`onClick={downloadTemplate}`, reusing the existing `downloadTemplate()` function already defined in the component). Right side — "Got it" button (`bg-[#C8102E]`) closes the modal.

### Modal JSX skeleton

```tsx
{showCsvHelp && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-gray-100">
        <p className="text-base font-bold text-gray-900">Bulk Upload — CSV Format</p>
        <p className="text-xs text-gray-500 mt-0.5">How to fill the upload template</p>
      </div>

      {/* Body — scrollable */}
      <div className="px-6 py-5 overflow-y-auto max-h-[70vh] flex flex-col gap-4 text-sm text-gray-600">

        {/* Column reference table */}
        <div>
          <p className="text-xs font-bold text-gray-900 mb-2">Required columns</p>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-2 py-1.5 border border-gray-200 font-semibold text-gray-600">Column</th>
                <th className="text-left px-2 py-1.5 border border-gray-200 font-semibold text-gray-600">Description</th>
                <th className="text-left px-2 py-1.5 border border-gray-200 font-semibold text-gray-600 whitespace-nowrap">Required?</th>
              </tr>
            </thead>
            <tbody>
              {/* Each column name in: font-mono text-[#C8102E] */}
              <tr><td className="px-2 py-1.5 border border-gray-200 font-mono text-[#C8102E]">name</td><td className="px-2 py-1.5 border border-gray-200">Employee's full name</td><td className="px-2 py-1.5 border border-gray-200 text-center">✅</td></tr>
              <tr className="bg-gray-50"><td className="px-2 py-1.5 border border-gray-200 font-mono text-[#C8102E]">email</td><td className="px-2 py-1.5 border border-gray-200">Work email address (must be unique)</td><td className="px-2 py-1.5 border border-gray-200 text-center">✅</td></tr>
              <tr><td className="px-2 py-1.5 border border-gray-200 font-mono text-[#C8102E]">title</td><td className="px-2 py-1.5 border border-gray-200">Job title (e.g. "Senior Manager")</td><td className="px-2 py-1.5 border border-gray-200 text-center">Optional</td></tr>
              <tr className="bg-gray-50"><td className="px-2 py-1.5 border border-gray-200 font-mono text-[#C8102E]">employee_id</td><td className="px-2 py-1.5 border border-gray-200">Your internal HR / payroll ID</td><td className="px-2 py-1.5 border border-gray-200 text-center">Optional</td></tr>
              <tr><td className="px-2 py-1.5 border border-gray-200 font-mono text-[#C8102E]">node_path</td><td className="px-2 py-1.5 border border-gray-200">Slash-separated path to the node. Leave blank to add to the currently selected node.</td><td className="px-2 py-1.5 border border-gray-200 text-center">Optional</td></tr>
            </tbody>
          </table>
        </div>

        {/* Example CSV — dark code block */}
        <div>
          <p className="text-xs font-bold text-gray-900 mb-2">Example CSV</p>
          <pre className="bg-[#1e1e2e] text-[#cdd6f4] rounded-lg p-3 text-xs font-mono leading-loose overflow-x-auto">{`name,email,title,employee_id,node_path\nPriya Sharma,priya@tata.com,Senior Manager,EMP001,Sales/North Region\nRahul Mehta,rahul@tata.com,Team Lead,EMP002,Sales/South Region\nAisha Khan,aisha@tata.com,Analyst,,Operations\nDev Patel,dev@tata.com,Director,EMP004,`}</pre>
        </div>

        {/* node_path tips — blue callout. 💡 is a plain Unicode character. */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900">
          <p className="font-bold mb-1">💡 node_path tips</p>
          <ul className="list-none space-y-1">
            <li>• Use <code className="bg-blue-100 px-1 rounded">/</code> to separate levels: <code className="bg-blue-100 px-1 rounded">Sales/North Region/Delhi Team</code></li>
            <li>• Names must match exactly (case-sensitive)</li>
            <li>• Leave blank to add the employee to the node currently selected in the tree</li>
            <li>• Employees with an unrecognised path will be skipped and listed in the error summary</li>
          </ul>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between">
        <button onClick={downloadTemplate} className="text-xs text-[#C8102E] font-semibold hover:underline">⬇ Download blank template</button>
        <button onClick={() => setShowCsvHelp(false)} className="bg-[#C8102E] text-white text-xs font-semibold px-5 py-2 rounded-lg">Got it</button>
      </div>
    </div>
  </div>
)}
```

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
