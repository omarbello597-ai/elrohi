// ─── ROLES ────────────────────────────────────────────────────────────────────
export const ROLE_META = {
  gerente:        { label: 'Gerente General',  badge: 'bg-violet-100 text-violet-800' },
  admin_elrohi:   { label: 'Admin ELROHI',     badge: 'bg-blue-100 text-blue-800'     },
  nomina:         { label: 'Nómina',           badge: 'bg-slate-100 text-slate-700'   },
  despachos:      { label: 'Despachos',        badge: 'bg-teal-100 text-teal-800'     },
  corte:          { label: 'Área de Corte',    badge: 'bg-orange-100 text-orange-800' },
  admin_satelite: { label: 'Admin Satélite',   badge: 'bg-amber-100 text-amber-800'   },
  operario:       { label: 'Operario',         badge: 'bg-yellow-100 text-yellow-800' },
  tintoreria:     { label: 'Tintorería',       badge: 'bg-indigo-100 text-indigo-800' },
  pespunte:       { label: 'Pespunte',         badge: 'bg-pink-100 text-pink-800'     },
  bodega:         { label: 'Bodega',           badge: 'bg-green-100 text-green-800'   },
};

// ─── LOT STATUSES ─────────────────────────────────────────────────────────────
export const LOT_STATUS = {
  activacion:  { label: 'Activación',        cls: 'bg-yellow-100 text-yellow-800', step: 1 },
  corte:       { label: 'En Corte',          cls: 'bg-orange-100 text-orange-800', step: 2 },
  asignacion:  { label: 'Asign. Satélite',   cls: 'bg-violet-100 text-violet-800', step: 3 },
  costura:     { label: 'En Costura',        cls: 'bg-blue-100 text-blue-800',     step: 4 },
  tintoreria:  { label: 'En Tintorería',     cls: 'bg-indigo-100 text-indigo-800', step: 5 },
  validacion:  { label: 'Validación',        cls: 'bg-cyan-100 text-cyan-800',     step: 6 },
  pespunte:    { label: 'En Pespunte',       cls: 'bg-pink-100 text-pink-800',     step: 7 },
  bodega:      { label: 'En Bodega',         cls: 'bg-green-100 text-green-800',   step: 8 },
  despachado:  { label: 'Despachado',        cls: 'bg-gray-100 text-gray-600',     step: 9 },
};

export const LOT_STATUS_STEPS = [
  ['activacion', 'Activación'],
  ['corte',      'Corte'],
  ['asignacion', 'Asign. Sat.'],
  ['costura',    'Costura'],
  ['tintoreria', 'Tintorería'],
  ['validacion', 'Validación'],
  ['pespunte',   'Pespunte'],
  ['bodega',     'Bodega'],
];

export const LOT_PRIORITY = {
  normal:  { label: 'Normal',  cls: 'bg-gray-100 text-gray-600'   },
  urgente: { label: 'Urgente', cls: 'bg-amber-100 text-amber-800' },
  critico: { label: 'Crítico', cls: 'bg-red-100 text-red-700'     },
};

// ─── GARMENT TYPES ────────────────────────────────────────────────────────────
export const GARMENT_TYPES = [
  { id: 'gt1', name: 'Pantalón Hombre', g: 'H', short: 'Pan.H' },
  { id: 'gt2', name: 'Pantalón Mujer',  g: 'M', short: 'Pan.M' },
  { id: 'gt3', name: 'Camisa Hombre',   g: 'H', short: 'Cam.H' },
  { id: 'gt4', name: 'Camisa Mujer',    g: 'M', short: 'Cam.M' },
  { id: 'gt5', name: 'Chaqueta Hombre', g: 'H', short: 'Cha.H' },
];

export const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

// ─── PESPUNTE OPS ─────────────────────────────────────────────────────────────
export const PESPUNTE_OPS = [
  { id: 'pp1', name: 'Planchar',      val: 500 },
  { id: 'pp2', name: 'Poner botones', val: 400 },
  { id: 'pp3', name: 'Doblar',        val: 300 },
  { id: 'pp4', name: 'Empacar',       val: 350 },
];

// ─── NAVIGATION PER ROLE ─────────────────────────────────────────────────────
export const NAV_CONFIG = {
  gerente:        ['/dashboard', '/pedidos', '/lotes', '/satelites', '/inventario', '/nomina', '/config'],
  admin_elrohi:   ['/dashboard', '/pedidos', '/lotes', '/corte', '/satelites', '/inventario'],
  nomina:         ['/nomina'],
  despachos:      ['/pedidos', '/inventario'],
  corte:          ['/corte','/remision'],
  admin_satelite: ['/taller', '/asignar-ops'],
  operario:       ['/mis-ops', '/quincena'],
  tintoreria:     ['/tintoreria'],
  pespunte:       ['/pespunte', '/quincena'],
  bodega:         ['/bodega'],
};

export const NAV_ITEMS = {
  '/dashboard':   { label: 'Panel General',    icon: 'LayoutDashboard' },
  '/pedidos':     { label: 'Pedidos',          icon: 'ShoppingBag'     },
  '/lotes':       { label: 'Producción',       icon: 'Package'         },
  '/satelites':   { label: 'Satélites',        icon: 'Factory'         },
  '/inventario':  { label: 'Inventario',       icon: 'Box'             },
  '/nomina':      { label: 'Nómina',           icon: 'DollarSign'      },
  '/config':      { label: 'Configuración',    icon: 'Settings'        },
  '/corte':       { label: 'Área de Corte',    icon: 'Scissors'        },
  '/taller':      { label: 'Mi Taller',        icon: 'Factory'         },
  '/asignar-ops': { label: 'Asignar Ops',      icon: 'Zap'             },
  '/mis-ops':     { label: 'Mis Operaciones',  icon: 'Wrench'          },
  '/quincena':    { label: 'Mi Quincena',      icon: 'DollarSign'      },
  '/tintoreria':  { label: 'Tintorería',       icon: 'Palette'         },
  '/pespunte':    { label: 'Pespunte',         icon: 'Layers'          },
  '/bodega':      { label: 'Bodega',           icon: 'Box'             },
  '/remision': { label: 'Remisión Corte', icon: 'FileText' },
};

export const ACCENT = '#e85d26';
