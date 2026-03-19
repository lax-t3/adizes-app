# Org Help Icons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two `?` help icon buttons to `AdminOrgDetail.tsx` — one in the org tree panel heading, one next to the Bulk Upload button — each opening a read-only modal with contextual guidance.

**Architecture:** All changes are in a single existing file. Two new `useState` booleans gate two new modal JSX blocks. The `HelpCircle` Lucide icon is added to the existing import. No new files, no backend changes, no routing changes.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, lucide-react

---

## File Map

| File | Change |
|------|--------|
| `src/pages/AdminOrgDetail.tsx` | Add `HelpCircle` to lucide import; add 2 state booleans; add heading row + `?` button in left tree panel; add `?` button after Bulk Upload button; add 2 modal JSX blocks at bottom of return |

---

### Task 1: Add Org Structure Help

**Files:**
- Modify: `src/pages/AdminOrgDetail.tsx`

This task has no backend logic to test with unit tests — it is pure JSX. Testing is visual (manual browser verification as listed below). Follow the steps carefully; the complete code is provided.

- [ ] **Step 1: Add `HelpCircle` to the lucide-react import**

Line 4 currently reads:
```tsx
import { ArrowLeft, ChevronRight, ChevronDown, Plus, Trash2, Users, Download } from 'lucide-react';
```

Change to:
```tsx
import { ArrowLeft, ChevronRight, ChevronDown, Plus, Trash2, Users, Download, HelpCircle } from 'lucide-react';
```

- [ ] **Step 2: Add two state booleans for the help modals**

After the existing bulk upload state block (after line 92, `const [uploading, setUploading] = useState(false);`), add:

```tsx
  // Help modal state
  const [showOrgHelp, setShowOrgHelp] = useState(false);
  const [showCsvHelp, setShowCsvHelp] = useState(false);
```

- [ ] **Step 3: Add "Organisation Structure" heading row with `?` button to the left tree panel**

The left tree panel starts at line 224:
```tsx
        <div className="w-[35%] border-r border-gray-200 overflow-y-auto p-3">
          {currentOrg.tree.map((root) => (
```

Replace that opening with:
```tsx
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
            >
              <HelpCircle className="h-4 w-4" />
            </button>
          </div>
          {currentOrg.tree.map((root) => (
```

- [ ] **Step 4: Add the Org Structure Help modal JSX**

Immediately before the closing `</div>` tag of the entire component (the last `</div>` at the bottom, after the Bulk Upload Modal closing `})`), add the following block:

```tsx
      {/* Org Structure Help Modal */}
      {showOrgHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            {/* Header */}
            <div className="px-6 pt-5 pb-4 border-b border-gray-100">
              <p className="text-base font-bold text-gray-900">How to build your org structure</p>
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
```

- [ ] **Step 5: Verify the file compiles**

```bash
cd /Users/vrln/adizes-frontend && npx tsc --noEmit
```

Expected: no errors. If there are errors, fix them before proceeding.

- [ ] **Step 6: Manual browser check — Org Help modal**

1. Ensure the dev server is running: `npm run dev` in `adizes-frontend`
2. Log in as admin (`admin@adizes.com` / `Admin@1234`)
3. Navigate to Admin → Organizations → any org
4. Verify "Organisation Structure" heading appears above the tree in the left panel
5. Click the `?` icon — verify the modal opens with 4 steps, the ASCII tree inside step 2, the amber sub-node callout, and a red "Got it" button
6. Click "Got it" — verify the modal closes

- [ ] **Step 7: Commit**

```bash
cd /Users/vrln/adizes-frontend
git add src/pages/AdminOrgDetail.tsx
git commit -m "feat: add org structure help icon and modal to AdminOrgDetail"
```

---

### Task 2: Add CSV Bulk Upload Help

**Files:**
- Modify: `src/pages/AdminOrgDetail.tsx`

- [ ] **Step 1: Add `?` button immediately after the Bulk Upload button**

The Bulk Upload button block (lines 298–303 in the original file, adjust for the lines added in Task 1) reads:
```tsx
                <button
                  onClick={() => setShowBulk(true)}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50 text-gray-600"
                >
                  Bulk Upload
                </button>
```

Add the following `?` button **immediately after** the closing `</button>` tag of "Bulk Upload" and **before** the "Add Employee" button:

```tsx
                <button
                  onClick={() => setShowCsvHelp(true)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  title="How to format the CSV file"
                >
                  <HelpCircle className="h-4 w-4" />
                </button>
```

The row order will be: [Download icon button] [Bulk Upload] [? icon] [Add Employee].

- [ ] **Step 2: Add the CSV Help modal JSX**

Immediately before the closing `</div>` of the component (after the Org Structure Help modal block added in Task 1), add:

```tsx
      {/* CSV Help Modal */}
      {showCsvHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            {/* Header */}
            <div className="px-6 pt-5 pb-4 border-b border-gray-100">
              <p className="text-base font-bold text-gray-900">Bulk Upload — CSV Format</p>
              <p className="text-xs text-gray-500 mt-0.5">How to fill the upload template</p>
            </div>

            {/* Body */}
            <div className="px-6 py-5 overflow-y-auto max-h-[70vh] flex flex-col gap-4 text-sm text-gray-600">

              {/* Column table */}
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
```

- [ ] **Step 3: Verify the file compiles**

```bash
cd /Users/vrln/adizes-frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Manual browser check — CSV Help modal**

1. Navigate to Admin → Organizations → any org → select any node
2. Verify the `?` icon appears between "Bulk Upload" and "Add Employee" in the controls row
3. Click the `?` icon — verify the modal opens with:
   - Column reference table (5 rows, column names in red monospace)
   - Dark (`#1e1e2e`) code block with 5 CSV rows
   - Blue `node_path` tips callout
   - "⬇ Download blank template" link on the left of the footer
   - Red "Got it" button on the right
4. Click "⬇ Download blank template" — verify a `employee_upload_template.csv` file downloads
5. Click "Got it" — verify modal closes
6. Also verify clicking "Bulk Upload" still opens the existing file-upload modal (unchanged)

- [ ] **Step 5: Commit**

```bash
cd /Users/vrln/adizes-frontend
git add src/pages/AdminOrgDetail.tsx
git commit -m "feat: add CSV bulk upload help icon and modal to AdminOrgDetail"
```
