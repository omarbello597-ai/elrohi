import { useState } from 'react';
import { useData }  from '../contexts/DataContext';
import { addDocument } from '../services/db';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import { fmtM, getOpVal, workerQuincena } from '../utils';
import { Modal } from '../components/ui';
import toast from 'react-hot-toast';

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const today = () => new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
const todayISO = () => new Date().toISOString().split('T')[0];
const consecutive = () => 'REC-' + Date.now().toString().slice(-6);

// ─── GENERATE & PRINT RECEIPT ─────────────────────────────────────────────────
function printReceipt(sat, total, workers, photoURL, recId, notes) {
  const workerRows = workers.map(w =>
    `<tr>
      <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0">${w.name}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;color:#10b981">
        ${fmtM(w.earnings)}
      </td>
    </tr>`
  ).join('');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Recibo ${recId}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #fff; color: #111; }
    .page { max-width: 600px; margin: 40px auto; padding: 40px; border: 1px solid #e5e7eb; border-radius: 12px; }
    .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 2px solid #e85d26; }
    .logo { font-size: 24px; font-weight: 900; letter-spacing: -0.04em; }
    .logo span { color: #e85d26; }
    .rec-num { font-size: 13px; color: #6b7280; text-align: right; }
    .rec-num strong { display: block; font-size: 16px; color: #111; }
    .section { margin-bottom: 22px; }
    .section-title { font-size: 11px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 10px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .info-item label { font-size: 11px; color: #6b7280; display: block; margin-bottom: 2px; }
    .info-item span { font-size: 13px; font-weight: 500; color: #111; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    thead tr { background: #f9f9f7; }
    th { padding: 8px 10px; text-align: left; font-size: 11px; color: #6b7280; font-weight: 500; }
    .total-row { background: #f0fdf4; font-size: 15px; font-weight: 800; }
    .total-row td { padding: 12px 10px; color: #10b981; }
    .notes { background: #f9f9f7; border-radius: 8px; padding: 12px; font-size: 13px; color: #374151; }
    .photo { width: 100%; max-height: 300px; object-fit: contain; border-radius: 8px; border: 1px solid #e5e7eb; margin-top: 10px; }
    .footer { margin-top: 28px; padding-top: 20px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; font-size: 11px; color: #9ca3af; }
    .firma { text-align: center; }
    .firma-line { width: 160px; border-top: 1px solid #374151; margin: 40px auto 6px; }
    @media print { body { print-color-adjust: exact; } }
  </style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="logo">🧵 <span>EL</span>ROHI</div>
    <div class="rec-num">
      Recibo de pago<br>
      <strong>${recId}</strong>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Datos del pago</div>
    <div class="info-grid">
      <div class="info-item"><label>Satélite</label><span>${sat.name}</span></div>
      <div class="info-item"><label>Ciudad</label><span>${sat.city}</span></div>
      <div class="info-item"><label>Fecha de pago</label><span>${today()}</span></div>
      <div class="info-item"><label>Total pagado</label><span style="color:#10b981;font-size:16px;font-weight:900">${fmtM(total)}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Desglose por operario</div>
    <table>
      <thead><tr><th>Operario</th><th style="text-align:right">Monto</th></tr></thead>
      <tbody>${workerRows}</tbody>
      <tfoot>
        <tr class="total-row">
          <td>TOTAL</td>
          <td style="text-align:right">${fmtM(total)}</td>
        </tr>
      </tfoot>
    </table>
  </div>

  ${notes ? `<div class="section"><div class="section-title">Observaciones</div><div class="notes">${notes}</div></div>` : ''}

  ${photoURL ? `<div class="section"><div class="section-title">Comprobante de transferencia</div><img src="${photoURL}" class="photo" alt="Comprobante"/></div>` : ''}

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:40px">
    <div class="firma">
      <div class="firma-line"></div>
      <div style="font-size:12px;color:#374151">Firma ELROHI — Nómina</div>
    </div>
    <div class="firma">
      <div class="firma-line"></div>
      <div style="font-size:12px;color:#374151">Recibido — ${sat.name}</div>
    </div>
  </div>

  <div class="footer">
    <span>ELROHI · Sistema de Gestión de Producción</span>
    <span>Generado: ${today()}</span>
  </div>
</div>
<script>window.onload = () => window.print();</script>
</body>
</html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
}

// ─── NOMINA SCREEN ────────────────────────────────────────────────────────────
export function NominaScreen() {
  const { lots, satellites, ops, satOpVals, users, payments } = useData();

  const [showModal,  setShowModal]  = useState(false);
  const [selSat,     setSelSat]     = useState(null);
  const [photo,      setPhoto]      = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [notes,      setNotes]      = useState('');
  const [saving,     setSaving]     = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [expanded,   setExpanded]   = useState(null);

  // Build satellite summary
  const summary = satellites.filter((s) => s.active).map((s) => {
    const satLots   = lots.filter((l) => l.satId === s.id);
    const satWorkers = users.filter((u) => u.satId === s.id && u.role === 'operario');

    const total = satLots
      .flatMap((l) => (l.lotOps || []).filter((lo) => lo.status === 'completado').map((lo) => ({ ...lo, satId: l.satId })))
      .reduce((acc, lo) => acc + getOpVal(ops, satOpVals, lo.satId, lo.opId) * lo.qty, 0);

    const compOps = satLots.flatMap((l) => (l.lotOps || []).filter((lo) => lo.status === 'completado')).length;

    const workerBreakdown = satWorkers.map((w) => ({
      ...w, earnings: workerQuincena(w.id, lots, ops, satOpVals),
    }));

    // Last payment for this satellite
    const lastPayment = payments
      .filter((p) => p.satId === s.id)
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))[0];

    return { ...s, total, compOps, workerBreakdown, lastPayment };
  }).sort((a, b) => b.total - a.total);

  const grand = summary.reduce((a, s) => a + s.total, 0);

  // Handle photo selection
  const handlePhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhoto(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  // Open payment modal
  const openPay = (sat) => {
    setSelSat(sat);
    setPhoto(null);
    setPhotoPreview(null);
    setNotes('');
    setShowModal(true);
  };

  // Confirm payment
  const confirmPayment = async () => {
    if (!selSat) return;
    setSaving(true);
    try {
      const recId = consecutive();
      let photoURL = null;

      // Upload photo if provided
      if (photo) {
        const storageRef = ref(storage, `payments/${recId}/${photo.name}`);
        await uploadBytes(storageRef, photo);
        photoURL = await getDownloadURL(storageRef);
      }

      // Save payment record to Firestore
      await addDocument('payments', {
        recId,
        satId:    selSat.id,
        satName:  selSat.name,
        total:    selSat.total,
        notes,
        photoURL,
        date:     todayISO(),
        workers:  selSat.workerBreakdown,
        compOps:  selSat.compOps,
      });

      toast.success(`✅ Pago registrado — ${recId}`);

      // Generate and print receipt
      printReceipt(selSat, selSat.total, selSat.workerBreakdown, photoURL, recId, notes);

      setShowModal(false);
    } catch (err) {
      console.error(err);
      toast.error('Error al registrar el pago');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-sm font-bold text-gray-900">Nómina — Quincena Actual</h1>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
        >
          {showHistory ? 'Ver quincena actual' : '📋 Historial de pagos'}
        </button>
      </div>

      {/* ── HISTORIAL ── */}
      {showHistory ? (
        <HistorialPagos payments={payments} satellites={satellites} />
      ) : (
        <>
          {/* Grand total card */}
          <div className="rounded-2xl p-5 mb-5 text-white" style={{ background: 'linear-gradient(135deg,#1e2d45,#2d4a6e)' }}>
            <p className="text-xs text-blue-300 uppercase tracking-wider mb-1">Total a pagar esta quincena</p>
            <p className="text-3xl font-black" style={{ letterSpacing: '-0.04em' }}>{fmtM(grand)}</p>
            <p className="text-xs text-blue-300 mt-1">
              {summary.reduce((a, s) => a + s.compOps, 0)} operaciones · {summary.length} satélites activos
            </p>
          </div>

          {/* Satellite cards */}
          <div className="space-y-2">
            {summary.map((s) => {
              const isPaid = !!s.lastPayment && s.lastPayment.date === todayISO();
              return (
                <div key={s.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50"
                    onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                  >
                    <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center text-lg flex-shrink-0">🏭</div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-gray-900">{s.name}</p>
                      <p className="text-[10px] text-gray-400">{s.city} · {s.workerBreakdown.length} operarios · {s.compOps} ops completadas</p>
                    </div>
                    <div className="text-right mr-2">
                      <p className="text-[9px] text-gray-400">Monto</p>
                      <p className="text-base font-black text-green-600">{fmtM(s.total)}</p>
                    </div>

                    {/* Pay / Paid button */}
                    {isPaid ? (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 rounded-lg">
                        <span className="text-green-600 text-sm">✅</span>
                        <span className="text-[10px] font-bold text-green-700">Pagado</span>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); openPay(s); }}
                        className="px-3 py-1.5 text-white rounded-lg text-[10px] font-bold hover:opacity-90"
                        style={{ background: '#e85d26' }}
                      >
                        Pagar
                      </button>
                    )}
                  </div>

                  {/* Worker breakdown */}
                  {expanded === s.id && s.workerBreakdown.length > 0 && (
                    <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                      <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-2">Desglose por operario</p>
                      <div className="space-y-1.5">
                        {s.workerBreakdown.map((w) => (
                          <div key={w.id} className="flex items-center gap-3 bg-white rounded-lg px-3 py-2 text-xs">
                            <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-[9px] font-bold text-indigo-700">{w.initials}</div>
                            <span className="flex-1 font-medium text-gray-800">{w.name}</span>
                            <span className="font-bold text-green-600 font-mono">{fmtM(w.earnings)}</span>
                          </div>
                        ))}
                      </div>
                      {/* Re-print last receipt */}
                      {s.lastPayment && (
                        <button
                          onClick={() => printReceipt(s, s.lastPayment.total, s.lastPayment.workers || [], s.lastPayment.photoURL, s.lastPayment.recId, s.lastPayment.notes)}
                          className="mt-3 text-[10px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                        >
                          🖨️ Reimprimir último recibo ({s.lastPayment.recId})
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── PAYMENT MODAL ── */}
      {showModal && selSat && (
        <Modal title={`Registrar pago — ${selSat.name}`} onClose={() => setShowModal(false)} wide>

          {/* Summary */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
            <p className="text-xs text-green-700 font-medium mb-1">Total a pagar</p>
            <p className="text-2xl font-black text-green-600">{fmtM(selSat.total)}</p>
            <p className="text-[10px] text-green-600 mt-0.5">{selSat.compOps} operaciones · {selSat.workerBreakdown.length} operarios</p>
          </div>

          {/* Worker breakdown inside modal */}
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Desglose por operario</p>
            <div className="space-y-1">
              {selSat.workerBreakdown.map((w) => (
                <div key={w.id} className="flex items-center justify-between px-3 py-1.5 bg-gray-50 rounded-lg text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[9px] font-bold text-indigo-700">{w.initials}</div>
                    <span className="font-medium text-gray-800">{w.name}</span>
                  </div>
                  <span className="font-bold text-green-600 font-mono">{fmtM(w.earnings)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Photo upload */}
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-700 mb-2">
              📸 Foto del comprobante de transferencia
              <span className="text-gray-400 font-normal ml-1">(opcional)</span>
            </p>
            <label className="flex flex-col items-center justify-center w-full border-2 border-dashed border-gray-300 rounded-xl p-4 cursor-pointer hover:border-orange-400 hover:bg-orange-50 transition-colors">
              {photoPreview ? (
                <img src={photoPreview} alt="Comprobante" className="max-h-40 rounded-lg object-contain" />
              ) : (
                <div className="text-center">
                  <p className="text-3xl mb-2">📷</p>
                  <p className="text-sm font-medium text-gray-600">Clic para subir foto</p>
                  <p className="text-xs text-gray-400 mt-0.5">JPG, PNG · Max 5MB</p>
                </div>
              )}
              <input type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
            </label>
            {photoPreview && (
              <button onClick={() => { setPhoto(null); setPhotoPreview(null); }} className="mt-2 text-xs text-red-500 hover:text-red-700">
                ✕ Quitar foto
              </button>
            )}
          </div>

          {/* Notes */}
          <div className="mb-5">
            <p className="text-xs font-semibold text-gray-700 mb-1">Observaciones <span className="text-gray-400 font-normal">(opcional)</span></p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Transferencia Bancolombia, nro. 1234567890..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none h-16 focus:outline-none focus:border-orange-400"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => setShowModal(false)}
              className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200"
            >
              Cancelar
            </button>
            <button
              onClick={confirmPayment}
              disabled={saving}
              className="flex-1 py-2.5 text-white rounded-xl text-sm font-bold disabled:opacity-50 hover:opacity-90"
              style={{ background: '#e85d26' }}
            >
              {saving ? 'Registrando...' : '✅ Confirmar pago y generar recibo'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── HISTORIAL DE PAGOS ───────────────────────────────────────────────────────
function HistorialPagos({ payments, satellites }) {
  const sorted = [...payments].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-4xl mb-3">📋</p>
        <p className="font-medium text-gray-700">Sin pagos registrados</p>
        <p className="text-sm text-gray-400 mt-1">Los pagos confirmados aparecerán aquí</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sorted.map((p) => (
        <div key={p.id} className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-mono text-xs font-bold text-blue-700">{p.recId}</span>
                <span className="text-[9px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">✅ Pagado</span>
              </div>
              <p className="text-sm font-bold text-gray-900">{p.satName}</p>
              <p className="text-[10px] text-gray-400">{p.date} · {p.compOps} operaciones</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-gray-400">Total pagado</p>
              <p className="text-base font-black text-green-600">{fmtM(p.total)}</p>
            </div>
          </div>

          {p.notes && (
            <p className="text-xs text-gray-500 italic bg-gray-50 rounded-lg px-3 py-2 mb-3">"{p.notes}"</p>
          )}

          <div className="flex items-center gap-2">
            {p.photoURL && (
              <a href={p.photoURL} target="_blank" rel="noreferrer"
                className="text-[10px] text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg font-medium hover:bg-blue-100">
                📸 Ver comprobante
              </a>
            )}
            <button
              onClick={() => printReceipt(
                satellites.find(s => s.id === p.satId) || { name: p.satName, city: '' },
                p.total, p.workers || [], p.photoURL, p.recId, p.notes
              )}
              className="text-[10px] text-gray-600 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg font-medium hover:bg-gray-100"
            >
              🖨️ Reimprimir recibo
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
