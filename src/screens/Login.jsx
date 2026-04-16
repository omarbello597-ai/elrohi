import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUser } from '../services/db';
import { NAV_CONFIG, ROLE_META, ACCENT } from '../constants';

export default function LoginScreen() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

const handleLogin = async (e) => {
  e.preventDefault();
  if (!email || !password) { setError('Ingresa tu correo y contraseña'); return; }
  setLoading(true);
  setError('');
  try {
    const result = await login(email.trim(), password);
    const profile = await getUser(result.user.uid);
    const NAV = {
      gerente: '/dashboard', admin_elrohi: '/dashboard',
      nomina: '/nomina', despachos: '/pedidos',
      corte: '/corte', admin_satelite: '/taller',
      operario: '/mis-ops', tintoreria: '/tintoreria',
      pespunte: '/pespunte', bodega: '/bodega',
    };
    navigate(profile?.role ? (NAV[profile.role] || '/dashboard') : '/');
  } catch (err) {
    setError('Correo o contraseña incorrectos');
  } finally {
    setLoading(false);
  }
};

  // Quick-access demo buttons
  const DEMO_LOGINS = [
    { label: 'Gerente General',  email: 'gerente@elrohi.com'    },
    { label: 'Admin ELROHI',     email: 'admin@elrohi.com'      },
    { label: 'Admin Satélite',   email: 'sat1@elrohi.com'       },
    { label: 'Operario',         email: 'op1@elrohi.com'        },
    { label: 'Área de Corte',    email: 'corte@elrohi.com'      },
    { label: 'Tintorería',       email: 'tintoreria@elrohi.com' },
    { label: 'Pespunte',         email: 'pespunte@elrohi.com'   },
    { label: 'Bodega',           email: 'bodega@elrohi.com'     },
  ];

  const quickLogin = (demoEmail) => {
    setEmail(demoEmail);
    setPassword('elrohi2024');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: '#111827' }}>
      {/* Logo */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-black text-white tracking-tighter">
          🧵 <span style={{ color: ACCENT }}>EL</span>ROHI
        </h1>
        <p className="text-gray-400 text-sm mt-1">Sistema de Gestión de Producción</p>
      </div>

      <div className="w-full max-w-sm">
        {/* Login form */}
        <form onSubmit={handleLogin} className="bg-gray-800 rounded-2xl p-6 mb-4 border border-gray-700">
          <h2 className="text-white font-semibold text-sm mb-4">Iniciar sesión</h2>

          {error && (
            <div className="bg-red-900/50 border border-red-700 rounded-lg px-3 py-2 mb-4">
              <p className="text-red-300 text-xs">{error}</p>
            </div>
          )}

          <div className="mb-3">
            <label className="block text-xs text-gray-400 mb-1">Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@elrohi.com"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-400"
            />
          </div>

          <div className="mb-4">
            <label className="block text-xs text-gray-400 mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-400"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-white text-sm font-bold transition-colors disabled:opacity-50"
            style={{ background: ACCENT }}
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        {/* Demo quick access */}
        <div className="bg-gray-800/60 border border-gray-700 rounded-2xl p-4">
          <p className="text-gray-400 text-[10px] font-semibold uppercase tracking-wider mb-3">
            Acceso demo rápido · contraseña: elrohi2024
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {DEMO_LOGINS.map((d) => (
              <button
                key={d.email}
                onClick={() => quickLogin(d.email)}
                className="text-left px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                <p className="text-gray-200 text-[11px] font-medium">{d.label}</p>
                <p className="text-gray-500 text-[9px]">{d.email}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
