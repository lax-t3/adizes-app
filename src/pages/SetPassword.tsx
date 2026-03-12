// src/pages/SetPassword.tsx
import { useEffect } from "react";

/**
 * Redirect shim — forwards old /set-password invite links to /register,
 * preserving the URL hash so the invite token reaches the Register page.
 * Can be deleted once all outstanding invite emails have been acted on.
 * When deleted, also remove the /set-password route from App.tsx.
 */
export function SetPassword() {
  useEffect(() => {
    window.location.replace(`/register${window.location.hash}`);
  }, []);
  return null;
}
