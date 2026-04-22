import { useState, useMemo } from 'react';
import { useData }     from '../contexts/DataContext';
import { addDocument } from '../services/db';
import { fmtM, getOpVal, workerQuincena } from '../utils';
import { Modal } from '../components/ui';
import { ACCENT } from '../constants';
import toast from 'react-hot-toast';

const today    = () => new Date().toLocaleDateString('es-CO',{year:'numeric',month:'long',day:'numeric'});
const todayISO = () => new Date().toISOString().split('T')[0];
const recId    = () => 'REC-'+Date.now().toString().slice(-6);
const toBase64 = (file) => new Promise((resolve,reject) => {
  const r = new FileReader();
  r.onload  = () => resolve(r.result);
  r.onerror = reject;
  r.readAsDataURL(file);
});

// Calcular quincena actual
function getQuincenaActual() {
  const now = new Date();
  const day = now.getDate();
  const month = now.getMonth();
  const year  = now.getFullYear();
  if (day <= 15) {
    return {
      label:  `1-15 ${now.toLocaleString('es-CO',{month:'long'})} ${year}`,
      inicio: new Date(year, month, 1),
      fin:    new Date(year, month, 15, 23, 59, 59),
      tipo:   'primera',
    };
  } else {
    const lastDay = new Date(year, month+1, 0).getDate();
    return {
      label:  `16-${lastDay} ${now.toLocaleString('es-CO',{month:'long'})} ${year}`,
      inicio: new Date(year, month, 16),
      fin:    new Date(year, month, lastDay, 23, 59, 59),
      tipo:   'segunda',
    };
  }
}

// Calcular operaciones completadas en un rango de fechas
function calcOpsEnPeriodo(userId, lots, ops, satOpVals, satId, inicio, fin) {
  let total = 0;
  lots.forEach(lot => {
    const lotOps = lot.lotOps || [];
    lotOps.forEach(lo => {
      if (lo.wId !== userId) return;
      if (lo.status !== 'completado') return;
      const doneAt = lo.doneAt ? new Date(lo.doneAt) : null;
      if (!doneAt || doneAt < inicio || doneAt > fin) return;
      const val = getOpVal(ops, satOpVals, satId || lot.satId, lo.opId);
      total += val * lo.qty;
    });
    // Operaciones internas ELROHI
    const opsElrohi = lot.opsElrohi || [];
    opsElrohi.forEach(op => {
      if (op.wId !== userId) return;
      if (op.status !== 'completado') return;
      const doneAt = op.doneAt ? new Date(op.doneAt) : null;
      if (!doneAt || doneAt < inicio || doneAt > fin) return;
      total += (op.val || 0);
    });
  });
  return total;
}

// Calcular incentivos en el periodo
function calcIncentivosEnPeriodo(user, inicio, fin) {
  return (user.incentivos || []).reduce((a, inc) => {
    const fecha = inc.fecha ? new Date(inc.fecha) : null;
    if (!fecha || fecha < inicio || fecha > fin) return a;
    return a + (inc.valor || 0);
  }, 0);
}

// Generar recibo PDF
function printRecibo(data) {
  const rows = data.detalle.map(d => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0">${d.concepto}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:700;color:#10b981">${fmtM(d.valor)}</td>
    </tr>`).join('');
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
  <title>Recibo ${data.recId}</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui,sans-serif}
  .page{max-width:600px;margin:40px auto;padding:40px;border:1px solid #e5e7eb;border-radius:12px}
  .header{display:flex;justify-content:space-between;margin-bottom:28px;padding-bottom:20px;border-bottom:3px solid #e85d26}
  .logo{font-size:24px;font-weight:900}.logo span{color:#e85d26}
  .firmas{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:40px}
  .firma{text-align:center}.firma-line{border-top:1px solid #374151;margin:40px auto 6px}
  @media print{body{print-color-adjust:exact}}</style></head><body>
  <div class="page">
    <div class="header">
      <div class="logo">🧵 <span>EL</span>ROHI</div>
      <div style="text-align:right;font-size:12px;color:#6b7280">Recibo de pago<br><strong style="font-size:16px;color:#111">${data.recId}</strong></div>
    </div>
    <div style="margin-bottom:20px;background:#f9fafb;border-radius:8px;padding:12px 16px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px">
        <div><span style="font-size:10px;color:#6b7280;display:block">Empleado</span><strong>${data.nombre}</strong></div>
        <div><span style="font-size:10px;color:#6b7280;display:block">Período</span><strong>${data.periodo}</strong></div>
        <div><span style="font-size:10px;color:#6b7280;display:block">Rol</span><strong>${data.rol}</strong></div>
        <div><span style="font-size:10px;color:#6b7280;display:block">Fecha</span><strong>${today()}</strong></div>
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px">
      <thead><tr style="background:#f9f9f7"><th style="padding:8px 10px;text-align:left;font-size:10px;color:#6b7280">Concepto</th><th style="padding:8px 10px;text-align:right;font-size:10px;color:#6b7280">Valor</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr style="background:#f0fdf4"><td style="padding:12px 10px;font-weight:900;font-size:15px">TOTAL</td><td style="padding:12px 10px;text-align:right;font-weight:900;font-size:18px;color:#10b981">${fmtM(data.total)}</td></tr></tfoot>
    </table>
    ${data.notas?`<div style="background:#f9f9f7;border-radius:8px;padding:12px;font-size:12px;margin-bottom:16px">${data.notas}</div>`:''}
    ${data.foto?`<img src="${data.foto}" style="width:100%;max-height:200px;object-fit:contain;border-radius:8px;border:1px solid #e5e7eb;margin-bottom:16px"/>`:''}
    <div class="firmas">
      <div class="firma"><div class="firma-line"></div><div style="font-size:11px">Firma ELROHI — Nómina</div></div>
      <div class="firma"><div class="firma-line"></div><div style="font-size:11px">Recibido — ${data.nombre}</div></div>
    </div>
  </div><script>window.onload=()=>window.print();</script></body></html>`;
  const win=window.open('','_blank'); win.document.write(html); win.document.close();
}

// ─── NOMINA SCREEN ────────────────────────────────────────────────────────────
export function NominaScreen() {
  const { lots, satellites, ops, satOpVals, users, payments } = useData();
  const [tab,         setTab]         = useState('elrohi');
  const [showModal,   setShowModal]   = useState(false);
  const [selWorker,   setSelWorker]   = useState(null);
  const [selSat,      setSelSat]      = useState(null);
  const [photo,       setPhoto]       = useState(null);
  const [photoPreview,setPhotoPreview]= useState(null);
  const [notes,       setNotes]       = useState('');
  const [saving,      setSaving]      = useState(false);

  const quincena = useMemo(() => getQuincenaActual(), []);

  // OPERARIOS INTERNOS ELROHI
  const operariosElrohi = users.filter(u =>
    ['corte','bodega_op','terminacion','tintoreria','despachos'].includes(u.role) &&
    u.active !== false && !u.satId && !u.eliminado
  );

  const calcLiquidacion = (u) => {
    const opsVal      = calcOpsEnPeriodo(u.id, lots, ops, satOpVals, null, quincena.inicio, quincena.fin);
    const incentivos  = calcIncentivosEnPeriodo(u, quincena.inicio, quincena.fin);
    const baseFija    = u.salarioTipo === 'solo_fijo' || u.salarioTipo === 'fijo_mas_ops'
      ? Math.round((u.salarioFijo || 0) / 2) : 0;
    const total       = baseFija + opsVal + incentivos;
    const detalle     = [];
    if (baseFija > 0)   detalle.push({ concepto: `Base fija (${quincena.tipo} quincena)`, valor: baseFija });
    if (opsVal > 0)     detalle.push({ concepto: 'Operaciones completadas', valor: opsVal });
    if (incentivos > 0) detalle.push({ concepto: 'Incentivos', valor: incentivos });
    if (detalle.length === 0) detalle.push({ concepto: 'Sin operaciones en este período', valor: 0 });
    return { baseFija, opsVal, incentivos, total, detalle };
  };

  // SATÉLITES
  const satSummary = satellites.filter(s=>s.active).map(s => {
    const satLots    = lots.filter(l=>l.satId===s.id);
    const satWorkers = users.filter(u=>u.satId===s.id&&u.role==='operario');
    const total      = satLots.flatMap(l=>(l.lotOps||[]).filter(lo=>lo.status==='completado'))
      .reduce((acc,lo) => acc + getOpVal(ops,satOpVals,s.id,lo.opId)*lo.qty, 0);
    const compOps    = satLots.flatMap(l=>(l.lotOps||[]).filter(lo=>lo.status==='completado')).length;
    const workerBreakdown = satWorkers.map(w=>({...w, earnings: workerQuincena(w.id,lots,ops,satOpVals)}));
    const lastPayment = payments.filter(p=>p.satId===s.id)
      .sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0))[0];
    return { ...s, total, compOps, workerBreakdown, lastPayment };
  }).sort((a,b)=>b.total-a.total);

  const handlePhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2*1024*1024) { toast.error('Máx 2MB'); return; }
    const b64 = await toBase64(file);
    setPhoto(b64); setPhotoPreview(b64);
  };

  const openPayElrohi = (u) => {
    setSelWorker(u); setSelSat(null);
    setPhoto(null); setPhotoPreview(null); setNotes('');
    setShowModal(true);
  };

  const openPaySat = (sat) => {
    setSelSat(sat); setSelWorker(null);
    setPhoto(null); setPhotoPreview(null); setNotes('');
    setShowModal(true);
  };

  const confirmarPago = async () => {
    setSaving(true);
    try {
      const rec = recId();
      if (selWorker) {
        const liq = calcLiquidacion(selWorker);
        const data = {
          recId: rec, tipo: 'elrohi',
          workerId: selWorker.id, workerName: selWorker.name,
          rol: selWorker.role, periodo: quincena.label,
          detalle: liq.detalle, total: liq.total,
          notas: notes, foto: photo||null, fecha: todayISO(),
        };
        await addDocument('payments', data);
        printRecibo({ ...data, nombre: selWorker.name });
        toast.success(`✅ Pago registrado — ${rec}`);
      } else if (selSat) {
        await addDocument('payments', {
          recId: rec, tipo: 'satelite',
          satId: selSat.id, satName: selSat.name,
          total: selSat.total, compOps: selSat.compOps,
          workers: selSat.workerBreakdown,
          notas: notes, photoBase64: photo||null, date: todayISO(),
        });
        // Print recibo satelite
        const rows = selSat.workerBreakdown.map(w=>({concepto:w.name,valor:w.earnings}));
        printRecibo({ recId:rec, nombre:selSat.name, periodo:quincena.label, rol:'Satélite', detalle:rows, total:selSat.total, notas:notes, foto:photo });
        toast.success(`✅ Pago satélite registrado — ${rec}`);
      }
      setShowModal(false);
    } catch(e) { console.error(e); toast.error('Error'); }
    finally { setSaving(false); }
  };

  const ROLE_LABELS = {
    corte:'Corte', bodega_op:'Bodega', terminacion:'Terminación',
    tintoreria:'Tintorería', despachos:'Despachos'
  };
  const SAL_LABELS = {
    solo_operaciones:'Por operaciones', fijo_mas_ops:'Fijo + ops', solo_fijo:'Fijo'
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-sm font-bold text-gray-900">Nómina</h1>
          <p className="text-xs text-gray-400">Período: {quincena.label}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        {[['elrohi','👷 Operarios ELROHI'],['satelites','🏭 Satélites'],['historial','📋 Historial']].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{background:tab===k?'#fff':'transparent',color:tab===k?'#111827':'#6b7280',
              fontWeight:tab===k?700:400,boxShadow:tab===k?'0 1px 3px rgba(0,0,0,0.08)':'none'}}>
            {l}
          </button>
        ))}
      </div>

      {/* OPERARIOS ELROHI */}
      {tab==='elrohi' && (
        <div className="space-y-3">
          {operariosElrohi.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-100">
              <p className="text-3xl mb-2">👷</p>
              <p className="text-sm text-gray-500">Sin operarios internos registrados</p>
            </div>
          )}
          {operariosElrohi.map(u => {
            const liq = calcLiquidacion(u);
            return (
              <div key={u.id} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-black text-white flex-shrink-0"
                      style={{background:'#1a3a6b'}}>
                      {u.initials||u.name?.slice(0,2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{u.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">
                          {ROLE_LABELS[u.role]||u.role}
                        </span>
                        <span className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                          {SAL_LABELS[u.salarioTipo]||'Por operaciones'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[9px] text-gray-400">Total quincena</p>
                    <p className="text-xl font-black text-green-600">{fmtM(liq.total)}</p>
                  </div>
                </div>

                {/* Desglose */}
                <div className="mt-3 space-y-1.5">
                  {liq.baseFija > 0 && (
                    <div className="flex justify-between text-xs px-3 py-1.5 bg-blue-50 rounded-lg">
                      <span className="text-blue-700">💰 Base fija ({quincena.tipo} quincena)</span>
                      <span className="font-bold text-blue-800">{fmtM(liq.baseFija)}</span>
                    </div>
                  )}
                  {liq.opsVal > 0 && (
                    <div className="flex justify-between text-xs px-3 py-1.5 bg-green-50 rounded-lg">
                      <span className="text-green-700">⚡ Operaciones completadas</span>
                      <span className="font-bold text-green-800">{fmtM(liq.opsVal)}</span>
                    </div>
                  )}
                  {liq.incentivos > 0 && (
                    <div className="flex justify-between text-xs px-3 py-1.5 bg-amber-50 rounded-lg">
                      <span className="text-amber-700">⭐ Incentivos</span>
                      <span className="font-bold text-amber-800">{fmtM(liq.incentivos)}</span>
                    </div>
                  )}
                  {liq.total === 0 && (
                    <p className="text-[10px] text-gray-400 text-center py-1">Sin movimientos en este período</p>
                  )}
                </div>

                <button onClick={() => openPayElrohi(u)}
                  className="mt-3 w-full py-2 text-white text-xs font-bold rounded-lg disabled:opacity-40"
                  style={{background: liq.total > 0 ? '#15803d' : '#9ca3af'}}
                  disabled={liq.total === 0}>
                  💳 Registrar pago — {fmtM(liq.total)}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* SATÉLITES */}
      {tab==='satelites' && (
        <div className="space-y-3">
          {satSummary.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-100">
              <p className="text-3xl mb-2">🏭</p>
              <p className="text-sm text-gray-500">Sin satélites activos</p>
            </div>
          )}
          {satSummary.map(s => (
            <div key={s.id} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                <div>
                  <p className="text-sm font-bold text-gray-900">{s.name}</p>
                  <p className="text-[10px] text-gray-400">{s.city} · {s.compOps} operaciones</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] text-gray-400">Total a pagar</p>
                  <p className="text-xl font-black text-green-600">{fmtM(s.total)}</p>
                </div>
              </div>
              {s.workerBreakdown.length > 0 && (
                <div className="space-y-1 mb-3">
                  {s.workerBreakdown.map(w => (
                    <div key={w.id} className="flex justify-between text-xs px-3 py-1.5 bg-gray-50 rounded-lg">
                      <span className="text-gray-700">{w.name}</span>
                      <span className="font-bold text-green-600">{fmtM(w.earnings)}</span>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={() => openPaySat(s)}
                className="w-full py-2 text-white text-xs font-bold rounded-lg"
                style={{background: s.total > 0 ? '#15803d' : '#9ca3af'}}
                disabled={s.total === 0}>
                💳 Registrar pago — {fmtM(s.total)}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* HISTORIAL */}
      {tab==='historial' && (
        <div className="space-y-3">
          {payments.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-100">
              <p className="text-3xl mb-2">📋</p>
              <p className="text-sm text-gray-500">Sin pagos registrados</p>
            </div>
          )}
          {[...payments].sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)).map(p => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-bold text-blue-700">{p.recId}</span>
                    <span className="text-[9px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">✅ Pagado</span>
                    <span className="text-[9px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                      {p.tipo==='elrohi'?'👷 ELROHI':'🏭 Satélite'}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-gray-900">{p.workerName||p.satName}</p>
                  <p className="text-[10px] text-gray-400">{p.periodo||p.date}</p>
                  <p className="text-sm font-black text-green-600 mt-1">{fmtM(p.total)}</p>
                </div>
                <button onClick={() => {
                  if (p.tipo==='elrohi') {
                    printRecibo({ recId:p.recId, nombre:p.workerName, periodo:p.periodo, rol:p.rol, detalle:p.detalle||[], total:p.total, notas:p.notas, foto:p.foto });
                  } else {
                    const rows=(p.workers||[]).map(w=>({concepto:w.name,valor:w.earnings}));
                    printRecibo({ recId:p.recId, nombre:p.satName, periodo:p.date, rol:'Satélite', detalle:rows, total:p.total, notas:p.notas, foto:p.photoBase64 });
                  }
                }}
                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex-shrink-0">
                  🖨️ Reimprimir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL PAGO */}
      {showModal && (selWorker || selSat) && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.6)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'#fff',borderRadius:16,padding:24,width:'100%',maxWidth:480}}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-900">
                {selWorker ? `Pago — ${selWorker.name}` : `Pago — ${selSat.name}`}
              </h2>
              <button onClick={()=>setShowModal(false)} className="text-gray-400 text-xl font-bold bg-transparent border-none cursor-pointer">✕</button>
            </div>

            {/* Resumen */}
            {selWorker && (()=>{
              const liq = calcLiquidacion(selWorker);
              return (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                  <p className="text-xs text-green-700 mb-1">Período: {quincena.label}</p>
                  <div className="space-y-1 mb-2">
                    {liq.detalle.map((d,i)=>(
                      <div key={i} className="flex justify-between text-xs text-green-700">
                        <span>{d.concepto}</span>
                        <span className="font-bold">{fmtM(d.valor)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-green-200 pt-2 flex justify-between">
                    <span className="text-sm font-bold text-green-800">Total a pagar</span>
                    <span className="text-xl font-black text-green-700">{fmtM(liq.total)}</span>
                  </div>
                </div>
              );
            })()}

            {selSat && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                <p className="text-2xl font-black text-green-600">{fmtM(selSat.total)}</p>
                <p className="text-[10px] text-green-600 mt-0.5">{selSat.compOps} operaciones · {selSat.workerBreakdown.length} operarios</p>
              </div>
            )}

            {/* Foto comprobante */}
            <div className="mb-3">
              <p className="text-xs font-semibold text-gray-700 mb-2">📸 Comprobante <span className="text-gray-400 font-normal">(opcional)</span></p>
              <label className="flex flex-col items-center justify-center w-full border-2 border-dashed border-gray-300 rounded-xl p-3 cursor-pointer hover:border-orange-400">
                {photoPreview
                  ? <img src={photoPreview} alt="Comprobante" className="max-h-32 rounded-lg object-contain" />
                  : <div className="text-center"><p className="text-2xl mb-1">📷</p><p className="text-xs text-gray-500">Clic para subir</p></div>
                }
                <input type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
              </label>
              {photoPreview && <button onClick={()=>{setPhoto(null);setPhotoPreview(null);}} className="mt-1 text-xs text-red-500">✕ Quitar</button>}
            </div>

            {/* Notas */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Observaciones</label>
              <textarea value={notes} onChange={e=>setNotes(e.target.value)}
                placeholder="Ej: Transferencia Bancolombia #1234567..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none h-14 focus:outline-none" />
            </div>

            <div className="flex gap-2">
              <button onClick={()=>setShowModal(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium">Cancelar</button>
              <button onClick={confirmarPago} disabled={saving}
                className="flex-1 py-2.5 text-white rounded-xl text-sm font-bold disabled:opacity-50"
                style={{background:'#15803d'}}>
                {saving?'Registrando...':'✅ Confirmar y generar recibo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
