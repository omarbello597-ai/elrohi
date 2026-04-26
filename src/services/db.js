import {
  collection, doc, getDoc, getDocs, addDoc, setDoc,
  updateDoc, deleteDoc, onSnapshot, query, where,
  orderBy, serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';

// ─── GENERIC ──────────────────────────────────────────────────────────────────
export const listenCol = (col, callback, ...constraints) =>
  onSnapshot(query(collection(db, col), ...constraints), (snap) =>
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  );

export const getColOnce = async (col) => {
  const snap = await getDocs(collection(db, col));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const setDocument = (col, id, data) =>
  setDoc(doc(db, col, id), { ...data, updatedAt: serverTimestamp() }, { merge: true });

export const addDocument = async (col, data) => {
  const ref = await addDoc(collection(db, col), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
};

export const updateDocument = (col, id, data) =>
  updateDoc(doc(db, col, id), { ...data, updatedAt: serverTimestamp() });

export const deleteDocument = (col, id) => deleteDoc(doc(db, col, id));

// ─── USERS ────────────────────────────────────────────────────────────────────
export const getUser = async (uid) => {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const listenUsers = (cb) => listenCol('users', cb);

export const createUserProfile = (uid, data) =>
  setDoc(doc(db, 'users', uid), { ...data, createdAt: serverTimestamp() });

// ─── CLIENTS ──────────────────────────────────────────────────────────────────
export const listenClients = (cb) => listenCol('clients', cb);

export const saveClient = (data) =>
  data.id ? updateDocument('clients', data.id, data) : addDocument('clients', data);

// ─── SATELLITES ───────────────────────────────────────────────────────────────
export const listenSatellites = (cb) => listenCol('Sateliteselrohi', cb, orderBy('name'));

export const saveSatellite = (data) =>
  data.id ? updateDocument('Sateliteselrohi', data.id, data) : addDocument('Sateliteselrohi', data);

export const toggleSatellite = (id, active) =>
  updateDocument('Sateliteselrohi', id, { active });

// ─── OPERATIONS (global) ──────────────────────────────────────────────────────
export const listenOperations = (cb) => listenCol('operations', cb);

export const saveOperation = (data) =>
  data.id ? updateDocument('operations', data.id, data) : addDocument('operations', data);

export const toggleOperation = (id, active) =>
  updateDocument('operations', id, { active });

// ─── SATELLITE OP VALUES (tarifas por taller) ─────────────────────────────────
export const listenSatOpVals = (cb) =>
  onSnapshot(collection(db, 'satOpVals'), (snap) => {
    const result = {};
    snap.docs.forEach((d) => { result[d.id] = d.data(); });
    cb(result);
  });

export const setSatOpVal = (satId, opId, val) =>
  setDoc(
    doc(db, 'satOpVals', satId),
    { [opId]: val === null || val === undefined ? null : Number(val) },
    { merge: true }
  );

// ─── ORDERS ───────────────────────────────────────────────────────────────────
export const listenOrders = (cb) => listenCol('orders', cb, orderBy('createdAt', 'desc'));

export const saveOrder = (data) =>
  data.id ? updateDocument('orders', data.id, data) : addDocument('orders', data);

export const updateOrderStatus = (id, status) =>
  updateDocument('orders', id, { status });

// ─── LOTS ─────────────────────────────────────────────────────────────────────
export const listenLots = (cb) => listenCol('lots', cb, orderBy('createdAt', 'desc'));

export const saveLot = (data) =>
  data.id ? updateDocument('lots', data.id, data) : addDocument('lots', data);

export const updateLotStatus = (id, status, extra = {}) =>
  updateDocument('lots', id, { status, ...extra });

// Avanzar lote al siguiente estado con lógica de negocio
export const advanceLot = async (lot, action, ops, extra = {}) => {
  const updates = { ...extra };

  switch (action) {
    case 'a_corte':       updates.status = 'corte';       break;
    case 'a_asignacion':  updates.status = 'asignacion';  break;
    case 'tintoreria':    updates.status = 'tintoreria';  break;
    case 'de_tintoreria': updates.status = 'validacion';  break;
    case 'a_pespunte':    updates.status = 'pespunte';    break;
    case 'a_bodega':      updates.status = 'bodega';      break;
    case 'despachar':     updates.status = 'despachado';  break;
    case 'reasignar':
      updates.status = 'asignacion';
      updates.satId  = null;
      break;
    case 'asignar_sat': {
      updates.status = 'costura';
      updates.satId  = extra.satId;
      // Generar operaciones del lote basadas en las prendas
      const gtIds = [...new Set(lot.garments.map((g) => g.gtId))];
      const lotOps = [];
      let idx = 1;
      gtIds.forEach((gtId) => {
        const gtOps = ops.filter((o) => o.gtId === gtId && o.active);
        const qty   = lot.garments.find((g) => g.gtId === gtId)?.total || 0;
        gtOps.forEach((op) => {
          lotOps.push({
            id:     `lo_${lot.id}_${idx++}`,
            opId:   op.id,
            wId:    null,
            status: 'pendiente',
            qty,
            done:   null,
          });
        });
      });
      updates.lotOps = lotOps;
      break;
    }
    default: break;
  }

  await updateDocument('lots', lot.id, updates);
};

// Actualizar una operación dentro del lote
export const updateLotOp = async (lotId, loId, changes) => {
  const snap = await getDoc(doc(db, 'lots', lotId));
  if (!snap.exists()) return;
  const lot = { id: snap.id, ...snap.data() };
  const lotOps = lot.lotOps.map((lo) => (lo.id === loId ? { ...lo, ...changes } : lo));
  // Si todas las ops están completadas → pasar a listo para remisión a tintorería
  // El admin satélite hace el conteo, ambas firmas y genera la remisión
  const allDone = lotOps.every((lo) => lo.status === 'completado');
  await updateDocument('lots', lotId, {
    lotOps,
    ...(allDone ? { status: 'listo_remision_tintoreria' } : {}),
  });
};

// ─── INVENTORY ────────────────────────────────────────────────────────────────
export const listenInventoryGarments = (cb) =>
  onSnapshot(doc(db, 'inventory', 'garments'), (snap) =>
    cb(snap.exists() ? snap.data() : {})
  );

export const listenSupplies = (cb) => listenCol('supplies', cb, orderBy('name'));

export const updateSupply = (id, qty) => updateDocument('supplies', id, { qty });

// ─── PAYMENTS ─────────────────────────────────────────────────────────────────
export const listenPayments = (cb) => listenCol('payments', cb, orderBy('createdAt', 'desc'));

export const addPayment = (data) => addDocument('payments', data);
