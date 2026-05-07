import { LOGO_ELROHI } from '../assets/logoBase64';
import { useState, useMemo, useRef, useEffect } from 'react';
import { useData }     from '../contexts/DataContext';
import { useAuth }     from '../contexts/AuthContext';
import { addDocument, updateDocument } from '../services/db';
import { fmtM, openPDF, getOpVal, workerQuincena } from '../utils';
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
    // Operaciones internas ELROHI (control calidad, terminación, remate)
    (lot.opsElrohi||[]).forEach(op => {
      if (op.wId !== userId || op.status !== 'completado') return;
      // Sin filtro de fecha para asegurar que todas aparezcan en la quincena activa
      const val = op.valorUnitario || (op.vrTotal && op.qty ? Math.round(op.vrTotal/op.qty) : 0) || op.val || 0;
      const qty  = op.qty || 1;
      const subtotal = op.vrTotal || (val*qty) || 0;
      if (!subtotal) return;
      total += subtotal;
      detalle.push({ lotCode: lot.code, referencia: op.referencia||'', operacion: op.operacion||op.name||'Operación', valUnit: val, qty, subtotal });
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
  var LOGO = "https://i.ibb.co/nMgfFVH0/Logo-ELROHI.jpg";

  function firmaBox(label, img, nombre) {
    return '<div style="text-align:center;padding:8px 16px">' +
      (img ? '<img src="' + img + '" style="height:60px;display:block;margin:0 auto 4px;border-bottom:1.5px solid #14405A;width:80%;object-fit:contain">'
           : '<div style="height:60px;border-bottom:1.5px solid #14405A;margin:0 20px"></div>') +
      '<div style="font-size:9px;font-weight:700;color:#14405A;margin-top:4px">' + label + '</div>' +
      (nombre ? '<div style="font-size:10px;color:#374151;margin-top:2px">' + nombre + '</div>' : '') +
      '</div>';
  }

  // Agrupar por corte
  var lotMap = {};
  (data.opsDetalle || []).forEach(function(o) {
    var key = o.lotCode || 'Sin corte';
    if (!lotMap[key]) lotMap[key] = { lotCode: key, total: 0 };
    lotMap[key].total += (o.subtotal || 0);
  });
  var cortesRows = Object.values(lotMap).map(function(c) {
    return '<tr style="border-bottom:1px solid #f3f4f6">' +
      '<td style="padding:6px 10px;font-size:11px;font-weight:700;color:#14405A">' + c.lotCode + '</td>' +
      '<td style="padding:6px 10px;font-size:12px;text-align:right;font-weight:700;color:#15803d">' + fmtM(c.total) + '</td>' +
      '</tr>';
  }).join('');

  var resumenRows = (data.resumen || data.detalle || []).map(function(d) {
    return '<tr>' +
      '<td style="padding:6px 10px;border-bottom:1px solid #f0f0f0;font-size:12px">' + d.concepto + '</td>' +
      '<td style="padding:6px 10px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:700;font-size:12px;color:' + (d.valor < 0 ? '#dc2626' : '#15803d') + '">' + fmtM(d.valor) + '</td>' +
      '</tr>';
  }).join('');

  var cortesSection = cortesRows
    ? '<div style="background:#14405A;color:#fff;font-size:9px;font-weight:700;letter-spacing:0.1em;padding:4px 10px">CORTES TRABAJADOS</div>' +
      '<table style="width:100%;border-collapse:collapse">' +
      '<thead><tr style="background:#F7F7F7">' +
      '<th style="padding:6px 10px;font-size:9px;text-align:left;color:#14405A">Corte</th>' +
      '<th style="padding:6px 10px;font-size:9px;text-align:right;color:#14405A">Valor</th>' +
      '</tr></thead><tbody>' + cortesRows + '</tbody></table>'
    : '';

  var html = '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>' +
    '<title>Recibo ' + (data.recId || '') + '</title>' +
    '<style>body{margin:0;font-family:Arial,sans-serif;color:#1f2937}@media print{body{margin:0}}</style>' +
    '</head><body>' +
    '<div style="max-width:600px;margin:20px auto;border:1.5px solid #14405A;border-radius:8px;overflow:hidden">' +

    // Header
    '<div style="background:#F7F7F7;border-bottom:2px solid #14405A;padding:12px 16px;display:flex;align-items:center;gap:12px">' +
    '<img src="' + LOGO + '" style="height:56px;width:auto;object-fit:contain" />' +
    '<div>' +
    '<div style="font-size:18px;font-weight:900"><span style="color:#2878B4">Dotaciones </span><span style="color:#14405A">EL·ROHI</span></div>' +
    '<div style="font-size:9px;color:#14405A">NIT. 901.080.234-7 · Calle 39 A Sur No. 5-63 Este La Victoria · Cel.: 313 372 5739</div>' +
    '</div>' +
    '</div>' +

    // Título
    '<div style="background:#14405A;color:#fff;font-size:11px;font-weight:700;letter-spacing:0.1em;padding:5px 16px;text-align:center">RECIBO DE PAGO</div>' +

    // Info
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;border-bottom:1px solid #e5e7eb">' +
    '<div style="padding:8px 12px;border-right:1px solid #e5e7eb"><span style="font-size:9px;color:#6b7280;display:block">RECIBO N°</span><div style="font-size:11px;font-weight:700;color:#14405A">' + (data.recId || '') + '</div></div>' +
    '<div style="padding:8px 12px;border-right:1px solid #e5e7eb"><span style="font-size:9px;color:#6b7280;display:block">NOMBRE</span><div style="font-size:11px;font-weight:700">' + (data.nombre || data.workerName || '') + '</div></div>' +
    '<div style="padding:8px 12px"><span style="font-size:9px;color:#6b7280;display:block">PERÍODO</span><div style="font-size:11px;font-weight:700">' + (data.periodo || '') + '</div></div>' +
    '</div>' +

    // Cortes trabajados
    cortesSection +

    // Resumen
    '<div style="background:#14405A;color:#fff;font-size:9px;font-weight:700;letter-spacing:0.1em;padding:4px 10px">RESUMEN</div>' +
    '<table style="width:100%;border-collapse:collapse">' +
    '<thead><tr style="background:#F7F7F7"><th style="padding:6px 10px;font-size:9px;text-align:left;color:#14405A">Concepto</th><th style="padding:6px 10px;font-size:9px;text-align:right;color:#14405A">Valor</th></tr></thead>' +
    '<tbody>' + resumenRows + '</tbody>' +
    '</table>' +

    // Total
    '<div style="display:flex;justify-content:space-between;padding:10px 16px;background:#f0fdf4;border-top:2px solid #14405A">' +
    '<span style="font-weight:900;font-size:14px;color:#14532d">TOTAL A PAGAR</span>' +
    '<span style="font-weight:900;font-size:18px;color:#15803d">' + fmtM(data.total || 0) + '</span>' +
    '</div>' +

    // Firmas
    '<div style="border-top:1px solid #e5e7eb;display:grid;grid-template-columns:1fr 1fr;padding:8px 0">' +
    firmaBox('Firma ELROHI - Responsable de pago', data.firmaElrohi, data.pagadoPor) +
    firmaBox('Firma de quien recibe', data.firmaRecibe, data.nombre || data.workerName) +
    '</div>' +

    // Foto comprobante
    (data.foto ? '<div style="padding:10px 16px;text-align:center;border-top:1px solid #e5e7eb"><p style="font-size:9px;color:#6b7280;margin:0 0 6px">COMPROBANTE DE PAGO</p><img src="' + data.foto + '" style="max-width:100%;max-height:200px;border-radius:6px;border:1px solid #e5e7eb" /></div>' : '') +

    '</div></body></html>';

  openPDF(html);
}


export function NominaScreen() {
  const { profile } = useAuth();
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
    const satLots  = lots.filter(l=>l.satId===s.id && !l.pagadoSatelite);
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
        const detalleFinal = [...(liq.resumen||liq.detalle||[]), ...(desc>0?[{concepto:'Descuentos',valor:-desc}]:[])];
        const data = {
          recId: rec, tipo: 'elrohi',
          workerId: selWorker.id, workerName: selWorker.name,
          rol: selWorker.role, periodo: quincena.label,
          detalle: detalleFinal, opsDetalle: liq.opsDetalle||[], total: totalFinal,
          notas: notes, foto: photo||null, fecha: todayISO(),
          firmaElrohi, firmaRecibe,
        };
        await addDocument('payments', data);
        // Guardar también para que el operario lo vea en Mis Pagos
        await addDocument('nominasSatelite', {
          ...data,
          operarioId: selWorker.id,
          workerName: selWorker.name,
          status: 'pagado',
          createdAt: new Date().toISOString(),
        });
        printRecibo({ ...data, nombre: selWorker.name, resumen: detalleFinal, opsDetalle: liq.opsDetalle||[] });
        toast.success('Pago registrado - ' + rec);
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
        const pagoId = await addDocument('pagosSatelite', {
          ...payData,
          status: 'pagado',
          pagadoPor: profile?.name || 'ELROHI',
          fechaPago: todayISO(),
        });
        // Marcar lotes del satélite como pagados para evitar doble pago
        const lotesDelSat = lots.filter(l => l.satId === selSat.id && !l.pagadoSatelite);
        for (const lot of lotesDelSat) {
          await updateDocument('lots', lot.id, {
            pagadoSatelite: true,
            pagoSateliteId: pagoId,
            pagoSateliteFecha: todayISO(),
          });
        }
        // Print recibo satelite
        const rows = (selSat.detalle||[]).map(d=>({concepto:d.desc||d.descripcion||d.concepto||'Operación',valor:d.subtotal||d.valor||0}));
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
                    <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">{ROLE_LABELS[u.role]||u.role}</span>
                    {pagado && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold">✅ Pagado</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-lg font-black ${pagado?'text-green-600':'text-gray-900'}`}>{fmtM(liq.total)}</p>
                  {!pagado && <p className="text-xs text-orange-500 font-bold">Pendiente →</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SATÉLITES */}
      {/* DETALLE OPERARIO ELROHI */}
      {tab==='elrohi' && selDetalle?.tipo==='elrohi' && (()=>{
        const {data:u, liq} = selDetalle;
        return (
          <div>
            <button onClick={()=>setSelDetalle(null)} className="text-xs text-gray-500 mb-4 flex items-center gap-1">← Volver</button>
            <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-black text-white" style={{background:'#14405A'}}>
                  {u.initials||u.name?.slice(0,2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{u.name}</p>
                  <p className="text-xs text-gray-400">{ROLE_LABELS[u.role]||u.role} · {quincena.label}</p>
                </div>
              </div>

              {/* Operaciones realizadas */}
              {(liq.opsDetalle||[]).length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Operaciones realizadas</p>
                  <div className="bg-gray-50 rounded-xl overflow-hidden">
                    <div className="grid grid-cols-4 gap-1 px-3 py-1.5 bg-gray-100 text-xs font-bold text-gray-500 uppercase">
                      <span className="col-span-1">Corte / Referencia</span>
                      <span className="col-span-1">Operación</span>
                      <span className="text-center">Und</span>
                      <span className="text-right">Total</span>
                    </div>
                    {liq.opsDetalle.map((o,i)=>(
                      <div key={i} className="grid grid-cols-4 gap-1 px-3 py-2 border-b border-gray-100 last:border-0 items-center">
                        <div className="col-span-1">
                          <p className="text-xs font-mono font-bold text-blue-700">{o.lotCode}</p>
                          <p className="text-xs text-gray-500 leading-tight">{o.referencia||''}</p>
                        </div>
                        <div className="col-span-1">
                          <p className="text-xs font-bold text-gray-800">{o.operacion}</p>
                          <p className="text-xs text-gray-400">{fmtM(o.valUnit)}/und</p>
                        </div>
                        <span className="text-xs text-center text-gray-600">{(o.qty||0).toLocaleString('es-CO')}</span>
                        <span className="text-xs font-black text-gray-900 text-right">{fmtM(o.subtotal)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Resumen */}
              <div className="space-y-1.5 mb-4">
                {liq.baseFija>0 && <div className="flex justify-between text-xs px-3 py-2 bg-blue-50 rounded-lg"><span className="text-blue-700">💰 Base fija</span><span className="font-bold text-blue-800">{fmtM(liq.baseFija)}</span></div>}
                {liq.opsVal>0  && <div className="flex justify-between text-xs px-3 py-2 bg-green-50 rounded-lg"><span className="text-green-700">⚡ Operaciones</span><span className="font-bold text-green-800">{fmtM(liq.opsVal)}</span></div>}
                {liq.total===0 && <p className="text-xs text-gray-400 italic text-center py-2">Sin movimientos en este período</p>}
              </div>

              <div className="flex justify-between text-sm font-black border-t border-gray-100 pt-3 mb-4">
                <span className="text-gray-700">TOTAL A PAGAR</span>
                <span style={{color:'#e85d26'}}>{fmtM(liq.total)}</span>
              </div>

              <button onClick={()=>openPayElrohi(u)}
                className="w-full py-2.5 text-white text-sm font-bold rounded-xl"
                style={{background: liq.total>0?'#15803d':'#6b7280'}}>
                💳 Registrar pago — {fmtM(liq.total)}
              </button>
            </div>
          </div>
        );
      })()}

            {false && tab==='satelites' && !selDetalle && (
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
                  <p className="text-xs text-gray-400">{s.compOps} ops · {(s.detalle||[]).length} items</p>
                  {pagado && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold">✅ Pagado</span>}
                </div>
                <div className="text-right">
                  <p className={`text-lg font-black ${pagado?'text-green-600':'text-gray-900'}`}>{fmtM(s.total)}</p>
                  {!pagado && <p className="text-xs text-orange-500 font-bold">Pendiente →</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {false && tab==='satelites' && selDetalle?.tipo==='satelite' && (()=>{
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
                  <p className="text-xs text-gray-400">{quincena.label}</p>
                </div>
              </div>



              {/* Desglose por operario con detalle */}
              {(s.workerBreakdown||[]).length>0 && (
                <div className="mb-4">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Operarios del satélite</p>
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
                                  <p className="text-xs font-bold text-blue-700">{o.lotCode}</p>
                                  <p className="text-xs text-gray-700">{o.referencia}</p>
                                  <p className="text-xs text-gray-500"><strong>{o.operacion}</strong> · {(o.qty||0).toLocaleString('es-CO')} und × {fmtM(o.valUnit)}</p>
                                </div>
                                <span className="text-xs font-black text-gray-900 flex-shrink-0">{fmtM(o.subtotal)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 italic">Sin operaciones en este período</p>
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
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">✅ Pagado</span>
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                      {p.tipo==='elrohi'?'👷 ELROHI':'🏭 Satélite'}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-gray-900">{p.workerName||p.satName}</p>
                  <p className="text-xs text-gray-400">{p.periodo||p.date}</p>
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
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.6)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:'16px'}}>
          <div style={{background:'#fff',borderRadius:'16px',width:'100%',maxWidth:'860px',maxHeight:'90vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.3)'}}>

            <div style={{background:'#14405A',borderRadius:'16px 16px 0 0',padding:'14px 20px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <p style={{color:'#fff',fontWeight:900,fontSize:'15px',margin:0}}>
                  {selWorker && ('Registrar Pago - ' + selWorker.name)}
                  {selSat && ('Registrar Pago - ' + selSat.name)}
                </p>
                <p style={{color:'#93c5fd',fontSize:'11px',margin:0}}>{quincena.label}</p>
              </div>
              <button onClick={function(){setShowModal(false);}} style={{color:'#fff',fontSize:'20px',fontWeight:900,background:'transparent',border:'none',cursor:'pointer'}}>X</button>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'20px',padding:'20px'}}>

              <div>
                <p style={{fontSize:'11px',fontWeight:700,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:'8px'}}>Resumen del periodo</p>

                {selWorker && (function(){
                  var liq = calcLiquidacion(selWorker);
                  return (
                    <div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:'12px',padding:'12px',marginBottom:'12px'}}>
                      {liq.opsDetalle && liq.opsDetalle.length > 0 && (
                        <div style={{marginBottom:'8px',maxHeight:'160px',overflowY:'auto'}}>
                          <p style={{fontSize:'10px',fontWeight:700,color:'#15803d',marginBottom:'4px'}}>Operaciones:</p>
                          {liq.opsDetalle.map(function(o,i){
                            return (
                              <div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:'10px',color:'#166534',padding:'2px 0',borderBottom:'1px solid #dcfce7'}}>
                                <span>{o.lotCode} - {o.referencia} - {o.operacion} x {(o.qty||0).toLocaleString('es-CO')}</span>
                                <span style={{fontWeight:700,marginLeft:'8px'}}>{fmtM(o.subtotal)}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {(liq.resumen||[]).map(function(d,i){
                        return (
                          <div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:'11px',color:'#15803d',padding:'2px 0'}}>
                            <span>{d.concepto}</span>
                            <span style={{fontWeight:700}}>{fmtM(d.valor)}</span>
                          </div>
                        );
                      })}
                      <div style={{borderTop:'1px solid #86efac',marginTop:'8px',paddingTop:'8px',display:'flex',justifyContent:'space-between'}}>
                        <span style={{fontWeight:700,color:'#14532d',fontSize:'12px'}}>Total a pagar</span>
                        <span style={{fontWeight:900,color:'#15803d',fontSize:'18px'}}>{fmtM(liq.total)}</span>
                      </div>
                    </div>
                  );
                })()}

                {selSat && (
                  <div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:'12px',padding:'16px',marginBottom:'12px'}}>
                    <p style={{fontSize:'24px',fontWeight:900,color:'#15803d',margin:'0 0 4px 0'}}>{fmtM(selSat.total)}</p>
                    <p style={{fontSize:'11px',color:'#16a34a',margin:0}}>{selSat.compOps} operaciones - {quincena.label}</p>
                  </div>
                )}

                <div style={{marginBottom:'12px'}}>
                  <label style={{display:'block',fontSize:'11px',fontWeight:600,color:'#374151',marginBottom:'4px'}}>Descuento (opcional)</label>
                  <input type="number" min={0} value={descuento} onChange={function(e){setDescuento(e.target.value);}}
                    placeholder="0"
                    style={{width:'100%',border:'1px solid #d1d5db',borderRadius:'10px',padding:'8px 12px',fontSize:'13px',outline:'none',boxSizing:'border-box'}} />
                </div>

                <div>
                  <p style={{fontSize:'11px',fontWeight:600,color:'#374151',marginBottom:'6px'}}>Comprobante (opcional)</p>
                  <label style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',border:'2px dashed #d1d5db',borderRadius:'12px',padding:'12px',cursor:'pointer',minHeight:'80px'}}>
                    {photoPreview && (
                      <img src={photoPreview} alt="Comprobante" style={{maxHeight:'100px',borderRadius:'8px',objectFit:'contain'}} />
                    )}
                    {!photoPreview && (
                      <span style={{fontSize:'11px',color:'#9ca3af'}}>Subir foto del comprobante</span>
                    )}
                    <input type="file" accept="image/jpeg,image/png,image/webp" style={{display:'none'}}
                      onChange={function(e){
                        var f = e.target.files[0];
                        if (!f) return;
                        var r = new FileReader();
                        r.onload = function(ev){ setPhotoPreview(ev.target.result); setPhoto(ev.target.result); };
                        r.readAsDataURL(f);
                      }} />
                  </label>
                </div>
              </div>

              <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>

                <div>
                  <label style={{display:'block',fontSize:'11px',fontWeight:600,color:'#374151',marginBottom:'4px'}}>Notas</label>
                  <textarea value={notes} onChange={function(e){setNotes(e.target.value);}} rows={2}
                    placeholder="Observaciones..."
                    style={{width:'100%',border:'1px solid #d1d5db',borderRadius:'10px',padding:'8px 12px',fontSize:'12px',resize:'none',outline:'none',boxSizing:'border-box'}} />
                </div>

                <div style={{background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:'12px',padding:'12px'}}>
                  <p style={{fontSize:'11px',fontWeight:700,color:'#1e40af',marginBottom:'8px'}}>Firma ELROHI - Responsable nomina</p>
                  <FirmaCanvas label="" onSave={setFirmaElrohi} />
                </div>

                <div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:'12px',padding:'12px'}}>
                  <p style={{fontSize:'11px',fontWeight:700,color:'#15803d',marginBottom:'8px'}}>Firma de quien recibe el pago</p>
                  <FirmaCanvas label="" onSave={setFirmaRecibe} />
                </div>

                <button onClick={confirmarPago} disabled={saving}
                  style={{width:'100%',padding:'14px',background:saving?'#9ca3af':'#15803d',color:'#fff',fontWeight:900,fontSize:'14px',borderRadius:'12px',border:'none',cursor:'pointer'}}>
                  {saving ? 'Guardando...' : 'Confirmar y generar recibo'}
                </button>

              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
