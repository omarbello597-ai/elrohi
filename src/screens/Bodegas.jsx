import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { updateDocument } from '../services/db';
import { advanceLotStatus } from '../services/db_timeline';
import { gLabel, fmtM } from '../utils';
import { GARMENT_TYPES, SIZES, ACCENT } from '../constants';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const BODEGAS_DEF = [
  {
    id:    'bodega_lonas',
    label: 'Bodega Lonas',
    desc:  'Inventario disponible para despacho a clientes',
    icon:  '📦',
    color: '#2563eb',
    statuses: ['bodega_lonas'],
  },
  {
    id:    'bodega_calidad',
    label: 'Bodega Control de Calidad',
    desc:  'Lotes en operaciones internas y revisión antes de pasar a Lonas',
    icon:  '🔍',
    color: '#7c3aed',
    statuses: ['bodega_calidad', 'en_operaciones_elrohi', 'en_revision_calidad'],
  },
];

const OPS_INTERNAS = [
  { id: 'pegar_boton',   name: 'Pegar botón',     val: 200 },
  { id: 'quitar_hebras', name: 'Quitar hebras',    val: 150 },
  { id: 'doblar',        name: 'Doblar',           val: 100 },
  { id: 'empacar',       name: 'Empacar',          val: 200 },
  { id: 'revisar',       name: 'Revisión calidad', val: 150 },
  { id: 'planchar',      name: 'Planchar',         val: 250 },
  { id: 'etiquetar',     name: 'Etiquetar',        val: 150 },
  { id: 'pegar_talla',   name: 'Pegar talla',      val: 100 },
];

const statusLabel = (s) => ({
  bodega_lonas:          { label:'Bodega Lonas',           cls:'bg-blue-100 text-blue-700'    },
  bodega_calidad:        { label:'Bodega Control Calidad', cls:'bg-purple-100 text-purple-700' },
  en_operaciones_elrohi: { label:'Operaciones ELROHI',     cls:'bg-orange-100 text-orange-700' },
  en_revision_calidad:   { label:'En Revisión Calidad',    cls:'bg-pink-100 text-pink-700'    },
}[s] || { label: s, cls: 'bg-gray-100 text-gray-600' });

export default function BodegasScreen() {
  const { profile }     = useAuth();
  const { lots, users } = useData();
  const [vista, setVista]       = useState('inicio'); // 'inicio' | 'bodega_lonas' | 'bodega_calidad'
  const [selLot, setSelLot]     = useState(null);
  const [tab, setTab]           = useState('bodega');
  const [bodegaDest, setBodegaDest] = useState('bodega_lonas');
  const [cantBodega, setCantBodega] = useState({});
  const [cantOps,    setCantOps]    = useState({});
  const [opsConOp,   setOpsConOp]   = useState([]);
  const [customOp,   setCustomOp]   = useState({ name:'', val:'' });
  const [saving,     setSaving]     = useState(false);
  const navigate = useNavigate();

  const isAdmin = ['gerente','admin_elrohi'].includes(profile?.role);

  const listoBodega = lots.filter(l => l.status === 'listo_bodega');

  const lotesEnBodega = (bodegaId) => {
    const b = BODEGAS_DEF.find(x => x.id === bodegaId);
    return lots.filter(l => b?.statuses.includes(l.status));
  };

  // Inventario Bodega Lonas agrupado por prenda+talla
  const inventarioLonas = {};
  lots.filter(l => l.status === 'bodega_lonas').forEach(lot => {
    (lot.garments||[]).forEach(g => {
      if (!inventarioLonas[g.gtId]) inventarioLonas[g.gtId] = { gtId:g.gtId, sizes:{}, total:0 };
      Object.entries(g.sizes||{}).forEach(([sz,qty]) => {
        inventarioLonas[g.gtId].sizes[sz] = (inventarioLonas[g.gtId].sizes[sz]||0) + (+qty||0);
      });
      inventarioLonas[g.gtId].total += g.total||0;
    });
  });

  const openLot = (lot) => {
    setSelLot(lot);
    setTab('bodega');
    setBodegaDest('bodega_lonas');
    const initB={}; const initO={};
    lot.garments?.forEach(g => { initB[g.gtId]=g.total; initO[g.gtId]=0; });
    setCantBodega(initB); setCantOps(initO); setOpsConOp([]);
  };

  const totalBodega = Object.values(cantBodega).reduce((a,b)=>a+(+b||0),0);
  const totalOps    = Object.values(cantOps).reduce((a,b)=>a+(+b||0),0);

  const updCantBodega = (gtId, val) => {
    const g = selLot.garments?.find(x=>x.gtId===gtId);
    const vB = Math.min(+val||0, g?.total||0);
    setCantBodega(f=>({...f,[gtId]:vB}));
    setCantOps(f=>({...f,[gtId]:(g?.total||0)-vB}));
  };

  const toggleOp = (opId) => {
    setOpsConOp(prev => {
      const exists = prev.find(o=>o.opId===opId);
      if (exists) return prev.filter(o=>o.opId!==opId);
      const op = OPS_INTERNAS.find(o=>o.id===opId);
      return [...prev, { opId, name:op?.name||opId, val:op?.val||0, operarioId:'', operarioName:'' }];
    });
  };

  const setOperario = (opId, operarioId) => {
    const worker = users.find(u=>u.id===operarioId);
    setOpsConOp(prev=>prev.map(o=>o.opId===opId?{...o,operarioId,operarioName:worker?.name||''}:o));
  };

  const operariosElrohi = users.filter(u =>
    ['corte','bodega_op','terminacion'].includes(u.role) && u.active!==false && !u.satId
  );

  const asignar = async (tipo) => {
    if (!selLot) return;
    if (tipo !== 'bodega' && opsConOp.length===0) { toast.error('Selecciona al menos una operación'); return; }
    if (tipo !== 'bodega' && opsConOp.some(o=>!o.operarioId)) { toast.error('Asigna un operario a cada operación'); return; }
    setSaving(true);
    try {
      const opsElrohi = opsConOp.map(o=>({
        id:`oe_${selLot.id}_${o.opId}`,
        opId:o.opId, name:o.name, val:o.val,
        qty: tipo==='parcial' ? totalOps : selLot.totalPieces,
        status:'pendiente', wId:o.operarioId, workerName:o.operarioName, assignments:[],
      }));
      const newStatus = tipo==='bodega' ? bodegaDest : 'en_operaciones_elrohi';
      await advanceLotStatus(selLot.id, newStatus, profile?.id, profile?.name, {
        ...(tipo!=='bodega' ? { opsElrohi } : {}),
        ...(tipo==='parcial' ? { bodegaSecundaria:bodegaDest, cantidadesBodega:cantBodega, cantidadesOps:cantOps, esParcial:true } : {}),
        ...(tipo==='bodega'  ? { cantidadesBodega:cantBodega } : {}),
        bodega: newStatus,
      });
      toast.success('✅ Lote asignado correctamente');
      setSelLot(null);
    } catch(e) { console.error(e); toast.error('Error'); }
    finally { setSaving(false); }
  };

  // ── INICIO — dos bodegas como tarjetas ───────────────────────────────────────
  if (vista === 'inicio') {
    return (
      <div>
        <h1 className="text-sm font-bold text-gray-900 mb-4">Bodegas</h1>

        {/* Lotes listos para asignar */}
        {listoBodega.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{listoBodega.length}</span>
              Lotes listos para asignar a bodega
            </p>
            <div className="space-y-2">
              {listoBodega.map(lot => (
                <div key={lot.id} className="bg-white rounded-xl border-2 border-amber-200 p-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs font-bold text-blue-700">{lot.code}</span>
                        <span className="text-[9px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">⏳ Pendiente asignación</span>
                      </div>
                      <p className="text-xs text-gray-500">{lot.totalPieces?.toLocaleString('es-CO')} piezas · Vence: {lot.deadline}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {lot.garments?.map((g,i)=>(
                          <span key={i} className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{gLabel(g.gtId)}: {g.total}</span>
                        ))}
                      </div>
                    </div>
                    {isAdmin && (
                      <button onClick={()=>openLot(lot)}
                        className="text-xs font-bold px-4 py-2 rounded-lg text-white flex-shrink-0"
                        style={{background:ACCENT}}>
                        📦 Asignar destino
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tarjetas de bodegas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {BODEGAS_DEF.map(b => {
            const lotes = lotesEnBodega(b.id);
            const totalPzas = lotes.reduce((a,l)=>a+(l.totalPieces||0),0);
            return (
              <button key={b.id} onClick={()=> b.id === 'bodega_lonas' ? navigate('/bodega-lonas') : setVista(b.id)}
                className="bg-white rounded-xl border-2 p-5 text-left hover:shadow-md transition-all"
                style={{borderColor:`${b.color}40`}}>
                <div className="flex items-start justify-between mb-3">
                  <div className="text-3xl">{b.icon}</div>
                  <span className="text-2xl font-black" style={{color:b.color}}>{lotes.length}</span>
                </div>
                <p className="text-sm font-bold text-gray-900 mb-1">{b.label}</p>
                <p className="text-[10px] text-gray-400 mb-3">{b.desc}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-500">{totalPzas.toLocaleString('es-CO')} piezas</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{background:b.color}}>
                    Ver bodega →
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── BODEGA LONAS ────────────────────────────────────────────────────────────
  if (vista === 'bodega_lonas') {
    return (
      <div>
        <button onClick={()=>setVista('inicio')} className="text-xs text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1">← Bodegas</button>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">📦</span>
          <div>
            <h1 className="text-sm font-bold text-gray-900">Bodega Lonas</h1>
            <p className="text-xs text-gray-400">Inventario disponible para despacho a clientes</p>
          </div>
        </div>

        {Object.keys(inventarioLonas).length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-100">
            <p className="text-4xl mb-3">📦</p>
            <p className="font-medium text-gray-700">Bodega vacía</p>
            <p className="text-sm text-gray-400 mt-1">Los lotes aprobados por calidad aparecerán aquí</p>
          </div>
        )}

        {Object.values(inventarioLonas).map(g => (
          <div key={g.gtId} className="bg-white rounded-xl border border-gray-100 p-4 mb-3">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-gray-900">{gLabel(g.gtId)}</p>
              <div className="text-right">
                <p className="text-xl font-black text-blue-700">{g.total.toLocaleString('es-CO')}</p>
                <p className="text-[10px] text-gray-400">piezas disponibles</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50">
                    {SIZES.map(s=><th key={s} className="px-3 py-1.5 text-center text-gray-500 font-medium border border-gray-100 w-16">{s}</th>)}
                    <th className="px-3 py-1.5 text-center text-gray-700 font-bold border border-gray-100">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {SIZES.map(s=>{
                      const qty = g.sizes[s]||0;
                      return <td key={s} className="px-3 py-2 text-center border border-gray-100 font-semibold"
                        style={{color:qty>0?'#1a3a6b':'#d1d5db'}}>{qty>0?qty:'—'}</td>;
                    })}
                    <td className="px-3 py-2 text-center font-black text-gray-900 border border-gray-100 bg-gray-50">{g.total}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── BODEGA CONTROL CALIDAD ──────────────────────────────────────────────────
  if (vista === 'bodega_calidad') {
    const lotesCalidad = lotesEnBodega('bodega_calidad');
    return (
      <div>
        <button onClick={()=>setVista('inicio')} className="text-xs text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1">← Bodegas</button>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">🔍</span>
          <div>
            <h1 className="text-sm font-bold text-gray-900">Bodega Control de Calidad</h1>
            <p className="text-xs text-gray-400">Operaciones internas y revisión antes de pasar a Bodega Lonas</p>
          </div>
        </div>

        {lotesCalidad.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-100">
            <p className="text-4xl mb-3">🔍</p>
            <p className="font-medium text-gray-700">Sin lotes en esta bodega</p>
          </div>
        )}

        <div className="space-y-3">
          {lotesCalidad.map(lot => {
            const st   = statusLabel(lot.status);
            const ops  = lot.opsElrohi || [];
            const done = ops.filter(o=>o.status==='completado').length;
            const prog = ops.length>0 ? Math.round(done/ops.length*100) : 0;
            return (
              <div key={lot.id} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono text-xs font-bold text-blue-700">{lot.code}</span>
                      <span className={`${st.cls} text-[9px] px-2 py-0.5 rounded-full font-bold`}>{st.label}</span>
                    </div>
                    <p className="text-xs text-gray-500">{lot.totalPieces?.toLocaleString('es-CO')} piezas</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {lot.garments?.map((g,i)=>(
                        <span key={i} className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{gLabel(g.gtId)}: {g.total}</span>
                      ))}
                    </div>
                  </div>
                  {ops.length > 0 && (
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-black" style={{color:prog===100?'#15803d':'#7c3aed'}}>{prog}%</p>
                      <p className="text-[9px] text-gray-400">{done}/{ops.length} ops</p>
                    </div>
                  )}
                </div>
                {ops.length > 0 && (
                  <>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
                      <div className="h-full rounded-full" style={{width:`${prog}%`,background:prog===100?'#10b981':'#7c3aed'}} />
                    </div>
                    <div className="space-y-3">
                      {ops.map((op,i)=>{
                        const worker = users.find(u=>u.id===op.wId);
                        return (
                          <div key={i} className="border rounded-xl p-3"
                            style={{borderColor:op.status==='completado'?'#86efac':'#fed7aa',background:op.status==='completado'?'#f0fdf4':'#fff8f4'}}>
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${op.status==='completado'?'bg-green-500':'bg-orange-400'}`} />
                              <span className="flex-1 text-xs font-bold text-gray-800">{op.name}</span>
                              <span className="text-[10px] text-gray-400">{op.qty?.toLocaleString('es-CO')} pzas</span>
                              <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${op.status==='completado'?'bg-green-100 text-green-700':'bg-orange-100 text-orange-700'}`}>
                                {op.status==='completado'?'✓ Listo':'Pendiente'}
                              </span>
                            </div>
                            {/* Selector de operario — visible siempre para admin si no está completado */}
                            {op.status !== 'completado' && (
                              <div className="bg-white rounded-lg border border-orange-200 p-2 mt-1">
                                <p className="text-[10px] font-bold text-orange-700 mb-1.5">
                                  👤 {op.wId ? `Asignado: ${worker?.name||'Cargando...'}` : '⚠ Sin operario — asigna uno:'}
                                </p>
                                <select
                                  value={op.wId||''}
                                  onChange={async(e)=>{
                                    const operarioId = e.target.value;
                                    if (!operarioId) return;
                                    const w = users.find(u=>u.id===operarioId);
                                    const opsElrohi = (lot.opsElrohi||[]).map(o=>
                                      o.id===op.id ? {...o,wId:operarioId,workerName:w?.name||''} : o
                                    );
                                    try {
                                      await updateDocument('lots', lot.id, {opsElrohi});
                                      toast.success(`✅ Asignado a ${w?.name}`);
                                    } catch { toast.error('Error'); }
                                  }}
                                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-orange-400">
                                  <option value="">— Seleccionar operario —</option>
                                  {users.filter(u=>
                                  !u.satId &&
                                  u.active!==false &&
                                  ['corte','bodega_op','terminacion','pespunte','operario','despachos'].includes(u.role)
                                  ).map(w=>(
                                    <option key={w.id} value={w.id}>{w.name} ({w.role})</option>
                                  ))}
                                </select>
                              </div>
                            )}
                            {op.status !== 'completado' && op.wId && (
                              <button
                                onClick={async()=>{
                                  const opsElrohi = (lot.opsElrohi||[]).map(o=>
                                    o.id===op.id ? {...o,status:'completado',doneAt:new Date().toISOString()} : o
                                  );
                                  const allDone = opsElrohi.every(o=>o.status==='completado');
                                  try {
                                    if (allDone) {
                                      await advanceLotStatus(lot.id,'en_revision_calidad',profile?.id,profile?.name,{opsElrohi});
                                      toast.success('✅ Operaciones completas — en revisión de calidad');
                                    } else {
                                      await updateDocument('lots',lot.id,{opsElrohi});
                                      toast.success('Operación completada');
                                    }
                                  } catch { toast.error('Error'); }
                                }}
                                className="mt-2 w-full py-1.5 text-white text-xs font-bold rounded-lg"
                                style={{background:'#15803d'}}>
                                ✓ Marcar como completada
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
                {lot.status==='en_revision_calidad' && (
                  <div className="mt-3 flex gap-2">
                    <button onClick={async()=>{
                      try {
                        await advanceLotStatus(lot.id,'bodega_lonas',profile?.id,profile?.name);
                        toast.success('✅ Aprobado — pasa a Bodega Lonas');
                      } catch { toast.error('Error'); }
                    }}
                      className="flex-1 py-2 text-white rounded-lg text-xs font-bold"
                      style={{background:'#15803d'}}>
                      ✓ Aprobar calidad → Bodega Lonas
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return null;

  // ── MODAL ASIGNAR ───────────────────────────────────────────────────────────
  // (El modal se renderiza sobre cualquier vista)
}
