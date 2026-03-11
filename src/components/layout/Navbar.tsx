import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { LogOut, User, Settings } from "lucide-react";

export function Navbar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    setOpen(false);
    logout();
    navigate("/");
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const initials = user?.name
    ? user.name.split(" ").map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()
    : "U";

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <Link to="/dashboard" className="flex items-center gap-2">
            <img
              src="/logo.png"
              alt="Adizes Institute"
              className="h-14 w-auto"
              referrerPolicy="no-referrer"
            />
          </Link>
        </div>

        {user && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setOpen(v => !v)}
              className="flex items-center gap-2.5 rounded-full pl-3 pr-1 py-1 hover:bg-gray-100 transition-colors"
            >
              <span className="hidden sm:inline-block text-sm font-medium text-gray-700">{user.name}</span>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white text-sm font-bold select-none">
                {initials}
              </div>
            </button>

            {open && (
              <div className="absolute right-0 mt-2 w-52 rounded-xl border border-gray-100 bg-white shadow-lg py-1.5 z-50">
                {/* User info header */}
                <div className="px-4 py-2.5 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>

                <Link
                  to="/profile"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <User className="h-4 w-4 text-gray-400" />
                  My Profile
                </Link>

                <div className="border-t border-gray-100 mt-1 pt-1">
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <LogOut className="h-4 w-4 text-gray-400" />
                    Log out
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
