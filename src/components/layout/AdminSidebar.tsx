import { NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { LayoutDashboard, Users, Download, LogOut, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function AdminSidebar() {
  const { logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/admin");
  };

  const navItems = [
    { name: "Dashboard", to: "/admin/dashboard", icon: LayoutDashboard },
    { name: "Cohorts", to: "/admin/cohorts", icon: Users },
    { name: "Administrators", to: "/admin/users", icon: ShieldCheck },
    { name: "Export", to: "/admin/export", icon: Download },
  ];

  return (
    <div className="flex h-screen w-64 flex-col border-r border-gray-200 bg-white">
      <div className="flex h-16 items-center border-b border-gray-200 px-6">
        <div className="flex items-center gap-2">
          <img 
            src="/logo.png" 
            alt="Adizes Admin" 
            className="h-8 w-auto" 
            referrerPolicy="no-referrer"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-3">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary-light text-primary"
                    : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    className={cn(
                      "mr-3 h-5 w-5 flex-shrink-0",
                      isActive ? "text-primary" : "text-gray-400 group-hover:text-gray-500"
                    )}
                    aria-hidden="true"
                  />
                  {item.name}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="border-t border-gray-200 p-4">
        <button
          onClick={handleLogout}
          className="group flex w-full items-center rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
        >
          <LogOut className="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-500" />
          Log out
        </button>
      </div>
    </div>
  );
}
