import { Link } from "react-router-dom";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-gray-100 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Policy links */}
          <nav className="flex items-center gap-1 text-sm text-gray-400">
            <Link to="/terms" className="px-2 py-1 hover:text-gray-700 transition-colors">
              Terms of Service
            </Link>
            <span className="text-gray-200">|</span>
            <Link to="/privacy" className="px-2 py-1 hover:text-gray-700 transition-colors">
              Privacy Policy
            </Link>
            <span className="text-gray-200">|</span>
            <Link to="/refund" className="px-2 py-1 hover:text-gray-700 transition-colors">
              Refund Policy
            </Link>
          </nav>

          {/* Copyright + powered by + HIL logo */}
          <div className="flex flex-col items-center sm:items-end gap-2 text-xs text-gray-400">
            <img src="/hil_blue.png" alt="Heartfulness Institute of Leadership" className="h-9 w-auto opacity-85" referrerPolicy="no-referrer" />
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <span>&copy; {year} Adizes Institute. All rights reserved.</span>
              <span className="hidden sm:inline text-gray-200">·</span>
              <span>App powered by <span className="font-semibold text-gray-500">Turiyaskills</span></span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
