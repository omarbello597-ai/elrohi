import { db } from '../firebase';
import {
  doc, getDoc, setDoc, updateDoc, increment,
  collection, getDocs, writeBatch
} from 'firebase/firestore';
import { GARMENT_TYPES } from '../constants';

// Genera ID de documento único por descripcionRef (slug seguro)
const docId = (g) => {
  const key = g.descripcionRef || g.gtId;
  return key.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 100);
};

// Sumar al inventario cuando un lote llega a bodega_lonas
export const sumarLoteAInventario = async (lot) => {
  const batch = writeBatch(db);
  for (const g of (lot.garments || [])) {
    const id = docId(g);
    const ref = doc(db, 'inventario', id);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const prevSizes = snap.data().sizes || {};
      const mergedSizes = {...prevSizes};
      Object.entries(g.sizes||{}).forEach(([t,v])=>{ mergedSizes[t] = (mergedSizes[t]||0) + (+v||0); });
      batch.update(ref, {
        disponible: increment(g.total || 0),
        total: increment(g.total || 0),
        sizes: mergedSizes,
        nombre: g.descripcionRef || snap.data().nombre,
        descripcionRef: g.descripcionRef || snap.data().descripcionRef,
        updatedAt: new Date().toISOString(),
      });
    } else {
      const gt = GARMENT_TYPES.find(x => x.id === g.gtId);
      batch.set(ref, {
        gtId: g.gtId,
        nombre: g.descripcionRef || gt?.name || g.gtId,
        descripcionRef: g.descripcionRef || gt?.name || g.gtId,
        sizes: g.sizes || {},
        disponible: g.total || 0,
        enAlistamiento: 0,
        total: g.total || 0,
        updatedAt: new Date().toISOString(),
      });
    }
  }
  await batch.commit();
};

// Migrar lotes existentes en bodega_lonas al inventario
export const migrarLotesAInventario = async (lots) => {
  const lotesBodega = lots.filter(l => l.status === 'bodega_lonas' && !l.migradoInventario);
  if (lotesBodega.length === 0) return;

  // Acumular por descripcionRef
  const acumulado = {};
  lotesBodega.forEach(lot => {
    (lot.garments || []).forEach(g => {
      const key = g.descripcionRef || g.gtId;
      if (!acumulado[key]) acumulado[key] = { gtId: g.gtId, descripcionRef: key, total: 0, sizes: {} };
      acumulado[key].total += g.total || 0;
      Object.entries(g.sizes||{}).forEach(([t,v])=>{
        acumulado[key].sizes[t] = (acumulado[key].sizes[t]||0) + (+v||0);
      });
    });
  });

  const batch = writeBatch(db);
  for (const [key, data] of Object.entries(acumulado)) {
    const id = key.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 100);
    const ref = doc(db, 'inventario', id);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const prevSizes = snap.data().sizes || {};
      const mergedSizes = {...prevSizes};
      Object.entries(data.sizes).forEach(([t,v])=>{ mergedSizes[t] = (mergedSizes[t]||0) + (+v||0); });
      batch.update(ref, {
        disponible: increment(data.total),
        total: increment(data.total),
        sizes: mergedSizes,
        updatedAt: new Date().toISOString(),
      });
    } else {
      batch.set(ref, {
        gtId: data.gtId,
        nombre: data.descripcionRef,
        descripcionRef: data.descripcionRef,
        sizes: data.sizes,
        disponible: data.total,
        enAlistamiento: 0,
        total: data.total,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  lotesBodega.forEach(lot => {
    const lotRef = doc(db, 'lots', lot.id);
    batch.update(lotRef, { migradoInventario: true });
  });

  await batch.commit();
  console.log(`✅ Migrados ${lotesBodega.length} lotes al inventario`);
};

// Inicializar inventario (legacy - mantener por compatibilidad)
export const initInventario = async () => {};

// Reservar unidades en alistamiento cuando se toma un pedido
export const reservarParaAlistamiento = async (items) => {
  if (!items || !items.length) return;
  const batch = writeBatch(db);
  for (const item of items) {
    if (!item.gtId || !item.qty) continue;
    const id = (item.descripcionRef || item.gtId).replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 100);
    const ref = doc(db, 'inventario', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) continue;
    batch.update(ref, {
      disponible: increment(-(item.qty || 0)),
      enAlistamiento: increment(item.qty || 0),
      updatedAt: new Date().toISOString(),
    });
  }
  await batch.commit();
};

// Liberar alistamiento
export const liberarAlistamiento = async (items) => {
  const batch = writeBatch(db);
  for (const item of items) {
    const id = (item.descripcionRef || item.gtId).replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 100);
    const ref = doc(db, 'inventario', id);
    batch.update(ref, {
      disponible: increment(item.qty || 0),
      enAlistamiento: increment(-(item.qty || 0)),
    });
  }
  await batch.commit();
};

// Descontar del inventario al facturar
export const descontarInventario = async (items) => {
  if (!items || !items.length) return;
  const batch = writeBatch(db);
  for (const item of items) {
    if (!item.gtId) continue;
    const id = (item.descripcionRef || item.gtId).replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 100);
    const ref = doc(db, 'inventario', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) continue;
    batch.update(ref, {
      enAlistamiento: increment(-(item.qty || 0)),
      total: increment(-(item.qty || 0)),
      updatedAt: new Date().toISOString(),
    });
  }
  await batch.commit();
};
