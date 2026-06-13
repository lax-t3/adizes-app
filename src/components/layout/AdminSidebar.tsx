import { useState, useEffect } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { useCoachingLeadsStore } from "@/store/coachingLeadsStore";
import { LayoutDashboard, Users, LogOut, ShieldCheck, Settings, HelpCircle, Menu, Building2, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function AdminSidebar() {
  const { logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const pendingLeads = useCoachingLeadsStore((s) => s.pending);
  const refreshLeads = useCoachingLeadsStore((s) => s.refresh);
  // Refresh the pending-lead count on mount and whenever the admin navigates.
  useEffect(() => { refreshLeads(); }, [location.pathname, refreshLeads]);

  const handleLogout = () => {
    logout();
    navigate("/admin");
  };

  const navItems = [
    { name: "Dashboard", to: "/admin/dashboard", icon: LayoutDashboard },
    { name: "Organizations", to: "/admin/organizations", icon: Building2 },
    { name: "Cohorts", to: "/admin/cohorts", icon: Users },
    { name: "Administrators", to: "/admin/users", icon: ShieldCheck },
    { name: "Coaching Leads", to: "/admin/coaching-leads", icon: MessageCircle },
    { name: "Settings", to: "/admin/settings", icon: Settings },
    { name: "Help & FAQs", to: "/admin/help", icon: HelpCircle },
  ];

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex h-20 items-center border-b border-gray-200 px-6">
        <div className="flex items-center gap-2">
          <img
            src="/HIL-Isotope.png"
            alt="Heartfulness Institute of Leadership"
            className="h-16 w-auto"
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
              onClick={() => setMobileOpen(false)}
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
                  <span className="flex-1">{item.name}</span>
                  {item.to === "/admin/coaching-leads" && pendingLeads > 0 && (
                    <span
                      title={`${pendingLeads} new lead${pendingLeads === 1 ? "" : "s"} to action`}
                      className="ml-2 inline-flex min-w-[20px] items-center justify-center rounded-full bg-[#C8102E] px-1.5 py-0.5 text-[11px] font-bold leading-none text-white"
                    >
                      {pendingLeads}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="border-t border-gray-200 p-4 space-y-1">
        <button
          onClick={handleLogout}
          className="group flex w-full items-center rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
        >
          <LogOut className="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-500" />
          Log out
        </button>
        <div className="px-3 pt-3 pb-2 space-y-2">
          <img src="/HIL-Isotope.png" alt="Heartfulness Institute of Leadership" className="h-10 w-auto opacity-85" referrerPolicy="no-referrer" />
          <p className="text-[10px] text-gray-400 leading-snug">&copy; {new Date().getFullYear()} Heartfulness Institute of Leadership</p>
          <p className="text-[10px] text-gray-400 leading-snug">Powered by the Adizes PAEI Framework</p>
          <p className="text-[10px] text-gray-400 leading-snug">Technical platform: <span className="font-medium">Turiyaskills</span></p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Hamburger button — mobile only */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 flex h-10 w-10 items-center justify-center rounded-md bg-white border border-gray-200 shadow-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Backdrop — mobile only */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — drawer on mobile, static on desktop */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 transform transition-transform duration-200 border-r border-gray-200 bg-white lg:static lg:translate-x-0 lg:h-screen",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </div>
    </>
  );
}
