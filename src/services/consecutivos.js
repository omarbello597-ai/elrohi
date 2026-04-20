// ─── CONSECUTIVOS — Números automáticos de documentos ────────────────────────
import { doc, getDoc, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';

// Obtiene y auto-incrementa el consecutivo de corte
export const getNextCorteNum = async () => {
  const ref = doc(db, 'consecutivos', 'corte');
  let num = 1;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    num = snap.exists() ? (snap.data().current || 0) + 1 : 1;
    tx.set(ref, { current: num, updatedAt: new Date().toISOString() });
  });
  return String(num).padStart(4, '0');
};

// Utilidad para formatear duración en ms → texto legible
export const fmtDuration = (ms) => {
  if (!ms || ms < 0) return null;
  const totalMin = Math.floor(ms / 60000);
  const totalH   = Math.floor(totalMin / 60);
  const totalD   = Math.floor(totalH / 24);
  if (totalD > 0)  return `${totalD}d ${totalH % 24}h`;
  if (totalH > 0)  return `${totalH}h ${totalMin % 60}m`;
  return `${totalMin}m`;
};

// Duración desde una fecha ISO hasta ahora
export const durationSince = (isoString) => {
  if (!isoString) return null;
  return fmtDuration(Date.now() - new Date(isoString).getTime());
};
