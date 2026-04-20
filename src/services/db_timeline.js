// Helper para avanzar estado de lote CON registro de tiempo en timeline
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export const advanceLotStatus = async (lotId, newStatus, changedById, changedByName, extra = {}) => {
  const snap = await getDoc(doc(db, 'lots', lotId));
  if (!snap.exists()) return;
  const lot = { id: snap.id, ...snap.data() };

  const now = new Date().toISOString();
  const timeline = lot.timeline || [];

  // Cerrar la entrada actual (última en timeline sin salió)
  const updatedTimeline = timeline.map((entry, idx) => {
    if (idx === timeline.length - 1 && !entry.salió) {
      const entrada = new Date(entry.entró);
      const salida  = new Date(now);
      const diffMs  = salida - entrada;
      const diffH   = Math.floor(diffMs / 3600000);
      const diffM   = Math.floor((diffMs % 3600000) / 60000);
      const duracion = diffH > 0 ? `${diffH}h ${diffM}m` : `${diffM}m`;
      return { ...entry, salió: now, duracionMs: diffMs, duracion, cerradoPor: changedByName };
    }
    return entry;
  });

  // Agregar nueva entrada para el nuevo estado
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
    ...extra,
  });

  return updatedTimeline;
};
