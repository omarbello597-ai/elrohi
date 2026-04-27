import { LOGO_ELROHI } from '../assets/logoBase64';
import { useState, useMemo, useRef, useEffect } from 'react';
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
  let detalle = [];
  lots.forEach(lot => {
    // Operaciones costura satélite
    (lot.lotOps||[]).forEach(lo => {
      if (lo.wId !== userId || lo.status !== 'completado') return;
      const doneAt = lo.doneAt ? new Date(lo.doneAt) : null;
      if (!doneAt || doneAt < inicio || doneAt > fin) return;
      const val = lo.val || getOpVal(ops, satOpVals, satId||lot.satId, lo.opId) || 0;
      const subtotal = val * (lo.qty||0);
      total += subtotal;
      detalle.push({ lotCode: lot.code, referencia: lot.descripcion||lot.code, operacion: lo.name||lo.opId, valUnit: val, qty: lo.qty||0, subtotal });
    });
    // Operaciones internas ELROHI (control calidad, terminación)
    (lot.opsElrohi||[]).forEach(op => {
      if (op.wId !== userId || op.status !== 'completado') return;
      const doneAt = op.doneAt ? new Date(op.doneAt) : null;
      if (!doneAt || doneAt < inicio || doneAt > fin) return;
      const val = op.vrTotal && op.qty ? Math.round(op.vrTotal/op.qty) : (op.valorUnitario||op.val||0);
      const qty  = op.qty || 1;
      const subtotal = op.vrTotal || (val*qty);
      total += subtotal;
      detalle.push({ lotCode: lot.code, referencia: op.referencia||lot.code, operacion: op.operacion||op.name||'Operación', valUnit: val, qty, subtotal });
    });
  });
  return { total, detalle };
}

// Calcular incentivos en el periodo
function calcIncentivosEnPeriodo(user, inicio, fin) {
  return (user.incentivos || []).reduce((a, inc) => {
    const fecha = inc.fecha ? new Date(inc.fecha) : null;
    if (!fecha || fecha < inicio || fecha > fin) return a;
    return a + (inc.valor || 0);
  }, 0);
}

// ─── FIRMA CANVAS ──────────────────────────────────────────────────────────────
function FirmaCanvas({ onSave, label }) {
  const ref = useRef(null); const drawing = useRef(false); const [has, setHas] = useState(false);
  const gp  = (e,c) => { const r=c.getBoundingClientRect(); const s=e.touches?e.touches[0]:e; return {x:s.clientX-r.left,y:s.clientY-r.top}; };
  const start=(e)=>{e.preventDefault();drawing.current=true;const c=ref.current;const ctx=c.getContext('2d');const p=gp(e,c);ctx.beginPath();ctx.moveTo(p.x,p.y);};
  const draw=(e)=>{e.preventDefault();if(!drawing.current)return;const c=ref.current;const ctx=c.getContext('2d');ctx.strokeStyle='#14405A';ctx.lineWidth=2.5;ctx.lineCap='round';const p=gp(e,c);ctx.lineTo(p.x,p.y);ctx.stroke();setHas(true);};
  const stop=()=>{drawing.current=false;};
  const clear=()=>{ref.current.getContext('2d').clearRect(0,0,ref.current.width,ref.current.height);setHas(false);onSave(null);};
  const save=()=>{onSave(ref.current.toDataURL('image/png'));toast.success('Firma guardada');};
  return (
    <div style={{marginBottom:8}}>
      <p style={{fontSize:11,fontWeight:600,color:'#374151',marginBottom:4}}>{label}</p>
      <div style={{border:'1px solid #d1d5db',borderRadius:8,background:'#fff',overflow:'hidden'}}>
        <canvas ref={ref} width={900} height={100} style={{display:'block',touchAction:'none',cursor:'crosshair',width:'100%'}}
          onMouseDown={start} onMouseMove={draw} onMouseUp={stop} onMouseLeave={stop}
          onTouchStart={start} onTouchMove={draw} onTouchEnd={stop} />
      </div>
      <div style={{display:'flex',gap:6,marginTop:4}}>
        <button onClick={clear} style={{fontSize:10,padding:'2px 9px',background:'#fee2e2',color:'#dc2626',border:'none',borderRadius:4,cursor:'pointer'}}>Borrar</button>
        {has && <button onClick={save} style={{fontSize:10,padding:'2px 9px',background:'#dcfce7',color:'#15803d',border:'none',borderRadius:4,cursor:'pointer',fontWeight:600}}>✓ Guardar</button>}
      </div>
    </div>
  );
}

// ─── RECIBO PDF ─────────────────────────────────────────────────────────────────
function printRecibo(data) {
  const firmaBox = (label,img,nombre) => `
    <div style="text-align:center;padding:8px 16px">
      ${img?`<img src="${img}" style="height:65px;display:block;margin:0 auto 4px;border-bottom:1.5px solid #14405A;width:80%;object-fit:contain">`
           :`<div style="height:65px;border-bottom:1.5px solid #14405A;margin:0 20px"></div>`}
      <div style="font-size:9px;font-weight:700;color:#14405A;margin-top:4px">${label}</div>
      ${nombre?`<div style="font-size:10px;color:#374151;margin-top:2px">${nombre}</div>`:''}
    </div>`;

  // Detalle de operaciones
  const opsRows = (data.opsDetalle||[]).map(o=>`
    <tr style="border-bottom:1px solid #f3f4f6">
      <td style="padding:5px 8px;font-size:10px;color:#14405A;font-weight:600">${o.lotCode||''}</td>
      <td style="padding:5px 8px;font-size:10px;color:#374151">${o.referencia||''}</td>
      <td style="padding:5px 8px;font-size:10px;color:#374151">${o.operacion||''}</td>
      <td style="padding:5px 8px;font-size:10px;text-align:center">${(o.qty||0).toLocaleString('es-CO')}</td>
      <td style="padding:5px 8px;font-size:10px;text-align:right">${fmtM(o.valUnit||0)}</td>
      <td style="padding:5px 8px;font-size:10px;text-align:right;font-weight:700;color:#15803d">${fmtM(o.subtotal||0)}</td>
    </tr>`).join('');

  const rows = (data.resumen||data.detalle||[]).map(d => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0;font-size:12px">${d.concepto}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:700;font-size:12px;color:${d.valor<0?'#dc2626':'#15803d'}">${fmtM(d.valor)}</td>
    </tr>`).join('');
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
  <title>Recibo ${data.recId}</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif}@media print{body{print-color-adjust:exact}}</style>
  </head><body><div style="max-width:650px;margin:20px auto;border:1.5px solid #14405A">
    <div style="background:#F7F7F7;border-bottom:2px solid #14405A;padding:10px 16px;display:flex;justify-content:space-between;align-items:center">
      <div style="display:flex;align-items:center;gap:10px"><img src="https://i.ibb.co/nMgfFVH0/Logo-ELROHI.jpg" style="height:52px;width:auto;object-fit:contain" /><div><div style="font-size:20px;font-weight:900"><span style="color:#2878B4">Dotaciones </span><span style="color:#14405A">EL·ROHI</span></div>
        <div style="font-size:9px;color:#14405A">NIT. 901.080.234-7</div></div>
      <div style="text-align:right">
        <div style="font-size:9px;color:#6b7280">RECIBO DE PAGO</div>
        <div style="font-size:14px;font-weight:900;color:#2878B4">${data.recId}</div>
      </div>
    </div>
    <div style="padding:10px 16px;border-bottom:1px solid #e5e7eb;display:flex;gap:24px;flex-wrap:wrap">
      <div><span style="font-size:9px;color:#6b7280">EMPLEADO/SATÉLITE</span><div style="font-size:14px;font-weight:700;color:#14405A">${data.nombre}</div></div>
      <div><span style="font-size:9px;color:#6b7280">PERÍODO</span><div style="font-size:12px;font-weight:600">${data.periodo}</div></div>
      <div><span style="font-size:9px;color:#6b7280">ROL</span><div style="font-size:12px">${data.rol}</div></div>
      <div><span style="font-size:9px;color:#6b7280">FECHA</span><div style="font-size:12px">${today()}</div></div>
    </div>
    ${opsRows?`
    <div style="background:#14405A;color:#fff;font-size:9px;font-weight:700;letter-spacing:0.1em;padding:4px 10px">DETALLE DE OPERACIONES</div>
    <table style="width:100%;border-collapse:collapse">
      <thead><tr style="background:#F7F7F7">
        <th style="padding:5px 8px;font-size:9px;text-align:left;color:#14405A">Corte</th>
        <th style="padding:5px 8px;font-size:9px;text-align:left;color:#14405A">Referencia</th>
        <th style="padding:5px 8px;font-size:9px;text-align:left;color:#14405A">Operación</th>
        <th style="padding:5px 8px;font-size:9px;text-align:center;color:#14405A">Und</th>
        <th style="padding:5px 8px;font-size:9px;text-align:right;color:#14405A">Vr/und</th>
        <th style="padding:5px 8px;font-size:9px;text-align:right;color:#14405A">Total</th>
      </tr></thead>
      <tbody>${opsRows}</tbody>
    </table>`:''}
    <div style="background:#14405A;color:#fff;font-size:9px;font-weight:700;letter-spacing:0.1em;padding:4px 10px">RESUMEN</div>
    <table style="width:100%;border-collapse:collapse">
      <thead><tr style="background:#F7F7F7">
        <th style="padding:7px 10px;font-size:10px;text-align:left;color:#14405A">Concepto</th>
        <th style="padding:7px 10px;font-size:10px;text-align:right;color:#14405A">Valor</th>
      </tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr style="background:#F7F7F7;border-top:2px solid #14405A">
        <td style="padding:10px;font-weight:900;font-size:14px;color:#14405A">TOTAL A PAGAR</td>
        <td style="padding:10px;text-align:right;font-weight:900;font-size:18px;color:#e85d26">${fmtM(data.total)}</td>
      </tr></tfoot>
    </table>
    ${data.notas?`<div style="padding:8px 16px;border-top:1px solid #e5e7eb;font-size:11px;color:#6b7280"><strong>Obs:</strong> ${data.notas}</div>`:''}
    ${data.foto?`<div style="padding:8px 16px"><img src="${data.foto}" style="max-height:150px;object-fit:contain;border-radius:8px;border:1px solid #e5e7eb"/></div>`:''}
    <div style="border-top:1px solid #14405A;display:grid;grid-template-columns:1fr 1fr">
      ${firmaBox('Pagado por — ELROHI Nómina', data.firmaElrohi, 'Departamento de Nómina')}
      <div style="border-left:1px solid #14405A">${firmaBox('Recibido conforme', data.firmaRecibe, data.nombre)}</div>
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
  const [firmaElrohi, setFirmaElrohi] = useState(null);
  const [firmaRecibe, setFirmaRecibe] = useState(null);
  const [descuento,   setDescuento]   = useState('');
  const [selDetalle,  setSelDetalle]  = useState(null); // expanded worker/sat view

  const quincena = useMemo(() => getQuincenaActual(), []);

  const yaPagado = (id, tipo) => payments.some(p =>
    p.periodo === quincena.label &&
    (tipo==='elrohi' ? p.workerId===id : p.satId===id)
  );

  // OPERARIOS INTERNOS ELROHI
  const operariosElrohi = users.filter(u =>
    ['corte','bodega_op','terminacion','tintoreria','despachos'].includes(u.role) &&
    u.active !== false && !u.satId && !u.eliminado
  );

  const calcLiquidacion = (u) => {
    const { total: opsVal, detalle: opsDetalle } = calcOpsEnPeriodo(u.id, lots, ops, satOpVals, null, quincena.inicio, quincena.fin);
    const incentivos  = calcIncentivosEnPeriodo(u, quincena.inicio, quincena.fin);
    const baseFija    = u.salarioTipo === 'solo_fijo' || u.salarioTipo === 'fijo_mas_ops'
      ? Math.round((u.salarioFijo || 0) / 2) : 0;
    const total       = baseFija + opsVal + incentivos;
    const resumen     = [];
    if (baseFija > 0)   resumen.push({ concepto: `Base fija (${quincena.tipo} quincena)`, valor: baseFija });
    if (opsVal > 0)     resumen.push({ concepto: 'Operaciones completadas', valor: opsVal });
    if (incentivos > 0) resumen.push({ concepto: 'Incentivos', valor: incentivos });
    if (resumen.length === 0) resumen.push({ concepto: 'Sin operaciones en este período', valor: 0 });
    return { baseFija, opsVal, incentivos, total, resumen, opsDetalle };
  };

  // SATÉLITES — cálculo por tarifas de satélite por tipo de prenda
  const [tarifasSat, setTarifasSat] = useState([]);
  useEffect(()=>{
    let unsub;
    import('../services/db').then(({listenCol})=>{
      unsub = listenCol('tarifasSatelite', setTarifasSat);
    });
    return ()=>{ if(unsub) unsub(); };
  },[]);

  const calcSatDetalle = (satId) => {
    const satLots = lots.filter(l=>l.satId===satId);
    let filas = [];
    satLots.forEach(lot=>{
      (lot.garments||[]).forEach(g=>{
        const qty = g.total||0;
        if (!qty) return;
        const desc = g.descripcionRef||gLabel(g.gtId);
        // Buscar tarifa que coincida con la descripcion del producto
        const tarifa = tarifasSat.find(t=>
          t.descripcion && desc.toUpperCase().includes(t.descripcion.replace(/_/g,' ').split(' ')[0])
        ) || tarifasSat[0]; // fallback a primera tarifa
        if (!tarifa) return;
        if (tarifa.confeccion>0) filas.push({ lotCode:lot.code, descripcion:desc, operacion:'Confección', valUnit:tarifa.confeccion, qty, subtotal:tarifa.confeccion*qty });
        if (tarifa.terminacion>0) filas.push({ lotCode:lot.code, descripcion:desc, operacion:'Terminación', valUnit:tarifa.terminacion, qty, subtotal:tarifa.terminacion*qty });
        if (tarifa.remate>0) filas.push({ lotCode:lot.code, descripcion:desc, operacion:'Remate', valUnit:tarifa.remate, qty, subtotal:tarifa.remate*qty });
      });
    });
    return filas;
  };

  const satSummary = satellites.filter(s=>s.active).map(s => {
    const satLots  = lots.filter(l=>l.satId===s.id);
    const detalle  = calcSatDetalle(s.id);
    const total    = detalle.reduce((a,f)=>a+f.subtotal,0);
    const compOps  = satLots.flatMap(l=>(l.lotOps||[]).filter(lo=>lo.status==='completado')).length;
    const lastPayment = payments.filter(p=>p.satId===s.id)
      .sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0))[0];
    return { ...s, total, compOps, detalle, lastPayment };
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
    setFirmaElrohi(null); setFirmaRecibe(null); setDescuento('');
    setShowModal(true);
  };

  const openPaySat = (sat) => {
    setSelSat(sat); setSelWorker(null);
    setPhoto(null); setPhotoPreview(null); setNotes('');
    setFirmaElrohi(null); setFirmaRecibe(null); setDescuento('');
    setShowModal(true);
  };

  const confirmarPago = async () => {
    if (!firmaElrohi) { toast.error('Falta firma ELROHI'); return; }
    if (!firmaRecibe)  { toast.error('Falta firma de quien recibe'); return; }
    setSaving(true);
    try {
      const rec = recId();
      if (selWorker) {
        const liq = calcLiquidacion(selWorker);
        const desc = +descuento||0;
        const totalFinal = liq.total - desc;
        const detalleFinal = [...liq.detalle, ...(desc>0?[{concepto:'Descuentos',valor:-desc}]:[])];
        const data = {
          recId: rec, tipo: 'elrohi',
          workerId: selWorker.id, workerName: selWorker.name,
          rol: selWorker.role, periodo: quincena.label,
          detalle: detalleFinal, opsDetalle: liq.opsDetalle||[], total: totalFinal,
          notas: notes, foto: photo||null, fecha: todayISO(),
          firmaElrohi, firmaRecibe,
        };
        await addDocument('payments', data);
        printRecibo({ ...data, nombre: selWorker.name, resumen: detalleFinal, opsDetalle: liq.opsDetalle||[] });
        toast.success(`✅ Pago registrado — ${rec}`);
      } else if (selSat) {
        const payData = {
          recId: rec, tipo: 'satelite',
          satId: selSat.id, satName: selSat.name,
          total: selSat.total, compOps: selSat.compOps,
          opsDetalle: selSat.detalle||[],
          notas: notes, photoBase64: photo||null, date: todayISO(),
          periodo: quincena.label,
          firmaElrohi, firmaRecibe,
        };
        await addDocument('payments', payData);
        // Enviar pago al modulo "Mis Pagos" del satelite
        await addDocument('pagosSatelite', {
          ...payData,
          status: 'pagado',
          pagadoPor: profile?.name || 'ELROHI',
          fechaPago: todayISO(),
        });
        // Print recibo satelite
        const rows = selSat.workerBreakdown.map(w=>({concepto:w.name,valor:w.earnings}));
        printRecibo({ recId:rec, nombre:selSat.name, periodo:quincena.label, rol:'Satélite', resumen:rows, opsDetalle:selSat.detalle||[], total:selSat.total, notas:notes, foto:photo, firmaElrohi, firmaRecibe });
        toast.success(`✅ Pago satélite registrado — ${rec}`);
      }
      setShowModal(false);
      setSelDetalle(null);
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
      {tab==='elrohi' && !selDetalle && (
        <div className="space-y-2">
          {operariosElrohi.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-100">
              <p className="text-3xl mb-2">👷</p>
              <p className="text-sm text-gray-500">Sin operarios internos registrados</p>
            </div>
          )}
          {operariosElrohi.map(u => {
            const liq   = calcLiquidacion(u);
            const pagado = yaPagado(u.id,'elrohi');
            return (
              <div key={u.id}
                onClick={()=>!pagado && setSelDetalle({tipo:'elrohi', data:u, liq})}
                className={`bg-white rounded-xl border p-4 flex items-center gap-3 ${pagado?'opacity-60':'cursor-pointer hover:border-orange-300 transition-all'}`}
                style={{borderColor: pagado?'#d1fae5':'#f3f4f6'}}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-black text-white flex-shrink-0"
                  style={{background: pagado?'#15803d':'#14405A'}}>
                  {u.initials||u.name?.slice(0,2).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-900">{u.name}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">{ROLE_LABELS[u.role]||u.role}</span>
                    {pagado && <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold">✅ Pagado</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-lg font-black ${pagado?'text-green-600':'text-gray-900'}`}>{fmtM(liq.total)}</p>
                  {!pagado && <p className="text-[9px] text-orange-500 font-bold">Pendiente →</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SATÉLITES */}
      {tab==='satelites' && !selDetalle && (
        <div className="space-y-2">
          {satSummary.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-100">
              <p className="text-3xl mb-2">🏭</p>
              <p className="text-sm text-gray-500">Sin satélites registrados</p>
            </div>
          )}
          {satSummary.map(s=>{
            const pagado = yaPagado(s.id,'satelite');
            return (
              <div key={s.id}
                onClick={()=>!pagado && setSelDetalle({tipo:'satelite', data:s})}
                className={`bg-white rounded-xl border p-4 flex items-center gap-3 ${pagado?'opacity-60':'cursor-pointer hover:border-orange-300 transition-all'}`}
                style={{borderColor:pagado?'#d1fae5':'#f3f4f6'}}>
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-lg flex-shrink-0">🏭</div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-900">{s.name}</p>
                  <p className="text-[10px] text-gray-400">{s.compOps} ops · {s.workerBreakdown?.length} operarios</p>
                  {pagado && <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold">✅ Pagado</span>}
                </div>
                <div className="text-right">
                  <p className={`text-lg font-black ${pagado?'text-green-600':'text-gray-900'}`}>{fmtM(s.total)}</p>
                  {!pagado && <p className="text-[9px] text-orange-500 font-bold">Pendiente →</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab==='satelites' && selDetalle?.tipo==='satelite' && (()=>{
        const s = selDetalle.data;
        const satLots = lots.filter(l=>l.satId===s.id);
        return (
          <div>
            <button onClick={()=>setSelDetalle(null)} className="text-xs text-gray-500 mb-4 flex items-center gap-1">← Volver</button>
            <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-xl">🏭</div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{s.name}</p>
                  <p className="text-[10px] text-gray-400">{quincena.label}</p>
                </div>
              </div>



              {/* Desglose por operario con detalle */}
              {s.workerBreakdown?.length>0 && (
                <div className="mb-4">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Operarios del satélite</p>
                  {s.workerBreakdown.map((w,i)=>(
                    <div key={i} className="bg-gray-50 rounded-xl p-3 mb-2 border border-gray-100">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-gray-800">{w.name}</span>
                        <span className="text-sm font-black text-green-700">{fmtM(w.earnings)}</span>
                      </div>
                      {(w.ops||[]).length>0 ? (
                        <div className="space-y-1">
                          {w.ops.map((o,j)=>(
                            <div key={j} className="bg-white rounded-lg px-3 py-1.5 border border-gray-100">
                              <div className="flex justify-between items-start gap-2">
                                <div className="flex-1">
                                  <p className="text-[10px] font-bold text-blue-700">{o.lotCode}</p>
                                  <p className="text-[10px] text-gray-700">{o.referencia}</p>
                                  <p className="text-[10px] text-gray-500"><strong>{o.operacion}</strong> · {(o.qty||0).toLocaleString('es-CO')} und × {fmtM(o.valUnit)}</p>
                                </div>
                                <span className="text-xs font-black text-gray-900 flex-shrink-0">{fmtM(o.subtotal)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-gray-400 italic">Sin operaciones en este período</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between text-sm font-black border-t border-gray-100 pt-3 mb-4">
                <span className="text-gray-700">TOTAL A PAGAR</span>
                <span style={{color:'#e85d26'}}>{fmtM(s.total)}</span>
              </div>

              {s.total===0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700 mb-2">
                  ⚠ Sin operaciones completadas en este período — el pago sería de $0
                </div>
              )}
              <button onClick={()=>openPaySat(s)}
                className="w-full py-2.5 text-white text-sm font-bold rounded-xl"
                style={{background: s.total>0?'#15803d':'#6b7280'}}>
                💳 Registrar pago — {fmtM(s.total)}
              </button>
            </div>
          </div>
        );
      })()}

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
                    printRecibo({ recId:p.recId, nombre:p.workerName, periodo:p.periodo, rol:p.rol, resumen:p.detalle||[], opsDetalle:p.opsDetalle||[], total:p.total, notas:p.notas, foto:p.foto, firmaElrohi:p.firmaElrohi||null, firmaRecibe:p.firmaRecibe||null });
                  } else {
                    const rows=(p.workers||[]).map(w=>({concepto:w.name,valor:w.earnings}));
                    printRecibo({ recId:p.recId, nombre:p.satName, periodo:p.periodo||p.date, rol:'Satélite', resumen:rows, opsDetalle:p.opsDetalle||[], total:p.total, notas:p.notas, foto:p.photoBase64, firmaElrohi:p.firmaElrohi||null, firmaRecibe:p.firmaRecibe||null });
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
                    {(liq.opsDetalle||[]).length>0 && (
                      <div className="mb-2">
                        <p className="text-[10px] font-bold text-green-800 mb-1">Operaciones:</p>
                        {liq.opsDetalle.map((o,i)=>(
                          <div key={i} className="flex justify-between text-[10px] text-green-700 py-0.5 border-b border-green-100 last:border-0">
                            <span className="flex-1">{o.lotCode} · {o.referencia} · <strong>{o.operacion}</strong> × {(o.qty||0).toLocaleString('es-CO')} und @ {fmtM(o.valUnit)}</span>
                            <span className="font-bold ml-2 flex-shrink-0">{fmtM(o.subtotal)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  {liq.resumen.map((d,i)=>(
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

            {/* Descuento */}
            <div className="mb-3">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Descuentos (opcional)</label>
              <input type="number" min={0} value={descuento} onChange={e=>setDescuento(e.target.value)}
                placeholder="0"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none" />
            </div>

            {/* Firmas */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-blue-800">Firma ELROHI — Nómina (Paga)</p>
                {firmaElrohi && <span className="text-[10px] text-green-600 font-bold">✓ Firmado</span>}
              </div>
              <FirmaCanvas label="Firma del responsable de nómina:" onSave={setFirmaElrohi} />
            </div>

            <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-green-800">Firma de quien recibe el pago</p>
                {firmaRecibe && <span className="text-[10px] text-green-600 font-bold">✓ Firmado</span>}
              </div>
              <FirmaCanvas label="Firma del operario/satélite:" onSave={setFirmaRecibe} />
            </div>

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
