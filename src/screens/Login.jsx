import { useState } from 'react';
import logo from '../assets/LogoELROHI.jpeg';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
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
      const cred = await login(email.trim(), password);
      const { getUser } = await import('../services/db');
      const prof = await getUser(cred.user.uid);
      const home = NAV_CONFIG[prof?.role]?.[0] || '/dashboard';
      navigate(home);
    } catch (err) {
      setError('Correo o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: '#111827' }}>
      {/* Logo */}
      <div className="mb-8 text-center">
        <img src={logo} alt="ELROHI" className="h-20 w-auto mx-auto mb-3 rounded-xl object-contain" />
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


      </div>
    </div>
  );
}
