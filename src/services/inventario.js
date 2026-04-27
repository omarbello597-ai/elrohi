import { db } from '../firebase';
import {
  doc, getDoc, setDoc, updateDoc, increment,
  collection, getDocs, writeBatch
} from 'firebase/firestore';
import { GARMENT_TYPES } from '../constants';

// Inicializar inventario si no existe
export const initInventario = async () => {
  const batch = writeBatch(db);
  for (const g of GARMENT_TYPES) {
    const ref = doc(db, 'inventario', g.id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      batch.set(ref, {
        gtId: g.id,
        nombre: g.name,
        disponible: 0,
        enAlistamiento: 0,
        total: 0,
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

  // Acumular por gtId preservando descripcionRef
  const acumulado = {};
  const descripcionRefs = {};
  lotesBodega.forEach(lot => {
    (lot.garments || []).forEach(g => {
      if (!acumulado[g.gtId]) acumulado[g.gtId] = 0;
      acumulado[g.gtId] += g.total || 0;
      if (g.descripcionRef) descripcionRefs[g.gtId] = g.descripcionRef;
    });
  });

  // Actualizar inventario
  const batch = writeBatch(db);
  for (const [gtId, qty] of Object.entries(acumulado)) {
    const ref = doc(db, 'inventario', gtId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      batch.update(ref, {
        disponible: increment(qty),
        total: increment(qty),
        updatedAt: new Date().toISOString(),
      });
    } else {
      const g = GARMENT_TYPES.find(x => x.id === gtId);
      const descRef = descripcionRefs[gtId];
      batch.set(ref, {
        gtId,
        nombre: descRef || g?.name || gtId,
        descripcionRef: descRef || g?.name || gtId,
        disponible: qty,
        enAlistamiento: 0,
        total: qty,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  // Marcar lotes como migrados
  lotesBodega.forEach(lot => {
    const lotRef = doc(db, 'lots', lot.id);
    batch.update(lotRef, { migradoInventario: true });
  });

  await batch.commit();
  console.log(`✅ Migrados ${lotesBodega.length} lotes al inventario`);
};

// Sumar al inventario cuando un lote llega a bodega_lonas
export const sumarLoteAInventario = async (lot) => {
  const batch = writeBatch(db);
  for (const g of (lot.garments || [])) {
    const ref = doc(db, 'inventario', g.gtId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const prevSizes = snap.data().sizes || {};
      const mergedSizes = {...prevSizes};
      Object.entries(g.sizes||{}).forEach(([t,v])=>{ mergedSizes[t] = (mergedSizes[t]||0) + (+v||0); });
      batch.update(ref, {
        disponible: increment(g.total || 0),
        total: increment(g.total || 0),
        sizes: mergedSizes,
        ...(g.descripcionRef ? { nombre: g.descripcionRef, descripcionRef: g.descripcionRef } : {}),
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

// Reservar unidades en alistamiento cuando se toma un pedido
export const reservarParaAlistamiento = async (items) => {
  if (!items || !items.length) return;
  const batch = writeBatch(db);
  for (const item of items) {
    if (!item.gtId || !item.qty) continue;
    const ref = doc(db, 'inventario', item.gtId);
    const snap = await getDoc(ref);
    if (!snap.exists()) continue; // skip if not in inventory
    batch.update(ref, {
      disponible: increment(-(item.qty || 0)),
      enAlistamiento: increment(item.qty || 0),
      updatedAt: new Date().toISOString(),
    });
  }
  await batch.commit();
};

// Liberar alistamiento (si se cancela el pedido)
export const liberarAlistamiento = async (items) => {
  const batch = writeBatch(db);
  for (const item of items) {
    const ref = doc(db, 'inventario', item.gtId);
    batch.update(ref, {
      disponible: increment(item.qty || 0),
      enAlistamiento: increment(-(item.qty || 0)),
      updatedAt: new Date().toISOString(),
    });
  }
  await batch.commit();
};

// Descontar del inventario al facturar
export const descontarInventario = async (items) => {
  if (!items || !items.length) return;
  const batch = writeBatch(db);
  for (const item of items) {
    if (!item.gtId) continue; // skip items without gtId
    const ref = doc(db, 'inventario', item.gtId);
    const snap = await getDoc(ref);
    if (!snap.exists()) continue;
    batch.update(ref, {
      enAlistamiento: increment(-(item.qty || 0)),
      total: increment(-(item.qty || 0)),
      updatedAt: new Date().toISOString(),
    });
  }
  if (batch._mutations?.length > 0) await batch.commit();
};
