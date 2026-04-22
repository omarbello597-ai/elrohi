// Helper para avanzar estado de lote CON registro de tiempo en timeline
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { sumarLoteAInventario } from './inventario';

export const advanceLotStatus = async (lotId, newStatus, changedById, changedByName, extra = {}) => {
  const snap = await getDoc(doc(db, 'lots', lotId));
  if (!snap.exists()) return;
  const lot = { id: snap.id, ...snap.data() };

  const now = new Date().toISOString();
  const timeline = lot.timeline || [];

  // Cerrar la entrada actual
  const updatedTimeline = timeline.map((entry, idx) => {
    if (idx === timeline.length - 1 && !entry.salió) {
      const entrada  = new Date(entry.entró);
      const salida   = new Date(now);
      const diffMs   = salida - entrada;
      const diffH    = Math.floor(diffMs / 3600000);
      const diffM    = Math.floor((diffMs % 3600000) / 60000);
      const duracion = diffH > 0 ? `${diffH}h ${diffM}m` : `${diffM}m`;
      return { ...entry, salió: now, duracionMs: diffMs, duracion, cerradoPor: changedByName };
    }
    return entry;
  });

  // Agregar nueva entrada
  updatedTimeline.push({
    status:        newStatus,
    entró:         now,
    salió:         null,
    duracionMs:    null,
    duracion:      null,
    cambiadoPor:   changedByName,
    cambiadoPorId: changedById,
  });

  await updateDoc(doc(db, 'lots', lotId), {
    status:    newStatus,
    timeline:  updatedTimeline,
    updatedAt: serverTimestamp(),
    migradoInventario: newStatus === 'bodega_lonas' ? true : (lot.migradoInventario || false),
    ...extra,
  });

  // Si el lote llega a bodega_lonas por primera vez → sumar al inventario
  if (newStatus === 'bodega_lonas' && !lot.migradoInventario) {
    const garments = extra.garments || lot.garments;
    await sumarLoteAInventario({ ...lot, garments });
  }

  return updatedTimeline;
};
