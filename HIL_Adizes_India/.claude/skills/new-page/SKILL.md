---
name: new-page
description: "Scaffold a new React page for adizes-frontend — creates the page component and wires it into App.tsx. Usage: /new-page <PageName>"
---

The user will provide a PascalCase page name (e.g. `Reports`).

## Step 1: Create the page component
Create `/Users/vrln/adizes-frontend/src/pages/<PageName>.tsx`:

```tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

export default function <PageName>() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) navigate("/login");
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900"><PageName></h1>
        {/* TODO: add content */}
      </div>
    </div>
  );
}
```

Adapt the component based on what the user is building (admin-only, public, auth-required, etc.).

## Step 2: Add route to App.tsx
Open `/Users/vrln/adizes-frontend/src/App.tsx`.

Add the import:
```tsx
import <PageName> from "./pages/<PageName>";
```

Add the route inside the `<Routes>` block:
```tsx
<Route path="/<page-name>" element={<PrivateRoute><PageName /></PrivateRoute>} />
```
Use `<Route>` without `PrivateRoute` for public pages.

## Step 3: Type check
```bash
cd /Users/vrln/adizes-frontend && npm run lint 2>&1
```
Fix any TypeScript errors before reporting done.
