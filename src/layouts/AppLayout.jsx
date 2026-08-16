import { Link, NavLink, Outlet } from "react-router-dom";

const navItems = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/applicants", label: "Applicants" },
  { to: "/agencies", label: "Agencies" },
  { to: "/finance", label: "Finance" },
  { to: "/forecasting", label: "Forecasting" },
];

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-100">
      <aside className="fixed left-0 top-0 h-screen w-64 bg-slate-900 text-slate-100 shadow-lg">
        <div className="border-b border-slate-700 px-6 py-5">
          <Link to="/dashboard" className="text-xl font-bold tracking-wide">
            FlowSensus
          </Link>
          <p className="mt-1 text-xs text-slate-400">Smart Deployment Management</p>
        </div>

        <nav className="space-y-1 px-3 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-sky-600 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`
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
          <div className="text-sm text-slate-600">Welcome, User</div>
        </header>

        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
