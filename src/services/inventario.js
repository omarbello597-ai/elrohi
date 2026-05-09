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
  // Usar unidades reales recibidas si hay trazabilidad de tintorería
  const rt = lot.remisionTinto;
  const factorAjuste = (rt && rt.totalOriginal > 0)
    ? rt.totalTintoreria / rt.totalOriginal
    : 1;

  for (const g of (lot.garments || [])) {
    const id = docId(g);
    const ref = doc(db, 'inventario', id);
    const snap = await getDoc(ref);
    // Calcular cantidad real recibida proporcional
    const totalReal = rt ? Math.round((g.total || 0) * factorAjuste) : (g.total || 0);
    // Ajustar sizes proporcionalmente
    const sizesReal = {};
    Object.entries(g.sizes || {}).forEach(function(entry) {
      sizesReal[entry[0]] = Math.round((+entry[1] || 0) * factorAjuste);
    });

    if (snap.exists()) {
      const prevSizes = snap.data().sizes || {};
      const mergedSizes = {...prevSizes};
      Object.entries(sizesReal).forEach(function(entry) {
        mergedSizes[entry[0]] = (mergedSizes[entry[0]] || 0) + entry[1];
      });
      batch.update(ref, {
        disponible: increment(totalReal),
        total: increment(totalReal),
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
        sizes: sizesReal,
        disponible: totalReal,
        enAlistamiento: 0,
        total: totalReal,
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
    if (!item.qty) continue;
    const id = (item.descripcionRef || item.gtId || 'gt1').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 100);
    const ref = doc(db, 'inventario', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) continue;
    // Actualizar sizes por talla
    const prevSizes = snap.data().sizes || {};
    const newSizes = {...prevSizes};
    if (item.talla && newSizes[item.talla] !== undefined) {
      newSizes[item.talla] = Math.max(0, (newSizes[item.talla] || 0) - (item.qty || 0));
    }
    batch.update(ref, {
      disponible: increment(-(item.qty || 0)),
      enAlistamiento: increment(item.qty || 0),
      sizes: newSizes,
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
    if (!item.qty) continue;
    const id = (item.descripcionRef || item.gtId || 'gt1').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 100);
    const ref = doc(db, 'inventario', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) continue;
    // Actualizar sizes por talla
    const prevSizes = snap.data().sizes || {};
    const newSizes = {...prevSizes};
    if (item.talla && newSizes[item.talla] !== undefined) {
      newSizes[item.talla] = Math.max(0, (newSizes[item.talla] || 0) - (item.qty || 0));
    }
    batch.update(ref, {
      enAlistamiento: increment(-(item.qty || 0)),
      total: increment(-(item.qty || 0)),
      sizes: newSizes,
      updatedAt: new Date().toISOString(),
    });
  }
  await batch.commit();
};
