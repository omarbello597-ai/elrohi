import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { addDocument, updateDocument, listenCol } from '../services/db';
import { advanceLotStatus } from '../services/db_timeline';
import { gLabel, fmtM } from '../utils';
import { ACCENT } from '../constants';
import { orderBy } from 'firebase/firestore';
import toast from 'react-hot-toast';

// ── CANVAS FIRMA ──────────────────────────────────────────────────────────────
function FirmaCanvas({ label, onSign, signed }) {
  const canvasRef = useRef(null);
  const drawing   = useRef(false);
  const clear = () => {
    const c = canvasRef.current;
    const ctx = c.getContext('2d');
    ctx.clearRect(0,0,c.width,c.height);
    ctx.fillStyle='#f9f9f7'; ctx.fillRect(0,0,c.width,c.height);
    ctx.strokeStyle='#e5e7eb'; ctx.strokeRect(0,0,c.width,c.height);
  };
  const getPos = (e, c) => {
    const r = c.getBoundingClientRect();
    const touch = e.touches?.[0]||e;
    return { x:(touch.clientX-r.left)*(c.width/r.width), y:(touch.clientY-r.top)*(c.height/r.height) };
  };
  const start = (e) => { e.preventDefault(); drawing.current=true; const c=canvasRef.current; const ctx=c.getContext('2d'); const p=getPos(e,c); ctx.beginPath(); ctx.moveTo(p.x,p.y); };
  const move  = (e) => { e.preventDefault(); if(!drawing.current) return; const c=canvasRef.current; const ctx=c.getContext('2d'); const p=getPos(e,c); ctx.lineTo(p.x,p.y); ctx.strokeStyle='#1a3a6b'; ctx.lineWidth=2; ctx.lineCap='round'; ctx.stroke(); };
  const end   = (e) => { e.preventDefault(); drawing.current=false; onSign(canvasRef.current.toDataURL()); };
  useEffect(() => { const c=canvasRef.current; if(c){const ctx=c.getContext('2d'); ctx.fillStyle='#f9f9f7'; ctx.fillRect(0,0,c.width,c.height); ctx.strokeStyle='#e5e7eb'; ctx.strokeRect(0,0,c.width,c.height);} },[]);
  return (
    <div className="mb-3">
      <p className="text-xs font-semibold text-gray-700 mb-1">{label}</p>
      <div className="relative">
        <canvas ref={canvasRef} width={500} height={120}
          className="border border-gray-200 rounded-xl w-full touch-none"
          style={{background:'#f9f9f7',cursor:'crosshair'}}
          onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
          onTouchStart={start} onTouchMove={move} onTouchEnd={end} />
        <button onClick={clear} className="absolute top-1 right-1 text-[9px] bg-white border border-gray-200 px-2 py-0.5 rounded text-gray-500">Limpiar</button>
        {signed && <span className="absolute bottom-1 right-1 text-[9px] text-green-600 font-bold bg-green-50 px-1.5 py-0.5 rounded">✓ Firmado</span>}
      </div>
    </div>
  );
}

const TIPOS_NOVEDAD = [
  { value: 'faltante_tintoreria', label: 'Faltante Tintorería',     color: '#dc2626', desc: 'Se descuenta del pago a tintorería' },
  { value: 'faltante_satelite',   label: 'Faltante Satélite',       color: '#d97706', desc: 'Se descuenta del pago al satélite' },
  { value: 'entrega_parcial',     label: 'Entrega Parcial',         color: '#2563eb', desc: 'Faltan prendas en proceso — llegará en otra remisión' },
  { value: 'danio',               label: 'Daño / Mancha',           color: '#7c3aed', desc: 'Prenda dañada o manchada' },
];

export default function RecepcionTintoreria() {
  const { profile } = useAuth();
  const { lots, users } = useData();
  const [remisiones, setRemisiones] = useState([]);
  const [recepciones, setRecepciones] = useState([]);
  const [tab, setTab] = useState('pendientes');

  // Modal remisión (tintorería genera entrega)
  const [showRemision, setShowRemision] = useState(null);
  const [conteoEntrega, setConteoEntrega] = useState({});
  const [novedades, setNovedades] = useState([]);
  const [firmaTinto, setFirmaTinto]   = useState(null);
  const [firmaAdmin, setFirmaAdmin]   = useState(null);
  const [saving, setSaving] = useState(false);

  // Modal recepción (admin recibe con semáforo)
  const [showRecepcion, setShowRecepcion] = useState(null);
  const [semaforo, setSemaforo] = useState('verde');
  const [obsAdmin, setObsAdmin] = useState('');

  useEffect(() => {
    const u1 = listenCol('remisionesTinto',   setRemisiones,  orderBy('createdAt','desc'));
    const u2 = listenCol('recepcionesTinto',  setRecepciones, orderBy('createdAt','desc'));
    return () => { u1(); u2(); };
  }, []);

  const isTinto = profile?.role === 'tintoreria';
  const isAdmin = ['gerente','admin_elrohi'].includes(profile?.role);

  // Lotes en tintorería
  const lotesEnTinto = lots.filter(l => l.status === 'tintoreria');
  const remisionesEnviadas = remisiones.filter(r => r.tintoreriaId === profile?.id || isTinto);
  // Remisiones pendientes de recepción por admin
  const remisionesPendientes = remisiones.filter(r => r.status === 'enviada');

  const openRemision = (lot) => {
    const conteo = {};
    lot.garments?.forEach(g => { conteo[g.gtId] = g.total; });
    setConteoEntrega(conteo);
    setNovedades([]);
    setFirmaTinto(null);
    setFirmaAdmin(null);
    setShowRemision(lot);
  };

  const addNovedad = () => setNovedades(prev => [...prev, { tipo:'faltante_tintoreria', gtId:'gt1', qty:0, descripcion:'' }]);
  const updNovedad = (i, key, val) => setNovedades(prev => { const n=[...prev]; n[i]={...n[i],[key]:val}; return n; });
  const removeNovedad = (i) => setNovedades(prev => prev.filter((_,idx)=>idx!==i));

  const totalEntregado = Object.values(conteoEntrega).reduce((a,b)=>a+(+b||0),0);
  const totalNovedad   = novedades.reduce((a,n)=>a+(+n.qty||0),0);

  const generarRemision = async () => {
    if (!firmaTinto) { toast.error('Falta firma de tintorería'); return; }
    setSaving(true);
    try {
      const remData = {
        lotId:        showRemision.id,
        lotCode:      showRemision.code,
        status:       'enviada',
        conteoEntrega,
        totalEntregado,
        novedades,
        totalNovedades: totalNovedad,
        firmaTintoreria: firmaTinto,
        firmaAdmin:      firmaAdmin || null,
        generadoPor:   profile?.name,
        tintoreriaId:  profile?.id,
      };
      await addDocument('remisionesTinto', remData);
      // Avanzar lote a estado especial si hay entrega parcial
      const hayParcial = novedades.some(n=>n.tipo==='entrega_parcial');
      if (!hayParcial) {
        await advanceLotStatus(showRemision.id, 'listo_recepcion_admin', profile?.id, profile?.name);
      }
      toast.success('✅ Remisión generada — esperando recepción de Admin');
      setShowRemision(null);
    } catch(e) { console.error(e); toast.error('Error'); }
    finally { setSaving(false); }
  };

  const recibirLote = async (remision, lot) => {
    setSaving(true);
    try {
      // Registrar recepción
      await addDocument('recepcionesTinto', {
        remisionId:   remision.id,
        lotId:        lot.id,
        lotCode:      lot.code,
        semaforo,
        observaciones: obsAdmin,
        recibidoPor:  profile?.name,
        fechaRecepcion: new Date().toLocaleString('es-CO',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}),
        conteoRecibido: remision.conteoEntrega,
        novedades:    remision.novedades,
        // Detalle completo del lote
        garments:     lot.garments || [],
        totalPieces:  lot.totalPieces || 0,
        deadline:     lot.deadline || '',
        satId:        lot.satId || '',
        satName:      remision.satName || '',
        lotOps:       lot.lotOps || [],
        // Detalle remisión tintorería
        remisionData: {
          conteo:       remision.conteo || [],
          hayFaltantes: remision.hayFaltantes || false,
          esCompleto:   remision.esCompleto || false,
          nota:         remision.nota || '',
          nombreSat:    remision.nombreSat || '',
          nombreTinto:  remision.nombreTinto || '',
          fechaTinto:   remision.fechaTinto || '',
        },
      });
      // Actualizar remisión
      await updateDocument('remisionesTinto', remision.id, {
        status:      'recibida',
        semaforo,
        recibidoPor: profile?.name,
        firmaAdminRecepcion: firmaAdmin,
      });
      // Avanzar estado del corte
      const nuevoStatus = semaforo === 'rojo' ? 'listo_bodega' :
                          semaforo === 'amarillo' ? 'tintoreria' : 'listo_bodega';
      await advanceLotStatus(lot.id, nuevoStatus, profile?.id, profile?.name, {
        semaforo,
        novedadesTinto: remision.novedades,
      });
      toast.success(`✅ Lote recibido con semáforo ${semaforo === 'verde' ? '🟢' : semaforo === 'amarillo' ? '🟡' : '🔴'}`);
      setShowRecepcion(null);
    } catch(e) { console.error(e); toast.error('Error'); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <h1 className="text-sm font-bold text-gray-900 mb-1">Tintorería</h1>
      <p className="text-xs text-gray-400 mb-4">Gestión de entregas y recepciones con tintorería</p>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        {[
          ['pendientes', isTinto ? `📦 Lotes (${lotesEnTinto.length})` : `📦 Por recibir (${remisionesPendientes.length})`],
          ['historial',  isTinto ? `📋 Mis Remisiones (${remisiones.length})` : '📋 Historial'],
        ].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{background:tab===k?'#fff':'transparent',color:tab===k?'#111827':'#6b7280',
              fontWeight:tab===k?700:400,boxShadow:tab===k?'0 1px 3px rgba(0,0,0,0.08)':'none'}}>
            {l}
          </button>
        ))}
      </div>

      {/* TINTORERÍA — ve los cortes que tiene */}
      {tab==='pendientes' && isTinto && (
        <div className="space-y-3">
          {lotesEnTinto.length===0 && (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-100">
              <p className="text-3xl mb-2">🎨</p>
              <p className="font-medium text-gray-700">Sin cortes en tintorería</p>
            </div>
          )}
          {lotesEnTinto.map(lot=>(
            <div key={lot.id} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-bold text-blue-700">{lot.code}</span>
                    <span className="text-[9px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">🎨 En Tintorería</span>
                  </div>
                  <p className="text-xs text-gray-500">{lot.totalPieces?.toLocaleString('es-CO')} piezas</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {lot.garments?.map((g,i)=>(
                      <span key={i} className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                        {g.descripcionRef||gLabel(g.gtId)}: {g.total}
                      </span>
                    );
              })}
                  </div>
                </div>
                <button onClick={()=>openRemision(lot)}
                  className="text-xs font-bold px-3 py-2 rounded-lg text-white flex-shrink-0"
                  style={{background:ACCENT}}>
                  📋 Generar remisión de entrega
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ADMIN — ve remisiones pendientes de recibir */}
      {tab==='pendientes' && isAdmin && (
        <div className="space-y-3">
          {remisionesPendientes.length===0 && (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-100">
              <p className="text-3xl mb-2">📬</p>
              <p className="font-medium text-gray-700">Sin remisiones pendientes</p>
            </div>
          )}
          {remisionesPendientes.map(rem=>{
            const lot = lots.find(l=>l.id===rem.lotId);
            return (
              <div key={rem.id} className="bg-white rounded-xl border-2 border-amber-200 p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-bold text-blue-700">{rem.lotCode}</span>
                      <span className="text-[9px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">⏳ Pendiente recepción</span>
                    </div>
                    <p className="text-xs text-gray-600">Total entregado: <strong>{rem.totalEntregado} piezas</strong></p>
                    {rem.novedades?.length>0 && (
                      <div className="mt-1 space-y-0.5">
                        {rem.novedades.map((n,i)=>{
                          const tipo = TIPOS_NOVEDAD.find(t=>t.value===n.tipo);
                          return (
                            <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full font-bold mr-1"
                              style={{background:`${tipo?.color}20`,color:tipo?.color}}>
                              ⚠ {tipo?.label}: {n.qty} pzas — {n.descripcion}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <button onClick={()=>{setShowRecepcion(rem);setSemaforo('verde');setObsAdmin('');setFirmaAdmin(null);}}
                    className="text-xs font-bold px-3 py-2 rounded-lg text-white flex-shrink-0"
                    style={{background:'#1a3a6b'}}>
                    📥 Recibir con semáforo
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* HISTORIAL */}
      {tab==='historial' && isTinto && (
        <div className="space-y-3">
          {remisiones.length===0 && (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-100">
              <p className="text-3xl mb-2">📋</p>
              <p className="font-medium text-gray-700">Sin remisiones enviadas</p>
            </div>
          )}
          {remisiones.map(r=>(
            <div key={r.id} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono text-xs font-bold text-blue-700">{r.codigoRemision||r.lotCode}</span>
                <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${r.status==='completado'?'bg-green-100 text-green-700':'bg-amber-100 text-amber-700'}`}>
                  {r.status==='completado'?'✅ Recibida por ELROHI':'⏳ En tintorería'}
                </span>
              </div>
              <p className="text-xs text-gray-500">Satélite: {r.satName}</p>
              <p className="text-xs text-gray-400">Piezas: {r.conteo?.reduce((a,g)=>a+(+g.enviado||0),0)||0}</p>
              {r.hayFaltantes && <p className="text-xs text-amber-600 mt-1">⚠ Envío parcial</p>}
            </div>
          ))}
        </div>
      )}
      {tab==='historial' && !isTinto && (
        <div className="space-y-3">
          {recepciones.length===0 && (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-100">
              <p className="text-3xl mb-2">📋</p>
              <p className="font-medium text-gray-700">Sin recepciones registradas</p>
            </div>
          )}
          {recepciones.map(r=>(
            <div key={r.id} className="bg-white rounded-xl border border-gray-100 p-4">
              {/* Header */}
              <div className="flex items-start gap-3 mb-3">
                <span className="text-2xl flex-shrink-0">{r.semaforo==='verde'?'🟢':r.semaforo==='amarillo'?'🟡':'🔴'}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-mono text-xs font-bold text-blue-700">{r.lotCode}</span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${r.semaforo==='verde'?'bg-green-100 text-green-700':r.semaforo==='amarillo'?'bg-amber-100 text-amber-700':'bg-red-100 text-red-700'}`}>
                      {r.semaforo==='verde'?'✓ Completo':r.semaforo==='amarillo'?'⚠ Parcial':'🔴 Novedad'}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400">Recibido por: <strong>{r.recibidoPor}</strong> · {r.fechaRecepcion||''}</p>
                  {r.satName && <p className="text-[10px] text-gray-400">Satélite: <strong>{r.satName}</strong></p>}
                </div>
              </div>

              {/* Prendas del lote */}
              {r.garments?.length>0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Prendas del corte</p>
                  <div className="flex flex-wrap gap-1">
                    {r.garments.map((g,i)=>(
                      <span key={i} className="text-[9px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-full">
                        {g.descripcionRef||gLabel(g.gtId)}: <strong>{g.total}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Conteo recibido */}
              {r.remisionData?.conteo?.length>0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Conteo de entrega tintorería</p>
                  <div className="bg-gray-50 rounded-xl overflow-hidden">
                    {r.remisionData.conteo.map((g,i)=>{
                      const faltante = g.original - g.enviado;
                      return (
                        <div key={i} className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-100 last:border-0 text-xs">
                          <span className="flex-1 text-gray-700">{g.descripcionRef||gLabel(g.gtId)}</span>
                          <span className="text-gray-400">Original: {g.original}</span>
                          <span className="text-gray-400">Enviado: {g.enviado}</span>
                          <span className={`font-bold ${faltante>0?'text-red-600':'text-green-600'}`}>
                            {faltante>0?`-${faltante}`:'✓'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Novedades */}
              {r.novedades?.length>0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider mb-1.5">⚠ Novedades ({r.novedades.length})</p>
                  <div className="space-y-1">
                    {r.novedades.map((n,i)=>(
                      <div key={i} className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-xs">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-bold text-red-700">{n.tipo?.replace(/_/g,' ')}</span>
                          <span className="text-red-600">{n.cantidad} pzas</span>
                        </div>
                        {n.descripcion && <p className="text-red-500 text-[10px]">{n.descripcion}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Observaciones admin */}
              {r.observaciones && (
                <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs text-amber-700">
                  <span className="font-bold">Obs Admin:</span> {r.observaciones}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* MODAL REMISIÓN DE ENTREGA (Tintorería) */}
      {showRemision && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.6)',zIndex:1000,display:'flex',alignItems:'flex-start',justifyContent:'center',padding:16,overflowY:'auto'}}>
          <div style={{background:'#fff',borderRadius:16,padding:24,width:'100%',maxWidth:560,marginTop:16,marginBottom:16}}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-900">Remisión de Entrega — {showRemision.code}</h2>
              <button onClick={()=>setShowRemision(null)} className="text-gray-400 text-xl font-bold bg-transparent border-none cursor-pointer">✕</button>
            </div>

            {/* Conteo de entrega */}
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Conteo de prendas a entregar</p>
            {/* Cabecera */}
            <div className="grid grid-cols-4 gap-1 px-3 py-1.5 bg-gray-100 rounded-lg mb-1">
              <span className="text-[9px] font-bold text-gray-500 col-span-1">Prenda</span>
              <span className="text-[9px] font-bold text-blue-600 text-center">Original ELROHI</span>
              <span className="text-[9px] font-bold text-amber-600 text-center">Enviado satélite</span>
              <span className="text-[9px] font-bold text-green-600 text-center">Entrega tintorería</span>
            </div>
            <div className="space-y-1.5 mb-4">
              {showRemision.garments?.map(g=>{
                const enviado = showRemision.conteo?.find?.(c=>c.gtId===g.gtId)?.enviado ?? g.total;
                return (
                <div key={g.gtId} className="grid grid-cols-4 gap-1 items-center bg-gray-50 rounded-xl px-3 py-2 border border-gray-100">
                  <span className="text-xs font-bold text-gray-700 col-span-1 leading-tight">{g.descripcionRef||gLabel(g.gtId)}</span>
                  <span className="text-sm font-black text-blue-700 text-center">{(g.total||0).toLocaleString('es-CO')}</span>
                  <span className="text-sm font-black text-amber-700 text-center">{(enviado||0).toLocaleString('es-CO')}</span>
                  <input type="number" min={0}
                    value={conteoEntrega[g.gtId]||0}
                    onChange={e=>setConteoEntrega(prev=>({...prev,[g.gtId]:+e.target.value}))}
                    className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-xs text-center focus:outline-none focus:border-orange-400" />
                </div>
                );
              })}
              <div className="flex justify-between text-xs font-bold px-3 py-2 bg-blue-50 rounded-xl">
                <span className="text-blue-700">Total a entregar</span>
                <span className="text-blue-800">{totalEntregado} piezas</span>
              </div>
            </div>

            {/* Novedades */}
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Novedades</p>
              <button onClick={addNovedad} className="text-xs text-orange-600 font-medium hover:underline">+ Agregar novedad</button>
            </div>
            {novedades.length===0 && (
              <p className="text-[10px] text-gray-400 mb-3 italic">Sin novedades — entrega completa</p>
            )}
            {novedades.map((n,i)=>{
              const tipo = TIPOS_NOVEDAD.find(t=>t.value===n.tipo);
              return (
                <div key={i} className="bg-gray-50 rounded-xl p-3 mb-2 border border-gray-100">
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 mb-1">Tipo de novedad</label>
                      <select value={n.tipo} onChange={e=>updNovedad(i,'tipo',e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none">
                        {TIPOS_NOVEDAD.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 mb-1">Cantidad</label>
                      <input type="number" min={0} value={n.qty}
                        onChange={e=>updNovedad(i,'qty',+e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none" />
                    </div>
                  </div>
                  {tipo && (
                    <p className="text-[9px] mb-2 px-2 py-1 rounded-lg font-medium"
                      style={{background:`${tipo.color}15`,color:tipo.color}}>
                      ℹ {tipo.desc}
                    </p>
                  )}
                  <input value={n.descripcion} onChange={e=>updNovedad(i,'descripcion',e.target.value)}
                    placeholder="Descripción de la novedad..."
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none mb-1" />
                  <button onClick={()=>removeNovedad(i)} className="text-[10px] text-red-500 hover:underline">✕ Quitar</button>
                </div>
              );
            })}

            {/* Firmas */}
            <div className="mt-4">
              <FirmaCanvas label="✍ Firma Tintorería *" onSign={setFirmaTinto} signed={!!firmaTinto} />
              <FirmaCanvas label="✍ Firma Admin ELROHI (opcional — puede firmar al recibir)" onSign={setFirmaAdmin} signed={!!firmaAdmin} />
            </div>

            <div className="flex gap-2 mt-2">
              <button onClick={()=>setShowRemision(null)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium">Cancelar</button>
              <button onClick={generarRemision} disabled={saving||!firmaTinto}
                className="flex-1 py-2.5 text-white rounded-xl text-sm font-bold disabled:opacity-50"
                style={{background:ACCENT}}>
                {saving?'Generando...':'📋 Generar remisión'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RECEPCIÓN (Admin) */}
      {showRecepcion && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.6)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:'#fff',borderRadius:16,padding:24,width:'100%',maxWidth:480}}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-900">Recepción — {showRecepcion.lotCode}</h2>
              <button onClick={()=>setShowRecepcion(null)} className="text-gray-400 text-xl font-bold bg-transparent border-none cursor-pointer">✕</button>
            </div>

            {/* Resumen remisión */}
            <div className="bg-gray-50 rounded-xl p-3 mb-4">
              <p className="text-xs font-bold text-gray-700 mb-1">Resumen remisión tintorería:</p>
              <p className="text-xs text-gray-600">Total entregado: <strong>{showRecepcion.totalEntregado} piezas</strong></p>
              {showRecepcion.novedades?.length>0 && (
                <div className="mt-2 space-y-1">
                  {showRecepcion.novedades.map((n,i)=>{
                    const tipo=TIPOS_NOVEDAD.find(t=>t.value===n.tipo);
                    return (
                      <div key={i} className="text-[10px] px-2 py-1 rounded-lg font-medium"
                        style={{background:`${tipo?.color}15`,color:tipo?.color}}>
                        ⚠ {tipo?.label}: {n.qty} pzas — {n.descripcion}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Semáforo */}
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Semáforo de recepción</p>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[
                { val:'verde',    emoji:'🟢', label:'Completo',   desc:'Todo en orden',           color:'#15803d' },
                { val:'amarillo', emoji:'🟡', label:'Parcial',    desc:'Faltan prendas en proceso',color:'#d97706' },
                { val:'rojo',     emoji:'🔴', label:'Novedad',    desc:'Faltantes o daños',        color:'#dc2626' },
              ].map(s=>(
                <button key={s.val} onClick={()=>setSemaforo(s.val)}
                  className="p-3 rounded-xl border-2 text-center transition-all"
                  style={{borderColor:semaforo===s.val?s.color:'#e5e7eb',background:semaforo===s.val?`${s.color}10`:'#fff'}}>
                  <p className="text-2xl mb-1">{s.emoji}</p>
                  <p className="text-xs font-bold" style={{color:s.color}}>{s.label}</p>
                  <p className="text-[9px] text-gray-400 mt-0.5">{s.desc}</p>
                </button>
              ))}
            </div>

            <div className="mb-3">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Observaciones</label>
              <textarea value={obsAdmin} onChange={e=>setObsAdmin(e.target.value)}
                placeholder="Notas adicionales de recepción..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none h-14 focus:outline-none" />
            </div>

            <FirmaCanvas label="✍ Firma Admin ELROHI *" onSign={setFirmaAdmin} signed={!!firmaAdmin} />

            <div className="flex gap-2">
              <button onClick={()=>setShowRecepcion(null)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium">Cancelar</button>
              <button onClick={()=>{
                const lot=lots.find(l=>l.id===showRecepcion.lotId);
                if(lot) recibirLote(showRecepcion, lot);
              }} disabled={saving||!firmaAdmin}
                className="flex-1 py-2.5 text-white rounded-xl text-sm font-bold disabled:opacity-50"
                style={{background:'#1a3a6b'}}>
                {saving?'Recibiendo...':'✅ Confirmar recepción'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
