import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { NAV_CONFIG, NAV_ITEMS, ROLE_META, ACCENT } from '../constants';

const NAV_ICONS = {
  LayoutDashboard: '⊞', ShoppingBag: '📋', Package: '📦', Factory: '🏭',
  Box: '🗄', DollarSign: '💵', Settings: '⚙', Scissors: '✂',
  Zap: '⚡', Wrench: '🔧', Palette: '🎨', Layers: '🪡', FileText: '📄',
  Warehouse: '📦', Users: '👥',
};

export default function Layout({ children }) {
  const { profile, logout } = useAuth();
  const { lots, supplies }  = useData();
  const navigate            = useNavigate();
  const [sideOpen, setSideOpen] = useState(true);

  if (!profile) return null;

  const navPaths = NAV_CONFIG[profile.role] || [];
  const meta     = ROLE_META[profile.role] || {};

  const alertSupplies = supplies.filter((s) => s.qty <= s.min);
  const alertLots     = lots.filter(
    (l) => !['despachado', 'bodega'].includes(l.status) && new Date(l.deadline) < new Date()
  );
  const alertCount = alertSupplies.length + alertLots.length;

  const handleLogout = async () => { await logout(); navigate('/login'); };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#f8f6f0' }}>
      {/* ── SIDEBAR ── */}
      <aside
        className="flex flex-col flex-shrink-0 transition-all"
        style={{ width: sideOpen ? '210px' : '48px', background: '#111827' }}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-3 py-4 border-b border-gray-800">
          {sideOpen && (
            <span className="text-lg font-black tracking-tighter text-white">
              🧵 <span style={{ color: ACCENT }}>EL</span>ROHI
            </span>
          )}
          <button
            onClick={() => setSideOpen(!sideOpen)}
            className="text-gray-500 hover:text-gray-300 text-sm px-1"
          >
            {sideOpen ? '←' : '☰'}
          </button>
        </div>

        {/* Role badge */}
        {sideOpen && (
          <div className="px-3 py-2">
            <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-800 text-gray-400">
              {meta.label}
            </span>
          </div>
        )}

        {/* Alert bar */}
        {sideOpen && alertCount > 0 && (
          <div className="mx-2 mb-1 bg-red-900/60 border border-red-800 rounded-lg px-3 py-2">
            <p className="text-red-300 text-[10px] font-semibold">⚠ {alertCount} alertas activas</p>
          </div>
        )}

        {/* Nav items */}
        <nav className="flex-1 px-2 py-1 overflow-y-auto">
          {navPaths.map((path) => {
            const item = NAV_ITEMS[path];
            if (!item) return null;
            const icon = NAV_ICONS[item.icon] || '•';
            return (
              <NavLink
                key={path}
                to={path}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-2.5 py-2 rounded-lg mb-0.5 text-xs transition-all ` +
                  (isActive
                    ? 'font-semibold text-white'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800')
                }
                style={({ isActive }) => isActive ? { background: ACCENT } : {}}
              >
                <span className="text-sm flex-shrink-0">{icon}</span>
                {sideOpen && item.label}
              </NavLink>
            );
          })}
        </nav>

        {/* User info */}
        <div className="px-2 py-2 border-t border-gray-800">
          {sideOpen ? (
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-[10px] font-bold text-gray-300 flex-shrink-0">
                {profile.initials}
              </div>
              <div className="min-w-0">
                <p className="text-gray-200 text-[11px] font-semibold truncate">{profile.name}</p>
                <p className="text-gray-500 text-[9px]">{meta.label}</p>
              </div>
            </div>
          ) : null}
          <button
            onClick={handleLogout}
            className="w-full text-[10px] text-gray-500 hover:text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-md py-1.5 transition-colors"
          >
            {sideOpen ? '↩ Cerrar sesión' : '↩'}
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        {/* Header */}
        <header className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-sm font-bold text-gray-900">ELROHI</h1>
            <p className="text-[10px] text-gray-400">Sistema de Gestión de Producción</p>
          </div>
          {alertCount > 0 && (
            <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
              <span>🔔</span>
              <span className="text-xs font-semibold text-red-600">{alertCount} alerta{alertCount > 1 ? 's' : ''}</span>
            </div>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-5">
          {children}
        </main>
      </div>
    </div>
  );
}
