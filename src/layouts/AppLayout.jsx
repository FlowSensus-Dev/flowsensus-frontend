  import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
  import { SIDEBAR_CONFIG } from "./sidebarConfig";

  function getModuleFromPath(pathname) {
    // Extract the base path (e.g., "manager" from "/manager/applicant-list")
    const base = "/" + pathname.split("/").filter(Boolean)[0];
    return SIDEBAR_CONFIG[base] ? base : "/manager";
  }

  export default function AppLayout() {
    const location = useLocation();
    const navigate = useNavigate();
    const moduleKey = getModuleFromPath(location.pathname);
    const navItems = SIDEBAR_CONFIG[moduleKey] || [];

    const handleLogout = () => {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      sessionStorage.clear();
      navigate("/");
    };

    return (
      <div className="min-h-screen bg-slate-100">
        <aside className="fixed left-0 top-0 h-screen w-64 bg-slate-900 text-slate-100 shadow-lg">
          <div className="border-b border-slate-700 px-6 py-5">
            <Link to={moduleKey} className="text-xl font-bold tracking-wide">
              FlowSensus
            </Link>
            <p className="mt-1 text-xs text-slate-400">Smart Deployment Management</p>
          </div>

          <nav className="space-y-1 px-3 py-4">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className={({ isActive }) =>
                  "block rounded-md px-3 py-2 text-sm font-medium transition " +
                  (isActive
                    ? "bg-sky-600 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white")
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <div className="ml-64 min-h-screen">
          <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 shadow-sm">
            <h1 className="text-lg font-semibold text-slate-800">FlowSensus Portal</h1>
            <div className="flex items-center gap-4">
              <div className="text-sm text-slate-600">Welcome, User</div>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-700"
              >
                Logout
              </button>
            </div>
          </header>

          <main className="p-6">
            <Outlet />
          </main>
        </div>
      </div>
    );
  }