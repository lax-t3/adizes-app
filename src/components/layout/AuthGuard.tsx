import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";

interface AuthGuardProps {
  allowedRole?: "user" | "admin";
}

export function AuthGuard({ allowedRole }: AuthGuardProps) {
  const { user, role } = useAuthStore();

  if (!user) {
    return <Navigate to={allowedRole === "admin" ? "/admin" : "/"} replace />;
  }

  if (allowedRole && role !== allowedRole) {
    return <Navigate to={role === "admin" ? "/admin/dashboard" : "/dashboard"} replace />;
  }

  return <Outlet />;
}
