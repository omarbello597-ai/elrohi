// ─── ROLES ────────────────────────────────────────────────────────────────────
export const ROLE_META = {
  gerente:        { label: 'Gerente General',      badge: 'bg-violet-100 text-violet-800' },
  admin_elrohi:   { label: 'Admin ELROHI',         badge: 'bg-blue-100 text-blue-800'     },
  nomina:         { label: 'Nómina',               badge: 'bg-slate-100 text-slate-700'   },
  despachos:      { label: 'Despachos',            badge: 'bg-teal-100 text-teal-800'     },
  corte:          { label: 'Operario Corte',       badge: 'bg-orange-100 text-orange-800' },
  admin_satelite: { label: 'Admin Satélite',       badge: 'bg-amber-100 text-amber-800'   },
  operario:       { label: 'Operario Satélite',    badge: 'bg-yellow-100 text-yellow-800' },
  tintoreria:     { label: 'Tintorería',           badge: 'bg-indigo-100 text-indigo-800' },
  terminacion:    { label: 'Operario Terminación', badge: 'bg-pink-100 text-pink-800'     },
  bodega_op:      { label: 'Operario Bodega',      badge: 'bg-green-100 text-green-800'   },
};

// ─── LOT STATUSES ─────────────────────────────────────────────────────────────
export const LOT_STATUS = {
  nuevo:                     { label: 'Nuevo',                   cls: 'bg-gray-100 text-gray-600',        step: 1  },
  recibido_alistamiento:     { label: 'Recibido Alistamiento',   cls: 'bg-blue-100 text-blue-700',        step: 2  },
  en_corte:                  { label: 'En Corte',                cls: 'bg-orange-100 text-orange-800',    step: 3  },
  entregar_admin:            { label: 'Entregar a Admin',        cls: 'bg-amber-100 text-amber-800',      step: 4  },
  asignacion:                { label: 'Asign. Satélite',         cls: 'bg-violet-100 text-violet-800',    step: 5  },
  costura:                   { label: 'En Costura',              cls: 'bg-sky-100 text-sky-800',          step: 6  },
  listo_remision_tintoreria: { label: 'Listo p/Tintorería',      cls: 'bg-green-100 text-green-700',      step: 7  },
  tintoreria:                { label: 'En Tintorería',           cls: 'bg-indigo-100 text-indigo-800',    step: 8  },
  listo_recepcion_admin:     { label: 'Listo — Recibir Admin',   cls: 'bg-yellow-100 text-yellow-800',    step: 9  },
  listo_bodega:              { label: 'Listo — Asignar Bodega',  cls: 'bg-cyan-100 text-cyan-800',        step: 10 },
  bodega_lonas:              { label: 'Bodega Lonas',            cls: 'bg-emerald-100 text-emerald-800',  step: 11 },
  bodega_calidad:            { label: 'Bodega Control Calidad',  cls: 'bg-teal-100 text-teal-800',        step: 11 },
  en_operaciones_elrohi:     { label: 'Operaciones ELROHI',      cls: 'bg-purple-100 text-purple-800',    step: 12 },
  en_revision_calidad:       { label: 'En Revisión Calidad',     cls: 'bg-pink-100 text-pink-800',        step: 13 },
  despachado:                { label: 'Despachado',              cls: 'bg-gray-100 text-gray-500',        step: 14 },
};

export const LOT_STATUS_STEPS = [
  ['nuevo',                   'Nuevo'       ],
  ['en_corte',                'Corte'       ],
  ['asignacion',              'Satélite'    ],
  ['costura',                 'Costura'     ],
  ['tintoreria',              'Tintorería'  ],
  ['listo_bodega',            'Bodega'      ],
  ['en_operaciones_elrohi',   'Operaciones' ],
  ['en_revision_calidad',     'Calidad'     ],
  ['despachado',              'Despachado'  ],
];

export const LOT_PRIORITY = {
  normal:  { label: 'Normal',  cls: 'bg-gray-100 text-gray-600'   },
  urgente: { label: 'Urgente', cls: 'bg-amber-100 text-amber-800' },
  critico: { label: 'Crítico', cls: 'bg-red-100 text-red-700'     },
};

export const GARMENT_TYPES = [
  { id: 'gt1', name: 'Pantalón Hombre', g: 'H', short: 'Pan.H' },
  { id: 'gt2', name: 'Pantalón Mujer',  g: 'M', short: 'Pan.M' },
  { id: 'gt3', name: 'Camisa Hombre',   g: 'H', short: 'Cam.H' },
  { id: 'gt4', name: 'Camisa Mujer',    g: 'M', short: 'Cam.M' },
  { id: 'gt5', name: 'Chaqueta Hombre', g: 'H', short: 'Cha.H' },
];

export const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

export const OPS_ELROHI_DEFAULT = [
  { id: 'oe1', name: 'Planchar',        val: 500, active: true },
  { id: 'oe2', name: 'Pegar botones',   val: 400, active: true },
  { id: 'oe3', name: 'Doblar',          val: 300, active: true },
  { id: 'oe4', name: 'Empacar',         val: 350, active: true },
  { id: 'oe5', name: 'Pegar etiquetas', val: 250, active: true },
  { id: 'oe6', name: 'Revisar calidad', val: 200, active: true },
];

export const NAV_CONFIG = {
  gerente:        ['/dashboard','/pedidos','/lotes','/corte','/satelites','/bodegas','/operaciones-elrohi','/gestion-operarios','/inventario','/nomina','/config','/recepcion-tinto','/bodega-calidad','/bodega-lonas','/listas-precios','/trazabilidad','/clientes','/carga-masiva','/cuenta-cobro','/tarifas-satelite'],
  admin_elrohi:   ['/dashboard','/pedidos','/lotes','/corte','/satelites','/bodegas','/operaciones-elrohi','/gestion-operarios','/inventario','/recepcion-tinto','/bodega-calidad','/bodega-lonas','/listas-precios','/trazabilidad','/clientes','/carga-masiva','/cuenta-cobro','/tarifas-satelite'],
  nomina:         ['/nomina'],
  despachos:      ['/bodegas','/bodega-lonas','/pedidos','/quincena'],
  corte:          ['/corte','/quincena'],
  admin_satelite: ['/taller','/asignar-ops','/cuenta-cobro','/nomina-satelite'],
  operario:       ['/mis-ops','/quincena'],
  tintoreria:     ['/recepcion-tinto'],
  terminacion:    ['/operaciones-elrohi','/quincena'],
  bodega_op:      ['/bodegas','/bodega-lonas','/bodega-calidad','/quincena'],
};

export const NAV_ITEMS = {
  '/dashboard':          { label: 'Panel General',          icon: 'LayoutDashboard' },
  '/pedidos':            { label: 'Pedidos',                icon: 'ShoppingBag'     },
  '/lotes':              { label: 'Cortes',                 icon: 'Scissors'        },
  '/satelites':          { label: 'Satélites',              icon: 'Factory'         },
  '/bodegas':            { label: 'Bodegas',                icon: 'Warehouse'       },
  '/operaciones-elrohi': { label: 'Operaciones',            icon: 'Layers'          },
  '/gestion-operarios':  { label: 'Operarios ELROHI',       icon: 'Users'           },
  '/inventario':         { label: 'Inventario Insumos',     icon: 'Box'             },
  '/nomina':             { label: 'Nómina',                 icon: 'DollarSign'      },
  '/config':             { label: 'Configuración',          icon: 'Settings'        },
  '/corte':              { label: 'Área de Corte',          icon: 'Scissors'        },
  '/taller':             { label: 'Mi Taller',              icon: 'Factory'         },
  '/asignar-ops':        { label: 'Asignar Ops',            icon: 'Zap'             },
  '/mis-ops':            { label: 'Mis Operaciones',        icon: 'Wrench'          },
  '/quincena':           { label: 'Mi Quincena',            icon: 'DollarSign'      },
  '/recepcion-tinto':    { label: 'Tintorería',             icon: 'Palette'         },
  '/remision':           { label: 'Remisión Corte',         icon: 'FileText'        },
  '/bodega-calidad':     { label: 'Bodega Control Calidad', icon: 'CheckSquare'     },
  '/bodega-lonas':       { label: 'Bodega Lonas',           icon: 'Package'         },
  '/listas-precios':     { label: 'Listas de Precios',      icon: 'DollarSign'      },
  '/trazabilidad':       { label: 'Trazabilidad',           icon: 'Activity'        },
  '/clientes':           { label: 'Clientes',               icon: 'Users'           },
  '/carga-masiva':       { label: 'Carga Masiva',           icon: 'Upload'          },
  '/cuenta-cobro':       { label: 'Cuenta de Cobro',        icon: 'FileText'        },
  '/nomina-satelite':    { label: 'Nómina Taller',          icon: 'DollarSign'      },
  '/tarifas-satelite':   { label: 'Tarifas Satélite',       icon: 'DollarSign'      },
};

export const ACCENT = '#e85d26';

// ─── COLORES CORPORATIVOS ELROHI ──────────────────────────────────────────────
export const BRAND = {
  azulMedio:   '#2878B4',  // "DOTACIONES"
  azulOscuro:  '#14405A',  // "EL·ROHI"
  azulCielo:   '#3C78B4',  // trazos
  cyanClaro:   '#64C8DC',  // trazos
  cyanMuyClaro:'#64C8F0',  // trazos
  fondo:       '#F7F7F7',  // fondo
  azulPetroleo:'#143C50',  // olas inferiores
};
