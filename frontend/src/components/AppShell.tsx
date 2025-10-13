import { Link, NavLink } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';

export const AppShell = ({ children }: { children: React.ReactNode }) => {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/dashboard" className="text-lg font-semibold text-slate-900">
            n8n Client Console
          </Link>

          <nav className="flex items-center gap-4 text-sm font-medium text-slate-600">
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 transition ${
                  isActive ? 'bg-slate-900 text-white' : 'hover:bg-slate-100'
                }`
              }
            >
              Dashboard
            </NavLink>

            {user?.role === 'admin' ? (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 transition ${
                    isActive ? 'bg-slate-900 text-white' : 'hover:bg-slate-100'
                  }`
                }
              >
                Admin
              </NavLink>
            ) : null}

            {user ? (
              <div className="flex items-center gap-3 border-l border-slate-200 pl-3">
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900">{user.name}</p>
                  <p className="text-xs text-slate-500">{user.email}</p>
                  {user.role === 'client' && user.clientName ? (
                    <p className="mt-1 text-xs text-slate-400">{user.clientName}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={logout}
                  className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-100"
                >
                  Log out
                </button>
              </div>
            ) : null}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto w-full max-w-6xl px-6 py-8">{children}</div>
      </main>
    </div>
  );
};
