import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import { AuthProvider, useAuth }  from './contexts/AuthContext';
import { DataProvider }           from './contexts/DataContext';
import Layout                     from './components/Layout';

import LoginScreen      from './screens/Login';
import Dashboard        from './screens/Dashboard';
import PedidosScreen    from './screens/Pedidos';
import LotesScreen      from './screens/Lotes';
import TallerScreen     from './screens/Taller';
import AsignarOpsScreen from './screens/AsignarOps';
import { MisOpsScreen, QuincenaScreen } from './screens/Operario';
import { TintoriaScreen, PespunteScreen, BodegaScreen } from './screens/Produccion';
import { InventarioScreen, ConfigScreen } from './screens/Otros';
import GestionSatelitesScreen from './screens/GestionSatelites';
import { NominaScreen } from './screens/Nomina';

import { seedDatabase } from './data/seed';
import { NAV_CONFIG }   from './constants';
import { RemisionScreen } from './screens/Remision';
import CorteElrohiScreen    from './screens/CorteElrohi';
import BodegasScreen        from './screens/Bodegas';
import OperacionesElrohiScreen from './screens/OperacionesElrohi';
import GestionOperariosScreen  from './screens/GestionOperarios';
import RecepcionTintoreria from './screens/RecepcionTintoreria';
import BodegaCalidadScreen from './screens/BodegaCalidad';
import BodegaLonasScreen from './screens/BodegaLonas';

// ─── PROTECTED ROUTE ─────────────────────────────────────────────────────────
function ProtectedRoute({ children, allowedRoles }) {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !profile) navigate('/login');
  }, [profile, loading, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <p className="text-white text-2xl font-black mb-2">🧵 ELROHI</p>
          <p className="text-gray-400 text-sm">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    const firstAllowed = NAV_CONFIG[profile.role]?.[0] || '/dashboard';
    return <Navigate to={firstAllowed} replace />;
  }

  return children;
}

// ─── ROUTES ──────────────────────────────────────────────────────────────────
const ROLE_GROUPS = {
  gerente:        ['/dashboard', '/pedidos', '/lotes', '/satelites', '/inventario', '/nomina', '/config'],
  admin_elrohi:   ['/dashboard', '/pedidos', '/lotes', '/corte', '/satelites', '/inventario'],
  nomina:         ['/nomina'],
  despachos:      ['/pedidos', '/inventario'],
  corte:          ['/corte'],
  admin_satelite: ['/taller', '/asignar-ops'],
  operario:       ['/mis-ops', '/quincena'],
  tintoreria:     ['/tintoreria'],
  pespunte:       ['/pespunte', '/quincena'],
  bodega:         ['/bodega'],
};

const ALL_ROUTES = [
  { path: '/dashboard',   component: Dashboard,        roles: ['gerente', 'admin_elrohi', 'nomina', 'despachos'] },
  { path: '/pedidos',     component: PedidosScreen,    roles: ['gerente', 'admin_elrohi', 'despachos'] },
  { path: '/lotes',       component: LotesScreen,      roles: ['gerente', 'admin_elrohi', 'operario'] },
  { path: '/satelites',   component: GestionSatelitesScreen, roles: ['gerente', 'admin_elrohi'] },
  { path: '/inventario',  component: InventarioScreen, roles: ['gerente', 'admin_elrohi', 'despachos', 'bodega'] },
  { path: '/nomina',      component: NominaScreen,     roles: ['gerente', 'nomina'] },
  { path: '/config',      component: ConfigScreen,     roles: ['gerente', 'admin_elrohi'] },
  { path: '/corte',       component: CorteElrohiScreen,      roles: ['gerente', 'admin_elrohi', 'corte'] },
  { path: '/taller',      component: TallerScreen,     roles: ['admin_satelite'] },
  { path: '/asignar-ops', component: AsignarOpsScreen, roles: ['admin_satelite'] },
  { path: '/mis-ops',     component: MisOpsScreen,     roles: ['operario', 'pespunte'] },
  { path: '/quincena',    component: QuincenaScreen,   roles: ['operario', 'pespunte'] },
  { path: '/tintoreria',  component: TintoriaScreen,   roles: ['gerente', 'admin_elrohi', 'tintoreria'] },
  { path: '/pespunte',    component: PespunteScreen,   roles: ['gerente', 'admin_elrohi', 'pespunte'] },
  { path: '/bodega',      component: BodegaScreen,     roles: ['gerente', 'admin_elrohi', 'bodega'] },
  { path: '/remision',    component: RemisionScreen,   roles: ['gerente', 'admin_elrohi', 'corte', 'admin_satelite'] },
  { path: '/corte',               component: CorteElrohiScreen,       roles: ['gerente','admin_elrohi','corte'] },
  { path: '/bodegas',             component: BodegasScreen,           roles: ['gerente','admin_elrohi','bodega_op'] },
  { path: '/operaciones-elrohi',  component: OperacionesElrohiScreen, roles: ['gerente','admin_elrohi','corte','bodega_op','terminacion','pespunte'] },
  { path: '/gestion-operarios',   component: GestionOperariosScreen,  roles: ['gerente','admin_elrohi'] },
  { path: '/recepcion-tinto',     component: RecepcionTintoreria, roles: ['gerente','admin_elrohi'] },
  { path: '/taller',              component: TallerScreen, roles: ['admin_satelite'] },
  { path: '/bodega-calidad', component: BodegaCalidadScreen, roles: ['gerente','admin_elrohi','bodega_op','terminacion'] },
  { path: '/bodega-lonas',   component: BodegaLonasScreen,   roles: ['gerente','admin_elrohi','bodega_op','despachos'] },
];

// ─── HOME REDIRECT ────────────────────────────────────────────────────────────
function HomeRedirect() {
  const { profile, loading } = useAuth();
  if (loading) return null;
  if (!profile) return <Navigate to="/login" replace />;
  const first = NAV_CONFIG[profile.role]?.[0] || '/dashboard';
  return <Navigate to={first} replace />;
}

// ─── APP INIT (seed on first load) ────────────────────────────────────────────
function AppInit() {
  useEffect(() => { seedDatabase().catch(console.error); }, []);
  return null;
}

// ─── APP ─────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DataProvider>
          <AppInit />
          <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
          <Routes>
            <Route path="/login" element={<LoginScreen />} />
            <Route path="/" element={<HomeRedirect />} />
            {ALL_ROUTES.map(({ path, component: Component, roles }) => (
              <Route key={path} path={path} element={
                <ProtectedRoute allowedRoles={roles}>
                  <Layout>
                    <Component />
                  </Layout>
                </ProtectedRoute>
              } />
            ))}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </DataProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
