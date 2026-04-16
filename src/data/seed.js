/**
 * ELROHI — Script de carga inicial de datos
 *
 * Este archivo se importa desde App.jsx la primera vez
 * que el sistema se inicializa (cuando no hay datos en Firestore).
 *
 * Para ejecutarlo manualmente, llama seedDatabase() desde la consola del navegador
 * o importalo en un componente temporal.
 */
import { writeBatch, doc, collection, setDoc, getDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from '../firebase';

// ─── DEMO USERS ───────────────────────────────────────────────────────────────
// Contraseñas demo: todas usan "elrohi2024" para facilitar pruebas
export const DEMO_USERS = [
  { id: '8DdBqKbLtKYcLoX7lp7Xo8ePMYo2',  name: 'Carlos Mendoza',  role: 'gerente',        satId: null,   email: 'gerente@elrohi.com',     initials: 'CM' },
  { id: 'Wbwg3IFskjPIbHA91d3ffpx97fb2',  name: 'Ana López',       role: 'admin_elrohi',   satId: null,   email: 'admin@elrohi.com',       initials: 'AL' },
  { id: 'aFHBxgMoEjdUc9e69OCnYoI2yO33',  name: 'Roberto Ríos',    role: 'nomina',         satId: null,   email: 'nomina@elrohi.com',      initials: 'RR' },
  { id: 'TUBGEjjzSCVO8t3wG2roXrxoaR52',  name: 'Sandra Pérez',    role: 'despachos',      satId: null,   email: 'despachos@elrohi.com',   initials: 'SP' },
  { id: 'Ihgo9hyB9yYEvJuE0mmVhub7uqA2',  name: 'Miguel Torres',   role: 'corte',          satId: null,   email: 'corte@elrohi.com',       initials: 'MT' },
  { id: 'UHowJDNrRcRn28UA5GDzWsMQwrf2',  name: 'Luis Rodríguez',  role: 'admin_satelite', satId: 'sat1', email: 'sat1@elrohi.com',        initials: 'LR' },
  { id: 'Q79L13oSXETlknxg3Bixr62kKVy2',  name: 'María García',    role: 'admin_satelite', satId: 'sat2', email: 'sat2@elrohi.com',        initials: 'MG' },
  { id: 'fgcIzNl4dOeP9WdAtAOj8LRD1ht2',  name: 'Jorge Castro',    role: 'admin_satelite', satId: 'sat3', email: 'sat3@elrohi.com',        initials: 'JC' },
  { id: '7jWrs6g5mTZ8hAIPWck19eGqhWM2',  name: 'Diana Morales',   role: 'operario',       satId: 'sat1', email: 'op1@elrohi.com',         initials: 'DM' },
  { id: 'atO5waBF0BaW5uXOjb09wwKwnAs1',  name: 'Carlos Vega',     role: 'operario',       satId: 'sat1', email: 'op2@elrohi.com',         initials: 'CV' },
  { id: 'N4NP0VG2i7dIAs5C9bHAirQdQNp2',  name: 'Patricia Ruiz',   role: 'operario',       satId: 'sat2', email: 'op3@elrohi.com',         initials: 'PR' },
  { id: 'bEtDYunR8XP7utBNdd1pgOq2vwO2',  name: 'Andrés Flores',   role: 'operario',       satId: 'sat2', email: 'op4@elrohi.com',         initials: 'AF' },
  { id: '1Ws6GZFUeMZz18XQHATeUoxY96K2',  name: 'Carmen Jiménez',  role: 'tintoreria',     satId: null,   email: 'tintoreria@elrohi.com',  initials: 'CJ' },
  { id: 'ybXkI4ePTWYSMrd8QAso9pb5lxj2',  name: 'Rosa Medina',     role: 'pespunte',       satId: null,   email: 'pespunte@elrohi.com',    initials: 'RM' },
  { id: 'ngLfhgEbNkV9NiZRF9XZCFxzgop2',  name: 'Pedro Sánchez',   role: 'bodega',         satId: null,   email: 'bodega@elrohi.com',      initials: 'PS' },
];

const CLIENTS = [
  { id: 'c1', name: 'Seguridad Nacional S.A.',  contact: 'Juan Pérez',     phone: '601-555-1001', city: 'Bogotá',   active: true },
  { id: 'c2', name: 'Construcciones del Valle', contact: 'María Orozco',   phone: '601-555-2002', city: 'Cali',     active: true },
  { id: 'c3', name: 'Minera Andina Corp',        contact: 'Roberto Díaz',   phone: '601-555-3003', city: 'Medellín', active: true },
  { id: 'c4', name: 'Hospital Central Norte',   contact: 'Patricia Vargas',phone: '601-555-4004', city: 'Bogotá',   active: true },
  { id: 'c5', name: 'Aerolíneas Colombia',       contact: 'Diego Martínez', phone: '601-555-5005', city: 'Bogotá',   active: true },
];

const SATELLITES = [
  { id: 'sat1', name: 'Taller Rodríguez',    adminId: 'UHowJDNrRcRn28UA5GDzWsMQwrf2', active: true,  city: 'Bogotá', phone: '310-555-0101', cap: 15 },
  { id: 'sat2', name: 'Confecciones García', adminId: 'Q79L13oSXET1knxg3Bixr62kKVy2', active: true,  city: 'Bogotá', phone: '315-555-0202', cap: 12 },
  { id: 'sat3', name: 'Taller López',        adminId: 'fgcIzN14dOeP9WdAtAOj8LRD1ht2', active: true,  city: 'Soacha', phone: '311-555-0303', cap: 10 },
  { id: 'sat4', name: 'Textiles Martínez',   adminId: null,  active: false, city: 'Bogotá', phone: '320-555-0404', cap: 8  },
  { id: 'sat5', name: 'Taller Herrera',      adminId: null,  active: false, city: 'Bosa',   phone: '317-555-0505', cap: 6  },
];
const OPERATIONS = [
  // Pantalón Hombre
  { id: 'o1',  gtId: 'gt1', name: 'Pegar cremallera',  val: 1200, active: true },
  { id: 'o2',  gtId: 'gt1', name: 'Cerrar pantalón',   val: 1500, active: true },
  { id: 'o3',  gtId: 'gt1', name: 'Poner bolsillos',   val: 800,  active: true },
  { id: 'o4',  gtId: 'gt1', name: 'Hacer dobladillos', val: 600,  active: true },
  { id: 'o5',  gtId: 'gt1', name: 'Pegar pretina',     val: 1000, active: true },
  // Pantalón Mujer
  { id: 'o6',  gtId: 'gt2', name: 'Pegar cremallera',  val: 1300, active: true },
  { id: 'o7',  gtId: 'gt2', name: 'Cerrar pantalón',   val: 1500, active: true },
  { id: 'o8',  gtId: 'gt2', name: 'Poner bolsillos',   val: 900,  active: true },
  { id: 'o9',  gtId: 'gt2', name: 'Hacer dobladillos', val: 600,  active: true },
  { id: 'o10', gtId: 'gt2', name: 'Pegar pretina',     val: 1000, active: true },
  // Camisa Hombre
  { id: 'o11', gtId: 'gt3', name: 'Pegar cuello',      val: 1200, active: true },
  { id: 'o12', gtId: 'gt3', name: 'Pegar bolsillo',    val: 800,  active: true },
  { id: 'o13', gtId: 'gt3', name: 'Cerrar camisa',     val: 1500, active: true },
  { id: 'o14', gtId: 'gt3', name: 'Hacer dobladillos', val: 600,  active: true },
  { id: 'o15', gtId: 'gt3', name: 'Pegar puños',       val: 1000, active: true },
  // Camisa Mujer
  { id: 'o16', gtId: 'gt4', name: 'Pegar cuello',      val: 1200, active: true },
  { id: 'o17', gtId: 'gt4', name: 'Pegar bolsillo',    val: 800,  active: true },
  { id: 'o18', gtId: 'gt4', name: 'Cerrar camisa',     val: 1500, active: true },
  { id: 'o19', gtId: 'gt4', name: 'Hacer dobladillos', val: 600,  active: true },
  { id: 'o20', gtId: 'gt4', name: 'Pegar puños',       val: 1000, active: true },
  // Chaqueta Hombre
  { id: 'o21', gtId: 'gt5', name: 'Pegar mangas',      val: 1800, active: true },
  { id: 'o22', gtId: 'gt5', name: 'Pegar cierre',      val: 1500, active: true },
  { id: 'o23', gtId: 'gt5', name: 'Cerrar chaqueta',   val: 2000, active: true },
  { id: 'o24', gtId: 'gt5', name: 'Pegar cuello',      val: 1200, active: true },
];

const SUPPLIES = [
  { id: 's1',  name: 'Tela drill hombre',      unit: 'metros',   qty: 850,  min: 300 },
  { id: 's2',  name: 'Tela drill mujer',       unit: 'metros',   qty: 620,  min: 300 },
  { id: 's3',  name: 'Tela oxford camisa',     unit: 'metros',   qty: 180,  min: 200 },
  { id: 's4',  name: 'Hilo negro',             unit: 'conos',    qty: 45,   min: 50  },
  { id: 's5',  name: 'Hilo blanco',            unit: 'conos',    qty: 38,   min: 30  },
  { id: 's6',  name: 'Hilo gris',              unit: 'conos',    qty: 22,   min: 30  },
  { id: 's7',  name: 'Cremalleras metal',      unit: 'unidades', qty: 1200, min: 500 },
  { id: 's8',  name: 'Botones 4 hoyos',        unit: 'cientos',  qty: 18,   min: 20  },
  { id: 's9',  name: 'Agujas Singer #14',      unit: 'cajas',    qty: 12,   min: 15  },
  { id: 's10', name: 'Entretela termofusible', unit: 'metros',   qty: 95,   min: 80  },
];

const DEMO_LOTS = [
  {
    id: 'lot1', code: 'ELROHI-2024-0891', clientId: 'c1', orderId: 'ord1',
    status: 'costura', priority: 'urgente', satId: 'sat1',
    created: '2024-11-01', deadline: '2024-11-20',
    garments: [
      { gtId: 'gt1', sizes: { S: 30, M: 60, L: 40, XL: 20 }, total: 150 },
      { gtId: 'gt3', sizes: { S: 30, M: 60, L: 40, XL: 20 }, total: 150 },
    ],
    totalPieces: 300,
	lotOps: [
  	  { id: 'lo1',  opId: 'o1',  wId: '7jWrs6g5mTZ8hAIPWck19eGqhWM2', status: 'completado', qty: 150, done: '2024-11-05' },
  	  { id: 'lo2',  opId: 'o2',  wId: 'at05waBF0BaW5uXOjb09wwKwnAs1', status: 'completado', qty: 150, done: '2024-11-06' },
  	  { id: 'lo3',  opId: 'o3',  wId: '7jWrs6g5mTZ8hAIPWck19eGqhWM2', status: 'completado', qty: 150, done: '2024-11-07' },
  	  { id: 'lo4',  opId: 'o4',  wId: 'at05waBF0BaW5uXOjb09wwKwnAs1', status: 'en_proceso',  qty: 150, done: null },
  	  { id: 'lo5',  opId: 'o5',  wId: null,                             status: 'pendiente',   qty: 150, done: null },
  	  { id: 'lo6',  opId: 'o11', wId: '7jWrs6g5mTZ8hAIPWck19eGqhWM2', status: 'completado', qty: 150, done: '2024-11-05' },
  	  { id: 'lo7',  opId: 'o12', wId: 'at05waBF0BaW5uXOjb09wwKwnAs1', status: 'completado', qty: 150, done: '2024-11-06' },
  	  { id: 'lo8',  opId: 'o13', wId: null,                             status: 'pendiente',   qty: 150, done: null },
  	  { id: 'lo9',  opId: 'o14', wId: null,                             status: 'pendiente',   qty: 150, done: null },
  	  { id: 'lo10', opId: 'o15', wId: null,                             status: 'pendiente',   qty: 150, done: null },
	],

    notes: 'Dotación guardia seguridad', novelties: [],
  },
  {
    id: 'lot2', code: 'ELROHI-2024-0892', clientId: 'c2', orderId: 'ord2',
    status: 'tintoreria', priority: 'normal', satId: 'sat2',
    created: '2024-10-25', deadline: '2024-11-15',
    garments: [
      { gtId: 'gt2', sizes: { S: 20, M: 40, L: 30 }, total: 90 },
      { gtId: 'gt4', sizes: { S: 20, M: 40, L: 30 }, total: 90 },
    ],
    totalPieces: 180,
    	lotOps: [
  	  { id: 'lo11', opId: 'o6',  wId: 'N4NP0VG2i7dIAs5C9bHAirQdQNp2', status: 'completado', qty: 90, done: '2024-11-01' },
  	  { id: 'lo12', opId: 'o7',  wId: 'bEtDYunR8XP7utBNdd1pgOq2vwO2', status: 'completado', qty: 90, done: '2024-11-02' },
	  { id: 'lo13', opId: 'o8',  wId: 'N4NP0VG2i7dIAs5C9bHAirQdQNp2', status: 'completado', qty: 90, done: '2024-11-03' },
	  { id: 'lo14', opId: 'o9',  wId: 'bEtDYunR8XP7utBNdd1pgOq2vwO2', status: 'completado', qty: 90, done: '2024-11-04' },	
	  { id: 'lo15', opId: 'o10', wId: 'N4NP0VG2i7dIAs5C9bHAirQdQNp2', status: 'completado', qty: 90, done: '2024-11-05' },
	  { id: 'lo16', opId: 'o16', wId: 'bEtDYunR8XP7utBNdd1pgOq2vwO2', status: 'completado', qty: 90, done: '2024-11-01' },
	  { id: 'lo17', opId: 'o17', wId: 'N4NP0VG2i7dIAs5C9bHAirQdQNp2', status: 'completado', qty: 90, done: '2024-11-02' },
	  { id: 'lo18', opId: 'o18', wId: 'bEtDYunR8XP7utBNdd1pgOq2vwO2', status: 'completado', qty: 90, done: '2024-11-03' },
	  { id: 'lo19', opId: 'o19', wId: 'N4NP0VG2i7dIAs5C9bHAirQdQNp2', status: 'completado', qty: 90, done: '2024-11-04' },
	  { id: 'lo20', opId: 'o20', wId: 'bEtDYunR8XP7utBNdd1pgOq2vwO2', status: 'completado', qty: 90, done: '2024-11-05' },
	],
    notes: 'Color azul oscuro industrial', novelties: [],
  },
  {
    id: 'lot3', code: 'ELROHI-2024-0893', clientId: 'c3', orderId: 'ord3',
    status: 'asignacion', priority: 'critico', satId: null,
    created: '2024-11-08', deadline: '2024-11-18',
    garments: [{ gtId: 'gt1', sizes: { M: 50, L: 50, XL: 30 }, total: 130 }],
    totalPieces: 130, lotOps: [], notes: 'URGENTE - zona minera', novelties: [],
  },
  {
    id: 'lot4', code: 'ELROHI-2024-0890', clientId: 'c4', orderId: 'ord4',
    status: 'bodega', priority: 'normal', satId: 'sat1',
    created: '2024-10-15', deadline: '2024-11-05',
    garments: [
      { gtId: 'gt3', sizes: { S: 10, M: 30, L: 20 }, total: 60 },
      { gtId: 'gt4', sizes: { S: 10, M: 30, L: 20 }, total: 60 },
    ],
    totalPieces: 120, lotOps: [], notes: 'Completado',
    novelties: [{ id: 'nv1', type: 'faltante', qty: 2, gtId: 'gt3', desc: '2 camisas talla L no llegaron' }],
  },
  {
    id: 'lot5', code: 'ELROHI-2024-0894', clientId: 'c5', orderId: 'ord5',
    status: 'corte', priority: 'urgente', satId: null,
    created: '2024-11-09', deadline: '2024-11-22',
    garments: [
      { gtId: 'gt3', sizes: { S: 40, M: 80, L: 60, XL: 20 }, total: 200 },
      { gtId: 'gt4', sizes: { S: 40, M: 80, L: 60, XL: 20 }, total: 200 },
    ],
    totalPieces: 400, lotOps: [], notes: 'Camisas vuelo Aerolíneas Colombia', novelties: [],
  },
  {
    id: 'lot6', code: 'ELROHI-2024-0895', clientId: 'c1', orderId: 'ord1',
    status: 'pespunte', priority: 'normal', satId: 'sat3',
    created: '2024-10-20', deadline: '2024-11-12',
    garments: [{ gtId: 'gt1', sizes: { S: 25, M: 50, L: 35, XL: 15 }, total: 125 }],
    totalPieces: 125, lotOps: [], notes: '', novelties: [],
  },
];

const DEMO_ORDERS = [
  { id: 'ord1', clientId: 'c1', status: 'en_produccion', deadline: '2024-11-25',
    items: [{ gtId: 'gt1', sizes: { S: 55, M: 110, L: 75, XL: 35 }, total: 275 }, { gtId: 'gt3', sizes: { S: 55, M: 110, L: 75, XL: 35 }, total: 275 }],
    notes: 'Dotación anual guardia' },
  { id: 'ord2', clientId: 'c2', status: 'en_produccion', deadline: '2024-11-15',
    items: [{ gtId: 'gt2', sizes: { S: 20, M: 40, L: 30 }, total: 90 }, { gtId: 'gt4', sizes: { S: 20, M: 40, L: 30 }, total: 90 }],
    notes: 'Uniforme campo' },
  { id: 'ord3', clientId: 'c3', status: 'en_produccion', deadline: '2024-11-18',
    items: [{ gtId: 'gt1', sizes: { M: 50, L: 50, XL: 30 }, total: 130 }], notes: 'URGENTE zona minera' },
  { id: 'ord4', clientId: 'c4', status: 'completado', deadline: '2024-11-05',
    items: [{ gtId: 'gt3', sizes: { S: 10, M: 30, L: 20 }, total: 60 }, { gtId: 'gt4', sizes: { S: 10, M: 30, L: 20 }, total: 60 }],
    notes: 'Batas y camisas médicas' },
  { id: 'ord5', clientId: 'c5', status: 'en_produccion', deadline: '2024-11-22',
    items: [{ gtId: 'gt3', sizes: { S: 40, M: 80, L: 60, XL: 20 }, total: 200 }, { gtId: 'gt4', sizes: { S: 40, M: 80, L: 60, XL: 20 }, total: 200 }],
    notes: 'Camisas tripulación vuelo' },
];

// ─── SEED FUNCTION ────────────────────────────────────────────────────────────
export async function seedDatabase() {
  console.log('🌱 Iniciando carga de datos demo...');

  // Verificar si ya hay datos
  const check = await getDoc(doc(db, 'clients', 'c1'));
  if (check.exists()) {
    console.log('✅ Base de datos ya tiene datos. Saltando seed.');
    return false;
  }

  const batch = writeBatch(db);

  // Clientes
  CLIENTS.forEach((c) => batch.set(doc(db, 'clients', c.id), c));

  // Satélites
  SATELLITES.forEach((s) => batch.set(doc(db, 'satellites', s.id), s));

  // Operaciones
  OPERATIONS.forEach((o) => batch.set(doc(db, 'operations', o.id), o));

  // Insumos
  SUPPLIES.forEach((s) => batch.set(doc(db, 'supplies', s.id), s));

  // Inventario de prendas
  batch.set(doc(db, 'inventory', 'garments'), {
    gt1: { XS: 5,  S: 12, M: 25, L: 18, XL: 8,  XXL: 3 },
    gt2: { XS: 8,  S: 15, M: 20, L: 12, XL: 5,  XXL: 2 },
    gt3: { XS: 3,  S: 18, M: 30, L: 22, XL: 10, XXL: 4 },
    gt4: { XS: 6,  S: 20, M: 28, L: 16, XL: 6,  XXL: 2 },
    gt5: { XS: 0,  S: 5,  M: 10, L: 8,  XL: 4,  XXL: 1 },
  });

  await batch.commit();
  console.log('✅ Datos base guardados.');

  // Lotes (por separado para no superar el límite del batch de 500 operaciones)
  const batch2 = writeBatch(db);
  DEMO_LOTS.forEach((l)   => batch2.set(doc(db, 'lots',   l.id), l));
  DEMO_ORDERS.forEach((o) => batch2.set(doc(db, 'orders', o.id), o));
  await batch2.commit();
  console.log('✅ Lotes y pedidos guardados.');

  // Usuarios en Firestore (SIN crear en Firebase Auth — eso lo hace el admin)
  const batch3 = writeBatch(db);
  DEMO_USERS.forEach((u) => batch3.set(doc(db, 'users', u.id), u));
  await batch3.commit();
  console.log('✅ Perfiles de usuario guardados en Firestore.');
  console.log('⚠️  Recuerda crear las cuentas en Firebase Auth (ver README).');

  return true;
}
