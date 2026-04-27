import { useState, useEffect, useRef } from 'react';
import { useAuth }   from '../contexts/AuthContext';
import { useData }   from '../contexts/DataContext';
import { addDocument, updateDocument, listenCol } from '../services/db';
import { fmtM }      from '../utils';
import { ACCENT }    from '../constants';
import { orderBy }   from 'firebase/firestore';
import toast         from 'react-hot-toast';
import logo          from '../assets/LogoELROHI.jpeg';

// ── CANVAS FIRMA ──────────────────────────────────────────────────────────────
function FirmaCanvas({ label, onSign, signed }) {
  const ref = useRef(null);
  const drawing = useRef(false);
  const getPos = (e,c) => { const r=c.getBoundingClientRect(); const t=e.touches?.[0]||e; return {x:(t.clientX-r.left)*(c.width/r.width),y:(t.clientY-r.top)*(c.height/r.height)}; };
  const start = (e) => { e.preventDefault(); drawing.current=true; const c=ref.current; const ctx=c.getContext('2d'); const p=getPos(e,c); ctx.beginPath(); ctx.moveTo(p.x,p.y); };
  const move  = (e) => { e.preventDefault(); if(!drawing.current)return; const c=ref.current; const ctx=c.getContext('2d'); const p=getPos(e,c); ctx.lineTo(p.x,p.y); ctx.strokeStyle='#1a3a6b'; ctx.lineWidth=2; ctx.lineCap='round'; ctx.stroke(); };
  const end   = (e) => { e.preventDefault(); drawing.current=false; onSign(ref.current.toDataURL()); };
  const clear = () => { const c=ref.current; const ctx=c.getContext('2d'); ctx.clearRect(0,0,c.width,c.height); ctx.fillStyle='#f9f9f7'; ctx.fillRect(0,0,c.width,c.height); onSign(null); };
  useEffect(()=>{ const c=ref.current; if(c){const ctx=c.getContext('2d'); ctx.fillStyle='#f9f9f7'; ctx.fillRect(0,0,c.width,c.height);} },[]);
  return (
    <div className="mb-3">
      <p className="text-xs font-semibold text-gray-700 mb-1">{label}</p>
      <div className="relative">
        <canvas ref={ref} width={500} height={100} className="border border-gray-200 rounded-xl w-full touch-none" style={{background:'#f9f9f7',cursor:'crosshair'}}
          onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
          onTouchStart={start} onTouchMove={move} onTouchEnd={end} />
        <button onClick={clear} className="absolute top-1 right-1 text-[9px] bg-white border border-gray-200 px-2 py-0.5 rounded text-gray-500">Limpiar</button>
        {signed && <span className="absolute bottom-1 right-1 text-[9px] text-green-600 font-bold bg-green-50 px-1.5 py-0.5 rounded">✓ Firmado</span>}
      </div>
    </div>
  );
}

// ── IMPRIMIR CUENTA DE COBRO ──────────────────────────────────────────────────
function printCuenta(cc, satName, logoBase64) {
  const rows = (cc.items||[]).map(item => `
    <tr>
      <td style="border:1px solid #e5e7eb;padding:6px 8px;font-size:11px;font-weight:600">${item.lotCode}</td>
      <td style="border:1px solid #e5e7eb;padding:6px 8px;text-align:center;font-size:11px">${item.qty?.toLocaleString('es-CO')}</td>
      <td style="border:1px solid #e5e7eb;padding:6px 8px;font-size:11px">${item.descripcion}</td>
      <td style="border:1px solid #e5e7eb;padding:6px 8px;font-size:11px">${item.operacion}</td>
      <td style="border:1px solid #e5e7eb;padding:6px 8px;text-align:right;font-size:11px">${fmtM(item.vrUnit)}</td>
      <td style="border:1px solid #e5e7eb;padding:6px 8px;text-align:right;font-size:11px;font-weight:700">${fmtM(item.vrTotal)}</td>
    </tr>`).join('');

  const descRows = (cc.descuentos||[]).map(d => `
    <tr>
      <td colspan="5" style="border:1px solid #e5e7eb;padding:5px 8px;font-size:11px;color:#dc2626">${d.descripcion}</td>
      <td style="border:1px solid #e5e7eb;padding:5px 8px;text-align:right;font-size:11px;font-weight:700;color:#dc2626">-${fmtM(d.valor)}</td>
    </tr>`).join('');

  const adicRows = (cc.adicionales||[]).map(a => `
    <tr>
      <td colspan="5" style="border:1px solid #e5e7eb;padding:5px 8px;font-size:11px;color:#15803d">${a.descripcion}</td>
      <td style="border:1px solid #e5e7eb;padding:5px 8px;text-align:right;font-size:11px;font-weight:700;color:#15803d">+${fmtM(a.valor)}</td>
    </tr>`).join('');

  const firmaBox = (label, img, nombre) => `
    <div style="text-align:center;padding:8px 20px">
      ${img?`<img src="${img}" style="height:50px;display:block;margin:0 auto 4px;border-bottom:1px solid #1a3a6b;width:80%">`:`<div style="height:50px;border-bottom:1px solid #1a3a6b;margin:0 20px"></div>`}
      <div style="font-size:9px;font-weight:700;color:#1a3a6b;margin-top:4px">${label}</div>
      ${nombre?`<div style="font-size:9px;color:#374151">${nombre}</div>`:''}
    </div>`;

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><title>Cuenta de Cobro</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif}@media print{body{print-color-adjust:exact}}</style>
  </head><body><div style="max-width:800px;margin:20px auto;padding:0 20px">
    <!-- Header -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid #14405A">
      <div>
        ${logoBase64?`<img src="${logoBase64}" style="height:60px;width:auto;object-fit:contain;border-radius:6px" />`:''}
        <div style="font-size:10px;color:#6b7280;margin-top:4px">NIT. 901.080.234-7</div>
        <div style="font-size:10px;color:#6b7280">Calle 39 A Sur No. 5-63 Este La Victoria</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:11px;font-weight:700;color:#6b7280;letter-spacing:0.1em">CUENTA DE COBRO</div>
        <div style="font-size:24px;font-weight:900;color:#2878B4;font-family:monospace">N° ${cc.numero}</div>
        <div style="font-size:11px;color:#6b7280">Fecha: ${cc.fecha}</div>
      </div>
    </div>

    <!-- Datos satélite -->
    <div style="background:#f9fafb;border-radius:8px;padding:12px 16px;margin-bottom:20px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div><span style="font-size:10px;color:#6b7280">Satélite:</span><br><span style="font-size:13px;font-weight:700">${satName}</span></div>
        <div><span style="font-size:10px;color:#6b7280">Período:</span><br><span style="font-size:13px;font-weight:700">${cc.periodo||''}</span></div>
      </div>
    </div>

    <!-- Tabla items -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:4px">
      <thead><tr style="background:#1a3a6b;color:#fff">
        <th style="padding:8px;font-size:11px;text-align:left">Doc</th>
        <th style="padding:8px;font-size:11px;text-align:center">Cant.</th>
        <th style="padding:8px;font-size:11px;text-align:left">Descripción</th>
        <th style="padding:8px;font-size:11px;text-align:left">Operación</th>
        <th style="padding:8px;font-size:11px;text-align:right">Vr. Unit.</th>
        <th style="padding:8px;font-size:11px;text-align:right">Vr. Total</th>
      </tr></thead>
      <tbody>${rows}${descRows}${adicRows}</tbody>
    </table>

    <!-- Totales -->
    <div style="display:flex;justify-content:flex-end;margin-bottom:24px">
      <div style="min-width:280px">
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e5e7eb">
          <span style="font-size:12px;color:#6b7280">Subtotal</span>
          <span style="font-size:12px;font-weight:600">${fmtM(cc.subtotal||0)}</span>
        </div>
        ${(cc.descuentos||[]).length>0?`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e5e7eb"><span style="font-size:12px;color:#dc2626">Descuentos</span><span style="font-size:12px;font-weight:600;color:#dc2626">-${fmtM(cc.totalDescuentos||0)}</span></div>`:''}
        ${(cc.adicionales||[]).length>0?`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e5e7eb"><span style="font-size:12px;color:#15803d">Adicionales</span><span style="font-size:12px;font-weight:600;color:#15803d">+${fmtM(cc.totalAdicionales||0)}</span></div>`:''}
        <div style="display:flex;justify-content:space-between;padding:10px 0;border-top:2px solid #1a3a6b">
          <span style="font-size:14px;font-weight:900;color:#14405A">TOTAL</span>
          <span style="font-size:18px;font-weight:900;color:#2878B4">${fmtM(cc.total||0)}</span>
        </div>
      </div>
    </div>

    <!-- Firmas -->
    <div style="display:grid;grid-template-columns:1fr 1fr;border-top:2px solid #1a3a6b;margin-top:20px">
      ${firmaBox('Admin Satélite — '+satName, cc.firmaAdminSat, cc.nombreAdminSat)}
      <div style="border-left:1px solid #1a3a6b">${firmaBox('Aprobado por — Admin ELROHI', cc.firmaAdminElrohi, cc.nombreAdminElrohi)}</div>
    </div>

    ${cc.observaciones?`<div style="margin-top:16px;padding:10px;background:#fef9c3;border-radius:6px"><span style="font-size:11px;font-weight:700;color:#92400e">Observaciones:</span><span style="font-size:11px;color:#374151;margin-left:6px">${cc.observaciones}</span></div>`:''}
  </div><script>window.onload=()=>window.print();</script></body></html>`;
  const win=window.open('','_blank'); win.document.write(html); win.document.close();
}

// ── SCREEN PRINCIPAL ──────────────────────────────────────────────────────────
export default function CuentaCobroScreen() {
  const { profile } = useAuth();
  const { lots, satellites, users } = useData();
  const [tarifas,   setTarifas]   = useState([]);
  const [cuentas,   setCuentas]   = useState([]);
  const [tab,       setTab]       = useState('nueva');
  const [showModal, setShowModal] = useState(false);
  const [saving,    setSaving]    = useState(false);

  // Form cuenta de cobro
  const [periodo,   setPeriodo]   = useState('');
  const [items,     setItems]     = useState([]);
  const [descuentos,setDescuentos]= useState([]);
  const [adicionales,setAdicionales]=useState([]);
  const [firmaSat,  setFirmaSat]  = useState(null);
  const [firmaElrohi,setFirmaElrohi]=useState(null);
  const [obsAdmin,  setObsAdmin]  = useState('');

  // Para admin ELROHI — revisar cuenta
  const [showRevision, setShowRevision] = useState(null);

  useEffect(()=>{
    const u1 = listenCol('tarifasSatelite', setTarifas, orderBy('descripcion','asc'));
    const u2 = listenCol('cuentasCobro',   setCuentas,  orderBy('createdAt','desc'));
    return ()=>{ u1(); u2(); };
  },[]);

  const isAdmin    = ['gerente','admin_elrohi'].includes(profile?.role);
  const isSat      = profile?.role === 'admin_satelite';

  // Satélite del usuario actual
  const miSatelite = satellites.find(s => s.id === profile?.satId);

  // Lotes completados del satélite (costura completa)
  const lotesSat = lots.filter(l =>
    l.satId === profile?.satId &&
    ['listo_remision_tintoreria','tintoreria','listo_recepcion_admin','listo_bodega',
     'bodega_lonas','bodega_calidad','en_operaciones_elrohi','en_revision_calidad','despachado'].includes(l.status)
  );

  const addItem = (lot) => {
    if (items.find(i=>i.lotId===lot.id)) { toast.error('Ya está en la cuenta'); return; }
    const tarifa = tarifas[0]; // default primera tarifa
    setItems(prev=>[...prev, {
      lotId:       lot.id,
      lotCode:     lot.code,
      qty:         lot.totalPieces||0,
      descripcion: tarifa?.descripcion||'',
      tarifaId:    tarifa?.id||'',
      operacion:   'completo',
      vrUnit:      tarifa?.total||0,
      vrTotal:     (lot.totalPieces||0)*(tarifa?.total||0),
    }]);
  };

  const updItem = (i, key, val) => {
    setItems(prev=>{
      const n=[...prev]; n[i]={...n[i],[key]:val};
      // Recalcular vrUnit y vrTotal cuando cambia tarifa o operacion
      if (key==='tarifaId' || key==='operacion') {
        const tar = tarifas.find(t=>t.id===(key==='tarifaId'?val:n[i].tarifaId));
        if (tar) {
          const op = key==='operacion'?val:n[i].operacion;
          const vrUnit = op==='completo' ? tar.total :
                         op==='confeccion' ? tar.confeccion :
                         op==='terminacion' ? tar.terminacion :
                         op==='remate' ? tar.remate : tar.total;
          n[i].vrUnit  = vrUnit||0;
          n[i].vrUnit  = vrUnit||0;
          n[i].descripcion = tar.descripcion;
          if (key==='tarifaId') n[i].tarifaId = val;
        }
      }
      n[i].vrTotal = (n[i].qty||0)*(n[i].vrUnit||0);
      return n;
    });
  };

  const subtotal        = items.reduce((a,i)=>a+i.vrTotal,0);
  const totalDescuentos = descuentos.reduce((a,d)=>a+(+d.valor||0),0);
  const totalAdicionales= adicionales.reduce((a,d)=>a+(+d.valor||0),0);
  const total           = subtotal - totalDescuentos + totalAdicionales;

  const enviarCuenta = async () => {
    if (!items.length) { toast.error('Agrega al menos un lote'); return; }
    if (!firmaSat)     { toast.error('Firma la cuenta de cobro'); return; }
    setSaving(true);
    try {
      const numero = String(cuentas.length+1).padStart(4,'0');
      await addDocument('cuentasCobro', {
        numero, periodo, satId: profile?.satId, satName: miSatelite?.name||'',
        items, descuentos, adicionales,
        subtotal, totalDescuentos, totalAdicionales, total,
        firmaAdminSat:  firmaSat,
        nombreAdminSat: profile?.name,
        fecha: new Date().toISOString().split('T')[0],
        status: 'pendiente_revision',
      });
      toast.success(`✅ Cuenta de cobro N° ${numero} enviada a Admin ELROHI`);
      setTab('pendiente');
      setItems([]); setDescuentos([]); setAdicionales([]);
      setFirmaSat(null); setPeriodo('');
      setTab('historial');
    } catch(e){ console.error(e); toast.error('Error'); }
    finally { setSaving(false); }
  };

  const aprobarCuenta = async (cc) => {
    if (!firmaElrohi) { toast.error('Firma la aprobación'); return; }
    setSaving(true);
    try {
      await updateDocument('cuentasCobro', cc.id, {
        status: 'aprobada',
        firmaAdminElrohi:  firmaElrohi,
        nombreAdminElrohi: profile?.name,
        observaciones:     obsAdmin,
        aprobadoAt: new Date().toISOString(),
      });
      toast.success('✅ Cuenta aprobada');
      setShowRevision(null); setFirmaElrohi(null); setObsAdmin('');
    } catch(e){ toast.error('Error'); }
    finally { setSaving(false); }
  };

  const OPERACIONES = [
    { val:'completo',    label:'Completo (confección + terminación + remate)' },
    { val:'confeccion',  label:'Solo confección' },
    { val:'terminacion', label:'Solo terminación' },
    { val:'remate',      label:'Solo remate' },
  ];

  return (
    <div>
      <h1 className="text-sm font-bold text-gray-900 mb-1">Cuenta de Cobro</h1>
      <p className="text-xs text-gray-400 mb-4">
        {isSat ? `Satélite: ${miSatelite?.name||''}` : 'Revisión y aprobación de cuentas'}
      </p>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        {[
          isSat ? ['nueva','📋 Nueva Cuenta'] : null,
          isSat ? ['pendiente',`⏳ Pendiente pago (${cuentas.filter(c=>c.satId===profile?.satId&&c.status==='pendiente_revision').length})`] : null,
          ['historial', isSat ? `📁 Historial` : `📁 Cuentas (${cuentas.filter(c=>c.status==='pendiente_revision').length} pendientes)`],
        ].filter(Boolean).map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{background:tab===k?'#fff':'transparent',color:tab===k?'#111827':'#6b7280',
              fontWeight:tab===k?700:400,boxShadow:tab===k?'0 1px 3px rgba(0,0,0,0.08)':'none'}}>
            {l}
          </button>
        ))}
      </div>

      {/* NUEVA CUENTA (Admin Satélite) */}
      {tab==='nueva' && isSat && (
        <div>
          {/* Período */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Período</label>
            <input value={periodo} onChange={e=>setPeriodo(e.target.value)}
              placeholder="Ej: 1-15 Abril 2026"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
          </div>

          {/* Lotes disponibles */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Lotes completados — clic para agregar</p>
            {lotesSat.length===0 && <p className="text-xs text-gray-400 italic">Sin lotes completados en este período</p>}
            <div className="flex flex-wrap gap-2">
              {lotesSat.map(lot=>{
                const yaAgregado = items.find(i=>i.lotId===lot.id);
                return (
                  <button key={lot.id} onClick={()=>!yaAgregado&&addItem(lot)}
                    className="text-xs px-3 py-1.5 rounded-lg border-2 font-medium transition-all"
                    style={{
                      borderColor: yaAgregado?'#15803d':'#e5e7eb',
                      background:  yaAgregado?'#f0fdf4':'#fff',
                      color:       yaAgregado?'#15803d':'#374151',
                      cursor:      yaAgregado?'default':'pointer',
                    }}>
                    {yaAgregado?'✓ ':''}{lot.code} · {lot.totalPieces?.toLocaleString('es-CO')} pzas
                  </button>
                );
              })}
            </div>
          </div>

          {/* Items de la cuenta */}
          {items.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Detalle de la cuenta</p>
              <div className="space-y-3">
                {items.map((item,i)=>(
                  <div key={i} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-blue-700">{item.lotCode}</span>
                      <span className="text-xs text-gray-500">{item.qty?.toLocaleString('es-CO')} piezas</span>
                      <button onClick={()=>setItems(p=>p.filter((_,idx)=>idx!==i))} className="text-red-400 text-xs">✕</button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-500 mb-1">Referencia / Tarifa</label>
                        <select value={item.tarifaId} onChange={e=>updItem(i,'tarifaId',e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none">
                          <option value="">— Seleccionar —</option>
                          {tarifas.map(t=><option key={t.id} value={t.id}>{t.descripcion}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-500 mb-1">Operación realizada</label>
                        <select value={item.operacion} onChange={e=>updItem(i,'operacion',e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none">
                          {OPERACIONES.map(o=><option key={o.val} value={o.val}>{o.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-100">
                      <span className="text-xs text-gray-600">{item.qty?.toLocaleString('es-CO')} × {fmtM(item.vrUnit)}</span>
                      <span className="text-sm font-black text-green-700">{fmtM(item.vrTotal)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Subtotal */}
              <div className="mt-3 flex justify-between text-sm font-bold px-3 py-2 bg-blue-50 rounded-xl text-blue-800">
                <span>Subtotal</span>
                <span>{fmtM(subtotal)}</span>
              </div>
            </div>
          )}

          {/* Descuentos */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Descuentos / Novedades</p>
              <button onClick={()=>setDescuentos(p=>[...p,{descripcion:'',valor:0}])}
                className="text-xs text-red-600 font-medium">+ Agregar descuento</button>
            </div>
            {descuentos.length===0 && <p className="text-[10px] text-gray-400 italic">Sin descuentos</p>}
            {descuentos.map((d,i)=>(
              <div key={i} className="flex gap-2 mb-2 items-center">
                <input value={d.descripcion} onChange={e=>setDescuentos(p=>{const n=[...p];n[i]={...n[i],descripcion:e.target.value};return n;})}
                  placeholder="Descripción del descuento..."
                  className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none" />
                <input type="number" min={0} value={d.valor} onChange={e=>setDescuentos(p=>{const n=[...p];n[i]={...n[i],valor:+e.target.value};return n;})}
                  placeholder="Valor"
                  className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none" />
                <button onClick={()=>setDescuentos(p=>p.filter((_,idx)=>idx!==i))} className="text-red-400 text-xs">✕</button>
              </div>
            ))}
            {descuentos.length>0 && (
              <div className="flex justify-between text-xs font-bold px-3 py-1.5 bg-red-50 rounded-lg text-red-700 mt-1">
                <span>Total descuentos</span><span>-{fmtM(totalDescuentos)}</span>
              </div>
            )}
          </div>

          {/* Adicionales */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Trabajos adicionales</p>
              <button onClick={()=>setAdicionales(p=>[...p,{descripcion:'',valor:0}])}
                className="text-xs text-green-600 font-medium">+ Agregar adicional</button>
            </div>
            {adicionales.length===0 && <p className="text-[10px] text-gray-400 italic">Sin adicionales</p>}
            {adicionales.map((a,i)=>(
              <div key={i} className="flex gap-2 mb-2 items-center">
                <input value={a.descripcion} onChange={e=>setAdicionales(p=>{const n=[...p];n[i]={...n[i],descripcion:e.target.value};return n;})}
                  placeholder="Descripción del trabajo adicional..."
                  className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none" />
                <input type="number" min={0} value={a.valor} onChange={e=>setAdicionales(p=>{const n=[...p];n[i]={...n[i],valor:+e.target.value};return n;})}
                  placeholder="Valor"
                  className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none" />
                <button onClick={()=>setAdicionales(p=>p.filter((_,idx)=>idx!==i))} className="text-red-400 text-xs">✕</button>
              </div>
            ))}
            {adicionales.length>0 && (
              <div className="flex justify-between text-xs font-bold px-3 py-1.5 bg-green-50 rounded-lg text-green-700 mt-1">
                <span>Total adicionales</span><span>+{fmtM(totalAdicionales)}</span>
              </div>
            )}
          </div>

          {/* Total final */}
          {items.length>0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-blue-800">TOTAL A COBRAR</span>
                <span className="text-2xl font-black" style={{color:'#e85d26'}}>{fmtM(total)}</span>
              </div>
            </div>
          )}

          {/* Firma Admin Satélite */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
            <FirmaCanvas label="✍ Firma Admin Satélite *" onSign={setFirmaSat} signed={!!firmaSat} />
          </div>

          <button onClick={enviarCuenta} disabled={saving||!items.length||!firmaSat}
            className="w-full py-3 text-white text-sm font-bold rounded-xl disabled:opacity-50"
            style={{background:ACCENT}}>
            {saving?'Enviando...':'📋 Enviar cuenta de cobro a Admin ELROHI'}
          </button>
        </div>
      )}

      {/* PENDIENTE DE PAGO (Satélite) */}
      {tab==='pendiente' && isSat && (
        <div className="space-y-3">
          {cuentas.filter(c=>c.satId===profile?.satId&&c.status==='pendiente_revision').length===0 && (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-100">
              <p className="text-3xl mb-2">✅</p>
              <p className="text-sm text-gray-500">Sin cuentas pendientes de pago</p>
            </div>
          )}
          {cuentas.filter(c=>c.satId===profile?.satId&&c.status==='pendiente_revision').map(cc=>(
            <div key={cc.id} className="bg-white rounded-xl border border-amber-200 p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-bold text-blue-700">CC-{cc.numero}</span>
                    <span className="text-[9px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">⏳ Pendiente pago</span>
                  </div>
                  <p className="text-sm font-bold text-gray-900">{cc.periodo}</p>
                  <p className="text-[10px] text-gray-400">{cc.fecha}</p>
                </div>
                <p className="text-xl font-black text-green-700 flex-shrink-0">{fmtM(cc.total)}</p>
              </div>
              <div className="space-y-1">
                {(cc.items||[]).map((item,i)=>(
                  <div key={i} className="flex justify-between text-xs text-gray-600 py-0.5 border-b border-gray-50 last:border-0">
                    <span className="truncate flex-1 mr-2">{item.lotCode} — {item.descripcion}</span>
                    <span className="font-bold flex-shrink-0">{fmtM(item.subtotal)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* HISTORIAL */}
      {tab==='historial' && (
        <div className="space-y-3">
          {cuentas.length===0 && (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-100">
              <p className="text-3xl mb-2">📋</p>
              <p className="font-medium text-gray-700">Sin cuentas de cobro</p>
            </div>
          )}
          {cuentas
            .filter(c => isSat ? c.satId===profile?.satId : true)
            .map(cc=>(
            <div key={cc.id} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-xs font-bold text-blue-700">CC-{cc.numero}</span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                      cc.status==='aprobada'?'bg-green-100 text-green-700':'bg-amber-100 text-amber-700'}`}>
                      {cc.status==='aprobada'?'✅ Aprobada':'⏳ Pendiente revisión'}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-gray-900">{cc.satName}</p>
                  <p className="text-[10px] text-gray-400">{cc.periodo} · {cc.fecha}</p>
                  <p className="text-sm font-black text-green-600 mt-1">{fmtM(cc.total)}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {isAdmin && cc.status==='pendiente_revision' && (
                    <button onClick={()=>{setShowRevision(cc);setFirmaElrohi(null);setObsAdmin('');}}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg text-white"
                      style={{background:'#1a3a6b'}}>
                      ✍ Revisar y aprobar
                    </button>
                  )}
                  {cc.status==='aprobada' && (
                    <button onClick={()=>printCuenta(cc, cc.satName, logo)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600">
                      🖨️ Imprimir
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL REVISIÓN (Admin ELROHI) */}
      {showRevision && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.6)',zIndex:1000,display:'flex',alignItems:'flex-start',justifyContent:'center',padding:16,overflowY:'auto'}}>
          <div style={{background:'#fff',borderRadius:16,padding:24,width:'100%',maxWidth:560,marginTop:16,marginBottom:16}}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-900">Revisión — CC-{showRevision.numero}</h2>
              <button onClick={()=>setShowRevision(null)} className="text-gray-400 text-xl font-bold bg-transparent border-none cursor-pointer">✕</button>
            </div>

            {/* Resumen */}
            <div className="bg-gray-50 rounded-xl p-3 mb-4">
              <p className="text-xs font-bold text-gray-700">{showRevision.satName} · {showRevision.periodo}</p>
              <div className="space-y-1 mt-2">
                {showRevision.items?.map((item,i)=>(
                  <div key={i} className="flex justify-between text-xs text-gray-600">
                    <span>{item.lotCode} · {item.descripcion} · {item.operacion}</span>
                    <span className="font-bold">{fmtM(item.vrTotal)}</span>
                  </div>
                ))}
              </div>
              {showRevision.descuentos?.length>0 && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  {showRevision.descuentos.map((d,i)=>(
                    <div key={i} className="flex justify-between text-xs text-red-600">
                      <span>- {d.descripcion}</span><span>-{fmtM(d.valor)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-between text-sm font-black mt-2 pt-2 border-t border-gray-200">
                <span>TOTAL</span><span style={{color:'#e85d26'}}>{fmtM(showRevision.total)}</span>
              </div>
            </div>

            <div className="mb-3">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Observaciones</label>
              <textarea value={obsAdmin} onChange={e=>setObsAdmin(e.target.value)}
                placeholder="Ajustes, aclaraciones o notas de aprobación..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none h-16 focus:outline-none" />
            </div>

            <FirmaCanvas label="✍ Firma Admin ELROHI *" onSign={setFirmaElrohi} signed={!!firmaElrohi} />

            <div className="flex gap-2 mt-2">
              <button onClick={()=>setShowRevision(null)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium">Cancelar</button>
              <button onClick={()=>aprobarCuenta(showRevision)} disabled={saving||!firmaElrohi}
                className="flex-1 py-2.5 text-white rounded-xl text-sm font-bold disabled:opacity-50"
                style={{background:'#15803d'}}>
                {saving?'Aprobando...':'✅ Aprobar cuenta de cobro'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
