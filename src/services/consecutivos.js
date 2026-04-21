import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const getNextCorteNum = async () => {
  const ref = doc(db, 'consecutivos', 'corte');
  try {
    const snap = await getDoc(ref);
    const current = snap.exists() ? (snap.data().current || 0) : 0;
    const next = current + 1;
    await setDoc(ref, { current: next }, { merge: true });
    return String(next).padStart(4, '0');
  } catch(e) {
    console.error('Error consecutivo:', e);
    return String(Date.now()).slice(-4);
  }
};

export const fmtDuration = (ms) => {
  if (!ms || ms < 0) return null;
  const totalMin = Math.floor(ms / 60000);
  const totalH   = Math.floor(totalMin / 60);
  const totalD   = Math.floor(totalH / 24);
  if (totalD > 0)  return `${totalD}d ${totalH % 24}h`;
  if (totalH > 0)  return `${totalH}h ${totalMin % 60}m`;
  return `${totalMin}m`;
};

export const durationSince = (isoString) => {
  if (!isoString) return null;
  return fmtDuration(Date.now() - new Date(isoString).getTime());
};
